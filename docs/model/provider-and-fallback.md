# Provider And Fallback

状态：current
适用范围：`packages/model`
最后核对：2026-04-14

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
- `packages/agent-core`
  - 负责“在某条链路上什么时候切换”

## 5. 继续阅读

- [model 文档目录](/Users/dev/Desktop/learning-agent-core/docs/model/README.md)
- [Packages 分层与依赖约定](/Users/dev/Desktop/learning-agent-core/docs/package-architecture-guidelines.md)
