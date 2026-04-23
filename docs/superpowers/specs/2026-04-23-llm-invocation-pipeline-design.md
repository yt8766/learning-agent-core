# LLM Invocation Pipeline Design

状态：proposed
文档类型：design-spec
适用范围：`packages/runtime`、`packages/core`、`apps/backend/agent-server`
最后更新：2026-04-23

## 1. 背景

当前仓库已经具备这些与模型调用相关的基础能力：

- `BudgetGuard`
- `Semantic Cache`
- `task.llmUsage` 与 `budgetState`
- runtime 主链中的 `onUsage` 回调累计
- direct-reply 直聊链路
- skill / tool / MCP 能力治理

但这些能力还没有收敛成统一的模型调用主线。

当前存在的主要问题：

- runtime 主链与 direct-reply 不是同一条模型调用管线
- direct-reply 仍可能绕过完整治理，较直接地调用 `llm.streamText(...)`
- token 统计、成本换算、trace、缓存、预算门禁分散在不同层次
- skill / tool / MCP 注入缺少统一、可解释、可观测的前置决策
- 账务事实源还偏向“调用时回调累加”，不利于审计、重放和去重

本设计的目标是把“用户消息进入系统后，何时、如何、在什么治理条件下调用模型”收敛成统一管线。

## 2. 目标与非目标

### 2.1 目标

- 为 runtime 主链与 direct-reply 提供统一的模型调用接口
- 在模型调用前增加标准化前处理关口
- 在模型调用后增加标准化后处理关口
- 支持调用级账本和任务级汇总双视图计费
- 采用保守按需注入策略管理 skill / tool / MCP
- 保留 direct-reply 与 runtime 的策略差异，但共享同一调用骨架
- 让预算、缓存、trace、计费、审计从“散点能力”升级为统一主线能力

### 2.2 非目标

- 本轮不把全部专项 agent 的 LLM 调用一次性迁入新管线
- 本轮不重写现有 graph 业务决策
- 本轮不要求 provider 层理解 skill / tool / MCP 业务规则
- 本轮不改变前端展示协议，只要求保留兼容投影

## 3. 设计结论

本设计采用以下结论：

- `packages/core` 提供 schema-first 的稳定调用 contract
- `packages/runtime` 提供统一的 `ModelInvocationPipeline` 与 `ModelInvocationFacade`
- 前处理与后处理通过接口扩展，但由 `packages/runtime` 统一编排与装配
- 调用方只能提交标准 `request + modeProfile`，不能自己拼 processor 链
- `packages/adapters` 继续负责模型路由、provider 调用、vendor usage 适配、provider 级 cache/fallback，不承载业务注入治理
- direct-reply 和 runtime-task 共用一条调用主线，通过不同 `InvocationModeProfile` 控制策略差异

## 4. 统一调用关口

模型调用统一改造成五段：

1. `Input Intake`
2. `Preprocess Gate`
3. `Model Execute`
4. `Postprocess Gate`
5. `Delivery`

### 4.1 Input Intake

职责：

- 接收用户消息、session/task 上下文、模式、预算快照和调用提示
- 归一化调用入口的原始输入
- 不在这一层直接调用模型

### 4.2 Preprocess Gate

职责：

- 输入 token 预估
- budget 可用性判断
- 上下文压缩或上下文组装决策
- skill / tool / MCP 是否需要注入的决策
- semantic cache 是否可以直接命中的决策
- 是否应进入 interrupt / approval / fallback，而不是继续调模型
- 形成可审计的调用决策

### 4.3 Model Execute

职责：

- 消费前处理产物，选择 provider 并执行
- 收集原始输出、vendor usage、fallback/retry 元信息
- 不承载业务治理判断

### 4.4 Postprocess Gate

职责：

- 输出 token / usage 收集
- 成本换算
- 调用级结算
- 任务级累计
- 输出清洗和结构校验
- trace / audit / evidence 记录
- cache 写回
- 失败分类与补偿逻辑

### 4.5 Delivery

职责：

- 把最终结果投递回 direct-reply SSE 或 runtime graph/session/checkpoint
- 不允许调用方自行拼接后处理或记账逻辑

## 5. 分层与宿主落位

### 5.1 `packages/core`

只放稳定 contract：

- `ModelInvocationRequestSchema`
- `PreprocessDecisionSchema`
- `ProviderExecutionResultSchema`
- `InvocationUsageRecordSchema`
- `PostprocessResultSchema`
- `ModelInvocationResultSchema`
- `CapabilityInjectionPlanSchema`

这些 contract 必须 schema-first，并通过 `z.infer` 推导类型。

### 5.2 `packages/runtime`

承载统一 orchestration：

- `ModelInvocationFacade`
- `ModelInvocationPipeline`
- `InvocationPreprocessor`
- `InvocationPostprocessor`
- `InvocationModeProfile`

`packages/runtime` 负责固定执行顺序、依赖装配、任务级回写、trace/audit 整合。

### 5.3 `packages/adapters`

继续承载：

- provider 调用
- 模型路由
- provider 级 fallback
- vendor usage 适配
- semantic cache 基础设施

不承载：

- skill / tool / MCP 注入策略
- direct-reply 与 runtime 的业务模式判断
- 预算中断与审批判断

### 5.4 `apps/backend/agent-server`

只作为调用方：

- direct-reply 改为调用 `ModelInvocationFacade`
- 不再自行拼前处理/后处理
- 只负责 HTTP / SSE 交付适配

## 6. 前处理设计

### 6.1 前处理不是“改 prompt”

前处理不能只做“输入 messages，输出改写后的 messages”。

前处理必须形成结构化 `PreprocessDecision`，回答这些问题：

- 是否允许执行
- 为什么允许或拒绝
- 选择哪个模型
- 预计输入 token 是多少
- 当前预算是否足够
- 是否命中缓存
- 需要注入哪些 skill / tool / MCP
- 最终给模型的上下文与消息是什么
- 这次决策的治理理由是什么

### 6.2 `PreprocessDecision` 最小字段

- `allowExecution`
- `denyReason?`
- `resolvedModelId`
- `resolvedMessages`
- `budgetDecision`
- `capabilityInjectionPlan`
- `cacheDecision`
- `traceMeta`

### 6.3 前处理处理器建议

建议按固定顺序拆分：

1. `InputNormalizePreprocessor`
2. `BudgetEstimatePreprocessor`
3. `ContextAssemblePreprocessor`
4. `CapabilityInjectionPreprocessor`
5. `CacheLookupPreprocessor`

### 6.4 前处理核心原则

- 处理器顺序固定
- 每个处理器只负责单一决策域
- 调用方不能自己选择处理器顺序
- direct-reply 与 runtime 只通过 profile 影响参数，不改变主顺序

## 7. 后处理设计

### 7.1 后处理输入

后处理输入至少包含：

- 原始 `ModelInvocationRequest`
- `PreprocessDecision`
- provider 原始结果
- vendor usage
- 流式 token 累积结果
- cache/fallback/retry 元信息
- 耗时、错误信息、终止原因

### 7.2 `PostprocessResult` 最小字段

- `finalOutput`
- `invocationUsageRecord`
- `taskUsageDelta`
- `cacheWriteback?`
- `auditEvents`
- `deliveryMeta`

### 7.3 调用级 + 任务级双视图

#### 调用级账本

每次模型调用都生成独立账本记录，至少包含：

- `invocationId`
- `taskId?`
- `sessionId?`
- `modeProfile`
- `stage`
- `providerId`
- `modelId`
- `promptTokens`
- `completionTokens`
- `totalTokens`
- `costUsd`
- `costCny`
- `measured | estimated`
- `cacheHit`
- `fallback`
- `retry`
- `selectedSkills`
- `selectedTools`
- `selectedMcpCapabilities`

调用级账本必须采用 append-only 语义，是结算和审计的事实源。

#### 任务级汇总

任务级只作为 projection，聚合：

- 累计 token
- 累计 cost
- 分模型统计
- 分阶段统计
- fallback 情况
- cache 节省情况
- 预算阈值命中情况

现有 `task.llmUsage` 与 `budgetState` 可继续保留，但应由后处理统一回写，而不是继续依赖零散 `onUsage` 累加。

### 7.4 后处理处理器建议

建议拆分为：

1. `UsageBillingPostprocessor`
2. `TraceAuditPostprocessor`
3. `OutputFinalizePostprocessor`

## 8. Skill / Tool / MCP 按需注入

### 8.1 总体策略

采用保守按需注入：

- 默认不全量注入
- 只在命中明确需求、能力缺口、workflow 约束或显式绑定时注入
- 注入集合必须是最小可用集合
- 每项注入都要可解释、可观测

### 8.2 统一抽象

三类能力可以统一抽象为 `CapabilityCandidate`，但决策规则分别执行，不能混成一个总开关。

前处理产出统一的 `CapabilityInjectionPlan`，包含：

- `selectedSkills`
- `selectedTools`
- `selectedMcpCapabilities`
- `rejectedCandidates`
- `reasons`
- `riskFlags`

### 8.3 Skill 注入规则

只有命中以下条件时注入：

- 用户显式点名 skill
- 当前任务已经绑定或复用某个 skill
- 能力缺口分析明确指向某类 skill
- 某个 workflow preset 要求该 skill 为固定前置能力

skill 注入产物应是结构化摘要，而不是整份 `SKILL.md` 原文。

### 8.4 Tool 注入规则

只有当任务属于执行型、外部动作型，且治理允许时才注入。

治理检查至少包括：

- 当前 execution mode 是否允许
- 当前阶段是否允许
- 是否只读
- 是否需要审批

### 8.5 MCP 注入规则

MCP 比 tool 更保守，只有在满足以下条件时注入：

- 出现明确 capability gap
- 任务确实需要外部连接器或外部资料
- source policy / connector policy 允许
- 当前不是轻量 direct-reply 普通问答

MCP 注入必须记录注入理由和 policy 约束。

### 8.6 direct-reply 限制

direct-reply 默认只允许轻量 skill/context 注入。

如果请求需要主动执行、重型检索、连接器访问、高风险工具或高成本外部能力，应升级到 runtime 主链或触发 interrupt，而不是继续伪装成普通直聊。

## 9. 模式配置

同一管线通过 `InvocationModeProfile` 区分策略，不通过调用方自定义处理器顺序区分。

### 9.1 `direct-reply`

特点：

- 默认低成本
- 默认轻上下文
- 默认不注入 MCP
- 默认不进入高风险工具执行
- 优先命中缓存
- 优先快速答复
- 命中复杂执行或审批需求时升级到 runtime

### 9.2 `runtime-task`

特点：

- 允许更完整上下文组装
- 允许按需注入 skill / tool / MCP
- 允许预算治理、审批中断、fallback、recover
- 允许多阶段模型调用和任务级汇总

### 9.3 配置原则

- 应用层只能选择 `modeProfile`
- processor 链由 `packages/runtime` 装配
- profile 只影响参数和阈值，不改变主执行顺序

## 10. 核心接口草案

### 10.1 `ModelInvocationRequest`

最小字段：

- `invocationId`
- `taskId?`
- `sessionId?`
- `modeProfile`
- `stage`
- `messages`
- `requestedModelId?`
- `contextHints`
- `capabilityHints`
- `budgetSnapshot`
- `traceContext`

### 10.2 `PreprocessDecision`

最小字段：

- `allowExecution`
- `denyReason?`
- `resolvedModelId`
- `resolvedMessages`
- `budgetDecision`
- `capabilityInjectionPlan`
- `cacheDecision`
- `traceMeta`

### 10.3 `ProviderExecutionResult`

最小字段：

- `outputText`
- `outputObject?`
- `usage`
- `vendorMetadata`
- `finishReason`
- `retryMeta`
- `fallbackMeta`

### 10.4 `PostprocessResult`

最小字段：

- `finalOutput`
- `invocationUsageRecord`
- `taskUsageDelta`
- `cacheWriteback?`
- `auditEvents`
- `deliveryMeta`

### 10.5 `ModelInvocationResult`

最小字段：

- `finalOutput`
- `invocationRecordId`
- `taskUsageSnapshot?`
- `traceSummary`
- `deliveryMeta`

## 11. 最小模块划分

建议在 `packages/runtime` 下新增：

```text
src/runtime/model-invocation/
  model-invocation-facade.ts
  model-invocation-pipeline.ts
  profiles/
  preprocessors/
  postprocessors/
  types/
```

初始处理器建议：

- preprocessors
  - `input-normalize`
  - `budget-estimate`
  - `context-assemble`
  - `capability-injection`
  - 后续补 `cache-lookup`
- postprocessors
  - `usage-billing`
  - `trace-audit`
  - `output-finalize`

## 12. 迁移策略

采用四步迁移，避免一次性重构全部调用点。

### 12.1 第一步：落统一 facade

先在 `packages/runtime` 建立：

- `ModelInvocationFacade`
- `ModelInvocationPipeline`
- 最小前后处理 contract

第一阶段先覆盖：

- 输入归一化
- model resolve
- usage 收集
- 调用级记录
- 任务级累计

暂不把所有能力注入与复杂缓存短路一次性接入。

### 12.2 第二步：优先接入 direct-reply

优先将 `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts` 改为通过 facade 调用。

目标：

- 统一 token / usage / cost
- 给 direct-reply 建立调用级账本
- 建立 direct-reply profile
- 建立基础 trace

### 12.3 第三步：接入 runtime 主链

逐步把 runtime 主链内散落的模型调用点切到 facade。

迁移期保留兼容桥：

- 旧 `onUsage` 可以暂时存在
- 但真实记账源切到后处理产物
- 完成迁移后逐步收口旧的零散累加逻辑

### 12.4 第四步：补强能力注入与缓存短路

在统一主线稳定后，再逐步引入：

- `CapabilityInjectionPreprocessor`
- `CacheLookupPreprocessor`
- direct-reply 升级到 runtime 的判定
- 更细粒度的 trace / audit / evidence 产物

## 13. 风险与保护措施

### 13.1 direct-reply 延迟升高

风险：

- 增加前后处理后，直聊链路响应变慢

保护：

- `direct-reply` 只启用轻量 processor 集
- token 预估和注入判定必须轻量
- direct-reply 默认不展开重型 tool/MCP 能力

### 13.2 双重记账

风险：

- 迁移期 `onUsage` 与 postprocess 同时记账导致重复累计

保护：

- postprocess 成为唯一记账源
- 调用级账本使用 `invocationId` 去重
- 旧 `onUsage` 在兼容期只做桥接，不再直接落账

### 13.3 注入过度保守导致能力退化

风险：

- 模型拿不到本应注入的 skill / tool / MCP

保护：

- `CapabilityInjectionPlan` 明确记录拒绝理由
- trace 可见为什么没有注入
- direct-reply 可升级到 runtime，避免静默失败

### 13.4 processor 膨胀为万能层

风险：

- 任意逻辑都被塞进 pre/post processor

保护：

- processor 单一职责
- 顺序固定
- 每个 processor 只改自身负责字段
- 调用方不能自定义处理器链

### 13.5 provider 与 runtime 职责再次混乱

风险：

- skill / tool / MCP 规则重新回流到 adapter/provider 层

保护：

- provider 只负责执行、usage、fallback、provider 级 cache
- 注入、预算治理、审批判断只属于 runtime pipeline

### 13.6 可观测性断层

风险：

- 统一后反而更黑盒

保护：

- 每次调用都必须产出 invocation record
- preprocess / execute / postprocess 都要有阶段事件
- 任务级汇总只是 projection，不替代调用级事实源

## 14. 验收标准

本设计落地后，至少应满足：

- runtime 主链与 direct-reply 不再直接裸调 provider
- direct-reply 和 runtime 都走统一 facade
- 前处理能给出结构化 `PreprocessDecision`
- 后处理能产出调用级 usage record 与任务级汇总
- skill / tool / MCP 采用保守按需注入
- direct-reply 保留轻量策略，复杂能力升级到 runtime
- 迁移期间不破坏既有 session / checkpoint / observability 兼容投影

## 15. 后续计划入口

本设计文档批准后，下一步应进入实现计划阶段，并使用 `writing-plans` 输出分阶段实施计划。
