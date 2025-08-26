import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// 支持从环境变量覆盖默认节点（Vite 环境变量以 VITE_ 前缀暴露到浏览器）
const MAINNET_URL = (import.meta as any).env?.VITE_SUI_MAINNET_URL as string | undefined;
const TESTNET_URL = (import.meta as any).env?.VITE_SUI_TESTNET_URL as string | undefined;
const DEVNET_URL = (import.meta as any).env?.VITE_SUI_DEVNET_URL as string | undefined;

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet';

const ENDPOINTS: Record<SuiNetwork, string> = {
	mainnet: MAINNET_URL || getFullnodeUrl('mainnet'),
	testnet: TESTNET_URL || getFullnodeUrl('testnet'),
	devnet: DEVNET_URL || getFullnodeUrl('devnet'),
};

// 单例客户端实例，避免重复创建连接
const clients: Record<SuiNetwork, SuiClient> = {
	mainnet: new SuiClient({ url: ENDPOINTS.mainnet }),
	testnet: new SuiClient({ url: ENDPOINTS.testnet }),
	devnet: new SuiClient({ url: ENDPOINTS.devnet }),
};

// 便捷导出
export const mainnetClient = clients.mainnet;
export const testnetClient = clients.testnet;
export const devnetClient = clients.devnet;

// 按网络名获取客户端（大小写不敏感）
export function getSuiClient(network: SuiNetwork | string): SuiClient {
	const key = network.toLowerCase() as SuiNetwork;
	if (!(key in clients)) {
		throw new Error(`Unsupported Sui network: ${network}`);
	}
	return clients[key];
}

// 运行时覆盖某个网络的 RPC URL（例如切换自定义节点）
export function setSuiRpcUrl(network: SuiNetwork, url: string): void {
	ENDPOINTS[network] = url;
	clients[network] = new SuiClient({ url });
}

// 获取当前各网络的节点地址（可用于调试）
export function getSuiEndpoints(): Record<SuiNetwork, string> {
	return { ...ENDPOINTS };
}


