# shared 文档归档

状态：current
文档类型：index
适用范围：`docs/shared/`
最后核对：2026-04-18

本目录用于归档 `packages/shared` 退场过程中的历史文档与迁移台账。

`packages/shared` 已于 `2026-04-18` 从 workspace 删除；这里的内容默认按“历史记录 / 迁移依据”阅读，不再表示当前可写入的新宿主。

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

- [shared-removal-completed.md](/docs/shared/shared-removal-completed.md)
- [core-compat-boundary.md](/docs/shared/core-compat-boundary.md)
- [shared-removal-feasibility.md](/docs/shared/shared-removal-feasibility.md)

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
  - 其中已由 core 托管的 capability augmentation / attachment / governance profile / execution hints 等稳定 contract，当前直接由 shared 做 compat re-export，不再保留一层 `CoreXxx -> Xxx` 中转样板
- `packages/shared/src/types/knowledge-learning.ts` / `packages/shared/src/types/knowledge-store.ts`
  - `LearningEvaluationRecord` 与 `BudgetState` 已改为指向 core-hosted schema/type 的 compat alias；`LearningJob` / `LearningQueueItem` 已退出 shared 公开面，runtime / memory 改由宿主本地记录承接；shared 在 knowledge 侧仅保留 compat 与 store 相关契约
- `packages/shared/src/types/skills-search.ts`
  - `SkillSearchStateRecord`、`SkillSearchStatus` 以及 install/search DTO、remote result、configured connector、connector discovery history 这批稳定 skills search contract 已统一改为指向 core-hosted schema/type 的 compat alias
  - shared 不再把 skills search 的主状态或外围 DTO / connector record 作为 shared-only 主定义长期维护；这里只保留 compat 出口
- `packages/shared/src/types/skills-capabilities.ts`
  - `LocalSkillSuggestionRecord` 与 `SkillTriggerReason` 也已改为 core compat re-export；shared 侧继续保留 worker definition、profile hint、bootstrap suggestion 等组合层契约
- `packages/shared/src/types/skills-sources.ts`
  - 承载 skill source、manifest、installed / receipt、company agent 契约
- `packages/shared/src/types/skills-search.ts`
  - 当前已收敛为纯 compat 出口；稳定 remote search、install dto、connector configure / discovery 契约统一由 core 托管
- `packages/shared/src/types/tasking.ts`
  - 当前仍是 tasking 聚合入口，但不应继续扩张为唯一主宿主
- `packages/shared/src/types/tasking-chat.ts` / `packages/shared/src/types/tasking-task-record.ts`
  - 当前仍保留为 shared consumption facade，但覆盖面已经进一步缩小
  - 这两份文件已经去掉一批与 core 完全一致的重复覆盖字段，例如 execution steps、queue/pending state、model route、llm usage、governance score/report、external sources、learning candidates，以及一批 planning/orchestration 聚合字段（`entryDecision / executionPlan / budgetGateState / complexTaskPlan / blackboardState / partialAggregation / planModeTransitions / planDraft`）
  - shared 现在更明确地只覆写真正存在 widening 或聚合差异的字段，例如 `resolvedWorkflow`、`currentMinistry`、`approvalPolicies`、`executionMode`、`budgetState`、`learningEvaluation`、`skillSearch` 以及 runtime decoration 相关字段
- `packages/shared/src/types/channels.ts`
  - 当前已经收敛为纯 compat re-export 文件；稳定 channel DTO / schema 主定义统一在 `@agent/core`，shared 不再保留一层 `CoreXxx -> Xxx` 的重复 type alias 样板
- `packages/shared/src/types/platform-console.ts`
  - 当前仅保留 `SharedPlatformConsoleRecord` 的 shared 默认泛型组合；`PlatformApprovalRecord` 及其相关稳定 approval DTO 已直接从 core 做 compat re-export，不再重复包一层 local alias
- `packages/shared/src/types/governance.ts`
  - `ApprovalRecord`、`ApprovalPolicyRecord`、`ApprovalScopeMatchInput`、`ApprovalScopePolicyRecord`、`McpCapability` 当前都已降成 core compat alias；`ApprovalInterruptRecord` 也已不再被 shared 内部其它类型复用，当前更接近历史 compat 出口
- `packages/core/src/types/tasking-planning.ts` / `packages/core/src/types/tasking-orchestration.ts`
  - 已开始承接 tasking planning / orchestration 的 schema-first 主定义；当前不仅包含 plan draft / manager plan，还包含 `EntryDecisionRecord`、`ExecutionPlanRecord`、`PartialAggregationRecord`、`DispatchInstruction`、specialist context / finding / critique 等稳定子契约
- `packages/core/src/types/tasking-chat.ts` / `packages/core/src/types/tasking-runtime-state.ts` / `packages/core/src/types/tasking-session.ts`
  - 已开始承接 tasking chat、task runtime state、tasking session 的稳定 schema-first 主定义；`packages/shared/src/types/tasking-chat.ts`、`tasking-task-record.ts` 与 `channels.ts` 当前对这些子契约只保留 compat re-export，其中 checkpoint graph state / stream status / cursor state 也已下沉到 `core`
- `packages/core/src/types/tasking-thought-graph.ts`
  - 已承接 checkpoint thought graph 的稳定 schema-first 主定义；`packages/shared/src/types/primitives.ts` 保留 compat 入口，shared 已删除不再被消费的 `types/tasking-thought-graph.ts` 过渡壳，避免同一组 thought graph contract 在 shared 内出现第二条失效路径
- `packages/shared/src/types/primitives.ts`
  - 当前继续保留少量 compat 入口；`ThoughtGraphNode` 已回落为 core alias，不再维持 shared widening
  - 但对已经与 core 完全一致的基础 tasking 片段，应直接退回 core alias；本轮 `ExecutionStepRecord` 与 `LlmUsageRecord` 已不再维持 shared 侧重复结构
- `packages/core/src/types/tasking-checkpoint.ts` / `packages/core/src/types/tasking-task-record.ts`
  - 已承接 `ChatCheckpointRecord` 与 `TaskRecord` 的 schema-first 主定义；`packages/shared/src/types/tasking-chat.ts` 与 `tasking-task-record.ts` 当前保留 compat host，并对运行时仍需的细化字段继续做 shared 侧窄化。当前已进一步把 `externalSources` / `learningCandidates` / `llmUsage` 以及预算门、复杂任务、黑板、治理评分、技能执行等稳定子状态收进 core-hosted schema
- 后续 tasking 迁移应继续把稳定 schema-first contract 收到 `core`，`shared` 逐步退化为 compat 聚合与展示友好别名层
- 不要再把 runtime center、skills source/install/search、capability governance 重新堆回单一 `runtime-centers.ts` 或 `skills.ts`
