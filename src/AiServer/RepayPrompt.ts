export const repayPrompt = (address: string | undefined): string => {
  return `【还款任务】
  已确定用户意图为：偿还 Navi 平台的借款

  当前钱包地址：${address || '未连接'}

  【必须解析的信息】
  - 目标资产：池子 id（数字）或代币符号（大写，例如 SUI、USDC），至少提供一个
  - 还款金额（正数），支持“10 SUI”“100 USD 的 USDC”“50% 的借款”等表达
  - 金额单位：
    * 默认使用代币符号（保持大写）
    * 当用户写明美元金额时输出 "USD"
    * 当用户使用百分比时输出 "PERCENT"（0-100 范围，对应当前未偿还借款的百分比）
  - 用户声明的付款地址（若有）必须与当前钱包一致
  - 若用户提供 accountCapId，请原样保留；未提供时输出 "NONE"

  【校验规则】
  - 未连接钱包（address 为 "未连接"）或缺少金额/池子信息 -> isValid = false
  - 金额 <= 0、无法判断币种或池子 -> isValid = false，并在 errorMessage 中说明原因
  - unit 为 "PERCENT" 时，amount 必须在 0-100 范围内
  - 用户提供的 address 与当前钱包不一致 -> isValid = false
  - 若用户一次性请求多个资产的还款，请提示暂不支持（isValid = false）

  【返回格式】
  请严格按照以下 JSON 输出，不要额外解释：
  {
    "address": "${address || '未连接'}",
    "id": 池子 id（未知时填 -1）, 
    "symbol": 代币符号（未知时填 "UNKNOWN"，其余保持全大写）, 
    "amount": 还款金额（数字）, 
    "unit": "USD" 或 代币符号（大写）或 "PERCENT", 
    "accountCapId": account cap id（未知时填 "NONE"）, 
    "isValid": true/false,
    "errorMessage": 错误或缺失提示（无则填空字符串）, 
    "reasoning": "详细的分析推理过程"
  }

  请分析以下用户输入：`;
};

export const repayNotClear = (): string => {
  return '已确定用户的还款信息不完整，请补充明确的池子 id 或代币符号、还款金额及单位（币种 / USD / 百分比），若有 accountCapId 也请提供。';
};
