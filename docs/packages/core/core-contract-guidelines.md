# core contract 规范

状态：current
文档类型：convention
适用范围：`packages/core`
最后核对：2026-04-16

本规范用于回答一个问题：在本仓库里，什么才配进入 `packages/core`。

它基于当前项目的长期方向整理而成，目标是把 `core` 固定成稳定边界层，而不是再次长成第二个业务实现层。

## 1. core 的定位

`packages/core` 是稳定 contract facade。

它负责定义跨包共享的“公共语言”：

- 数据长什么样
- 如何校验这些数据
- 包与包之间通过什么接口协作
- 长流程在协议层如何表达
- 错误、审批、中断、恢复如何被结构化描述

`core` 不负责真实业务执行，不负责 provider/sdk 接线，也不负责 graph/flow 编排。

补充硬规则：

- 历史上如果 `packages/shared` 与 `packages/core` 出现职责重叠，默认以 `packages/core` 为准，继续把稳定主 contract 迁入 `core`
- `packages/shared` 已退场，不再作为稳定主 contract 的长期宿主
- `packages/core` 默认采用 schema-first；稳定公共 contract 必须先定义 schema，再通过 `z.infer<typeof Schema>` 推导类型
- 没有 schema 的结构，不应作为 `core` 的长期公共边界继续扩张
- 迁移完成后的目标形态是：`core` 拥有唯一主定义，compat/默认组合落到真实宿主本地；不允许把“shared 与 core 双主定义”当成稳定状态

## 2. core 负责什么

结合当前仓库，`core` 默认只负责下面五类内容。

### 2.1 共享数据模型

只放跨包稳定复用的数据模型，不放局部实现细节。

优先包括：

- `TaskRecord`
- `ChatCheckpointRecord`
- `SkillCard`
- `EvidenceRecord`
- `MemoryRecord`
- `RuleRecord`
- `McpCapability`
- `HealthCheckResult`
- approval / governance policy records
- `QueueStateRecord`
- `LlmUsageModelRecord`
- `LlmUsageRecord`
- `ConnectorKnowledgeIngestionSummary`
- `ConnectorCapabilityUsageRecord`
- runtime / approval / evidence / learning 等会被 apps、backend、runtime、agent 同时消费的公共 DTO
- pipeline 输入输出、SSE payload、结构化 trace、checkpoint 摘要等公共协议

不应进入 `core` 的例子：

- 某个 flow 内部临时 state patch
- 某个页面专用 view model
- 某个 service 内部缓存结构

### 2.2 数据校验规则

`core` 应把 Zod 作为稳定 contract 的唯一数据规则源，用它表达面向 JSON 的稳定结构约束。

固定要求：

1. `schema` 定义结构
2. `type` 由 `schema` 推导

也就是说：

- 先写 `z.object(...)`
- 再用 `z.infer<typeof Schema>`
- 不再手写一份容易漂移的重复 Type
- 如果某个 `shared` 类型已经被认定要迁入 `core`，迁移时必须补对应 schema，不能只把 interface 搬目录
- 如果某个已有 `core` contract 目前还是手写 interface/type，本仓库后续默认把它视为待补 schema 的迁移项，而不是最终形态
- 当前已经切到 schema-first 的示例包括：
  - `HealthCheckResult`
  - `ConnectorHealthRecord`
  - `ApprovalPolicyRecord`
  - `ApprovalScopePolicyRecord`
  - `McpCapability`
  - `QueueStateRecord`
  - `LlmUsageModelRecord`
  - `LlmUsageRecord`
  - `ConnectorKnowledgeIngestionSummary`
  - `ConnectorCapabilityUsageRecord`
  - tasking planning 子域中的 `PlanQuestionRecord`、`PlanDecisionRecord`、`PlanDraftRecord`
  - tasking planning 子域中的 `EntryDecisionRecord`、`ExecutionPlanRecord`、`PartialAggregationRecord`
  - tasking orchestration 子域中的 `AgentMessageRecord`、`SubTaskRecord`、`ManagerPlan`
  - tasking orchestration 子域中的 `DispatchInstruction`、`SpecialistLeadRecord`、`SpecialistSupportRecord`、`SpecialistFindingRecord`、`ContextSliceRecord`、`CritiqueResultRecord`
  - tasking orchestration 子域中的 `BudgetGateStateRecord`、`ComplexTaskPlanRecord`、`BlackboardStateRecord`、`MicroLoopStateRecord`、`CurrentSkillExecutionRecord`
  - tasking orchestration 子域中的 `GovernanceScoreRecord`、`GovernanceReportRecord`
  - tasking chat 子域中的 `ChatMessageRecord`、`ChatEventRecord`、`ChatThoughtChainItem`、`ChatThinkState`
  - tasking runtime state 子域中的 `TaskModeGateState`、`TaskBackgroundLearningState`、`TaskCheckpointGraphState`、`TaskCheckpointStreamStatus`、`TaskCheckpointCursorState`
  - tasking session 子域中的 `ChannelIdentity`、`ChatSessionCompressionRecord`、`ChatSessionRecord`
  - tasking thought graph 子域中的 `CheckpointRef`、`ThoughtGraphNode`、`ThoughtGraphEdge`
  - tasking checkpoint 子域中的 `ChatCheckpointMetadata`、`ChatCheckpointPendingApprovals`、`ChatCheckpointAgentStates`、`ChatCheckpointRecord`
  - tasking task / checkpoint 主体中引用的 `EvidenceRecord`、`LearningCandidateRecord`、`LlmUsageRecord`
  - tasking task 子域中的 `TaskRecord`
  - governance 子域中的 `ApprovalRecord`
  - tasking orchestration 子域中的 `AgentExecutionState`

允许例外：

- 与 LangGraph `Annotation`、第三方 SDK 原生类型、极小的辅助泛型交互时，可以存在少量手写 type
- 但只要是稳定 JSON contract、DTO、事件 payload、错误对象，就必须优先由 schema 驱动

### 2.3 跨包能力接口

`core` 可以定义跨包能力接口，但不实现这些能力。

适合进入 `core` 的接口：

- 检索接口，例如 `Retriever`、knowledge search contract、evidence search contract
- 生成接口，例如 `Generator`、structured generation contract
- 执行阶段接口，例如 pipeline stage handler contract、interrupt handler contract
- 统一 facade / adapter contract

不适合进入 `core` 的内容：

- OpenAI、Anthropic、MCP、浏览器、sandbox、filesystem 等具体 SDK 或 transport 适配实现
- 某个 provider 专属 option 拼装逻辑
- 某个工具执行器的内部目录结构

### 2.4 通用错误模型

`core` 负责错误的结构，不负责错误的处理实现。

建议统一沉淀：

- 错误码
- 错误分类
- 是否可重试
- 是否需要审批
- 是否可恢复
- 用户展示摘要与调试元数据的边界

目标是让 backend、runtime、agent、frontend 对同一种失败有一致表达，而不是每层各自拼字符串。

### 2.5 流程抽象

`core` 可以定义流程的类型级抽象，但不承载流程执行逻辑。

适合进入 `core` 的内容：

- stage / phase / route enum
- pipeline input / output contract
- interrupt / recover payload
- structured event、checkpoint、trace、delivery envelope
- 与审批、取消、恢复相关的稳定协议

不适合进入 `core` 的内容：

- graph node wiring
- flow node 实现
- retry loop 细节
- 调用工具、调模型、写文件的真实执行逻辑

## 3. core 不负责什么

`core` 默认不负责以下三类内容，这也是本规范最重要的边界。

### 3.1 业务实现

例如：

- graph/flow 节点
- runtime orchestration
- session 协调
- learning/review/research/delivery 的主链逻辑
- repository/service 的增删改查实现

这些内容应落在 `runtime`、`memory`、`tools`、`agents/*` 等真实执行包。

### 3.2 外部 SDK

例如：

- LLM provider SDK
- MCP client / transport
- 浏览器、终端、sandbox、filesystem executor
- 数据库、向量库、第三方 SaaS connector

`core` 只定义它们对外暴露的 contract，不接入具体 SDK。

### 3.3 包内部私有结构

例如：

- 某个包的目录布局
- 私有 helper 的返回形状
- 仅供单模块内部消费的类型
- 依赖“当前实现恰好这样组织”的隐式约定

只要调用方不应该感知，就不该进入 `core`。

## 4. 与本仓库现有分层的对应关系

### `packages/core`

- 面向外部暴露稳定 contract facade
- 优先承接跨包共享模型、schema、errors、pipeline contract

### 历史 `packages/shared`

- 已退场，相关历史说明保留在 `docs/archive/shared/*`
- 对应职责现在应拆分到 `packages/core` 与真实宿主本地 compat/facade 层
- 如果评审中再次出现“第二份 shared 公共包壳”，应默认判定为边界回退

### `packages/runtime` / `agents/*`

- 负责 graph、flow、session、governance、专项 agent orchestration 与 LLM interaction policy
- 不是 `core` contract 层
- 不要把 runtime / agents 内部 state 或节点细节错误上提为 `core` 公共协议

### `packages/runtime` / `packages/tools` / `packages/memory` / `packages/adapters`

- 负责真实实现与适配
- 通过 `core` contract 解耦
- 不应把实现细节反向泄漏回 `core`

## 5. 新增代码落位规则

遇到新能力时，按这个顺序判断：

1. 它是不是跨包稳定 contract？
2. 它是不是需要被 schema 明确校验的公共结构？
3. 它是不是调用方应该依赖、但不该依赖底层实现的能力接口？

如果答案是“是”，优先考虑 `core`。

如果它属于以下情况，就不要放进 `core`：

- 只在一个模块内使用
- 明显依赖外部 SDK
- 含有副作用或真实执行逻辑
- 与 graph/flow/runtime 节点强绑定
- 只是“多个地方都能复用”的业务 helper

## 6. 文档与实现约束

后续凡是新增或修改 `packages/core` 相关能力，默认要同步满足：

1. 文档落在 `docs/packages/core/`
2. 稳定结构必须优先提供 schema
3. type 必须优先由 `z.infer<typeof Schema>` 推导
4. 通过 `@agent/core` 根入口暴露，不新增深层公共导入约定
5. 评估是否需要同步更新 `docs/conventions/package-architecture-guidelines.md` 与 `docs/maps/packages-overview.md`

## 7. 当前迁移建议

结合仓库现状，后续可以按这个方向继续收敛：

1. 把“跨包稳定 DTO / event / error / pipeline contract”优先整理成 `core` 语义清单
2. 对新增稳定结构默认补 `zod schema + z.infer`
3. 把 `packages/core` 从单纯 re-export facade 逐步升级为真正的 contract 入口
4. 避免继续把业务 helper、provider 细节、graph state 私有结构塞进 `core`

这条规范的目标不是立即大迁移，而是从现在开始让新增沉淀有统一边界。
