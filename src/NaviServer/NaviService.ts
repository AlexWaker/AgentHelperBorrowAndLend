import type { SuiNetwork } from '../SuiServer/SuiService';
import { getPools, depositCoinPTB, getPool } from '@naviprotocol/lending';
import { Transaction } from '@mysten/sui/transactions';
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
class NaviService {
    private readonly defaultNetwork: SuiNetwork = 'devnet';
    constructor(defaultNetwork: SuiNetwork = 'devnet') { this.defaultNetwork = defaultNetwork; }
    private mapEnv(): 'prod' | 'dev' { return this.defaultNetwork === 'mainnet' ? 'prod' : 'dev'; }
    private normalizePool(allInfoPool: any): NaviPoolSimpleInfo {
        const id = allInfoPool.id || 0;
        const symbol = allInfoPool.token.symbol || 'UNKNOWN';
        const borrowAPY = allInfoPool.borrowIncentiveApyInfo.apy + '%' || '0%';
        const supplyAPY = allInfoPool.supplyIncentiveApyInfo.apy + '%' || '0%';
        const price = allInfoPool.oracle.price + 'USD' || '0USD';
        return {
            id,
            symbol,
            borrowAPY,
            supplyAPY,
            price
        };
    }
    private isDecimalIntString(v: unknown): v is string {
        return typeof v === 'string' && /^[0-9]+$/.test(v);
    }
    async getNaviPool(idOrSymbol: any): Promise<any | null> {
        let identifier: number | string = idOrSymbol;
        try {
            if (!idOrSymbol) return null;
            if (this.isDecimalIntString(idOrSymbol)) {
                const num = Number(idOrSymbol);
                if (Number.isSafeInteger(num)) identifier = num;
                return await getPool(identifier, { env: this.mapEnv() });
            } else {
                return await getPool(identifier, { env: this.mapEnv() });
            }

        } catch (error) {
            console.error('Error fetching Navi pool:', error);
            return null;
        }
    }
    async getNaviPools(): Promise<any[]> {
        try {
            const pools = await getPools({ env: (() => { if (this.defaultNetwork === 'mainnet') return 'prod'; return 'dev'; })(), cacheTime: 30000 });
            return pools;
        } catch (error) {
            console.error('Error fetching Navi pools:', error);
            return [];
        }
    }
    async getNaviPoolsSimple(): Promise<NaviPoolSimpleInfo[]> {
        const pools = await this.getNaviPools();
        const simplePoolsInfo = pools.map(pool => this.normalizePool(pool));
        return simplePoolsInfo;
    }
    toSuiMist(amount: number | string): bigint {
        const n = typeof amount === 'string' ? Number(amount) : amount;
        if (!Number.isFinite(n) || n <= 0) throw new Error('质押金额必须是正数');
        return BigInt(Math.round(n * 1_000_000_000));
    }
    async buildSuiSupplyTransaction(params: {
        from: string;
        amountMist: bigint;
    }): Promise<Transaction> {
        const { from, amountMist } = params;
        if (!from || !from.startsWith('0x')) throw new Error('无效地址');
        if (amountMist <= 0n) throw new Error('金额必须大于 0');
        await getPool('SUI', { env: this.mapEnv() });
        const tx = new Transaction();
        tx.setSender(from);
        await depositCoinPTB(tx as any, 'SUI', (tx as any).gas, { amount: Number(amountMist), env: this.mapEnv() });
        return tx;
    }
    async supplySui(params: {
        from: string;
        amountMist: bigint;
        signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>;
    chain?: string;
    }): Promise<{ digest?: string } | any> {
        const { from, amountMist, signer, chain } = params;
        const tx = await this.buildSuiSupplyTransaction({ from, amountMist });
        return signer({ transaction: tx, chain });
    }
}
const env = import.meta.env.VITE_SUI_ENV;
export const naviService = new NaviService(env);
