# agent-kit 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/agent-kit/`
最后核对：2026-04-26

本目录用于沉淀 `packages/agent-kit` 相关文档。

当前文档：

- 当前目录索引就是 `packages/agent-kit` 的主文档；后续新增专项说明时继续放入本目录并补到本列表。

包边界：

- 职责：
  - agent 基础构件
  - agent registry
  - runtime context helper
  - planner strategy
  - streaming execution facade
  - active memory / temporal context helper
- 允许：
  - 面向 agent 组合的轻量 kit API
  - 对 `@agent/core` 稳定 contract 的消费
  - 对 runtime、memory、tools、skill-runtime 等能力的薄封装与组合入口
- 禁止：
  - 直接承载垂直 agent graph 主链
  - 内联 app controller / UI view model
  - 泄漏第三方 SDK 原始类型到公共 contract
  - 替代 `packages/runtime` 成为主链编排宿主
- 依赖方向：
  - 依赖 `@agent/core`、`@agent/config`、`@agent/adapters`、`@agent/memory`、`@agent/skill-runtime`、`@agent/tools`
- 公开入口：
  - 根入口：`@agent/agent-kit`

约定：

- `packages/agent-kit` 的专项文档统一放在 `docs/packages/agent-kit/`
- 新增 agent kit 公开 API、demo 契约或包边界变化后，需同步更新本目录文档
- 若能力演进为稳定 runtime 主链或垂直 agent graph，应沉淀到对应真实宿主，而不是继续堆在 agent-kit
