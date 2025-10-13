// import { supportCoin } from "./SupportCoin";
export const depositPrompt = (address: string | undefined): string => {
    return `【质押任务】
    已确定用户意图为：往 Navi 指定池子质押资产

    当前钱包地址：${address || '未连接'}

    【必须解析的信息】
    - 池子 id（数字）或代币符号（大写，例如 SUI、USDC），至少提供一个
    - 质押金额（正数），支持“10 SUI”或“100 USD”这类表达
    - 金额单位：当用户写明美元时输出 "USD"，否则输出对应的代币符号（大写）

    【校验规则】
    - 未连接钱包（address 为 "未连接"）或缺少金额/池子信息 -> isValid = false
    - 金额 <= 0、无法判断币种、池子符号与用户要求冲突 -> isValid = false，并在 errorMessage 中说明原因
    - 若用户显式给出 from 地址，与当前钱包不一致时需提示冲突（依然设置 isValid=false）

    【返回格式】
    请严格按照以下 JSON 输出，不要额外解释：
    {
      "address": "${address || '未连接'}",
      "id": 池子 id（未知时填 -1）, 
      "symbol": 代币符号（未知时填 "UNKNOWN"，其余保持全大写）, 
      "amount": 质押金额（数字）, 
      "unit": "USD" 或 代币符号（大写）, 
      "isValid": true/false,
      "errorMessage": 错误或缺失提示（无则填空字符串）, 
      "reasoning": "详细的分析推理过程"
    }

    请分析以下用户输入：`;
};

export const depositNotClear = (): string => {
    return '已确定用户的存款信息不完整，请提醒用户补充明确的池子 id 或代币符号、质押金额及单位。';
}