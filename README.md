# Hackthon1 · AI 驱动的 Sui dApp（余额查询示例）

一个基于 React + Vite 的 Sui dApp，内置 AI 助手：
- 识别用户意图（如“查询余额”）
- 自动抽取地址并调用链上 RPC 查询 SUI 余额
- 支持钱包连接与多网络配置（默认 testnet）

## 功能概览
- 聊天式 AI 助手：`src/AiServer/OpenAIService.ts`
  - 首轮意图识别（normalPrompt + firstIntentAnalysis）
  - 余额意图二次解析（queryCoinPrompt）
  - 调用 SuiService 查询余额并格式化返回
- Sui 客户端管理：`src/SuiServer/SuiClientManager.ts`
  - 基于 `@mysten/sui` 维护 mainnet/testnet/devnet 客户端单例
  - 支持通过环境变量覆盖 RPC URL
- 业务服务层：`src/SuiServer/SuiService.ts`
  - 提供 `getSuiBalance(owner)` 最小余额查询能力（单位 MIST）
  - 提供 `toSUI(mist)` 的简单展示换算（1 SUI = 1e9 MIST）
- 应用框架：
  - `@mysten/dapp-kit` 钱包与 SuiClientProvider
  - React + TypeScript + Vite + Radix UI + TanStack Query

## 技术栈
- React 18, TypeScript, Vite 7
- @mysten/dapp-kit 0.17, @mysten/sui 1.37
- OpenAI SDK 5（可配置 DeepSeek/OpenAI 等兼容提供商）

## 目录速览
- `src/main.tsx`：应用入口，挂载 SuiClientProvider（默认网络 testnet）
- `src/networkConfig.ts`：网络配置（devnet/testnet/mainnet）
- `src/AiServer/`：AI 相关（提示词、意图枚举、OpenAIService）
- `src/SuiServer/`：Sui 客户端与业务服务（SuiClientManager / SuiService）
- `src/Components/`：UI 组件（包含聊天窗口类型定义）

## 快速开始
1) 安装依赖
```bash
pnpm install
```

2) 配置环境变量（复制 `.env.example` 为 `.env` 并填写）
```bash
cp .env.example .env
```
在 `.env` 中配置：
- `VITE_OPENAI_API_KEY`：你的 API Key
- `VITE_OPENAI_API_URL`：服务提供商的 Base URL（注意应是 API 根路径，而非具体的 /chat/completions，示例：
  - OpenAI 官方：`https://api.openai.com/v1`
  - DeepSeek：`https://api.deepseek.com`
）
- `VITE_OPENAI_MODEL`：如 `gpt-4o-mini`、`gpt-3.5-turbo` 或 `deepseek-chat`

可选网络覆盖（供前端 RPC 指定自定义节点）：
- `VITE_SUI_MAINNET_URL`
- `VITE_SUI_TESTNET_URL`
- `VITE_SUI_DEVNET_URL`

3) 启动开发服务器
```bash
pnpm dev
```

4) 在浏览器中体验
- 连接钱包（页面右上/相关 UI，由 dapp-kit 提供）
- 在聊天输入框中输入：
  - “查询余额” 或 “查这个地址余额 0x…”，AI 会解析地址并返回余额

## 核心代码片段
查询余额（业务层）：`src/SuiServer/SuiService.ts`
```ts
const balanceMist = await suiService.getSuiBalance('0x...');
const balanceSui = suiService.toSUI(balanceMist);
```

AI 调用（摘自 `OpenAIService.processWithAgent` 的 QUERY_BALANCE 分支）：
```ts
const balanceMist = await suiService.getSuiBalance(address);
const balanceSui = suiService.toSUI(balanceMist);
return `地址 ${short} 的 SUI 余额：${balanceSui} SUI（${balanceMist} MIST）`;
```

## 网络与钱包
- 默认网络：`testnet`（见 `src/main.tsx` 与 `SuiService` 默认参数）
- 可通过 `SuiClientManager.setSuiRpcUrl(network, url)` 在运行时切换自定义节点
- 钱包与客户端由 `SuiClientProvider` 和 `WalletProvider` 管理

## 构建与预览
```bash
pnpm build
pnpm preview
```

## 可选：Move 合约
本项目包含 `move/` 目录，若需部署自定义 Move 包，请参考 Sui CLI 文档进行发布；与本示例的“余额查询”功能无强依赖。

## 常见问题
- 提示“请先连接钱包以使用 AI 助手功能”：
  - 需要先在页面中连接钱包，或放宽逻辑允许离线查询（可改动 `OpenAIService` 前置校验）。
- OpenAI/DeepSeek 接口 401 或 404：
  - 检查 `VITE_OPENAI_API_KEY` 与 `VITE_OPENAI_API_URL` 是否正确，`API_URL` 应为提供商的 API 根路径。
- 余额一直为 0：
  - 确认查询网络正确（testnet/mainnet），以及地址确实在对应网络有余额。

## 许可证
本仓库遵循上游依赖的许可证；示例代码可自由用于学习与黑客松原型。
