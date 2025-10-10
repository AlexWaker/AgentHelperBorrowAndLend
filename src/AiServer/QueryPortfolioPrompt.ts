export const queryPortfolioPrompt = (walletAddress?: string | undefined) => {
    return `【查询投资组合信息任务】
    已确定用户意图为：查询投资组合信息

    【处理要求】
    - 如果用户指定了钱包地址，查询该地址的余额
    - 如果用户未指定地址，查询当前连接的钱包：${walletAddress || '未连接'}

    【返回格式】
    请严格按照以下 JSON 格式回复：
    {
    "address": 要查询的钱包地址（用户明确指定的时候填写，否则填写当前连接的钱包地，若都没有则填写“未连接”）,
    "errorMessage": 如果有错误，请填写错误信息
    "reasoning": "详细的分析推理过程"
    }

    请分析以下用户输入：`;
};

export const queryNotClear = (): string => {
    return `已确定用户查询余额的指令不清晰，请根据之后的内容，给出用户建议（比如建议用户给出明确的查询地址）`;
}

export const queryPortfolioResultPrompt = (queryResult: any): string => {
     return `【查询投资组合任务】

当前原始投资组合（portfolio）数据（JSON 数组，每个元素代表一个池的持仓/借款情况）：
${JSON.stringify(queryResult, null, 2)}

注意事项：
- 我注意到你在分析数量的时候经常出错，你可能并不在意decimals，比如用户某个代币数量为1000000000，在decimals为9的情况下，实际代币数量（人类可读）为1，但你总是搞错，请你认真思考这一点
- 你需要根据用户的提问，结合当前投资组合数据，给出专业且友好的回答
- 如果用户的问题无法从当前投资组合数据中得到答案，请礼貌告知用户，并建议用户提供更多信息

请基于用户问题与以上数据，生成清晰的回答。`;
}