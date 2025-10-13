export const withdrawPortfolioPrompt = (portfolioInfo: any) => {
  return `【提现任务】
  已确定用户意图为：从当前投资组合中提取资产

  【当前投资组合信息】
  ${JSON.stringify(portfolioInfo, null, 2)}

  【处理要求】
  - 解析用户要提取的资产类型与数量：支持“5 SUI”“5 美元的 SUI”“50% 的 USDC”等自然语言
  - 根据 portfolioInfo 中的仓位、价格和 decimals，将人类可读数量换算成最小单位（mist），结果需为整数
  - 用户若给出百分比，应按对应仓位折算；若给出美元金额，需结合价格估算对应币量
  - 若用户请求的资产不在 portfolioInfo 中、或无法推导金额，需返回错误提示
  - 一次只处理一种资产；若用户同时提出多个提取请求，请提示只支持单笔并给出 errorMessage

  【返回格式】
  请严格按照以下 JSON 输出：
  {
    "coinType": 币种类型（Sui 完整 0x 类型，或无法确定时填空字符串）, 
    "amount": 提取数量（用 mist 表示，只输出整数数字字符串）, 
    "errorMessage": 错误提示（无错误时填空字符串）, 
    "reasoning": "详细的分析推理过程"
  }

  请分析以下用户输入：`;
};
