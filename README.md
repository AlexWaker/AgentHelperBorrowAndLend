# AgentHelperBorrowAndLend · AI 驱动的 Sui 借贷助手

![AgentHelperBorrowAndLend Banner](docs/images/cover.png)

> 一站式体验：AI 聊天理解需求 → 自动解析链上数据 → 给出可执行建议。借助 Vite + React 构建的轻量前端，结合 Sui RPC 与 OpenAI 兼容接口，让查、转、存、借、还流程真正实现“开口即用”。

---

## 📌 目录
- [项目亮点](#项目亮点)
- [功能清单](#功能清单)
- [快速上手](#快速上手)
- [核心模块拆解](#核心模块拆解)
- [AI 工作流详解](#ai-工作流详解)
- [项目结构](#项目结构)
- [开发调试指南](#开发调试指南)
- [常见问题 FAQ](#常见问题-faq)
- [未来规划](#未来规划)
- [许可证](#许可证)

---

## 项目亮点
- 🤖 **AI 智能对话**：支持中文/英文指令，自动抽取意图（余额查询、转账、借贷操作等）并返回链上反馈。
- 🌉 **Sui 多网络兼容**：内置 mainnet / testnet / devnet，可通过环境变量或运行时动态切换 RPC。
- 🔌 **钱包无缝连接**：集成 `@mysten/dapp-kit`，带来即插即用的钱包组件与签名能力。
- 🧱 **模块化架构**：AI 层、链上服务层、UI 层解耦，方便扩展策略逻辑或替换 AI 服务商。
- ⚙️ **Walrus部署**：项目部署在Walrus上，分布式存储，让网站更长久更安全。

---

## 功能清单
| 功能 | 如何提问（使用） | 示例
| --- | --- | --- |
| 余额查询 | 直接提问“查询余额”或“查这个地址余额 0x...”，助手会自动识别地址并返回结果。 |
| 借贷意图 | 说明需求，如“我要借 50 SUI”“提醒我归还贷款”，触发对应提示词和处理流程。 |
| 转账辅助 | 描述转账请求，例如“帮我转 5 SUI 给 0xABC...”，系统会引导确认细节。 | 帮我转5U的sui给xxx；帮我转5个Sui给xxx；帮我转我当前帐户30%的Sui给xxx |

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

## 核心模块拆解

### 1. AI 服务层 (`src/AiServer/`)
- `OpenAIService.ts`：封装聊天、意图识别、多轮对话流程。
- `BorrowPrompt.ts` 等：针对借贷流程设计的系统提示词。
- `IntentType.ts` / `IntentType.json`：规范化意图枚举，确保前后端一致。

### 2. 链上业务层 (`src/SuiServer/`)
- `SuiService.ts`：提供 `getSuiBalance`、`toSUI` 等上层 API。
- `CoinManager.ts`：集中管理 Sui 客户端实例及 RPC 缓存策略。

### 3. UI 层 (`src/Components/`, `src/Pages/`)
- `Chatwindows/`：消息列表、输入框、提示气泡等组件。
- `Toolbar/`：语言切换、钱包状态、网络选择。
- `Pages/Home.tsx`：整体布局与上下文提供者。

---

## AI 工作流详解
1. **触发对话**：用户在聊天框输入“帮我查 0x123 的余额”。
2. **意图识别**：`OpenAIService` 使用 `GlobalPrompt` + `firstIntentAnalysis` 得出意图 `QUERY_BALANCE`。
3. **参数抽取**：`QueryCoinPrompt` 二次解析，定位地址/币种。
4. **链上查询**：`SuiService.getSuiBalance` 调用 RPC，获得 MIST 数值并换算为 SUI。
5. **结果生成**：AI 将结果格式化为自然语言，并发送给前端。
6. **界面展示**：Chat 窗口展示回复，并可继续引导下一步操作。

> 你可以在 `src/AiServer/BorrowPrompt.ts` 等文件扩展新的借贷/还款流程，复用已有模板即可快速迭代。

---

## 项目结构
```
AgentHelperBorrowAndLend/
├── docs/
│   └── transfer-flow.md
├── move/
│   └── counter/
├── src/
│   ├── AiServer/
│   ├── Components/
│   ├── Pages/
│   ├── SuiServer/
│   ├── globalStyles.ts
│   ├── main.tsx
│   └── networkConfig.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.mts
```

---

## 开发调试指南

### 常用脚本
```bash
pnpm dev           # 本地开发
pnpm build         # 生产构建
pnpm preview       # 预览生产构建
pnpm lint          # 运行 ESLint
pnpm format        # 执行 Prettier
pnpm test          # 如启用测试，可在此运行
```

### 调试技巧
- **查看 AI 请求**：在浏览器 Network 面板观察 `/v1/chat/completions` 请求 payload，便于优化提示词与参数。
- **切换网络**：通过工具栏或 `SuiClientManager.setSuiRpcUrl` 动态调整 RPC 节点。
- **请求节流**：在 `OpenAIService` 中添加节流/缓存策略，避免重复调用造成费用消耗。

---

## 常见问题 FAQ
| 问题 | 解决方案 |
| --- | --- |
| AI 请求返回 401/404 | 检查 API Key 与 `VITE_OPENAI_API_URL` 是否正确，URL 必须是根路径。 |
| 查询结果一直为 0 | 确认当前网络（testnet/mainnet）与查询地址一致，并确保地址确有余额。 |
| 钱包无法连接 | 确保钱包支持 `@mysten/dapp-kit`，或在浏览器无痕模式重试。 |
| 想切换其他模型 | 在 `.env` 中调整 `VITE_OPENAI_MODEL`，例如 `gpt-4.1-mini`，并根据需要微调提示词。 |

---

## 未来规划
- [ ] 扩展借贷策略流程（质押、赎回、利率分析）。
- [ ] 引入会话记忆与上下文持久化（IndexedDB / Supabase）。
- [ ] 完成多语言界面支持（i18n）。
- [ ] 增加自动化测试与 CI（Vitest + GitHub Actions）。

欢迎通过 Issues / PR 提出建议或贡献代码。

---

## 许可证
本项目遵循现有依赖的开源协议，示例代码可自由用于学习、黑客松展示或进一步商业化迭代。若引用第三方资源，请确保遵守相应的许可证要求。
