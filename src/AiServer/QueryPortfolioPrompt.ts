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
  // 防止直接插值对象导致 [object Object]，这里做格式化处理
  const formatResult = (val: any): string => {
    if (val == null) return 'null';
    if (typeof val === 'string') {
      // 如果已经是字符串且看起来像 JSON，就直接返回
      const trimmed = val.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return trimmed;
      }
      return val;
    }
    try {
      // 处理 BigInt -> string，避免 JSON.stringify 报错
      const replacer = (_k: string, v: any) => typeof v === 'bigint' ? v.toString() : v;
      const json = JSON.stringify(val, replacer, 2);
    //   防止过长 prompt，截断并提示（可按需调整阈值）
      const MAX = 12000; // 字符阈值
      if (json.length > MAX) {
        return json.slice(0, MAX) + '\n...（已截断，实际数据更长）';
      }
      return json;
    } catch (e) {
      return '[无法序列化的结果]';
    }
  };
  const pretty = formatResult(queryResult);
     return `【查询投资组合任务】

当前原始投资组合（portfolio）数据（JSON 数组，每个元素代表一个池的持仓/借款情况）：
${pretty}

【字段说明（单条 portfolio 结构）】
顶层常见字段：
- assetId: 资产/池子 ID（与 pool.id 对应）
- borrowBalance: 当前地址在该池的借款余额（原始最小单位字符串，为 "0" 表示未借）
- supplyBalance: 当前地址在该池的存款余额（原始最小单位字符串）
- pool: 该池的元数据与风险/利率/奖励信息对象

pool 内常见字段：
- id: 池子 ID（和 assetId 关联）
- coinType / suiCoinType: 资产在链上的完整 Move 类型标识（有时两个字段相同，保留链上唯一性）
- token: { symbol, decimals, logoUri } 其中 decimals 用于把 supplyBalance / borrowBalance 转成人类可读数量
- oracle: { price, value, decimal, valid } price 为 USD 价格（字符串），value 是原始预言机内部值（decimal 决定精度）
- ltv: 最高贷款价值比（高精度大整数，未提供精度时不要臆算；可声明“原始值”）
- borrowCapCeiling / supplyCapCeiling: 借款/存款总上限（原始大整数或科学计数字符串）
- currentBorrowIndex / currentSupplyIndex: 利息（复利）累积指数，随时间递增，用于内部结息计算
- currentBorrowRate / currentSupplyRate: 实时利率（底层定点数，若未给出精度，回答时说明“原始速率值”即可）
- totalSupply / totalBorrow: 全局累计存入/借出量（原始或衍生统计）
- totalSupplyAmount: 可能与 totalSupply 差异（具体需官方文档，回答可并列展示）
- borrowedAmount: 已被借出的量（原始值）
- availableBorrow: 该池当前剩余可借额度（流动性判断）
- validBorrowAmount / leftBorrowAmount / leftSupply: 剩余或可用容量指标（互相关联，不能重复自相矛盾）
- leftSupply: 剩余可再存入的可用空间或估算剩余供应容量
- minimumAmount: 发起一次操作的最小数量（小于该值的 supply 或 borrow 可能被拒）
- treasuryBalance: 协议金库余额（用于奖励/风险缓冲）
- treasuryFactor: 协议对收益抽成或分润因子（高精度）
- isIsolated: 是否隔离池（隔离池的抵押风险不与其它资产共享）
- lastUpdateTimestamp: 最近状态更新时间戳（可能是毫秒/纳秒样式的长整数字符串，避免误判）
- oracleId: 价格源 ID（和 oracle 对象相对应）
- supplyIncentiveApyInfo / borrowIncentiveApyInfo: 存款 / 借款的奖励信息对象：
  - apy: 综合年化收益（百分数字符串）
  - vaultApr / boostedApr / treasuryApy / stakingYieldApy: 组成 APY 的不同来源（可能有的为 "0"）
  - rewardCoin: 奖励发放的代币 coinType 列表（可能包含多个，如主币 + 衍生证书）
  - voloApy 等字段若为 "0" 可直接说明暂无该来源奖励
- liquidationFactor: { threshold, ratio, bonus }：清算相关参数（例如 threshold ~ 触发清算 LTV；bonus 为清算人奖励；ratio 代表折价/回收因子）
- borrowRateFactors: 利率曲线或参数配置对象（结构内部复杂时可概述为“内部利率因子配置”）
- contract: { reserveId, pool, rewardFundId } 相关链上合约/存储对象 ID

请基于用户问题与以上数据，生成清晰的回答。`;
}