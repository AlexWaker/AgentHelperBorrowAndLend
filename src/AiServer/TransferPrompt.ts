// import { supportCoin } from "./SupportCoin";

export const transferCoinPrompt = (walletAddress: string | undefined): string => {
    return `任务：代币转账
    上下文：当前钱包=${walletAddress || '未连接'}

    请从用户输入中抽取并校验：
    - toAddress：0x 开头的 Sui 地址
    - amount：> 0

    以下任一情况判定 isValid=false：缺少地址/金额、地址非法或多个地址，提供的地址（如果用户自己提供的话）并非当前钱包地址、金额≤0、非 SUI、未连接且未指定 from、指令含糊。

    仅输出 JSON（不要附加解释）：
    {
        "fromAddress": 当前钱包地址,
        "toAddress": "",
        "amount": 转账数量（数字）,
        "coin": 代币名称,
        "memo": "",
        "isValid": true/false,
        "errorMessage": ""
    }

    用户输入：`;
    };

export const transferNotClear = (): string => {
    return `转账信息不完整。请补充：收款地址(0x...)、金额`;
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