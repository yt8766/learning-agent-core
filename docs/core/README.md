# core 文档目录

状态：current
文档类型：index
适用范围：`docs/core/`
最后核对：2026-04-17

本目录用于沉淀 `packages/core` 相关文档。

`packages/core` 在本仓库里不是业务实现层，也不是 graph/runtime 编排层，而是稳定 contract facade。它优先回答的是“跨包怎么对齐边界”，不是“业务怎么跑起来”。

包边界：

- 职责：
  - 稳定共享数据模型的公共出口
  - Zod schema 驱动的结构约束
  - 跨包能力接口与 pipeline contract
  - 通用错误模型与兼容字段语义
- 允许：
  - DTO、Record、Enum、Schema、由 Schema 推导的 Type
  - 对外稳定的 interface、adapter contract、facade contract
  - pipeline stage、interrupt/recover payload、结构化事件 contract
  - 错误码、错误分类、重试/审批语义的结构定义
- 禁止：
  - 业务实现
  - 外部 SDK 接入
  - graph、flow、service、repository 执行逻辑
  - 调用方私有状态与包内内部目录约定
- 依赖方向：
  - 应尽量保持轻量，默认只承载稳定 contract
  - 其他包可依赖 `@agent/core` 获取公共边界
  - `@agent/core` 不应回填业务编排或基础设施实现

当前现实：

- `packages/core` 已经不只是迁移期 facade；当前源码中已经承载 provider interface、memory schema、approval / shared schema 以及多组稳定类型入口
- `packages/core/src/types/tasking-planning.ts`
  - 已开始承接 tasking planning 子域的 schema-first 主定义，当前覆盖 plan question / decision / draft / mode transition，以及 `EntryDecisionRecord` / `ExecutionPlanRecord` / `PartialAggregationRecord`；最近一轮已把 counselor selector、imperial direct intent、partial aggregation policy、question set、micro budget 等匿名结构提为具名子 schema
- `packages/core/src/types/tasking-orchestration.ts`
  - 已开始承接 tasking orchestration 子域的 schema-first 主定义，当前覆盖 agent message / sub task / manager plan / review record，以及 `DispatchInstruction` / specialist context-finding / critique 子契约；治理与执行状态中的 `BudgetGateStateRecord`、`ComplexTaskPlanRecord`、`BlackboardStateRecord`、`MicroLoopStateRecord`、`CurrentSkillExecutionRecord`、`GovernanceScoreRecord`、`GovernanceReportRecord` 也已进入 core-hosted schema；最近一轮已把 recent turn、review outcome、interrupt load、dependency、blackboard refs 等匿名结构提为具名子 schema
- `packages/core/src/types/tasking-chat.ts`
  - 当前承接 chat 子域里最稳定的 schema-first 主定义，覆盖 chat message / chat event / thought chain item / think state；最近一轮已把 chat card 子结构中的 preview item、plan question status、capability catalog、skill draft contract 等匿名块提为具名 schema
- `packages/core/src/types/tasking-runtime-state.ts`
  - 当前承接 task record 与 checkpoint 内部可独立复用的稳定状态契约，覆盖 mode gate state / background learning state / checkpoint graph state / checkpoint stream status / checkpoint cursors；最近一轮已把 graph state 内部匿名结构提为具名子 schema，并复用 primitives 主枚举
- `packages/core/src/spec/primitives.ts`
  - 当前已开始同时提供基础枚举的值常量与 schema 出口，`tasking-chat`、`specialist-finding` 等下游 schema 应优先复用这里的主枚举，而不是继续手写重复字面量
- `packages/core/src/types/tasking-session.ts`
  - 当前承接 chat session 子域的 schema-first 主定义，覆盖 channel identity / compression / session record
- `packages/core/src/types/tasking-thought-graph.ts`
  - 当前承接 checkpoint thought graph 子域的 schema-first 主定义，覆盖 checkpoint ref / thought graph node / thought graph edge / thought graph wrapper
- `packages/core/src/types/tasking-checkpoint.ts`
  - 当前承接 checkpoint 主体与 checkpoint wrapper 的 schema-first 主定义，覆盖 checkpoint metadata / pending approvals / agent states / checkpoint record；checkpoint 上的 `externalSources`、`llmUsage`、预算/治理/黑板/技能执行等稳定状态字段已改为引用 core-hosted 子 schema；最近一轮已把 cursor fields、shared refs、specialist state 提为具名子 schema，并把 `requestedHints / capabilityAttachments / activeInterrupt / interruptHistory` 接回正式 schema
- `packages/core/src/types/tasking-task-record.ts`
  - 当前承接 task 主体的 schema-first 主定义，作为 `TaskRecord` 的稳定主宿主；当前已覆盖 task 主体骨架、`externalSources` / `learningCandidates`、`llmUsage` 以及多组预算/治理/黑板/技能执行稳定聚合字段，剩余高变嵌套字段继续按兼容 schema 逐步精细化；最近一轮已开始复用 checkpoint 的 specialist/shared-ref/agent-output 子 schema，并补出 task execution state 与 planning state 的具名聚合 schema
- `packages/shared/src/types/tasking-chat.ts` 与 `packages/shared/src/types/tasking-task-record.ts`
  - 当前继续作为 shared consumption facade 存在，负责承接 runtime-facing 聚合字段与 shared narrowing；不应再把它们当作与 core 平行的主 contract 宿主
- 仍然存在部分 contract 从 `shared` 向 `core` 继续迁移的债务，但 `core` 本身已经是当前真实生效的稳定 contract 宿主之一
- 后续稳定公共 contract 仍应按 `core` 边界思考，而不是继续把 `core` 当“任何共用代码都能放”的杂物层

本目录主文档：

- 当前项目的 core 包规范：[current-core-package-guidelines.md](/docs/core/current-core-package-guidelines.md)
- 当前 core 包合规检查：[current-core-package-audit.md](/docs/core/current-core-package-audit.md)
- contract 边界主文档：[core-contract-guidelines.md](/docs/core/core-contract-guidelines.md)

建议优先阅读：

1. [当前 core 包规范](/docs/core/current-core-package-guidelines.md)
2. [当前 core 包合规检查](/docs/core/current-core-package-audit.md)
3. [core contract 规范](/docs/core/core-contract-guidelines.md)
4. [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
5. [Packages 目录说明](/docs/packages-overview.md)
