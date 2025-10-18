export const withdrawPortfolioPrompt = (address: string | undefined): string => {
  return `【提现任务】
  已确定用户意图为：从当前投资组合中提取资产

  当前钱包地址：${address || '未连接'}

  【必须解析的信息】
  - 目标资产：池子 id（数字）或代币符号（大写，例如 SUI、USDC），至少提供一个
  - 可选的 coinType（若能确定，请输出完整 0x:: 类型；无法确认时填空字符串）
  - 提现金额（保持人类可读单位，不要转换成最小单位），支持 “5 SUI”“100 USD 的 USDC”“50% 的资产” 等表达
  - 金额单位：
    * 默认使用代币符号（保持大写）
    * 当用户写明美元金额时输出 "USD"
    * 当用户使用百分比时输出 "PERCENT"（0-100 范围，对应当前可提余额的百分比）
    * 当用户明确要求全部提取时，请将 amount 设为 100，unit 填写 "PERCENT"
  - 用户声明的地址（若有）必须与当前钱包一致
  - 若用户一次性请求多个资产，请提示暂不支持（isValid = false）

  【返回格式】
  请严格按照以下 JSON 输出，不要额外解释：
  {
    "address": "${address || '未连接'}",
    "id": 池子 id（未知时填 -1）, 
    "symbol": 代币符号（未知时填 "UNKNOWN"，其余保持全大写）, 
    "coinType": "0x..." 或 空字符串,
    "amount": 提现金额（数字）, 
    "unit": "USD" 或 代币符号（大写）或 "PERCENT", 
    "isValid": true 或 false,
    "errorMessage": 错误或缺失提示（无则填空字符串）, 
    "reasoning": "详细的分析推理过程"
  }

  请分析以下用户输入：`;
};

export const withdrawPortfolioNotClear = (): string => {
  return '已确定用户的提现信息不完整，请补充池子 id 或代币符号、提现金额及单位（币种 / USD / 百分比），若要全部提取请明确说明。';
};
