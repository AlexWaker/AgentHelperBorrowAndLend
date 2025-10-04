// Prompt: 解释用户地址在 Navi 协议中的投资组合（portfolio）与池子（pool）字段含义，
// 引导 LLM 用这些原始指标生成友好回答。
export const portfolioInfoPrompt = (): string => {
        return `【投资组合与池子字段说明】
        - assetId: 与池子 id 对应（可视为该资产池的唯一编号）。
        - borrowBalance: 当前地址在该池子的累计借款余额（原始最小单位 / 可能是整数字符串）。为 "0" 表示未借贷。
        - supplyBalance: 当前地址提供(存入)的资产数量（原始最小单位 / 整数字符串）。
        - id: 池子 id（与 assetId 对应）。
        - coinType / suiCoinType: 完整 Sui Move 类型标识，用于链上唯一定位该资产。
        - borrowCapCeiling: 借款上限（原始精度大整数，限制全局总借出规模）。
        - supplyCapCeiling: 存款上限（可能出现科学计数法字符串）。
        - currentBorrowIndex / currentSupplyIndex: 利息累积指数（一般为高精度定点数，随时间递增）。
        - currentBorrowRate / currentSupplyRate: 实时借/供利率（定点数大整数，需按协议精度换算才能转成人类年化/日化；如果未提供精度，回答中保持“原始速率值”说明即可）。
        - totalSupplyAmount: 链上统计的总存入量原始值。
        - totalSupply / totalBorrow: 统计用聚合量（可能与 *Amount 字段在定义/场景上略有差异，保留原值并说明）。
        - borrowedAmount: 当前池子已被借出的总额（原始值）。
        - availableBorrow: 剩余可借额度（可用于提示流动性充足或紧张）。
        - leftBorrowAmount / leftSupply: 可能表示剩余容量（不同命名代表借款与存款方向的余量）。
        - validBorrowAmount: 在风险参数约束下实际可用的最大安全借款额度（估算值）。
        - minimumAmount: 发起一次操作的最小数量（小于此值的 supply / borrow 操作可能被拒绝）。
        - treasuryBalance: 协议金库持有余额（用于奖励/风险缓冲）。
        - treasuryFactor: 协议抽成/金库分润因子（高精度定点数）。
        - ltv: 最高贷款价值比 (Loan-To-Value)。通常需要除以 1e(协议精度) 才得到百分比。例如若精度是 1e27，600000000000000000000000000 ≈ 0.6 (60%)。若未给精度，回答时加“原始值”说明。 
        - isIsolated: 是否隔离资产池（true 时其风险不与其它资产交叉）。
        - lastUpdateTimestamp: 最近一次状态更新的时间戳（毫秒或秒；如果数值长度 > 13 可能需判断是否多了精度）。
        - oracleId: 预言机 id（与 oracle 对象对应）。
        - supplyIncentiveApyInfo / borrowIncentiveApyInfo: 存款/借款激励信息（包含奖励 APY、奖励代币等）。
        - borrowRateFactors / liquidationFactor: 风险参数集合（Liquidation 相关因子、利率曲线参数等）。
        - token: 包含 symbol / decimals / icon / 名称等元数据（用来把最小单位换成人类可读数）。
        - oracle: 价格相关信息（例如 price）。
        - contract: 与部署合约相关的地址或配置。

        【回答要求】
        1. 如用户只问“我在这个池子有多少” → 提供 supplyBalance (换成人类单位若给了 decimals) + 当前价格估算美元价值（如果 oracle.price 可用）。
        2. 如用户问“还能借多少” → 使用 availableBorrow（说明单位来源）并结合 ltv 的含义提醒风险。
        3. 如用户问“利率/收益” → 指出 currentSupplyRate / currentBorrowRate 是原始速率，并说明缺少精度时无法直接百分比换算（可提示用户查官方文档）。
        4. 如果字段没有（为空 / undefined），不要编造，标注“该字段当前未提供”。
        5. 对极大整数可做可读化展示（例如 115367961783516685 ≈ 1.153e17 原始单位），但务必同时保留原始值或说明“(原始值保留如上)”。
        6. 不要随意假设精度；若缺少 decimals，提示“需要 decimals 才能精确换算”。
        7. 当用户的问题超出当前字段（例如“清算罚金是多少”但缺少相关参数），请礼貌说明并可建议他们前往官网 https://app.naviprotocol.io/ 获取更多详情。

        【输出风格建议】
        - 专业 + 易懂：先结果，再解释。
        - 风险提醒适度：涉及借款、可用额度、LTV、清算时进行提示。
        - 支持条目化列出各池持仓：列出 symbol / 供应量 / 借款量 / 可借余量。

准备好后根据用户的具体提问生成回答。`;
}