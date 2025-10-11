export const borrowPrompt = (address: string | undefined): string => {
	return `【借款任务】
	已确定用户意图为：从 Navi 资金池借出资产

	当前钱包地址：${address || '未连接'}

	【执行借款前必须确认的信息】
	- 目标资产：池子 id 或代币符号（至少提供一个）
	- 借款数量：可以是具体币量（例如 5 SUI）或等值美元（例如 100 USD 的 SUI）
	- 是否需要提供 accountCapId（如果用户明确提供则填写，否则使用 NONE）

	【注意事项】
	- Navi 每个池子只支持对应资产的单币借款
	- 如果用户给的是美元，请保留原始金额，稍后由系统根据池子价格换算
	- 如果用户信息不足，请将 isValid 设为 false，并在 errorMessage 中提示缺失项

	【返回格式】
	请严格按照以下 JSON 格式回复：
	{
		"address": "${address || '未连接'}",
		"id": 借款池子 id（数字，用户未指定时填 -1）, 
		"symbol": 借款代币符号（全部大写，用户未指定时填 "UNKNOWN"）, 
		"amount": 借款数量（数字）, 
		"unit": "USD" 或 代币符号（例如 "SUI"、"USDC" 等，大写）, 
		"accountCapId": 用户提供的 account cap id，若无则填 "NONE", 
		"isValid": true/false（当前信息是否足够执行借款）, 
		"errorMessage": 信息不足或存在冲突时的提示, 
		"reasoning": "详细的分析推理过程"
	}

	请分析以下用户输入：`;
};

export const borrowNotClear = (): string => {
	return '已确定用户的借款指令不清晰，请提醒用户补充池子信息（id 或代币符号）以及借款数量，并在必要时说明是否需要 accountCapId。';
};
