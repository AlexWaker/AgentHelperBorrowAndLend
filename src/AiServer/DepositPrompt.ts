// import { supportCoin } from "./SupportCoin";
export const depositPrompt = (address: string | undefined): string => {
    return `【质押任务】
    已确定用户意图为：往某个池子里质押

    当前钱包地址：${address || '未连接'}

    【用户需要明确提供的数据】
    - 池子id或代币名称（二者必须至少提供一个）
    - 质押金额（usd形式或币种，比如50u的sui，10个sui这种）

    【注意】
    - 池子都是单一代币池子，类似银行存款，sui存sui，usdc存usdc

    【返回格式】
    请严格按照以下 JSON 格式回复：
    {
        “address”: "${address || '未连接'}",
        "id": 要存的池子id（数字，用户明确指定的时候填写，否则填写-1）,
        "symbol": 要存的代币名称（字母要全大写，用户明确指定的时候填写，否则填写UNKNOWN）,
        "amount": 存款金额（数字）,
        "unit": "USD" 或 币种名称（比如 SUI, USDC 等，要大写）,
        "isValid": true/false（用户指令是否足够清晰明确进行质押）,
        "errorMessage": 如果有错误，请填写错误信息
        "reasoning": "详细的分析推理过程"
    }

    请分析以下用户输入：`;
};

export const depositNotClear = (): string => {
    return `已确定用户存款的指令不清晰，请根据之后的内容，给出用户建议（比如建议用户给出明确的存款池子和金额）`;
}