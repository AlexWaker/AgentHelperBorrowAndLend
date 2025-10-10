export const withdrawPortfolioPrompt = (portfolioInfo: any) => {
  return `【提现投资组合信息任务】
  已确定用户意图为：提现投资组合信息

  【当前投资组合信息】
  ${JSON.stringify(portfolioInfo, null, 2)}

  【处理要求】
  - 用户的提取需求可能是多样的，比如5个sui，5u的sui，50%的sui等，这些要求其实都可以通过当前投资组合信息计算而来，请认真分析
  = 比如，用户说取出5u的sui，你需要先根据当前sui的价格，计算出5u的sui大概是多少数量（人类可读），然后根据decimals计算出多少mist
  - 如果用户的提取需求无法从当前投资组合信息中得到答案，请礼貌告知用户，并建议用户提供更多信息
  - 当用户说我需要取出1个sui之类的，并不是指的是1个mist，而是1个sui（人类可读），你需要根据decimals计算出多少mist
  - 当用户说百分之多少的时候，可以直接根据当前投资组合信息计算出mist数量
  - 一次性只能执行一次取钱操作，如果用户同时存了sui和wal，要求

  【返回格式】
    请严格按照以下 JSON 格式回复：
    {
      "coinType": 提取的币种类型,
      "amount": 提取的数量（用mist表示，只需要列举出数字，不需要跟着mist）
      "errorMessage": 如果有错误，请填写错误信息
      "reasoning": "详细的分析推理过程"
    }

  请分析以下用户输入：`;
};
