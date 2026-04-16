# memory 文档目录

状态：current
文档类型：index
适用范围：`docs/memory/`
最后核对：2026-04-16

本目录用于沉淀 `packages/memory` 相关文档。

优先阅读：

- [agent-memory-architecture.md](/docs/memory/agent-memory-architecture.md)
- [storage-and-search.md](/docs/memory/storage-and-search.md)

包边界：

- 职责：
  - memory/rule/runtime-state repository、vector index、semantic cache 与搜索
- 允许：
  - repository
  - search contract
  - vector / cache 基础设施
- 禁止：
  - agent 主链编排
  - review / delivery / research 流程控制
- 依赖方向：
  - 只依赖 `@agent/shared`、`@agent/config`、`@agent/model`
  - 被 backend、agent-core 消费
- 公开入口：
  - 根入口：`@agent/memory`
- 约定：
  - 统一只从 `@agent/memory` 根入口导入
  - `repositories/*`、`search/*`、`vector/*`、`embeddings/*` 作为包内组织目录保留，但不作为消费侧导入入口

约定：

- `packages/memory` 的专项文档统一放在 `docs/memory/`
- 新增记忆模型、存储策略、检索规则或清理机制后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [agent-memory-architecture.md](/docs/memory/agent-memory-architecture.md)
- [storage-and-search.md](/docs/memory/storage-and-search.md)
