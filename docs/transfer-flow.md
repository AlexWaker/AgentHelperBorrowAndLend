# Sui 转账流程说明

- 入口：`src/Components/Chatwindows/ChatWindow.tsx`
- 解析与决策：`src/AiServer/OpenAIService.ts`
- 执行层：`src/SuiServer/SuiService.ts`
- 钱包签名：`@mysten/dapp-kit` 的 `useSignAndExecuteTransaction`

安全性：只有在钱包签名确认后才会广播交易；拒绝则终止。

---

## 调用逻辑与职责划分

- `ChatWindow.tsx`
  - 组装最近对话上下文，调用 `openAIService.processWithAgent(...)`
  - 注入 `signer`（由 `useSignAndExecuteTransaction` 提供）以实际执行交易

- `OpenAIService.ts`
  - 阶段一：意图识别（是否为转账）
  - 阶段二：转账参数解析（收款地址、金额等）
  - 组装参数调用 `suiService.transferSui(...)`

- `SuiService.ts`
  - 基于 `VITE_SUI_ENV` 初始化 `SuiClient`（`mainnet`/`testnet`/`devnet`）
  - 构建 `Transaction`（拆分 gas coin、转移对象）
  - 将交易交由外部 `signer` 签名与广播

- Provider（`src/main.tsx`）
  - `SuiClientProvider` + `WalletProvider` + `QueryClientProvider`
  - 当前默认网络：`testnet`（由 Provider 决定链）

---

## 数据流与契约

- 输入：用户自然语言消息（聊天）
- LLM 第一阶段输出（意图识别）：
  - `{ intent: 'TRANSFER' | 'QUERY_BALANCE' | 'OTHER' }`
- LLM 第二阶段输出（转账解析）：
  - `{ fromAddress: string, toAddress: string, amount: number, isValid: boolean, errorMessage: string }`
  - 使用字段：`toAddress`, `amount`, `isValid`, `errorMessage`
  - 单位：`amount` 是 SUI（人类可读）
- 服务层调用：
  - `suiService.toMist(amount)` → 转换为字符串 MIST
  - `suiService.transferSui({ to, amountMist, signer })` → 返回包含 `digest` 的结果（依钱包实现）
- 执行与回执：
  - 钱包签名弹窗 → 用户确认 → 广播交易 → 返回 `digest`
  - 失败则抛错或返回错误信息

---

## 核心代码片段

### 1) Chat 窗口注入 signer 并发起处理

```tsx
// src/Components/Chatwindows/ChatWindow.tsx（节选）
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
// ...
const currentAccount = useCurrentAccount();
const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

const response = await openAIService.processWithAgent(
  conversationHistory,
  !!currentAccount,
  currentAccount?.address,
  async ({ transaction }) => {
    // 拉起钱包签名 + 执行
    return await signAndExecute({ transaction });
  }
);
```

### 2) Agent 解析并调用转账

```ts
// src/AiServer/OpenAIService.ts（节选）
if (transferParsed.isValid) {
  const { toAddress, amount } = transferParsed;

  if (!signer) {
    return '无法发起转账：未提供钱包签名器，请先连接钱包或传入 signer。';
  }

  const transferResult = await suiService.transferSui({
    to: toAddress,
    amountMist: suiService.toMist(amount),
    signer, // 由 ChatWindow 注入
  });

  // transferResult 通常包含 digest，可用于后续查询与反馈
  // ...生成结果回复
}
```

### 3) 服务层构建交易与执行

```ts
// src/SuiServer/SuiService.ts（节选）
buildSuiTransferTransaction({ to, amountMist }) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(amountMist))]);
  tx.transferObjects([coin], tx.pure.address(to));
  return tx;
}

async transferSui({ to, amountMist, signer }) {
  const tx = this.buildSuiTransferTransaction({ to, amountMist });
  // 真正签名与广播由外部 signer 完成（会拉起钱包）
  return await signer({ transaction: tx });
}
```

---

## 网络与配置

- Provider 默认网络：`testnet`（`src/main.tsx`）
- 服务默认网络：`import.meta.env.VITE_SUI_ENV`（`'mainnet' | 'testnet' | 'devnet'`）
- 建议两者保持一致，避免“在 A 网络签名，但服务默认 B 网络”的心智负担

---

## 关键约束与错误处理

- 钱包未连接：
  - `processWithAgent` 起始检查：未连接时直接返回提示
  - 转账分支如未注入 `signer`，返回“未提供钱包签名器”
- 地址与金额：
  - 地址需 `0x` 开头，金额需 > 0
  - 金额单位转换：`SUI → MIST` 使用内部工具，避免精度问题
- 钱包交互：
  - 用户拒绝签名 → 交易不执行
  - 成功签名 → 返回 `digest`，可用于后续 confirm 与状态查询

---

## 可选增强

- 显式传入链前缀（如 `sui:testnet`），当前依赖 Provider 默认网络即可
- 等待上链反馈：`suiClient.waitForTransaction({ digest })`
- 更严格的地址/金额校验与提示
- 提示签名/广播中的错误细节，提升可观测性

---

## 小结

- 数据流：聊天 → Agent 识别/解析 → Service 构建交易 → 钱包签名执行
- 安全：必须用户签名才会广播
- 关键文件：`ChatWindow.tsx`（注入 signer）、`OpenAIService.ts`（业务编排）、`SuiService.ts`（交易构建与执行）
- 网络：由 Provider 控制（当前 `testnet`），建议与环境变量保持一致
