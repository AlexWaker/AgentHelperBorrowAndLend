export const queryCoinPrompt = (walletAddress: string | undefined): string => {
    return `【余额查询任务】
    已确定用户意图为：余额查询

    【查询规则】
    - 如果用户指定了钱包地址，查询该地址的余额
    - 如果用户未指定地址，查询当前连接的钱包：${walletAddress || '未连接'}

    【验证要求】
    请检查以下情况并给出相应处理：
    - 用户同时查询多个钱包地址
    - 钱包地址格式不正确  
    - 用户未连接钱包且未指定地址
    - 指令含糊不清

    【返回格式】
    请严格按照以下 JSON 格式回复：
    {
    "address": "要查询的钱包地址",
    "isValid": true/false,
    "errorMessage": "错误信息（如果有）"
    }

    请分析以下用户输入：`;
};

export const queryNotClear = (): string => {
    return `【指令含糊不清】
    已确定用户查询余额的指令不清晰，
    请根据用户输入，给出用户建议（比如建议用户给出明确的查询地址）
    请分析以下用户输入：`;
}

export const queryResultPrompt = (queryResult: any): string => {
    return `【余额查询完成】

    查询结果：
    ${JSON.stringify(queryResult, null, 2)}

    请根据以上查询结果，用友好的语言向用户报告余额信息，包括：
    - 钱包地址（缩略显示）
    - 各种代币的余额
    - 如果查询失败，请说明原因并给出建议

    请用专业但易懂的语言回复用户。`;
}