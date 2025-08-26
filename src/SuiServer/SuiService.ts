import { getSuiClient, type SuiNetwork } from './SuiClientManager';

/**
 * SuiService
 * 仅实现最基础的余额查询功能，复用同目录下的 SuiClientManager。
 */
export class SuiService {
	private readonly defaultNetwork: SuiNetwork;

	constructor(defaultNetwork: SuiNetwork = 'devnet') {
		this.defaultNetwork = defaultNetwork;
	}

	/**
	 * 查询地址的 SUI 余额（原始最小单位，字符串）。
	 * @param owner Sui 地址（0x 开头）
	 * @param network 可选，覆盖默认网络
	 * @returns totalBalance 原始字符串（以 MIST 计数）
	 */
	async getSuiBalance(owner: string, network?: SuiNetwork): Promise<string> {
		const client = getSuiClient(network ?? this.defaultNetwork);
		const { totalBalance } = await client.getBalance({
			owner,
			coinType: '0x2::sui::SUI',
		});
		return totalBalance; // 原样返回字符串，避免精度问题
	}

	/**
	 * 可选的小工具：将最小单位字符串转换为 SUI 浮点数，仅用于展示。
	 * 注意：大额时可能有精度损失，生产环境请使用大数库。
	 */
	toSUI(balanceInMist: string): number {
		return Number(balanceInMist) / 1e9;
	}
}

// 可按需导出一个默认实例（当前网络设为 devnet）
export const suiService = new SuiService('devnet');

