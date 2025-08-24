import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { networkConfig } from '../networkConfig';

// 常量：SUI 主币的 CoinType 与精度
const SUI_COIN_TYPE = '0x2::sui::SUI';
const MIST_PER_SUI = 1_000_000_000n; // 1 SUI = 1e9 MIST

export type SupportedNetwork = 'mainnet' | 'testnet' | 'devnet';

export interface QueryAgentOptions {
	owner: string; // Sui 地址
	network?: SupportedNetwork; // 可选，默认 mainnet
	rpcUrlOverride?: string; // 可选，优先级最高
}

export interface CoinBalanceItem {
	coinType: string;
	totalBalance: string; // 原始最小单位（MIST 或该 token 的最小单位），字符串以避免大数精度问题
	coinObjectCount?: number;
	lockedBalance?: Record<string, string>;
}

export interface QueryBalanceResult {
	owner: string;
	network: SupportedNetwork;
	rpcUrl: string;
	balances: CoinBalanceItem[];
	// 便捷字段
	suiBalanceMist?: string; // SUI 的 MIST 数量
}

function resolveRpcUrl(network: SupportedNetwork, rpcUrlOverride?: string): string {
	if (rpcUrlOverride) return rpcUrlOverride;
	// 优先使用本项目的 networkConfig；若缺失则回退官方 URL
	const urlFromConfig = (networkConfig as any)?.[network]?.url as string | undefined;
	return urlFromConfig ?? getFullnodeUrl(network);
}

function formatMistToSui(mist: string | bigint): string {
	const v = typeof mist === 'string' ? BigInt(mist) : mist;
	const intPart = v / MIST_PER_SUI;
	const fracPart = v % MIST_PER_SUI;
	// 去除小数末尾多余 0
	const fracStr = fracPart.toString().padStart(9, '0').replace(/0+$/, '');
	return fracStr.length ? `${intPart.toString()}.${fracStr}` : intPart.toString();
}

/**
 * 查询指定地址在指定网络上的所有余额（包含 SUI 与其他代币）。
 */
export async function queryBalances(options: QueryAgentOptions): Promise<QueryBalanceResult> {
	const network: SupportedNetwork = options.network ?? 'mainnet';
	const rpcUrl = resolveRpcUrl(network, options.rpcUrlOverride);

	if (!options.owner) {
		throw new Error('owner 地址不能为空');
	}

	const client = new SuiClient({ url: rpcUrl });

	// 获取全部代币余额列表
	const all = await client.getAllBalances({ owner: options.owner });

	const balances: CoinBalanceItem[] = all.map((b) => ({
		coinType: b.coinType,
		totalBalance: (b.totalBalance as any).toString(),
		coinObjectCount: (b as any).coinObjectCount,
		lockedBalance: (b as any).lockedBalance,
	}));

	const suiItem = balances.find((b) => b.coinType === SUI_COIN_TYPE);

	return {
		owner: options.owner,
		network,
		rpcUrl,
		balances,
		suiBalanceMist: suiItem?.totalBalance,
	};
}

/**
 * 生成中文摘要，便于直接作为聊天回复。
 * - 展示 SUI 余额（SUI 与 MIST）
 * - 展示前若干个非 SUI 代币余额（默认前 5 个）
 */
export function formatBalanceSummary(result: QueryBalanceResult, topN = 5): string {
	const { owner, network, rpcUrl, balances, suiBalanceMist } = result;

	const header = `📊 账户余额查询结果\n` +
		`• 地址：${owner}\n` +
		`• 网络：${network} (${rpcUrl})`;

	const suiLine = (() => {
		if (!suiBalanceMist) return '• SUI：0 SUI (0 MIST)';
		const suiStr = formatMistToSui(suiBalanceMist);
		return `• SUI：${suiStr} SUI (${suiBalanceMist} MIST)`;
	})();

	const others = balances
		.filter((b) => b.coinType !== SUI_COIN_TYPE)
		.slice(0, topN)
		.map((b) => `• ${b.coinType}：${b.totalBalance}`);

	const othersBlock = others.length
		? `\n其他代币（前${topN}）：\n${others.join('\n')}`
		: `\n其他代币：无`;

	return `${header}\n${suiLine}${othersBlock}`;
}

/**
 * Agent 入口：查询余额并返回中文摘要字符串。
 * 你也可以直接使用 queryBalances 获取原始数据做进一步处理。
 */
export async function queryBalanceAgent(options: QueryAgentOptions): Promise<string> {
	try {
		const result = await queryBalances(options);
		return formatBalanceSummary(result);
	} catch (err: any) {
		const reason = err?.message ?? String(err);
		return `抱歉，查询余额失败：${reason}`;
	}
}

export default {
	queryBalances,
	queryBalanceAgent,
	formatBalanceSummary,
};

