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
import { coinInfo, mergeCoinsFromPools, upsertCoin } from './CoinInfo';
import { getPools, getPool, depositCoinPTB, getLendingState } from '@naviprotocol/lending';

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
				// 合并 coin 信息（即便过期也可以先用，后面再刷新）
				mergeCoinsFromPools(parsed.pools);
			}
		} catch (e) {
			console.warn('加载本地池子缓存失败:', e);
		}
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
				mergeCoinsFromPools(pools);
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
	 * 查询某地址指定币种（通过 symbol）余额（单位：最小单位）
	 */
	async getCoinBalance(owner: string, coin: string): Promise<string> {
		this.assertAddress(owner);
		const client = this.client;
		const { totalBalance } = await client.getBalance({
			owner,
			coinType: coinInfo[coin as keyof typeof coinInfo].coinType,
		});
		return totalBalance;
	}

	/** 将最小单位（字符串）转换为人类可读单位 */
	toCoin(coin:string, balanceInMist: string): number {
		return Number(balanceInMist) / (10**coinInfo[coin as keyof typeof coinInfo].decimals);
	}

	/** 将人类可读数量转换为最小单位 bigint */
	toMist(coin: string, amountCoin: string | number): bigint {
		const n = typeof amountCoin === 'string' ? Number(amountCoin) : amountCoin;
		console.log('n', n);
		if (!Number.isFinite(n) || n <= 0) throw new Error('转账金额必须是正数');
		return BigInt(Math.round(n * (10**coinInfo[coin as keyof typeof coinInfo].decimals)));
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
		this.assertAddress(params.to);
		const tx = new Transaction();
		const { coinObject } = await this.consolidateCoins(tx, params.from, params.coin, params.amountMist);
		tx.transferObjects([coinObject], tx.pure.address(params.to));
		return tx;
	}

	/** 直接完成构建 + 调用外部 signer 发送 */
	async transferSui(params: {
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
				const upper = String(identifier).toUpperCase();
				let meta = coinInfo[upper as keyof typeof coinInfo];
				if (!meta) {
					if (!this.isPoolCacheValid()) await this.fetchAndUpdatePools();
					const p = this.poolCache.pools.find(p => p?.token?.symbol?.toUpperCase() === upper);
					if (p) {
						upsertCoin(upper, { coinType: p.coinType || p?.token?.coinType, decimals: p?.token?.decimals });
						meta = coinInfo[upper as keyof typeof coinInfo];
					}
				}
				if (!meta) throw new Error('未知币种, 请先刷新池子列表');
				// 缓存里可能已有对应的 pool
				const hit = this.poolCache.pools.find(p => p?.token?.symbol?.toUpperCase() === upper);
				if (hit) return hit;
				return await getPool(meta.coinType, { env: this.mapEnv() });
			}
		} catch (error) {
			console.error('Error fetching Navi pool:', error);
			return null;
		}
	}
	/** 获取全部池子（可选强制刷新） */
	private async getNaviPools(forceRefresh = false): Promise<any[]> {
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
	/** SUI 专用：从人类单位转最小单位（SUI 9 decimals） */
	toSuiMist(amount: number | string): bigint {
		const n = typeof amount === 'string' ? Number(amount) : amount;
		if (!Number.isFinite(n) || n <= 0) throw new Error('质押金额必须是正数');
		return BigInt(Math.round(n * 1_000_000_000));
	}
	/** 归一化借贷状态里的单条资产结构 */
	private normalizePortfolio(portfolio: any): any {
		const poolId = portfolio.assetId || -1;
		const borrowBalance = portfolio.borrowBalance || '0';
		const supplyBalance = portfolio.supplyBalance || '0';
		const coinType = portfolio.pool?.coinType || 'UNKNOWN';
		return { poolId, borrowBalance, supplyBalance, coinType };
	}
	/** 查询地址在 Navi 上的借贷资产列表 */
	async getNaviLendingState(depositAddress: string): Promise<any> {
		this.assertAddress(depositAddress);
		try {
			const allPortfolio = await getLendingState(depositAddress, { env: this.mapEnv() });
			return allPortfolio.map(portfile => this.normalizePortfolio(portfile));
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
		const coinType = coinInfo[coin as keyof typeof coinInfo].coinType;
		const allCoins = await this.client.getCoins({ owner, coinType });
		if (allCoins.data.length === 0) throw new Error('余额不足');
		const total = allCoins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
		const primaryCoinId = allCoins.data[0].coinObjectId;
		const mergeIds = allCoins.data.slice(1).map(c => tx.object(c.coinObjectId));
		if (mergeIds.length > 0) tx.mergeCoins(tx.object(primaryCoinId), mergeIds);
		if(coin.toUpperCase() === 'SUI' && total >= amountMist) {
			const [coinObject] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
			return { coinObject, total };
		} else {
			const [coinObject] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(amountMist)]);
			console.log('primary', primaryCoinId);
			return { coinObject, total };
		}
	}
	/**
	 * 构建 Navi 质押（deposit）交易（仅组装，不签名广播）：
	 * - 按 id 或 symbol 获取池子
	 * - 支持 USD 单位换算（通过 oracle price）
	 * - 动态计算最小单位并拆分/合并余额
	 */
	async buildCoinDepositTransaction(params: { depositAddress: string, depositId: number; depositSymbol: string; depositAmount: number; depositUnit: string }): Promise<Transaction> {
		const { depositAddress, depositId, depositSymbol, depositAmount, depositUnit } = params;
		if (depositId === -1 && depositSymbol === 'UNKNOWN') throw new Error('必须指定质押池id或币种');
		if (depositAmount <= 0) throw new Error('金额必须大于 0');
		if (!depositAddress) throw new Error('需要提供 from 地址用于合并与拆分代币');
		let poolInfo: any = null;
		if (depositId !== -1){
			poolInfo = await this.getNaviPool(depositId);
		} else {
			poolInfo = await this.getNaviPool(depositSymbol);
		}
		if (!poolInfo) throw new Error('未找到有效的池子信息');
		const symbol = poolInfo.token.symbol.toUpperCase();
		if (depositSymbol !== 'UNKNOWN' && symbol !== depositSymbol.toUpperCase()) throw new Error('质押币种与池子不匹配');
		const coinKey = symbol as keyof typeof coinInfo;
		if (!coinInfo[coinKey]) throw new Error('不支持的币种');
		const decimals = coinInfo[coinKey].decimals;
		let amountHuman: number;
		if (depositUnit === 'USD') {
			const priceStr = poolInfo.oracle.price;
			const price = Number(priceStr);
			if (!Number.isFinite(price) || price <= 0) throw new Error('无法获取币种价格');
			amountHuman = depositAmount / price;
		} else {
			amountHuman = depositAmount;
		}
		const amountMist = BigInt(Math.round(amountHuman * 10 ** decimals)); // 用户要存的数量
		const tx = new Transaction();
		const { coinObject, total } = await this.consolidateCoins(tx, depositAddress, symbol, amountMist);
		if (total < amountMist) throw new Error('余额不足');
		await depositCoinPTB(
			tx as any, // 兼容 @mysten/sui 在依赖树里重复版本导致的类型私有字段不匹配
			poolInfo.coinType,
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
}
const env = import.meta.env.VITE_SUI_ENV as SuiNetwork;
export const suiService = new SuiService(env);

