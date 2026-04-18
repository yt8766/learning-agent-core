# core 文档目录

状态：current
文档类型：index
适用范围：`docs/core/`
最后核对：2026-04-18

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

- `packages/core` 已经不只是迁移期 facade；当前源码中已经承载 provider interface、memory schema、approval / review schema 以及多组稳定类型入口
- `packages/core/src/tasking/schemas/planning.ts` + `packages/core/src/tasking/types/planning.ts`
  - 已开始承接 tasking planning 子域的 schema-first 主定义，当前覆盖 plan question / decision / draft / mode transition，以及 `EntryDecisionRecord` / `ExecutionPlanRecord` / `PartialAggregationRecord`；最近一轮已把 counselor selector、imperial direct intent、partial aggregation policy、question set、micro budget 等匿名结构提为具名子 schema
- `packages/core/src/tasking/schemas/orchestration.ts` + `packages/core/src/tasking/types/orchestration.ts`
  - 已开始承接 tasking orchestration 子域的 schema-first 主定义，当前覆盖 agent message / sub task / manager plan / review record，以及 `DispatchInstruction` / specialist context-finding / critique 子契约；治理与执行状态中的 `BudgetGateStateRecord`、`ComplexTaskPlanRecord`、`BlackboardStateRecord`、`MicroLoopStateRecord`、`CurrentSkillExecutionRecord`、`GovernanceScoreRecord`、`GovernanceReportRecord` 也已进入 core-hosted schema；最近一轮已把 recent turn、review outcome、interrupt load、dependency、blackboard refs 等匿名结构提为具名子 schema
- `packages/core/src/tasking/schemas/chat.ts` + `packages/core/src/tasking/types/chat.ts`
  - 当前承接 chat 子域里最稳定的 schema-first 主定义，覆盖 chat message / chat event / thought chain item / think state；最近一轮已把 chat card 子结构中的 preview item、plan question status、capability catalog、skill draft contract 等匿名块提为具名 schema
- `packages/core/src/tasking/schemas/runtime-state.ts` + `packages/core/src/tasking/types/runtime-state.ts`
  - 当前承接 task record 与 checkpoint 内部可独立复用的稳定状态契约，覆盖 mode gate state / background learning state / checkpoint graph state / checkpoint stream status / checkpoint cursors；最近一轮已把 graph state 内部匿名结构提为具名子 schema，并复用 primitives 主枚举
- `packages/core/src/primitives/*`
  - `primitives` 基础域现已拆成 `schemas / types` 两层，基础枚举、状态记录与 workflow primitive contract 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/tasking/schemas/session.ts` + `packages/core/src/tasking/types/session.ts`
  - 当前承接 chat session 子域的 schema-first 主定义，覆盖 channel identity / compression / session record
- `packages/core/src/tasking/schemas/tasking.ts` + `packages/core/src/tasking/types/tasking.ts`
  - 当前承接极小 tasking DTO 的 schema-first 主定义与类型出口；`HealthCheckResultSchema` 已收敛到 `tasking/*` 真实宿主
- `packages/core/src/tasking/schemas/thought-graph.ts` + `packages/core/src/tasking/types/thought-graph.ts`
  - 当前承接 checkpoint thought graph 子域的 schema-first 主定义与类型出口；`CheckpointRef / ThoughtGraph*` schema 已从旧平铺 compat 入口收回 `tasking/*`
- `packages/core/src/tasking/types/thought-graph.ts`
  - 当前承接 checkpoint thought graph 子域的类型出口，覆盖 checkpoint ref / thought graph node / thought graph edge / thought graph wrapper
- `packages/core/src/execution-trace/*`
  - `execution-trace` 子域现已拆成 `schemas / types` 两层，`ExecutionTrace` 本体与 summary DTO 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/channels/*`
  - `channels` 子域现已拆成 `schemas / types` 两层，create-task、session、approval、memory-feedback 等跨端 DTO 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/connectors/*`
  - `connectors` 子域现已拆成 `schemas / types` 两层，稳定 ingestion summary 与 capability usage contract 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/workflow-route/*`
  - `workflow-route` 子域现已拆成 `schemas / types` 两层，route context / classification / readiness contract 已物理落位；旧平铺入口仅保留 compat 角色
- `packages/core/src/delivery/*`
  - `delivery` 子域现已拆成 `schemas / types` 两层，citation 与 source summary contract 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/skills-search/*`
  - `skills-search` 子域现已拆成 `schemas / types` 两层，install/search DTO、configured connector 与 discovery history contract 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/platform-console/*`
  - `platform-console` 的 schema-first 记录现已拆成 `schemas / types` 两层，approval record 与相关 plan/interrupt DTO 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/architecture/*`
  - `architecture-records` 子域现已拆成 `schemas / types` 两层，diagram / descriptor / runtime architecture contract 已物理落位；旧平铺 `spec/types` 入口已删除
- 历史上的 `packages/shared` compat 命名已退场；对应 canonical contract 现在统一由 `packages/core` 或真实宿主承接
- `packages/core/src/tasking/schemas/checkpoint.ts` + `packages/core/src/tasking/types/checkpoint.ts`
  - 当前承接 checkpoint 主体与 checkpoint wrapper 的 schema-first 主定义，覆盖 checkpoint metadata / pending approvals / agent states / checkpoint record；checkpoint 上的 `externalSources`、`llmUsage`、预算/治理/黑板/技能执行等稳定状态字段已改为引用 core-hosted 子 schema；最近一轮已把 cursor fields、shared refs、specialist state 提为具名子 schema，并把 `requestedHints / capabilityAttachments / activeInterrupt / interruptHistory` 接回正式 schema
- `packages/core/src/tasking/schemas/task-record.ts` + `packages/core/src/tasking/types/task-record.ts`
  - 当前承接 task 主体的 schema-first 主定义，作为 `TaskRecord` 的稳定主宿主；当前已覆盖 task 主体骨架、`externalSources` / `learningCandidates`、`llmUsage` 以及多组预算/治理/黑板/技能执行稳定聚合字段，剩余高变嵌套字段继续按兼容 schema 逐步精细化；最近一轮已开始复用 checkpoint 的 specialist/shared-ref/agent-output 子 schema，并补出 task execution state 与 planning state 的具名聚合 schema
- 历史上的 `packages/shared` tasking/primitives facade 已退场；当前应直接阅读 `packages/core` 与对应宿主本地 facade/aggregate 类型层
- `packages/core/src/skills/schemas/*` + `packages/core/src/skills/types/skills.types.ts`
  - `skills` 子域现已具备真实 top-level domain host，由 `capability / safety / catalog / registry` 四组 schema 文件与统一类型宿主承接；旧平铺 `spec/types` 入口已删除
  - 当前已新增 `CapabilityAugmentationRecord` 的 core-hosted schema/type，`CreateTaskDto` 和 checkpoint capability state 已开始复用该主契约
- `packages/core/src/tasking/schemas/task-record.ts`
  - 当前已进一步承接 task runtime decoration，`requestedHints`、interrupt 历史、capability augmentations/attachments、current skill execution、learning evaluation、skill search 等字段已接回正式 schema
  - 本轮又继续收紧了一批此前还是 `z.any()` 的运行时支撑字段，checkpoint / task record 现在已经复用明确 schema 来描述 tool attachment / usage、execution trace、context filter、guardrail、critic、sandbox、knowledge ingestion/index、evaluation report、internal sub-agent
  - `ToolAttachmentRecord.ownerType` 现已与 capability ownership 主契约对齐，统一接受 `shared`、`ministry-owned`、`specialist-owned`、`imperial-attached`、`temporary-assignment`、`user-attached`、`runtime-derived`；后续 runtime/backend/memory 不应再各自维护缩窄副本
- `packages/core/src/data-report/schemas/*` + `packages/core/src/data-report/types/*`
  - `data-report` 子域现已具备真实 top-level domain host，`data-report` / `data-report-json` / `data-report-json-schema` 的 schema 与类型实现均已从平铺 compat 入口收回该目录；旧平铺 `spec/types` 入口已删除
- `packages/core/src/knowledge/*`
  - `knowledge` 子域现已拆成 `schemas / types / helpers` 三层，`BudgetState`、`LearningEvaluationRecord` 与 evidence 判定 helper 均已物理落到该域；旧平铺 `spec/types` 入口已删除
- `packages/core/src/governance/*`
  - `governance` 子域现已拆成 `schemas / types / helpers` 三层，稳定 policy / capability / approval scope contract 与 matcher helper 已物理落位；旧平铺 `spec/types` 入口已删除
- `packages/core/src/review/*`
  - `review` 子域现已拆成 `schemas / helpers` 两层，`specialist-finding` / `critique-result` 主 schema 与 normalize helper 已从旧 shared 命名完全迁入该域
- `packages/core/src/skills/schemas/*` + `packages/core/src/skills/types/skills.types.ts`
  - 当前除 capability / attachment / governance profile 外，也已开始承接 `SkillTriggerReason`、`LocalSkillSuggestionRecord`、`SkillSearchStateRecord` 这组稳定 skill search 主契约；`tasking-checkpoint.ts` 与 `tasking-task-record.ts` 已开始直接复用
- `packages/core/src/contracts/platform-console/index.ts`
  - 当前 contracts 出口已开始按 `chat / ministries / execution / architecture / platform-console / approval / data-report` 聚合；`SharedPlatformConsoleRecord` 这类 generic aggregation shell 仍属于 contracts 终态例外，除非后续确认它本身要进入稳定 JSON/API 边界，否则不应强行 schema-first 化
- 仍然存在部分 contract 从 `shared` 向 `core` 继续迁移的债务，但 `core` 本身已经是当前真实生效的稳定 contract 宿主之一
- 后续稳定公共 contract 仍应按 `core` 边界思考，而不是继续把 `core` 当“任何共用代码都能放”的杂物层

本目录主文档：

- 当前项目的 core 包规范：[current-core-package-guidelines.md](/docs/core/current-core-package-guidelines.md)
- 当前 core 包合规检查：[current-core-package-audit.md](/docs/core/current-core-package-audit.md)
- contract 边界主文档：[core-contract-guidelines.md](/docs/core/core-contract-guidelines.md)

当前执行重点：

- `core` 是稳定主 contract 的唯一宿主
- `shared` 只保留 compat / facade / 展示组合职责
- `core` 当前应按 `contracts / providers / memory + domain folders` 理解：`tasking / data-report / skills / review / governance / knowledge / channels / connectors / workflow-route / delivery / execution-trace / skills-search / platform-console / architecture / primitives` 已具备真实物理宿主
- 后续继续收敛时，优先把剩余仍在平铺 compat 入口后的子域继续迁入 domain folder，而不是继续扩大根级平铺文件数量

建议优先阅读：

1. [当前 core 包规范](/docs/core/current-core-package-guidelines.md)
2. [当前 core 包合规检查](/docs/core/current-core-package-audit.md)
3. [core contract 规范](/docs/core/core-contract-guidelines.md)
4. [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
5. [Packages 目录说明](/docs/packages-overview.md)

后续 AI 如果要继续推进 schema-first 收敛，建议先确认两件事：

1. 当前目标是不是“继续迁移主 contract”，还是“确认剩余 facade 是否属于有意保留的 compat/aggregation 终态”
2. 本轮触达的 shared 文件是否仍承担 widening / 组合职责；如果是，应优先更新文档和消费边界，而不是直接把它们改成纯 alias
