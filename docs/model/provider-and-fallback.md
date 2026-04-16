# Provider And Fallback

状态：current
文档类型：reference
适用范围：`packages/model`
最后核对：2026-04-16

## 1. 这篇文档说明什么

本文档说明 `@agent/model` 当前负责的 provider、chat / embedding factory 与 fallback 边界。

## 2. 当前目录结构

`packages/model/src` 当前主要分为：

- `src/providers`
  - provider normalize 与 provider 元数据
- `src/chat`
  - chat model factory
- `src/embeddings`
  - embedding model factory

## 3. 当前职责边界

`packages/model` 负责：

- provider normalize
- chat / embedding factory
- fallback candidate 基础逻辑
- provider metadata

不负责：

- flow-specific prompt
- graph / flow 编排
- 业务 heuristic

## 4. fallback 约束

模型降级和候选模型重试这类能力可以依赖 `@agent/model` 提供的基础装配，但不应在这里放：

- 具体业务节点 prompt
- 某一条 flow 的降级策略细节
- chat / review / learning 的业务判断

推荐做法：

- `packages/model`
  - 负责“有哪些 provider / model / candidate”
- `packages/runtime` / `agents/*`
  - 负责“在某条链路上什么时候切换”

## 5. 当前 provider 接入说明

当前 runtime provider 注册走两层：

- `packages/config`
  - 负责把 `.env` / overrides 解析成统一 `providers` 配置
- `packages/adapters`
  - 负责把 `providers` 配置装配成真实 `LlmProvider`

当前 runtime 对 `MiniMax` 采用“独立 provider 适配器 + 复用 `@agent/model` chat factory”的方式接入：

- `packages/config`
  - 负责产出 `type=minimax` 的 provider 配置
- `packages/adapters/src/llm/minimax-provider.ts`
  - 负责 `new MiniMaxProvider(config)`，并独立实现 provider 的文本/流式/结构化输出入口
- `packages/adapters/src/llm/runtime-provider-factory.ts`
  - 在 `type=minimax` 时显式注册 `MiniMaxProvider`
- `packages/model/src/chat/chat-model-factory.ts`
  - 提供 `createMiniMaxChatModel(...)` 作为更底层的 chat model 工厂

默认配置约定为：

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
  - 默认可省略，运行时会回落到 `https://api.minimaxi.com/v1`
- `MINIMAX_MANAGER_MODEL`
  - 默认 `MiniMax-M2.7`
- `MINIMAX_RESEARCH_MODEL`
  - 默认 `MiniMax-M2.5`
- `MINIMAX_EXECUTOR_MODEL`
  - 默认 `MiniMax-M2.5-highspeed`
- `MINIMAX_REVIEWER_MODEL`
  - 默认 `MiniMax-M2.7-highspeed`
- `MINIMAX_DIALOG_MODEL`
  - 默认 `M2-her`

如果只提供 `MINIMAX_API_KEY`，系统会自动生成一个 `id=minimax`、`type=minimax` 的 provider，并把以上 5 个模型加入可选模型列表。

## 6. 继续阅读

- [model 文档目录](/Users/dev/Desktop/learning-agent-core/docs/model/README.md)
- [Packages 分层与依赖约定](/Users/dev/Desktop/learning-agent-core/docs/package-architecture-guidelines.md)
