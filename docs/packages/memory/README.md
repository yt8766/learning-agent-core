# memory 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/memory/`
最后核对：2026-04-20

本目录用于沉淀 `packages/memory` 相关文档。

优先阅读：

- [agent-memory-architecture.md](/docs/packages/memory/agent-memory-architecture.md)
- [storage-and-search.md](/docs/packages/memory/storage-and-search.md)

包边界：

- 职责：
  - memory/rule/runtime-state repository、semantic cache 与 memory 自身搜索
  - runtime state 中的 workspace skill reuse record 持久槽位
- 允许：
  - repository
  - search contract
  - cache 基础设施
- 禁止：
  - agent 主链编排
  - review / delivery / research 流程控制
  - knowledge chunking / retrieval / citation
- 依赖方向：
  - 只依赖 `@agent/core`、`@agent/config`、`@agent/adapters`
  - 被 backend、runtime、agents 消费
- 公开入口：
  - 根入口：`@agent/memory`
- 约定：
  - 统一只从 `@agent/memory` 根入口导入
  - `repositories/*`、`search/*`、`embeddings/*` 是当前真实宿主目录
  - helper 的 canonical host 已收敛到：
    - `normalization/memory-record-helpers.ts`
    - `governance/memory-repository-governance.ts`
    - `governance/memory-usage-insights.ts`
    - `governance/memory-version-compare.ts`
    - `governance/cross-check-evidence.ts`
  - 包根 `memory-record-helpers.ts`、`memory-repository-governance.ts` 已删除
  - 内部过渡薄层 `shared/memory-record-helpers.ts` 与 `repositories/memory-repository-governance.ts` 也已删除
  - `contracts/*` 当前仅保留稳定 facade 入口，便于调用方使用显式 contract import
  - 消费侧默认继续从 `@agent/memory` 根入口导入，不依赖包内物理路径

约定：

- `packages/memory` 的专项文档统一放在 `docs/packages/memory/`
- 新增记忆模型、存储策略、检索规则或清理机制后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [package-structure-guidelines.md](/docs/packages/memory/package-structure-guidelines.md)
- [agent-memory-architecture.md](/docs/packages/memory/agent-memory-architecture.md)
- [storage-and-search.md](/docs/packages/memory/storage-and-search.md)

补充：

- RAG knowledge ingestion / retrieval / citation 从 `2026-04-18` 起开始收口到 `packages/knowledge`
- `RuntimeStateSnapshot.workspaceSkillReuseRecords` 从 `2026-04-26` 起作为 `AgentSkillReuseRecord[]` 的最小持久槽位存在；`load()` 对旧快照默认补空数组，避免 learning flow 或 Workspace Center 写入的复用记录被顶层白名单丢弃。runtime 写入端按幂等 id 覆盖同一 run/task + skill 的重复记录，Workspace Center 读取端按 `workspaceId` 过滤并只投影 core contract 字段。
