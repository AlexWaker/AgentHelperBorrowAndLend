# Agenavi· AI 驱动的 Navi 助手

![AgentHelperBorrowAndLend Banner](docs/images/cover.png)

> 一站式体验：AI 聊天理解需求 → 自动解析链上数据 → 给出可执行建议。借助 Vite + React 构建的轻量前端，结合 Sui RPC 与 OpenAI 兼容接口，让查、转、存、借、还流程真正实现“开口即用”。

---

## 相关链接

- ❗️ 项目网站：https://agenavi.wal.app/
- ❗️ 官推：[@agentonsui](https://x.com/agentonsui)
- ❗️ Navi官网：https://naviprotocol.io/

---

## 📌 目录
- [项目亮点](#项目亮点)
- [功能清单](#功能清单)
- [快速上手](#快速上手)
- [注意事项](#注意事项)
- [未来规划](#未来规划)

---

## 项目亮点
- 🤖 **AI 智能对话**：支持中文/英文指令，自动抽取意图（余额查询、转账、借贷操作等）并返回链上反馈。
- 🪐 **纯自然语言描述**：无需任何提问格式，不存在结构化/正则匹配关键词的情况，AI分析意图，支持绝对的自然语言（口语）！
- ✨ **支持多币种与精准匹配**：支持Navi所有池子币种，查转存取借还均无需指定池子Id、币种合约等信息，小白也能用！
- 🌉 **Sui 多网络兼容**：内置 mainnet / testnet / devnet，可通过环境变量或运行时动态切换 RPC。
- 🔌 **钱包无缝连接**：集成 `@mysten/dapp-kit`，带来即插即用的钱包组件与签名能力。
- 🧱 **模块化架构**：AI 层、链上服务层、UI 层解耦，方便扩展策略逻辑或替换 AI 服务商。
- ⚙️ **Walrus部署**：项目部署在Walrus上，分布式存储，让网站更长久更安全。

---

## 功能清单
| 功能 | 如何提问（使用） | 示例
| --- | --- | --- |
| 余额查询 | 直接提问“查询某个币种的余额”或“查某个地址某个币种余额”，助手会自动识别地址并返回结果。 | 帮我查询我现在有多少Sui; 帮我查xxx地址有多少USDC；|
| 查询意图 | 可帮你查询你当前的portfolio和池子信息 | 当前有哪些池子收益很高；当前有哪些池子借款利率低于存款利率；我当前存了多少xbtc在里面； |
| 转账意图 | 描述转账请求，例如“帮我转 5 SUI 给 0xABC...”，系统会引导确认细节。 | 帮我转5U的sui给xxx；帮我转5个Sui给xxx；帮我转我当前帐户30%的Sui给xxx；我当前借了多少钱； |
| 存款意图 | 描述存钱需求即可，无需指定池子Id或代币合约 | 帮我把5U的Sui存到池子里；帮我把5个sui存到池子里；帮我把全部的sui存到池子里 |
| 取款意图 | 描述取钱需求即可，无需指定池子id或代币合约 | 帮我取出一半的navi；帮我取出10刀的Sui；帮我取出10个wal；|
| 借款意图 | 描述你想借款的币种和数量即可 | 帮我借出来5U的deep；帮我借100个Wal；|
| 还款意图 | 描述你想还款的币种和数量即可 | 帮我还清所有的Sui；帮我还20%的Sui；帮我还5U的Sui

---

## 快速上手

### 环境要求
- Node.js ≥ 20（与 `package.json` 中 `engines` 字段保持一致）
- pnpm ≥ 8
- 可访问的 OpenAI 兼容模型服务（如 OpenAI、DeepSeek 等）
- 一个 Sui 钱包（建议使用 Sui Wallet 或任意兼容 dapp-kit 的钱包）

### 1. 安装依赖
```bash
pnpm install
```

> 首次执行 `pnpm install` 会触发 `preinstall` 钩子编译 SDK（`pnpm sdk:build`），请耐心等待。

### 2. 配置环境变量
```bash
cp .env.example .env
```

在 `.env` 中填写：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `VITE_OPENAI_API_KEY` | ✅ | AI 提供商的 API Key |
| `VITE_OPENAI_API_URL` | ✅ | API 根路径（如 `https://api.openai.com/v1` 或 `https://api.deepseek.com`） |
| `VITE_OPENAI_MODEL` | ✅ | 模型名称，如 `gpt-5-mini`、`deepseek-chat` |
| `VITE_SUI_ENV` | ✅ | mainnet、testnet、devnet可选 |

### 3. 启动开发服务器
```bash
pnpm dev
```
访问 [http://localhost:5173](http://localhost:5173)，连接钱包后即可与 AI 助手对话。

### 4. 构建与预览
```bash
pnpm build
pnpm preview
```

---

## 注意事项

- ⚠️ 当前仅支持一句话描述单意图，不可同时提出多种需求
- ⚠️ 当前仅支持与Navi Protocol进行交互，不支持其他DeFi

---

## 未来规划
- 🍃 多意图打包签名发送，让多种操作一键搞定。
- 🌛 接入Astra，支持用自然语言进行Swap。
- 🌞 继续优化Prompt，支持更加多样化的自然语言描述。
- ☕️ 融入Navi，成为Navi网站的一个功能模块。
- 🍞 增设 DeFi 聚合看板、币种报价、新闻等模块，做到“看到就问，立刻解答”。
- 🥥 支持Sui上其他DeFi，如Headal、Scollop等。
- 🍊 扩展至其他链（以太坊、Solana等），增设用自然语言跨链功能，成为全链（抽象链）Agent。

欢迎通过 Issues / PR 提出建议或贡献代码。

---
