/**
 * SuiService
 * -------------------------------------------------------
 * 封装：
 * 1. Sui 链上基础余额 / 转账 / 单位换算
 * 2. Navi 协议池子、账户借贷信息查询
 * 3. 动态 coinInfo 维护（当发现新池子 symbol 自动补充）
 * 4. 池子列表本地缓存（内存 + localStorage + 5 分钟 TTL + 并发合并）
 *
 * 设计要点：
 * - 避免重复网络请求：用 poolFetchPromise 合并并发
 * - 刷新页面后尽快可用：localStorage 预热 + mergeCoinsFromPools
 * - 当 symbol 未出现在 coinInfo 中时，会触发一次池子刷新尝试补全
 * - 兼容非浏览器（Node / SSR）环境：所有 localStorage 操作前做 isBrowser() 检查
 */
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions';
// 不再使用静态 coinInfo，所有 coinType / decimals 均通过池子信息动态获取
import { getPools, getPool, depositCoinPTB, getLendingState, withdrawCoinPTB, borrowCoinPTB, repayCoinPTB } from '@naviprotocol/lending';

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet';

export type NaviPoolSimpleInfo = {
	id: number;
	symbol: string;
	borrowAPY: string;
	supplyAPY: string;
	price: string;
};
export type NaviPoolInfo = {
	id: number;
	symbol: string;
	coinType: string;
	borrowAPY: number;
	borrowAPR: number;
	supplyAPY: number;
	supplyAPR: number;
	price: string;
}

type WithdrawRawParams = {
	coinType: string;
	amount: string | number | bigint;
	withdrawAddress: string;
	accountCapId?: string;
	signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>;
	chain?: string;
};

type WithdrawParams = {
	withdrawAddress: string;
	withdrawId: number;
	withdrawSymbol: string;
	withdrawAmount: number;
	withdrawUnit: string;
	accountCapId?: string;
	signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>;
	chain?: string;
	portfolioSnapshot?: any;
	/** 可选 coinType 提示，与其他流程保持一致时可忽略，默认基于池子解析 */
	coinTypeHint?: string;
};

class SuiService {
	private readonly defaultNetwork: SuiNetwork;
	private readonly client: SuiClient;
	// ------- 池子缓存相关 (内存 + localStorage) -------
	/** localStorage key（如需按网络区分，可在后续版本拼接 env） */
	private static readonly POOL_CACHE_KEY = 'navi_pools_cache_v1';
	/** 池子缓存默认有效期：5 分钟 */
	private static readonly POOL_TTL_MS = 5 * 60 * 1000; // 5 分钟
	/** 内存缓存：最近一次成功获取的池子 + 时间戳 */
	private poolCache: { updatedAt: number; pools: any[] } = { updatedAt: 0, pools: [] };
	/** 当前正在进行的池子请求 Promise；用于合并并发，防止短时间内多次重复请求 */
	private poolFetchPromise?: Promise<any[]>;
	/** 背景预热 Promise，防止多处重复触发 */
	private warmPromise?: Promise<void>;
	/** 自动刷新 interval id */
	private autoRefreshId?: any;

	constructor(defaultNetwork: SuiNetwork = 'devnet') {
		this.defaultNetwork = defaultNetwork;
		this.client = new SuiClient({ url: getFullnodeUrl(this.defaultNetwork) });
		// 页面初始化时尝试从 localStorage 预热缓存（如果存在）
		this.loadPoolCacheFromStorage();
	}

	/** 判断当前是否运行在浏览器（而不是 Node / SSR） */
	private isBrowser(): boolean {
		return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
	}

	/**
	 * 从 localStorage 读取池子缓存；如果结构合法：
	 * - 回填到内存 poolCache
	 * - 并把其中的 token 信息 merge 到 coinInfo（即便数据可能过期，至少能让 symbol -> coinType / decimals 即时可用）
	 */
	private loadPoolCacheFromStorage() {
		if (!this.isBrowser()) return;
		try {
			const raw = window.localStorage.getItem(SuiService.POOL_CACHE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (parsed && Array.isArray(parsed.pools) && typeof parsed.updatedAt === 'number') {
				this.poolCache = parsed;
				// 动态 coinInfo 逻辑已移除：此处不再合并 symbol
			}
		} catch (e) {
			console.warn('加载本地池子缓存失败:', e);
		}
	}

	/**
	 * 获取指定 symbol 的池对象（不区分大小写）。必要时触发刷新。
	 * @param symbol 资产符号
	 */
	private async getPoolBySymbol(symbol: string, forceRefresh = false): Promise<any | undefined> {
		if (!symbol) return undefined;
		const upper = symbol.toUpperCase();
		if (forceRefresh || !this.isPoolCacheValid()) await this.fetchAndUpdatePools();
		let hit = this.poolCache.pools.find(p => p?.token?.symbol?.toUpperCase() === upper);
		if (!hit) { // 再给一次强制刷新机会
			await this.fetchAndUpdatePools();
			hit = this.poolCache.pools.find(p => p?.token?.symbol?.toUpperCase() === upper);
		}
		return hit;
	}

	/** 通过 symbol 获取 coinType / decimals 元信息（SUI 特殊处理） */
	private async getCoinMetaDynamic(symbol: string): Promise<{ coinType: string; decimals: number }> {
		const upper = symbol.toUpperCase();
		if (upper === 'SUI') {
			return { coinType: '0x2::sui::SUI', decimals: 9 };
		}
		const pool = await this.getPoolBySymbol(upper);
		if (!pool) throw new Error(`未知币种: ${upper}`);
		// 优先使用 token.coinType（带 0x 前缀）；若缺失再回退顶层 coinType，并补齐 0x
		let coinType: string | undefined = pool.token?.coinType || pool.coinType;
		if (coinType && !coinType.startsWith('0x')) {
			coinType = '0x' + coinType;
		}
		const decimals = pool.token?.decimals;
		if (!coinType || typeof decimals !== 'number') throw new Error(`缺少币种元数据: ${upper}`);
		return { coinType, decimals };
	}

	/** 标准化 coinType，允许传入无 0x 前缀的写法 */
	private normalizeCoinType(raw: string): string {
		if (!raw || typeof raw !== 'string') throw new Error('必须指定有效的币种类型');
		const trimmed = raw.trim();
		if (!trimmed) throw new Error('必须指定有效的币种类型');
		return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
	}

	private parseBigIntAmount(value: string | number | bigint, context: string): bigint {
		if (typeof value === 'bigint') {
			if (value <= 0n) throw new Error(`${context}金额必须大于 0`);
			return value;
		}
		if (typeof value === 'number') {
			if (!Number.isFinite(value) || value <= 0) throw new Error(`${context}金额必须大于 0`);
			return BigInt(Math.round(value));
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) throw new Error(`${context}金额格式无效`);
			if (!/^[0-9]+$/.test(trimmed)) throw new Error(`${context}金额格式无效`);
			const parsed = BigInt(trimmed);
			if (parsed <= 0n) throw new Error(`${context}金额必须大于 0`);
			return parsed;
		}
		throw new Error(`${context}金额格式无效`);
	}

	private extractSupplyBalanceMist(portfolioSnapshot: any, symbol: string): { found: boolean; balance: bigint } | undefined {
		if (!portfolioSnapshot) return undefined;
		const list = Array.isArray(portfolioSnapshot) ? portfolioSnapshot : Array.isArray(portfolioSnapshot?.data) ? portfolioSnapshot.data : undefined;
		if (!Array.isArray(list)) return undefined;
		const upper = symbol.toUpperCase();
		for (const item of list) {
			const poolSymbol = item?.pool?.token?.symbol || item?.pool?.tokenSymbol || item?.token?.symbol;
			if (typeof poolSymbol !== 'string' || poolSymbol.toUpperCase() !== upper) continue;
			const raw = item?.supplyBalance ?? item?.supply_balance ?? item?.depositBalance ?? item?.deposit_balance ?? item?.balance;
			if (raw === undefined || raw === null) {
				return { found: true, balance: 0n };
			}
			try {
				if (typeof raw === 'string') {
					const trimmed = raw.trim();
					if (!trimmed) return { found: true, balance: 0n };
					return { found: true, balance: BigInt(trimmed) };
				}
				if (typeof raw === 'number') {
					if (!Number.isFinite(raw)) return { found: true, balance: 0n };
					const normalized = Math.floor(raw);
					return { found: true, balance: normalized > 0 ? BigInt(normalized) : 0n };
				}
				if (typeof raw === 'bigint') {
					return { found: true, balance: raw > 0n ? raw : 0n };
				}
			} catch (error) {
				return { found: true, balance: 0n };
			}
			return { found: true, balance: 0n };
		}
		return { found: false, balance: 0n };
	}

	private async getSupplyBalanceMist(address: string, symbol: string, portfolioSnapshot?: any): Promise<bigint> {
		const snapshotResult = this.extractSupplyBalanceMist(portfolioSnapshot, symbol);
		if (snapshotResult) {
			if (snapshotResult.found) {
				return snapshotResult.balance;
			}
		}
		const latest = await this.getNaviLendingState(address);
		const latestResult = this.extractSupplyBalanceMist(latest, symbol);
		if (latestResult && latestResult.found) {
			return latestResult.balance;
		}
		return 0n;
	}

	/**
	 * 根据 id / symbol 拉取池子并做一致性校验。
	 * 复用在存款与借款逻辑中，避免分支不一致。
	 */
	private async resolvePoolOrThrow(params: { id: number; symbol: string; context: 'deposit' | 'borrow' | 'repay' | 'withdraw' }): Promise<{ poolInfo: any; symbol: string }> {
		const { id, symbol, context } = params;
		const hasId = typeof id === 'number' && id !== -1;
		const hasSymbol = !!symbol && symbol !== 'UNKNOWN';
		if (!hasId && !hasSymbol) {
			let action = '操作';
			if (context === 'deposit') action = '质押';
			else if (context === 'borrow') action = '借款';
			else if (context === 'repay') action = '还款';
			else if (context === 'withdraw') action = '提现';
			throw new Error(`必须指定${action}池子 id 或币种符号`);
		}

		let poolInfo: any = null;
		if (hasId) {
			poolInfo = await this.getNaviPool(id);
		}
		if (!poolInfo && hasSymbol) {
			poolInfo = await this.getNaviPool(symbol);
		}
		if (!poolInfo) {
			throw new Error('未找到有效的池子信息');
		}

		const resolvedSymbol = poolInfo.token?.symbol?.toUpperCase() || 'UNKNOWN';
		if (hasSymbol && resolvedSymbol !== symbol.toUpperCase()) {
			throw new Error('提供的币种符号与池子信息不匹配');
		}
		return { poolInfo, symbol: resolvedSymbol };
	}

	private ensureNumberAmount(value: number, errorMessage: string): void {
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(errorMessage);
		}
	}

	/**
	 * 将“人类可读”数量转换为最小单位，带有安全检查。
	 */
	private toMistWithCheck(amount: number, decimals: number, context: string): bigint {
		const scaled = amount * 10 ** decimals;
		if (!Number.isFinite(scaled) || scaled <= 0) {
			throw new Error(`${context}金额必须大于 0`);
		}
		if (Math.round(scaled) > Number.MAX_SAFE_INTEGER) {
			throw new Error(`${context}金额过大，暂不支持超过 MAX_SAFE_INTEGER 的交易`);
		}
		return BigInt(Math.round(scaled));
	}

	/**
	 * 统一的金额换算方法：支持币种 / USD / 百分比三种写法。
	 */
	private async calculateAmountWithUnit(params: { address: string; coin: string; amount: number; unit?: string; context: string; percentBaseMist?: bigint | (() => Promise<bigint>) }): Promise<bigint> {
		const { address, coin, amount, context, percentBaseMist } = params;
		let { unit } = params;
		this.assertAddress(address);
		this.ensureNumberAmount(amount, `${context}金额必须大于 0`);
		const symbol = coin.toUpperCase();
		unit = (unit || symbol).toUpperCase();
		const { decimals } = await this.getCoinMetaDynamic(symbol);
		if (unit === symbol) {
			return this.toMistWithCheck(amount, decimals, context);
		}
		if (unit === 'USD') {
			const pool = await this.getPoolBySymbol(symbol);
			if (!pool) {
				throw new Error(`无法获取币种价格，暂不支持按美元金额${context}`);
			}
			const price = Number(pool.oracle?.price);
			if (!Number.isFinite(price) || price <= 0) {
				throw new Error(`无法获取币种价格，暂不支持按美元金额${context}`);
			}
			const amountHuman = amount / price;
			return this.toMistWithCheck(amountHuman, decimals, context);
		}
		if (unit === 'PERCENT' || unit === '%') {
			if (amount > 100) {
				throw new Error(`${context}百分比需在 0-100 范围内`);
			}
			let baseMist: bigint;
			if (typeof percentBaseMist === 'function') {
				baseMist = await percentBaseMist();
			} else if (typeof percentBaseMist === 'bigint') {
				baseMist = percentBaseMist;
			} else {
				const balanceMistStr = await this.getCoinBalance(address, symbol);
				baseMist = BigInt(balanceMistStr || '0');
			}
			const baseLabel = typeof percentBaseMist !== 'undefined' ? '借款余额' : '余额';
			if (baseMist <= 0n) {
				const referenceLabel = typeof percentBaseMist !== 'undefined' ? '借款余额' : '账户余额';
				throw new Error(`${referenceLabel}为 0，无法按百分比${context}`);
			}
			const scale = 10000n;
			const scaledPercent = BigInt(Math.floor(amount * Number(scale)));
			const amountMist = (baseMist * scaledPercent) / (scale * 100n);
			if (amountMist <= 0n) {
				throw new Error(`按百分比计算得到的${context}金额过小，请提高百分比`);
			}
			if (amountMist > baseMist) {
				throw new Error(`按百分比计算的${context}金额超过${baseLabel}`);
			}
			return amountMist;
		}
		throw new Error(`暂不支持的${context}金额单位，请使用币种、USD 或 PERCENT`);
	}

	private async getBorrowBalanceMist(address: string, symbol: string): Promise<bigint> {
		this.assertAddress(address);
		const upper = symbol.toUpperCase();
		try {
			const lendingState = await this.getNaviLendingState(address);
			if (!Array.isArray(lendingState)) return 0n;
			const match = lendingState.find((item: any) => {
				const poolSymbol = item?.pool?.token?.symbol || item?.pool?.tokenSymbol || item?.token?.symbol;
				return typeof poolSymbol === 'string' && poolSymbol.toUpperCase() === upper;
			});
			if (!match) return 0n;
			const borrowRaw = (match.borrowBalance ?? match.borrow_balance ?? match.borrowAmount ?? match.borrow_amount ?? '0');
			const borrowNumber = typeof borrowRaw === 'number' ? borrowRaw : Number(borrowRaw);
			if (!Number.isFinite(borrowNumber) || borrowNumber <= 0) return 0n;
			return BigInt(borrowNumber);
		} catch (error) {
			console.warn('获取借款余额失败:', error);
			return 0n;
		}
	}

	/**
	 * 依据不同单位（币种、USD、百分比）计算转账所需的最小单位金额。
	 */
	public async calculateTransferAmount(params: { fromAddress: string; coin: string; amount: number; unit?: string }): Promise<bigint> {
		const { fromAddress, coin, amount, unit } = params;
		return this.calculateAmountWithUnit({
			address: fromAddress,
			coin,
			amount,
			unit,
			context: '转账',
		});
	}

	/** 将最小单位（字符串）转换为人类可读单位 */
	async toCoin(coin:string, balanceInMist: string): Promise<number> {
		const { decimals } = await this.getCoinMetaDynamic(coin);
		return Number(balanceInMist) / (10 ** decimals);
	}

	/** 将人类可读数量转换为最小单位 bigint */
	async toMist(coin: string, amountCoin: string | number): Promise<bigint> {
		const { decimals } = await this.getCoinMetaDynamic(coin);
		const n = typeof amountCoin === 'string' ? Number(amountCoin) : amountCoin;
		if (!Number.isFinite(n) || n <= 0) throw new Error('转账金额必须是正数');
		return BigInt(Math.round(n * (10 ** decimals)));
	}

	/** 将当前内存池子缓存序列化并写入 localStorage（忽略写入异常） */
	private savePoolCacheToStorage() {
		if (!this.isBrowser()) return;
		try {
			window.localStorage.setItem(SuiService.POOL_CACHE_KEY, JSON.stringify(this.poolCache));
		} catch (e) {
			console.warn('保存本地池子缓存失败:', e);
		}
	}

	/** 判断内存缓存是否仍在有效期内 */
	private isPoolCacheValid(): boolean {
		return !!this.poolCache.pools.length && Date.now() - this.poolCache.updatedAt < SuiService.POOL_TTL_MS;
	}

	/**
	 * 发起真实网络请求获取池子列表，并：
	 * 1. 动态合并 coinInfo
	 * 2. 刷新内存缓存 & 写入 localStorage
	 * 3. 通过 poolFetchPromise 合并并发
	 */
	private async fetchAndUpdatePools(): Promise<any[]> {
		if (this.poolFetchPromise) return this.poolFetchPromise; // 避免并发重复请求
		this.poolFetchPromise = (async () => {
			try {
				const pools = await getPools({ env: this.mapEnv(), cacheTime: 30000 });
				// 已移除动态 coinInfo 维护逻辑（需求：保持最初写死状态）
				this.poolCache = { pools, updatedAt: Date.now() };
				this.savePoolCacheToStorage();
				return pools;
			} finally {
				this.poolFetchPromise = undefined;
			}
		})();
		return this.poolFetchPromise;
	}

	/**
	 * 背景预热：页面加载后主动拉取池子，并更新 coinInfo。
	 * 不阻塞首屏渲染；若已有有效缓存则快速返回。
	 * @param forceRefresh 是否强制忽略缓存重新拉取
	 */
	public warmPools(forceRefresh = false): Promise<void> {
		if (this.warmPromise) return this.warmPromise;
		this.warmPromise = (async () => {
			try {
				if (forceRefresh || !this.isPoolCacheValid()) {
					await this.fetchAndUpdatePools();
				}
			} catch (e) {
				console.warn('预热池子数据失败(忽略):', e);
			} finally {
				// 轻微延迟后允许再次预热（避免立即连点）
				setTimeout(() => { this.warmPromise = undefined; }, 1000);
			}
		})();
		return this.warmPromise;
	}

	/** 开启自动刷新（默认每 POOL_TTL_MS 触发一次更新） */
	public startAutoRefresh(intervalMs: number = SuiService.POOL_TTL_MS) {
		if (this.autoRefreshId) return;
		this.autoRefreshId = setInterval(() => {
			this.fetchAndUpdatePools().catch(() => {});
		}, intervalMs);
	}

	/** 停止自动刷新 */
	public stopAutoRefresh() {
		if (this.autoRefreshId) {
			clearInterval(this.autoRefreshId);
			this.autoRefreshId = undefined;
		}
	}

	/**
	 * 查询某地址指定币种（通过 symbol）余额（单位：最小单位）
	 */
	async getCoinBalance(owner: string, coin: string): Promise<string> {
		this.assertAddress(owner);
		const client = this.client;
		const { coinType } = await this.getCoinMetaDynamic(coin);
		const { totalBalance } = await client.getBalance({ owner, coinType });
		return totalBalance;
	}

	/** 基础 Sui 地址格式校验 */
	private assertAddress(addr: string) {
		if (!addr || typeof addr !== 'string' || !addr.startsWith('0x') || addr.length < 66) {
			throw new Error('无效的 Sui 地址');
		}
	}
	/** 构建一次简单的单币种转账交易（不直接签名广播） */
	async buildCoinTransferTransaction(params: {
		from: string;
		to: string;
		coin: string;
		amountMist: bigint;
		network?: SuiNetwork;
	}): Promise<Transaction> {
		this.assertAddress(params.from);
		this.assertAddress(params.to);
		if (params.amountMist <= 0n) {
			throw new Error('转账金额必须大于 0');
		}
		const tx = new Transaction();
		const { coinObject, total } = await this.consolidateCoins(tx, params.from, params.coin, params.amountMist);
		if (total < params.amountMist) {
			throw new Error('余额不足');
		}
		tx.transferObjects([coinObject], tx.pure.address(params.to));
		return tx;
	}

	/** 直接完成构建 + 调用外部 signer 发送 */
	async transferCoin(params: {
		from: string;
		to: string;
		coin: string;
		amountMist: bigint;
		signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>;
		network?: SuiNetwork;
		chain?: string;
	}): Promise<{ digest?: string } | any> {
		const { from, to, coin, amountMist, signer, chain } = params;
		const tx = await this.buildCoinTransferTransaction({ from, to, coin, amountMist });
		return await signer({ transaction: tx, chain });
	}

	/** 兼容旧命名 */
	async transferSui(params: {
		from: string;
		to: string;
		coin: string;
		amountMist: bigint;
		signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>;
		network?: SuiNetwork;
		chain?: string;
	}): Promise<{ digest?: string } | any> {
		return this.transferCoin(params);
	}

	// ---------------- Navi 相关辅助 ----------------
	private mapEnv(): 'prod' | 'dev' { return this.defaultNetwork === 'mainnet' ? 'prod' : 'dev'; }
	private normalizePool(allInfoPool: any): NaviPoolSimpleInfo {
		const id = allInfoPool.id || 0;
		const symbol = allInfoPool.token.symbol || 'UNKNOWN';
		const borrowAPY = allInfoPool.borrowIncentiveApyInfo.apy + '%' || '0%';
		const supplyAPY = allInfoPool.supplyIncentiveApyInfo.apy + '%' || '0%';
		const price = allInfoPool.oracle.price + 'USD' || '0USD';
		return { id, symbol, borrowAPY, supplyAPY, price };
	}
	/**
	 * 获取单个池子：
	 * - 入参可以是 id（number）或 symbol（string）
	 * - 优先走内存缓存；必要时刷新；symbol 还会尝试补齐 coinInfo
	 */
	async getNaviPool(idOrSymbol: number | string): Promise<any | null> {
		let identifier: number | string = idOrSymbol;
		try {
			if (!idOrSymbol) return null;
			if (typeof idOrSymbol === 'number') {
				// 先检查缓存
				if (!this.isPoolCacheValid()) await this.fetchAndUpdatePools();
				const hit = this.poolCache.pools.find(p => p.id === identifier);
				if (hit) return hit; // 直接返回缓存对象
				return await getPool(identifier, { env: this.mapEnv() }); // 兜底精确请求
			} else {
				const pool = await this.getPoolBySymbol(String(identifier));
				if (pool) return pool;
				throw new Error('未知币种, 请确认 symbol 是否正确');
			}
		} catch (error) {
			console.error('Error fetching Navi pool:', error);
			return null;
		}
	}
	/** 获取全部池子（可选强制刷新） */
	async getNaviPools(forceRefresh = false): Promise<any[]> {
		try {
			if (!forceRefresh && this.isPoolCacheValid()) return this.poolCache.pools;
			return await this.fetchAndUpdatePools();
		} catch (error) {
			console.error('Error fetching Navi pools:', error);
			return this.poolCache.pools; // 失败时仍返回旧缓存（即便可能过期）
		}
	}
	/** 获取池子列表的简化投影（UI 显示用） */
	async getNaviPoolsSimple(forceRefresh = false): Promise<NaviPoolSimpleInfo[]> {
		const pools = await this.getNaviPools(forceRefresh);
		return pools.map(pool => this.normalizePool(pool));
	}
	/** 查询地址在 Navi 上的借贷资产列表 */
	async getNaviLendingState(depositAddress: any): Promise<any> {
		this.assertAddress(depositAddress);
		console.log('Fetching lending state for:', depositAddress);
		try {
			const allPortfolio = await getLendingState(depositAddress, { env: this.mapEnv() });
			console.log('Lending state fetched:', allPortfolio);
			return allPortfolio
		} catch (error) {
			console.error('Error fetching lending state:', error);
			return null;
		}
	}
	/**
	 * 合并一个地址下的同类型 coin：
	 * - 先聚合余额
	 * - 如需拆分，后续由调用方处理
	 * - SUI 特殊：可直接从 gas coin 拆出
	 */
	private async consolidateCoins(tx: Transaction, owner: string, coin: string, amountMist: bigint): Promise<{ coinObject: any; total: bigint }> {
		this.assertAddress(owner);
		const { coinType } = await this.getCoinMetaDynamic(coin);
		const allCoins = await this.client.getCoins({ owner, coinType });
		if (allCoins.data.length === 0) throw new Error('余额不足');
		const total = allCoins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
		const isSui = coin.toUpperCase() === 'SUI';
		if (isSui) {
			if (total < amountMist) throw new Error('余额不足');
			const [coinObject] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
			return { coinObject, total };
		}
		const primaryCoinId = allCoins.data[0].coinObjectId;
		const mergeIds = allCoins.data.slice(1).map(c => tx.object(c.coinObjectId));
		if (mergeIds.length > 0) {
			tx.mergeCoins(tx.object(primaryCoinId), mergeIds);
		}
		if (total < amountMist) throw new Error('余额不足');
		const [coinObject] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(amountMist)]);
		return { coinObject, total };
	}
	/**
	 * 构建 Navi 质押（deposit）交易（仅组装，不签名广播）：
	 * - 按 id 或 symbol 获取池子
	 * - 支持 USD 单位换算（通过 oracle price）
	 * - 动态计算最小单位并拆分/合并余额
	 */
	async buildCoinDepositTransaction(params: { depositAddress: string; depositId: number; depositSymbol: string; depositAmount: number; depositUnit: string }): Promise<Transaction> {
		const { depositAddress, depositId, depositSymbol, depositAmount, depositUnit } = params;
		if (!depositAddress) throw new Error('需要提供质押地址');
		this.assertAddress(depositAddress);
		this.ensureNumberAmount(depositAmount, '质押金额必须大于 0');
		const { symbol } = await this.resolvePoolOrThrow({ id: depositId, symbol: depositSymbol, context: 'deposit' });
		const normalizedUnit = (depositUnit || '').toUpperCase() || symbol;
		const amountMist = await this.calculateAmountWithUnit({
			address: depositAddress,
			coin: symbol,
			amount: depositAmount,
			unit: normalizedUnit,
			context: '质押',
		});
		const { coinType } = await this.getCoinMetaDynamic(symbol);
		const tx = new Transaction();
		const { coinObject, total } = await this.consolidateCoins(tx, depositAddress, symbol, amountMist);
		if (total < amountMist) throw new Error('余额不足');
		await depositCoinPTB(
			tx as any, // 兼容 @mysten/sui 在依赖树里重复版本导致的类型私有字段不匹配
			coinType,
			coinObject,
		);
		return tx;
	}
	/** 一步式：构建 + 调用签名器发送 deposit 交易 */
	async depositCoin(params: { depositAddress: string, depositId: number, depositSymbol: string, depositAmount: number, depositUnit: string, signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>; chain?: string }): Promise<{ digest?: string } | any> {
		const { depositAddress, depositId, depositSymbol, depositAmount, depositUnit, signer, chain } = params;
		const tx = await this.buildCoinDepositTransaction({ depositAddress, depositId, depositSymbol, depositAmount, depositUnit });
		return signer({ transaction: tx, chain });
	}
	async buildCoinBorrowTransaction(params: { borrowAddress: string; borrowId: number; borrowSymbol: string; borrowAmount: number; borrowUnit: string; accountCapId?: string }): Promise<Transaction> {
		const { borrowAddress, borrowId, borrowSymbol, borrowAmount, borrowUnit, accountCapId } = params;
		if (!borrowAddress) throw new Error('需要提供借款接收地址');
		this.assertAddress(borrowAddress);
		this.ensureNumberAmount(borrowAmount, '借款金额必须大于 0');
		const { poolInfo, symbol } = await this.resolvePoolOrThrow({ id: borrowId, symbol: borrowSymbol, context: 'borrow' });
		const normalizedUnit = (borrowUnit || '').toUpperCase() || symbol;
		const { decimals, coinType } = await this.getCoinMetaDynamic(symbol);
		let amountHuman: number;
		if (normalizedUnit === 'USD') {
			const price = Number(poolInfo.oracle?.price);
			if (!Number.isFinite(price) || price <= 0) {
				throw new Error('无法获取币种价格');
			}
			amountHuman = borrowAmount / price;
		} else if (normalizedUnit === symbol) {
			amountHuman = borrowAmount;
		} else {
			throw new Error('借款金额单位与池子币种不匹配');
		}
		const amountMist = this.toMistWithCheck(amountHuman, decimals, '借款');
		const tx = new Transaction();
		const borrowCoin = await borrowCoinPTB(
			tx as any,
			coinType,
			Number(amountMist),
			{ env: this.mapEnv(), accountCap: accountCapId && accountCapId !== 'NONE' ? accountCapId : undefined }
		);
		tx.transferObjects([borrowCoin], tx.pure.address(borrowAddress));
		return tx;
	}
	async borrowCoin(params: { borrowAddress: string; borrowId: number; borrowSymbol: string; borrowAmount: number; borrowUnit: string; accountCapId?: string; signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>; chain?: string }): Promise<{ digest?: string } | any> {
		const { borrowAddress, borrowId, borrowSymbol, borrowAmount, borrowUnit, accountCapId, signer, chain } = params;
		const tx = await this.buildCoinBorrowTransaction({ borrowAddress, borrowId, borrowSymbol, borrowAmount, borrowUnit, accountCapId });
		return signer({ transaction: tx, chain });
	}
	async buildCoinRepayTransaction(params: { repayAddress: string; repayId: number; repaySymbol: string; repayAmount: number; repayUnit: string; accountCapId?: string }): Promise<Transaction> {
		const { repayAddress, repayId, repaySymbol, repayAmount, repayUnit, accountCapId } = params;
		if (!repayAddress) throw new Error('需要提供还款地址');
		this.assertAddress(repayAddress);
		this.ensureNumberAmount(repayAmount, '还款金额必须大于 0');
		const { symbol } = await this.resolvePoolOrThrow({ id: repayId, symbol: repaySymbol, context: 'repay' });
		const normalizedUnit = (repayUnit || '').toUpperCase() || symbol;
		const borrowMist = await this.getBorrowBalanceMist(repayAddress, symbol);
		if (borrowMist <= 0n) {
			throw new Error('当前没有该币种的未偿还借款');
		}
		let amountMist = await this.calculateAmountWithUnit({
			address: repayAddress,
			coin: symbol,
			amount: repayAmount,
			unit: normalizedUnit,
			context: '还款',
			percentBaseMist: normalizedUnit === 'PERCENT' ? borrowMist : undefined,
		});
		if (amountMist > borrowMist) {
			if (amountMist - borrowMist <= 1n) {
				amountMist = borrowMist;
			} else {
				throw new Error('还款金额超过当前借款余额');
			}
		}
		const { coinType } = await this.getCoinMetaDynamic(symbol);
		const tx = new Transaction();
		const { coinObject, total } = await this.consolidateCoins(tx, repayAddress, symbol, amountMist);
		if (total < amountMist) throw new Error('余额不足');
		const repayOptions: { env: 'prod' | 'dev'; accountCap?: string } = { env: this.mapEnv() };
		if (accountCapId && accountCapId !== 'NONE') {
			repayOptions.accountCap = accountCapId;
		}
		await repayCoinPTB(
			tx as any,
			coinType,
			coinObject,
			repayOptions
		);
		return tx;
	}
	async repayCoin(params: { repayAddress: string; repayId: number; repaySymbol: string; repayAmount: number; repayUnit: string; accountCapId?: string; signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>; chain?: string }): Promise<{ digest?: string } | any> {
		const { repayAddress, repayId, repaySymbol, repayAmount, repayUnit, accountCapId, signer, chain } = params;
		const tx = await this.buildCoinRepayTransaction({ repayAddress, repayId, repaySymbol, repayAmount, repayUnit, accountCapId });
		return signer({ transaction: tx, chain });
	}
	/**
	 * 原始 coinType + 最小单位金额 的提现交易构建（仅内部复用）
	 */
	private async buildRawWithdrawTransaction(params: { coinType: string; amount: bigint; withdrawAddress: string; accountCapId?: string }): Promise<Transaction> {
		const { coinType, amount, withdrawAddress, accountCapId } = params;
		const normalizedCoinType = this.normalizeCoinType(coinType);
		if (amount <= 0n) throw new Error('必须指定金额');
		this.assertAddress(withdrawAddress);
		if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
			throw new Error('当前实现暂不支持超过 MAX_SAFE_INTEGER 的提现金额');
		}
		const tx = new Transaction();
		const withdrawCoin = await withdrawCoinPTB(
			tx as any,
			normalizedCoinType,
			Number(amount),
			{ env: this.mapEnv(), accountCap: accountCapId }
		);
		tx.transferObjects([withdrawCoin], tx.pure.address(withdrawAddress));
		return tx;
	}

	/**
	 * 与 deposit/borrow/repay 对齐的提现交易构建：按 id/symbol + 金额/单位，内部负责校验与换算。
	 */
	async buildCoinWithdrawTransaction(params: { withdrawAddress: string; withdrawId: number; withdrawSymbol: string; withdrawAmount: number; withdrawUnit: string; accountCapId?: string; portfolioSnapshot?: any; coinTypeHint?: string }): Promise<Transaction> {
		const { withdrawAddress, withdrawId, withdrawSymbol, withdrawAmount, withdrawUnit, accountCapId, portfolioSnapshot, coinTypeHint } = params;
		this.assertAddress(withdrawAddress);
		if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
			throw new Error('提现金额必须大于 0');
		}
		const { poolInfo, symbol } = await this.resolvePoolOrThrow({ id: withdrawId, symbol: withdrawSymbol, context: 'withdraw' });
		const normalizedSymbol = symbol.toUpperCase();
		const withdrawableMist = await this.getSupplyBalanceMist(withdrawAddress, normalizedSymbol, portfolioSnapshot);
		if (withdrawableMist <= 0n) {
			throw new Error(`当前没有 ${normalizedSymbol} 的可提余额`);
		}

		let normalizedUnit = (withdrawUnit || '').toUpperCase() || normalizedSymbol;
		let amountValue = withdrawAmount;
		if (normalizedUnit === '%') normalizedUnit = 'PERCENT';

		const percentBase = normalizedUnit === 'PERCENT' ? withdrawableMist : undefined;
		let amountMist = await this.calculateAmountWithUnit({
			address: withdrawAddress,
			coin: normalizedSymbol,
			amount: amountValue,
			unit: normalizedUnit,
			context: '提现',
			percentBaseMist: percentBase,
		});
		if (amountMist > withdrawableMist) {
			amountMist = withdrawableMist;
		}
		if (amountMist <= 0n) {
			throw new Error('提现金额必须大于 0');
		}

		// 尽量基于池子解析 coinType，与其他流程一致；coinTypeHint 仅作可选提示
		let coinType: string | undefined;
		const hint = coinTypeHint?.trim();
		if (hint) {
			try {
				coinType = this.normalizeCoinType(hint);
			} catch {
				// 忽略 hint 错误，继续用池子信息解析
			}
		}
		if (!coinType) {
			const inferred = poolInfo?.token?.coinType || poolInfo?.coinType;
			if (typeof inferred === 'string' && inferred.trim()) {
				coinType = this.normalizeCoinType(inferred);
			} else {
				({ coinType } = await this.getCoinMetaDynamic(normalizedSymbol));
			}
		}

		return this.buildRawWithdrawTransaction({ coinType, amount: amountMist, withdrawAddress, accountCapId });
	}

	/** 一步式提现：对齐 deposit/borrow/repay 的调用风格 */
	async withdrawCoin(params: WithdrawParams): Promise<{ digest?: string } | any> {
		const { withdrawAddress, withdrawId, withdrawSymbol, withdrawAmount, withdrawUnit, accountCapId, signer, chain, portfolioSnapshot, coinTypeHint } = params;
		const tx = await this.buildCoinWithdrawTransaction({ withdrawAddress, withdrawId, withdrawSymbol, withdrawAmount, withdrawUnit, accountCapId, portfolioSnapshot, coinTypeHint });
		return signer({ transaction: tx, chain });
	}

	/** 可选：按 coinType + 最小单位金额直接提现的便捷方法（需要调用方自行换算） */
	async withdrawCoinByCoinType(params: WithdrawRawParams): Promise<{ digest?: string } | any> {
		const { coinType, amount, withdrawAddress, accountCapId, signer, chain } = params;
		const amountBigInt = this.parseBigIntAmount(amount, '提现');
		const tx = await this.buildRawWithdrawTransaction({ coinType, amount: amountBigInt, withdrawAddress, accountCapId });
		return signer({ transaction: tx, chain });
	}
}
const env = import.meta.env.VITE_SUI_ENV as SuiNetwork;
export const suiService = new SuiService(env);
