import { SuiClient, getFullnodeUrl } from '@mysten/sui/client' // 从 @mysten/sui 引入客户端与全节点 URL 工具
import { Transaction } from '@mysten/sui/transactions'; // 引入可编程交易构建器
import { coinAddress } from './CoinAddress'; // 引入币种地址与精度配置

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet'; // 定义 Sui 网络类型别名

class SuiService { // 封装与 Sui 节点交互的服务类
	private readonly defaultNetwork: SuiNetwork; // 默认网络
	private readonly client: SuiClient; // Sui 客户端实例

	constructor(defaultNetwork: SuiNetwork = 'devnet') { // 构造函数，允许传入默认网络
		this.defaultNetwork = defaultNetwork; // 保存默认网络配置
		this.client = new SuiClient({ url: getFullnodeUrl(this.defaultNetwork) }); // 使用默认网络创建客户端
	} // 构造函数结束

	async getCoinBalance(owner: string, coin: string): Promise<string> { // 查询指定地址的某币种余额（最小单位）
		this.assertAddress(owner); // 基础校验地址格式
		const client = this.client; // 获取客户端引用
		const { totalBalance } = await client.getBalance({ // 调用节点接口获取余额
			owner, // 钱包地址
			coinType: coinAddress[coin as keyof typeof coinAddress].coinType, // 币种类型（Type）
		}); // 结束余额查询调用
		return totalBalance; // 原样返回字符串，避免精度问题
	} // 方法结束：getCoinBalance

	toCoin(coin:string, balanceInMist: string): number { // 将最小单位转换为人类可读单位
		return Number(balanceInMist) / (10**coinAddress[coin as keyof typeof coinAddress].decimals); // 根据精度除以 10^decimals
	} // 方法结束：toCoin

	/** 将金额(人类单位)转换为最小单位 MIST（bigint） */
	toMist(coin: string, amountCoin: string | number): bigint { // 转换为最小单位，返回 bigint
		const n = typeof amountCoin === 'string' ? Number(amountCoin) : amountCoin; // 将输入规范为 number
		console.log('n', n); // 调试输出输入值
		if (!Number.isFinite(n) || n <= 0) throw new Error('转账金额必须是正数'); // 简单校验金额
		return BigInt(Math.round(n * (10**coinAddress[coin as keyof typeof coinAddress].decimals))); // 乘以 10^decimals 后取整并转 bigint
	} // 方法结束：toMist

	/** 简单校验地址 */
	private assertAddress(addr: string) { // 粗略判断十六进制地址
		if (!addr || typeof addr !== 'string' || !addr.startsWith('0x') || addr.length < 66) { // 要求以 0x 开头且长度足够
			throw new Error('无效的 Sui 地址'); // 不符合则抛错
		}
	} // 方法结束：assertAddress

	async buildSuiTransferTransaction(params: { // 构建一笔 SUI 转账交易（未签名）
		from: string; // 发送方地址
		to: string; // 接收方地址
		coin: string; // 币种标识（用于解析 coin type 和精度）
		amountMist: bigint; // 使用最小单位，避免精度问题
		// 预留：可接受 network 覆盖，当前对构建不敏感，仅用于可能的链前缀
		network?: SuiNetwork; // 可选网络参数
	}): Promise<Transaction> { // 返回 Transaction 实例
		const allCoins = await this.client.getCoins({ // 查询发送方持有的该币种的所有 coin 对象
			owner: params.from, // 发送方地址
			coinType: coinAddress[params.coin as keyof typeof coinAddress].coinType, // 币种类型
		}); // 结束查询 coin 对象
		this.assertAddress(params.to); // 校验接收方地址
		// 2. 检查总余额是否足够
		const totalBalance = allCoins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n); // 累加所有 coin 对象余额
		console.log('totalBalance', totalBalance); // 输出余额调试信息
		const amountMistBigInt = typeof params.amountMist === 'string' ? BigInt(params.amountMist) : params.amountMist; // 规范化金额为 bigint
		if (totalBalance < amountMistBigInt) { // 若余额不足
			throw new Error('钱包总SUI余额不足，无法完成转账。'); // 抛出错误
		} // 余额校验结束

		// 3. 构建可编程交易块
		const tx = new Transaction(); // 创建交易对象

		// 4. 将所有 SUI 币对象合并到第一个币对象中
		// 假设列表不为空
		const primaryCoinId = allCoins.data[0].coinObjectId; // 选取第一个 coin 对象作为主对象
		const mergeCoinIds = allCoins.data.slice(1).map(c => tx.object(c.coinObjectId)); // 其余 coin 对象句柄

		// 合并操作，将所有 mergeCoinIds 合并到 primaryCoinId 中
		if (mergeCoinIds.length > 0) { // 若存在可合并对象
			tx.mergeCoins(tx.object(primaryCoinId), mergeCoinIds); // 执行合并
		} // 合并结束

		// 5. 从合并后的主币中分割出转账金额
		const [transferredCoin] = tx.splitCoins(tx.object(primaryCoinId), [tx.pure.u64(params.amountMist)]); // 按金额拆分出新 coin 对象

		// 6. 将新分割出的币对象转给接收方
		tx.transferObjects([transferredCoin], tx.pure.address(params.to)); // 转移新对象至接收方地址

		return tx; // 返回未签名交易
	} // 方法结束：buildSuiTransferTransaction

	async transferSui(params: { // 构建并提交一笔 SUI 转账
		from: string; // 发送方
		to: string; // 接收方
		coin: string; // 预留，当前仅支持 SUI
		amountMist: bigint; // 转账金额（最小单位）
		signer: (args: { transaction: Transaction; chain?: string }) => Promise<{ digest?: string } | any>; // 外部签名与发送函数
		network?: SuiNetwork; // 可选覆盖，若 signer 需要 chain，可自行拼接如 `sui:devnet`
		chain?: string; // 可显式传入给 signer
	}): Promise<{ digest?: string } | any> { // 返回链上提交结果（含 digest）
		const { from, to, coin, amountMist, signer, chain } = params; // 解构参数
		const tx = await this.buildSuiTransferTransaction({ from, to, coin, amountMist }); // 构建交易
		return await signer({ transaction: tx, chain }); // 调用签名器提交交易
	} // 方法结束：transferSui

	async getTransactionDetails(digest: string, coin: string): Promise<{ // 根据交易哈希查询并解析交易详情
		digest: string; // 交易哈希
		sender: string; // 发送方地址
		recipient: string; // 接收方地址
		amount: string; // 转账金额（最小单位字符串）
		amountSui: number; // 转账金额（SUI 人类单位）
		coinType: string; // 币种类型
		status: 'success' | 'failure'; // 交易状态
		gasUsed?: string; // 计算用量（粗略）
		timestamp?: number; // 时间戳（毫秒）
	}> { // 返回解析后的交易信息
		try { // 异常捕获
			const txResponse = await this.client.getTransactionBlock({ // 查询交易详情
				digest, // 交易哈希
				options: { // 需要的展开字段
					showInput: true, // 展示输入
					showEffects: true, // 展示执行结果
					showEvents: true, // 展示事件
					showObjectChanges: true, // 展示对象变化
					showBalanceChanges: true, // 展示余额变化
				}, // 选项结束
			}); // 完成交易详情查询调用

			// 提取基本信息
			const sender = txResponse.transaction?.data.sender || ''; // 发送方地址
			let recipient = ''; // 接收方地址占位
			let amount = '0'; // 金额占位（最小单位）
			const coinType = coinAddress[coin as keyof typeof coinAddress].coinType; // 转发币种

			// 从余额变化中提取转账信息
			if (txResponse.balanceChanges) { // 若接口返回余额变化
				for (const change of txResponse.balanceChanges) { // 遍历余额变化
					if (change.coinType === coinType) { // 只处理 SUI 币种
						const changeAmount = BigInt(change.amount); // 将变化金额转为 bigint
						let ownerAddress = ''; // 所有者地址
						// 处理不同类型的 owner
						if (typeof change.owner === 'string') { // 如果直接是字符串
							ownerAddress = change.owner; // 记录地址
						} else if (change.owner && typeof change.owner === 'object' && 'AddressOwner' in change.owner) { // 如果是对象包裹
							ownerAddress = change.owner.AddressOwner as string; // 取出地址
						}
						if (changeAmount < 0 && ownerAddress === sender) { // 发送方的负余额变化
							// 发送方的负余额变化
							amount = (-changeAmount).toString(); // 记录转出金额
						} else if (changeAmount > 0 && ownerAddress !== sender) { // 接收方的正余额变化
							// 接收方的正余额变化
							recipient = ownerAddress; // 记录接收方地址
						}
					} // 处理单条余额变化结束
				} // 遍历余额变化结束
			} // 余额变化解析结束

			// 从对象变化中补充提取接收方信息（如果余额变化中没有找到）
			if (!recipient && txResponse.objectChanges) { // 若未能从余额变化中识别接收方
				for (const objChange of txResponse.objectChanges) { // 遍历对象变化
					if (objChange.type === 'transferred' && objChange.objectType?.includes('0x2::coin::Coin')) { // 定位转移的 Coin 对象
						let recipientAddress = ''; // 接收方地址占位
                        
						// 处理不同类型的 recipient
						if (typeof objChange.recipient === 'string') { // 直接字符串
							recipientAddress = objChange.recipient; // 记录
						} else if (objChange.recipient && typeof objChange.recipient === 'object' && 'AddressOwner' in objChange.recipient) { // 对象包裹
							recipientAddress = objChange.recipient.AddressOwner as string; // 取出
						}
                        
						recipient = recipientAddress; // 设置接收方
						break; // 已找到即可退出
					} // 匹配转移对象结束
				} // 遍历对象变化结束
			} // 对象变化解析结束

			const status = txResponse.effects?.status?.status === 'success' ? 'success' : 'failure'; // 解析交易状态
			const gasUsed = txResponse.effects?.gasUsed?.computationCost || '0'; // 读取 gas 计算成本
			const timestamp = txResponse.timestampMs ? Number(txResponse.timestampMs) : undefined; // 转为 number 类型时间戳

			return { // 组装返回结果
				digest, // 交易哈希
				sender, // 发送方
				recipient, // 接收方
				amount, // 金额（最小单位）
				amountSui: this.toCoin(coin, amount), // 金额（人类单位）
				coinType, // 币种类型
				status, // 状态
				gasUsed, // Gas 使用
				timestamp, // 时间戳
			}; // 返回对象结束
		} catch (error) { // 异常处理
			console.error('获取交易详情失败:', error); // 打印错误日志
			throw new Error(`获取交易详情失败: ${error instanceof Error ? error.message : '未知错误'}`); // 统一封装错误
		} // try-catch 结束
	} // 方法结束：getTransactionDetails
}

const env = import.meta.env.VITE_SUI_ENV as SuiNetwork; // 从环境变量读取默认网络
export const suiService = new SuiService(env); // 导出默认实例，供全局使用

