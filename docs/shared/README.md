# shared 文档目录

状态：current
文档类型：index
适用范围：`docs/shared/`
最后核对：2026-04-16

本目录用于沉淀 `packages/shared` 相关文档。

包边界：

- 职责：
  - 稳定 DTO、Record、Enum、跨端展示 contract
  - `@agent/core` 主 contract 的 compat 聚合与前后端友好别名层
- 允许：
  - 纯类型
  - 纯 normalize / label helper
  - 指向 `@agent/core` 的兼容 re-export
- 禁止：
  - prompt、retry、LLM、service、graph、node、executor、repository、副作用逻辑
- 依赖方向：
  - 不依赖 runtime / agents / apps 等业务宿主
  - 可以依赖 `@agent/core`，但仅用于 compat re-export、展示组合和默认泛型包装
  - 被 apps、backend、agent-core、基础包共同消费

约定：

- `packages/shared` 的专项文档统一放在 `docs/shared/`
- 同语义、同消费边界、同稳定性的主 contract 必须优先放在 `@agent/core`
- `packages/shared` 不再新增与 `@agent/core` 平行的第二份主定义；如需兼容旧消费方，只保留 compat re-export 或轻量包装
- 对外根入口允许继续聚合 `types/*`，但不要在 `src/index.ts` 叠加重复导出清单
- 新增共享类型、公共协议、跨端契约或兼容约束后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

本目录主文档：

- 当前目录索引就是主入口；如后续出现共享类型专题，应在这里补“当前文档”列表并标记唯一主文档

当前文档：

- [core-compat-boundary.md](/Users/dev/Desktop/learning-agent-core/docs/shared/core-compat-boundary.md)

当前真实入口约束补充：

- `packages/shared/src/types/runtime-centers.ts`
  - 只保留 runtime center facade 与聚合导出
- `packages/shared/src/types/runtime-centers-analytics.ts`
  - 承载 usage analytics、knowledge overview、subgraph / workflow version 契约
- `packages/shared/src/types/runtime-centers-briefing.ts`
  - 承载 daily tech briefing category / schedule / audit 契约
- `packages/shared/src/types/runtime-centers-execution.ts`
  - 承载 thought graph、imperial chain、execution span、interrupt ledger、governance scorecard 契约
- `packages/shared/src/types/runtime-centers-tools.ts`
  - 承载 runtime tools / tool family / recent usage 契约
- `packages/shared/src/types/skills.ts`
  - 只保留 skills facade 与聚合导出
- `packages/shared/src/types/skills-capabilities.ts`
  - 承载 capability ownership、治理画像、worker definition、suggestion / trigger 契约
- `packages/shared/src/types/skills-sources.ts`
  - 承载 skill source、manifest、installed / receipt、company agent 契约
- `packages/shared/src/types/skills-search.ts`
  - 承载 remote search、install dto、connector configure/search state 契约
- `packages/shared/src/types/tasking.ts`
  - 当前仍是 tasking 聚合入口，但不应继续扩张为唯一主宿主
- `packages/core/src/types/tasking-planning.ts` / `packages/core/src/types/tasking-orchestration.ts`
  - 已开始承接 tasking planning / orchestration 的 schema-first 主定义；当前不仅包含 plan draft / manager plan，还包含 `EntryDecisionRecord`、`ExecutionPlanRecord`、`PartialAggregationRecord`、`DispatchInstruction`、specialist context / finding / critique 等稳定子契约
- `packages/core/src/types/tasking-chat.ts` / `packages/core/src/types/tasking-runtime-state.ts` / `packages/core/src/types/tasking-session.ts`
  - 已开始承接 tasking chat、task runtime state、tasking session 的稳定 schema-first 主定义；`packages/shared/src/types/tasking-chat.ts`、`tasking-task-record.ts` 与 `channels.ts` 当前对这些子契约只保留 compat re-export，其中 checkpoint graph state / stream status / cursor state 也已下沉到 `core`
- `packages/core/src/types/tasking-thought-graph.ts`
  - 已承接 checkpoint thought graph 的稳定 schema-first 主定义；`packages/shared/src/types/primitives.ts` 保留 compat 入口，`packages/shared/src/types/tasking.ts` 不再重复透传这组 thought graph contract，避免 barrel 冲突；`ThoughtGraphRecord` 也统一从 `primitives` 出口暴露
- `packages/core/src/types/tasking-checkpoint.ts` / `packages/core/src/types/tasking-task-record.ts`
  - 已承接 `ChatCheckpointRecord` 与 `TaskRecord` 的 schema-first 主定义；`packages/shared/src/types/tasking-chat.ts` 与 `tasking-task-record.ts` 当前保留 compat host，并对运行时仍需的细化字段继续做 shared 侧窄化。当前已进一步把 `externalSources` / `learningCandidates` / `llmUsage` 以及预算门、复杂任务、黑板、治理评分、技能执行等稳定子状态收进 core-hosted schema
- 后续 tasking 迁移应继续把稳定 schema-first contract 收到 `core`，`shared` 逐步退化为 compat 聚合与展示友好别名层
- 不要再把 runtime center、skills source/install/search、capability governance 重新堆回单一 `runtime-centers.ts` 或 `skills.ts`
