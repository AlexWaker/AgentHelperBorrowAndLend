// import { supportCoin } from "./SupportCoin";

export const transferCoinPrompt = (walletAddress: string | undefined): string => {
    return `任务：代币转账
    上下文：当前钱包=${walletAddress || '未连接'}

    请从用户输入中抽取并校验：
    - fromAddress：若用户声明自己的地址，需与当前钱包一致
    - toAddress：0x 开头的 Sui 地址，长度至少 66 位
    - coin：代币符号（默认 SUI），使用全大写
    - amount：大于 0 的数字
    - unit：金额单位，支持以下取值：
      * 币种符号（默认值，与 coin 相同，表示“人类可读数量”）
      * "USD" 表示按美元金额转账
      * "PERCENT" 表示按百分比转账（amount 范围 0-100，对应当前余额的百分比）

    【判定 isValid=false 的情况】
    - 未连接钱包（当前钱包为 "未连接"）
    - 缺少 toAddress / amount / coin 信息
    - toAddress 不是合法的 0x 地址或出现多个目标地址
    - 用户声明的 fromAddress 与当前钱包地址不一致
    - 金额 <= 0 或无法解析为数字
    - unit 为 "PERCENT" 时 amount 不在 0-100 范围内

    仅输出 JSON（不要附加解释）：
    {
      "fromAddress": 当前钱包地址,
      "toAddress": 收款地址,
      "amount": 转账数量（数字）, 
      "coin": 代币名称（大写）, 
      "unit": 金额单位（币种 / USD / PERCENT）, 
      "memo": "",
      "isValid": true/false,
      "errorMessage": ""
    }

    用户输入：`;
    };

export const transferNotClear = (): string => {
  return `转账信息不完整。请补充：收款地址(0x...)、金额与单位（币种 / USD / 百分比）`;
}

export const transferResultPrompt = (transferInfo: any): string => {
    if (typeof transferInfo === 'string') {
        // 兼容旧版本只传递 digest 的情况
        return `转账结果

数据：交易哈希${transferInfo}

请用自然语言简述：
- 状态（成功/失败）
- 交易哈希（供用户查询）
失败时请给原因与建议。不输出 JSON。`;
    }

    // 新版本：传递完整的转账信息对象
    return `转账完成

转账详情：
- 交易哈希：${transferInfo.digest}
- 发送方：${transferInfo.sender}
- 接收方：${transferInfo.recipient}
- 转账金额：${transferInfo.amountCoin} SUI（${transferInfo.amount} MIST）
- 币种：${transferInfo.coinType}
- 状态：${transferInfo.status}
- Gas 费用：${transferInfo.gasUsed || '未知'} MIST
- 时间：${transferInfo.timestamp ? new Date(transferInfo.timestamp).toLocaleString() : '未知'}

请用友好的语言向用户报告转账结果，包括：
- 转账是否成功
- 发送方和接收方地址（使用缩略显示）
- 转账金额
- 交易哈希（便于用户查询）
- 如果失败，请给出原因与建议

不输出 JSON，用自然语言回复。`;
}