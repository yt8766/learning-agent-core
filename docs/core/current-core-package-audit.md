# 当前 core 包合规检查

状态：current
文档类型：reference
适用范围：`packages/core`
最后核对：2026-04-17

本检查基于 [当前 core 包规范](/docs/core/current-core-package-guidelines.md) 对 `packages/core` 的当前实现做一次现实核对。

## 结论

如果只按“contract 边界”判断，`packages/core` 当前已经基本满足本仓库为 `core` 定义的包边界规范。

但如果按更严格的 `rag` 风格结构标准判断，即：

- `spec/` 只放 schema
- `types/` 只放 `z.infer`
- `helpers/` 放确定性逻辑

那么 `packages/core` 还没有完全达标，目前处于“迁移进行中”。

本轮已完成的收敛：

- `core` 内已存在本地主契约的文件，改为优先引用 `core` 自身的 schema/type，而不是继续从 `@agent/shared` 借道。
- 删除 `packages/core/package.json` 中已不再使用的 `@agent/report-kit` 依赖，避免稳定 contract 层回填到报表实现层。
- `workflow-route / execution-trace / chat-graph / specialist-finding / critique-result / pending-execution-context` 等入口已进一步向 `core` 主宿主收敛。
- 新增并落位 `ActionIntent / ApprovalStatus / ReviewDecision / TrustClass / RequestedExecutionHints / CapabilityAttachmentRecord / CapabilityGovernanceProfileRecord / GovernanceProfileRecord / SkillCard / ToolExecutionResult` 等稳定公共契约的 core-hosted schema/type。
- `packages/core/src` 当前已经没有直接 `import '@agent/shared'` 的源码入口。
- 已新增 `src/spec/` 与 `src/helpers/`，并将 `governance / tasking-session / skills` 三个子域迁成：
  - `spec/*` 只放 schema
  - `types/*` 只放 `z.infer`
  - `helpers/*` 放确定性逻辑
- 已新增 `src/contracts/` 并开始承接不适合 schema-first 的技术契约：
  - `data-report` 的 generate input / graph state / graph handlers
  - `data-report-json` 的 node model policy / generate input / graph state / graph handlers
  - `architecture-records` 的 registry entry
- `platform-console / workflow-route / delivery / execution-trace / architecture-records` 已完成从裸 `interface` 到 `spec + types` 或 `spec + types + contracts` 的首轮收敛。
- `data-report / data-report-json / data-report-json-schema` 已完成“稳定 JSON contract 与技术 contract”分层，核心 schema 已进入 `spec/`，runtime-only 技术接口已进入 `contracts/`。
- `TaskStatus / ApprovalScope / ChatRole / ExecutionPlanMode` 已开始从 `shared` 向 `core` 收口，其中 `shared` 的 `TaskStatus` 已改为兼容常量出口而非独立主定义。
- `packages/core/src/spec/tasking-runtime-state.ts` 已进一步收敛匿名嵌套结构，补出具名子 schema，并复用 `TaskStatusSchema / ExecutionPlanModeSchema` 作为主枚举来源，减少 runtime state 子域的重复定义。
- `packages/core/src/spec/primitives.ts` 已补齐 `RiskLevel / LearningSourceType / ReviewDecision / TrustClass / ApprovalScope / ChatRole / ExecutionPlanMode` 的值常量出口，并开始让 `tasking-chat`、`shared/schemas/specialist-finding-schema` 等下游 schema 直接复用，减少跨文件手写重复枚举。
- `packages/core/src/spec/tasking-chat.ts` 已把 card 子结构中的 approval preview、plan question status、capability catalog、skill draft contract 等匿名对象提升为具名 schema，后续同域 contract 应优先复用这些子件。
- `packages/core/src/spec/tasking-planning.ts` 已把 counselor selector、imperial direct intent、dispatch chain node、partial aggregation policy、plan draft question set、micro budget 等匿名结构提升为具名 schema，并复用 `ExecutionPlanModeSchema`。
- `packages/core/src/spec/tasking-orchestration.ts` 已把 `ContextSlice` recent turn、`GovernanceReport` review outcome / interrupt load、`ComplexTaskPlan` dependency、`Blackboard` refs 等匿名结构提升为具名 schema，并复用 `ChatRoleSchema / ReviewDecisionSchema / RiskLevelSchema` 作为基础枚举来源。
- `packages/core/src/spec/tasking-checkpoint.ts` 已把 cursor fields、shared string refs、specialist state 等 checkpoint 聚合片段提升为具名 schema，并将 `requestedHints / capabilityAttachments / activeInterrupt / interruptHistory` 从 `z.any()` 接回 core-hosted 主 schema。
- `packages/core/src/spec/tasking-task-record.ts` 已开始复用 checkpoint 的 specialist/shared-ref/agent-output 子 schema，并补出 task execution state 与 planning state 的具名聚合 schema，减少 task 与 checkpoint 之间的重复定义。
- `packages/core/src/spec/connectors.ts` 已承接 `ConnectorKnowledgeIngestionSummary` 与 `ConnectorCapabilityUsageRecord` 的 schema 主定义，`types/connectors.ts` 现已回到 infer/alias 宿主。
- `packages/core/src/contracts/platform-console.ts` 已承接 `SharedPlatformConsoleRecord` 泛型组合容器，`types/platform-console.ts` 现已回到纯 infer 宿主。
- `packages/shared/src/types/tasking-planning.ts` 与 `packages/shared/src/types/tasking-orchestration.ts` 中一批与 core 已完全对齐的 planning / orchestration contract 已改成 compat alias，不再继续保留重复主定义。
- `packages/shared/src/types/tasking-chat.ts` 与 `packages/shared/src/types/tasking-task-record.ts` 已重新确认定位为 shared 组合层，而不是稳定主 contract 的重复宿主；它们当前保留是因为仍需承接 shared narrowing 与 runtime-facing 聚合字段。

## 当前满足的规范点

- `packages/core/src` 目前以稳定类型、schema、provider interface、memory schema、approval/tasking/governance/delivery contract 为主，没有发现 graph wiring、service、repository、runtime orchestration、tool executor 等实现层落位。
- `packages/core/src` 当前没有文件超过 400 行强制拆分阈值的新增违规项。
- `packages/core/src/index.ts` 仍作为统一公共出口，符合稳定 facade 的对外形态。
- `TaskRecord`、`ChatEventRecord`、`DispatchInstruction`、`SpecialistFindingRecord`、`CritiqueResultRecord`、`CurrentSkillExecutionRecord` 等稳定契约，已经在 `core` 中存在 schema-first 主定义。

## 当前仍需继续关注的点

下面这些点说明 `core` 还没有完全达到“严格结构终态”：

- `packages/core/src/types/` 下仍有一批文件不是纯 `z.infer` 终态，但范围已经明显缩小。
  - `primitives.ts` 仍保留 compat value export，例如 `TaskStatus`、`ActionIntent`、`ApprovalDecision` 与多组 `*Values`
  - `knowledge.ts` 仍保留技术接口与 helper
  - `llm-provider-like.ts`、`chat-graph.ts` 仍属于技术接口宿主，而不是纯 infer 文件
- `shared` 里仍然存在一批尚未完全迁入 `core` 的稳定公共契约，例如 `CreateTaskDto`、部分 channel / session-facing DTO、以及若干兼容期保留的基础类型。
- 当前已经迁入 `core` 的契约，`shared` 主要改成 type alias / compat 出口，但还没有把所有相关文档与消费点统一改造成“只把 `shared` 当消费友好层”。
- `packages/shared/src/types/primitives.ts` 仍保留一部分兼容层定义，例如 `WorkflowPresetDefinition` 继续在 core 主契约之上附加 `explicitOnly`、更窄的 `sourcePolicy.mode`，以及面向 workflow preset 兼容消费的更宽 `webLearningPolicy.preferredSourceTypes`；这类 shared widening 仍需显式标记为兼容层，而不是新的主定义宿主。
- `packages/shared/src/types/tasking-chat.ts`、`packages/shared/src/types/tasking-task-record.ts` 仍然承担前后端消费友好的组合层职责，目前保留了对 core host contract 的 widening/组合，不适合简单替换为纯 alias；其中 `TaskRecord.resolvedWorkflow` 需要继续跟随 shared `WorkflowPresetDefinition` 的兼容 widening，一旦把这里误收窄，会直接在 preset 定义与 staged typecheck 上暴露回归。
- `packages/core/src/types/tasking-chat.ts`、`tasking-planning.ts`、`tasking-orchestration.ts`、`tasking-runtime-state.ts`、`tasking-checkpoint.ts`、`tasking-task-record.ts` 现在已经基本收敛到纯 infer 形态；后续更需要关注的是 `primitives / connectors / knowledge / platform-console` 这类仍保留 compat value 或技术接口的例外文件该如何长期定性。

## 建议的后续收敛顺序

建议按风险由低到高继续推进：

1. 继续把 `primitives / knowledge` 这些仍保留 compat value、技术接口或组合容器的例外文件收敛到更清晰的长期定性
2. 判断 `CreateTaskDto` 与 channel 侧 DTO 中哪些字段属于真正稳定的跨包协议，再迁入 `core`
3. 继续把 `shared` 中仍残留的 compat 定义改薄，优先收敛 `ApprovalScope / ChatRole / ExecutionPlanMode`
4. 对 `data-report*` 再补更细粒度的 schema parse 回归与文档说明，避免后续新增节点时重新混回 `types/`

## 本轮判断

如果按“`packages/core` 当前是否符合 contract 边界”判断：现在已经基本满足，并且本轮把最关键的边界问题收掉了。

如果按“是否达到你给出的 `rag` 风格最终结构”判断：还没有，但现在已经有了可运行的迁移模板，后续只需要按域持续复制这套结构，而不是重新摸索方向。

如果按本轮“Schema-First 收敛计划（第一阶段到完整收口路线）”判断：计划中的首批 schema-first 迁移、`data-report*` 分层、`shared -> core` 主契约收口、compat 测试与文档更新已经完成；当前剩余的是更高风险的二次精细化收敛，而不是本阶段遗漏。
