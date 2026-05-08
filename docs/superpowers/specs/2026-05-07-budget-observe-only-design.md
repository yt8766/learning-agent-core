# Budget Observe-Only Design

状态：draft
文档类型：spec
适用范围：`packages/runtime`、`apps/backend/agent-server`、`apps/frontend/agent-admin`、`apps/frontend/agent-chat`、`docs/packages/runtime/**`
最后核对：2026-05-07

## 背景

当前 runtime 已经具备任务预算、模型调用预算预检、usage billing、Runtime Center 预算投影和 budget interrupt。真实使用中，预算门对当前阶段的帮助有限，反而容易让 Agent 回复变短、模型选择变保守、任务被不必要地打断，并增加排障噪音。

本设计将预算从“执行治理门”降级为“观测账本”。系统继续记录 token、cost、usage ledger 和 runtime projection，但预算不得影响模型选择、回复长度、任务暂停、审批或主链流转。

## 目标

- 保留 token / cost / usage accounting，用于后续观测、分析和成本治理复盘。
- 关闭预算对执行的硬影响：不 fallback、不 deny、不触发 soft / hard budget interrupt。
- 让 Agent 回复长度只受模型、业务提示词、用户要求和产品策略影响，不受 budget gate 影响。
- 保持现有 `budgetState` / `budgetGateState` contract 的兼容性，减少跨前后端破坏式迁移。
- 更新文档和 UI 语义，明确当前预算是 observe-only。

## 非目标

- 不删除 `budgetState`、usage ledger、Runtime Center analytics 或已有 cost/token 字段。
- 不重建计费系统或 LLM gateway 的 API key 日限额能力。
- 不把 step / retry 这类 runtime safety limit 混同为预算治理增强；如果保留它们，应在文档和 UI 中与 cost/token budget 分开命名。
- 不在本阶段引入新的审批流程或预算确认卡。

## 设计原则

预算字段继续存在，但只表达事实：用了多少 token、花了多少 cost、当前任务累计多少调用。任何 `budgetState` 的派生状态都不能改变 Agent 的执行路径。

具体规则：

- `budgetEstimatePreprocessor` 仍可估算 input tokens，但结果只写入 `budgetDecision.status = "allow"`，不得因为 token 或 cost 超限切换模型或拒绝执行。
- `UsageBillingPostprocessor` 继续生成 `invocationUsageRecord` 和 `taskUsageDelta`，并继续回写 `TaskRecord.budgetState.tokenConsumed`、`costConsumedUsd`、`costConsumedCny`。
- `updateTaskBudgetState()` 继续更新 consumed 字段，但不再设置 `soft-threshold-triggered` 或 `hard-threshold-triggered`。
- `assertTaskBudgetAllowsProgress()` 不再因为 token/cost hard threshold 抛 `TaskBudgetExceededError`。
- `budgetGateState` 若仍需要兼容展示，应始终保持非阻断语义，例如 `status = "open"`，summary 使用“预算仅观测，不影响执行”。
- Runtime Center 和 agent-admin 只展示 usage/cost 趋势，不展示“预算门阻断”“预算治理暂停”等强治理文案。

## 影响范围

### Runtime Model Invocation

`packages/runtime/src/runtime/model-invocation/preprocessors/budget-estimate-preprocessor.ts`

当前行为会在 cost exhausted 或 token estimate 超 budget 时 fallback / deny。改为：

- 永远允许执行。
- 保留 `estimatedInputTokens`。
- 不读取 `fallbackModelId` 来改写 `resolvedModelId`。
- 不返回 `denyReason = "token budget exceeded"` 或 `"cost budget exceeded"`。

### Task Budget State

`packages/runtime/src/graphs/main/tasking/runtime/main-graph-task-runtime-budget.ts`

当前行为会按 token/cost ratio 设置 soft/hard budget interrupt，并更新 `budgetGateState`。改为：

- consumed 字段继续累计。
- `budgetInterruptState` 默认保持 `idle`。
- 不因 token/cost ratio 设置 interrupt。
- `overBudget` 可保留为纯观测布尔值，但不得被 runtime orchestration 用作阻断条件。
- `budgetGateState.status` 保持 `open`，除非队列节流等非预算机制另有明确状态。

### Main Graph Orchestration

主链中捕获 `TaskBudgetExceededError` 的逻辑可以保留兼容，但 observe-only 预算不应再主动产生该错误。后续若 `TaskBudgetExceededError` 仍存在，应只服务非预算的 runtime safety limit，或在下一轮单独重命名为更准确的 execution limit error。

### Frontend Projections

`agent-admin` 和 `agent-chat` 继续读取 tokens/cost/usage projection，但展示语义调整为：

- “Usage / Cost” 是事实统计。
- “Budget gate” 不再作为当前执行中心的治理节点。
- 如必须保留节点，文案应标注 `observe-only`，避免用户误以为预算会阻断任务。

### Documentation

需要同步更新：

- `docs/packages/runtime/README.md`
- `docs/packages/runtime/llm-invocation-lifecycle-plan.md`
- `docs/architecture/ARCHITECTURE.md`
- 任何提到 budget fallback / deny / interrupt 当前生效的 backend/frontend 文档

## 错误处理

observe-only 后，预算相关错误不再作为正常执行结果出现：

- token/cost 超出观测阈值不返回业务错误。
- 模型 provider 自身的 `max_tokens`、context length 或 gateway daily limit 仍按各自边界返回错误，这些不是 runtime budget gate。
- 如果 LLM gateway 仍有 API key 日限额，那属于 gateway 级账号保护，不属于 Agent runtime 预算流程，本设计不改变它。

## 测试策略

需要覆盖这些回归：

- `budgetEstimatePreprocessor` 在 token estimate 超 budget 时仍返回 allow，且不切 fallback model。
- cost consumed 大于 cost budget 时仍返回 allow，且不 deny。
- `updateTaskBudgetState()` 在 token/cost ratio 超 soft/hard threshold 时不设置 budget interrupt。
- `assertTaskBudgetAllowsProgress()` 不因 cost/token hard threshold 抛错。
- usage billing 仍累计 `tokenConsumed`、`costConsumedUsd`、`costConsumedCny`。
- Runtime Center projection 不再把 budget gate 标成 blocked。

## 迁移策略

第一阶段只改执行语义，不删字段：

1. Runtime 预算预检改为 observe-only。
2. Task budget state 不再产生 budget interrupt。
3. UI 与文档改文案，明确预算只观测。
4. 保留历史字段和测试 fixture，避免前后端 contract 破坏。

第二阶段如果确认不再需要预算治理，再评估是否删除或重命名字段。删除必须另开设计，因为会影响 `TaskRecord`、Runtime Center、agent-admin、agent-chat、测试 fixture 和文档。

## 验收标准

- Agent 不会因为 token/cost budget 变短、切低成本模型、停止执行或请求预算确认。
- Runtime 仍能记录每次模型调用的 tokens/cost。
- Runtime Center 仍能展示 usage 趋势。
- 所有预算阻断相关文案都被改为 observe-only 或移除。
- 受影响单测和类型检查通过。
