import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions';
import { coinInfo } from './CoinInfo';
import { getPools, getPool, depositCoinPTB } from '@naviprotocol/lending';

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

	constructor(defaultNetwork: SuiNetwork = 'devnet') {
		this.defaultNetwork = defaultNetwork;
		this.client = new SuiClient({ url: getFullnodeUrl(this.defaultNetwork) });
	}

	async getCoinBalance(owner: string, coin: string): Promise<string> {
		this.assertAddress(owner);
		const client = this.client;
		const { totalBalance } = await client.getBalance({
			owner,
			coinType: coinInfo[coin as keyof typeof coinInfo].coinType,
		});
		return totalBalance;
	}

	toCoin(coin:string, balanceInMist: string): number {
		return Number(balanceInMist) / (10**coinInfo[coin as keyof typeof coinInfo].decimals);
	}

	toMist(coin: string, amountCoin: string | number): bigint {
		const n = typeof amountCoin === 'string' ? Number(amountCoin) : amountCoin;
		console.log('n', n);
		if (!Number.isFinite(n) || n <= 0) throw new Error('转账金额必须是正数');
		return BigInt(Math.round(n * (10**coinInfo[coin as keyof typeof coinInfo].decimals)));
	}

	private assertAddress(addr: string) {
		if (!addr || typeof addr !== 'string' || !addr.startsWith('0x') || addr.length < 66) {
			throw new Error('无效的 Sui 地址');
		}
	}
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

	// Navi merged
	private mapEnv(): 'prod' | 'dev' { return this.defaultNetwork === 'mainnet' ? 'prod' : 'dev'; }
	private normalizePool(allInfoPool: any): NaviPoolSimpleInfo {
		const id = allInfoPool.id || 0;
		const symbol = allInfoPool.token.symbol || 'UNKNOWN';
		const borrowAPY = allInfoPool.borrowIncentiveApyInfo.apy + '%' || '0%';
		const supplyAPY = allInfoPool.supplyIncentiveApyInfo.apy + '%' || '0%';
		const price = allInfoPool.oracle.price + 'USD' || '0USD';
		return { id, symbol, borrowAPY, supplyAPY, price };
	}
	async getNaviPool(idOrSymbol: number | string): Promise<any | null> {
		let identifier: number | string = idOrSymbol;
		try {
			if (!idOrSymbol) return null;
			if (typeof idOrSymbol === 'number') {
				return await getPool(identifier, { env: this.mapEnv() });
			} else {
				const coinType = coinInfo[identifier as keyof typeof coinInfo].coinType;
				return await getPool(coinType, { env: this.mapEnv() });
			}
		} catch (error) {
			console.error('Error fetching Navi pool:', error);
			return null;
		}
	}
	private async getNaviPools(): Promise<any[]> {
		try {
			const pools = await getPools({ env: this.mapEnv(), cacheTime: 30000 });
			return pools;
		} catch (error) {
			console.error('Error fetching Navi pools:', error);
			return [];
		}
	}
	async getNaviPoolsSimple(): Promise<NaviPoolSimpleInfo[]> {
		const pools = await this.getNaviPools();
		return pools.map(pool => this.normalizePool(pool));
	}
	toSuiMist(amount: number | string): bigint {
		const n = typeof amount === 'string' ? Number(amount) : amount;
		if (!Number.isFinite(n) || n <= 0) throw new Error('质押金额必须是正数');
		return BigInt(Math.round(n * 1_000_000_000));
	}

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
			tx,
			poolInfo.coinType,
			coinObject,
		);
		return tx;
	}
	async depositCoin(params: { depositAddress: string, depositId: number, depositSymbol: string, depositAmount: number, depositUnit: string, signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>; chain?: string }): Promise<{ digest?: string } | any> {
		const { depositAddress, depositId, depositSymbol, depositAmount, depositUnit, signer, chain } = params;
		const tx = await this.buildCoinDepositTransaction({ depositAddress, depositId, depositSymbol, depositAmount, depositUnit });
		return signer({ transaction: tx, chain });
	}
}
const env = import.meta.env.VITE_SUI_ENV as SuiNetwork;
export const suiService = new SuiService(env);

