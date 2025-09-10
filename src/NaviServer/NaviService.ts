import type { SuiNetwork } from '../SuiServer/SuiService';
import { getPools } from '@naviprotocol/lending'

export type NaviPoolSimpleInfo = { // 运行时为普通js对象，可以直接通过JSON.stringify转化为字符串
    id: number;
    symbol: string;
    borrowAPY: string;
    supplyAPY: string;
    price: string;    // 价格（美元）
};

export type NaviPoolInfo = {
    id: number;
    symbol: string;
    coinType: string;
    borrowAPY: number;
    borrowAPR: number;
    supplyAPY: number;
    supplyAPR: number;
    price: string;    // 价格（美元）
}

class NaviService {
    private readonly defaultNetwork: SuiNetwork = 'devnet'; // 默认网络

    constructor(defaultNetwork: SuiNetwork = 'devnet') {
        this.defaultNetwork = defaultNetwork;
    }

    private normalizePool(allInfoPool: any): NaviPoolSimpleInfo {
        // 不同 SDK 字段名可能不同，这里做多路兜底
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

    async getNaviPools(): Promise<any[]> {
        try {
            const pools = await getPools({
                env: (() => {if (this.defaultNetwork === 'mainnet') return 'prod'; return 'dev';})(),
                cacheTime: 30000 // Optional: cache time
            })
            return pools
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
}

const env = import.meta.env.VITE_SUI_ENV; // 从环境变量读取默认网络
export const naviService = new NaviService(env);
