import { supportCoin } from "./SupportCoin";
export const queryPoolPrompt = (): string => {
    return `【查询NAVI池子信息任务】
    已确定用户意图为：查询池子信息

    【处理要求】
    请检查以下情况并给出相应处理：
    - 如果用户明确指定币种或池子id，则注明，否则默认为查询当前所有池子

    【返回格式】
    请严格按照以下 JSON 格式回复：
    {
    "symbol": 要查询的币种符号（用户明确指定的时候填写，否则填写unknown）,
    "id": 要查询的池子id（用户明确指定的时候填写，否则填写unknown）,
    "isAll": 是否查询所有池子（当symbol和id都没有提供的时候为true，否则为false）,
    "errorMessage": 如果有错误，请填写错误信息
    "reasoning": "详细的分析推理过程"
    }

    请分析以下用户输入：`;
};

export const queryNotClear = (): string => {
    return `已确定用户查询余额的指令不清晰，请根据之后的内容，给出用户建议（比如建议用户给出明确的查询地址）`;
}

export const queryPoolResultPrompt = (queryResult: any): string => {
    return `【余额池子完成】

    查询结果：
    ${JSON.stringify(queryResult, null, 2)}

    请根据以上查询结果，用友好的语言向用户报告池子信息，其中：
    - symbol表示代币名称
    - id表示池子ID
    - borrowAPY表示借款年化收益率
    - supplyAPY表示存款年化收益率
    - price表示当前价格（USD）

    注意事项：
    - 可以提示用户想进一步查询具体池子信息的话可以访问Navi官网https://app.naviprotocol.io/

    请用专业但友好的语言回复用户。`;
}