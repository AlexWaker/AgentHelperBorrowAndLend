// import { supportCoin } from "./SupportCoin";
export const depositPrompt = (): string => {
    return `【质押任务】
    已确定用户意图为：往某个池子里质押

    【用户需要明确提供的数据】
    - 池子id或代币名称（二者必须至少提供一个）
    - 质押金额（usd形式或币种，比如50u的sui，10个sui这种）

    【返回格式】
    请严格按照以下 JSON 格式回复：
    {
    "id": 要存的池子id（用户明确指定的时候填写，否则填写unknown）,
    "symbol": 要存的代币名称（用户明确指定的时候填写，否则填写unknown）,
    "amount": 存款金额（数字）,
    "isValid": true/false（用户指令是否足够清晰明确进行质押）,
    "errorMessage": 如果有错误，请填写错误信息
    "reasoning": "详细的分析推理过程"
    }

    请分析以下用户输入：`;
};

export const depositNotClear = (): string => {
    return `已确定用户存款的指令不清晰，请根据之后的内容，给出用户建议（比如建议用户给出明确的存款池子和金额）`;
}