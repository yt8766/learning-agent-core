# runtime 文档目录

状态：current
文档类型：index
适用范围：`docs/runtime/`
最后核对：2026-04-24

本目录用于沉淀 `packages/runtime` 相关文档。

包边界：

- 职责：
  - graph wiring
  - runtime orchestration
  - session lifecycle
  - checkpoint / cancel / recover
  - governance runtime
  - runtime-facing facade
- 允许：
  - graphs
  - flows
  - session
  - governance
  - runtime facade
  - capabilities
- 禁止：
  - provider SDK 细节
  - repository 底层实现
  - tool executor 底层实现
  - app controller / view model
  - 垂直 agent 私有 prompt 与实现
- 依赖方向：
  - 依赖 `@agent/config`、`@agent/core`、`@agent/adapters`、`@agent/memory`、`@agent/tools`、`@agent/skill-runtime`
  - 当前仍存在对 `agents/*` 的编排依赖，后续应继续向 contract / registry 方向收敛
- 公开入口：
  - 根入口：`@agent/runtime`

与 `apps/backend/agent-server/src/runtime` 的边界：

- `packages/runtime`
  - canonical runtime host
  - 负责主链编排、session lifecycle、approval/recover、background semantics、runtime-facing facade
  - `runtime/provider-audit.ts`、`runtime/runtime-analytics.ts`、`runtime/runtime-metrics-store.ts` 已作为 metrics 子域主宿主
  - `runtime/runtime-metrics-refresh.ts` 当前作为 runtime/evals persisted snapshot refresh facade 主宿主；这层默认顺序写入同一份 `RuntimeStateSnapshot`，避免 usage/eval history 并发落盘时互相覆盖
  - `governance/runtime-governance-store.ts`、`governance/runtime-governance-aggregation.ts`、`governance/runtime-counselor-selector-store.ts`、`governance/runtime-approval-scope-policy-store.ts` 已作为 governance 子域主宿主
  - `runtime/runtime-center-projection*.ts`、`runtime/runtime-company-agents-center.ts`、`runtime/runtime-connectors-center.ts`、`runtime/runtime-skill-sources-center.ts` 当前作为 admin/runtime center projection 主宿主
  - `runtime/runtime-learning-center*.ts` 当前作为 learning center full/summary projection 主宿主
  - backend 需要使用 metrics / governance / center projection helper 时，默认应从 `@agent/runtime` 根入口消费
- `agent-server/src/runtime`
  - backend-specific host / BFF adapter
  - 不应长期沉积稳定 runtime 主逻辑
  - 若 backend 暂时需要局部 runtime domain helper，应明确标记为 app-local 过渡收口层，而不是第二套 runtime canonical host

约定：

- `packages/runtime` 的专项文档统一放在 `docs/runtime/`
- 新增 runtime facade、session 语义、governance 边界或 graph 主链宿主变化后，需同步更新本目录文档
- `runtime/llm-facade.ts` 当前作为 LLM retry / structured generation facade 的真实宿主
- `contracts/llm-facade.ts` 已删除；这类 helper 不再额外包一层 runtime contract 壳
- `runtime/model-invocation` 当前已收敛两条最小语义：
  - `CapabilityInjectionPreprocessor` 对 `direct-reply` 维持保守按需注入，默认不放行 MCP；若 hint 显式请求 MCP，会写入 `rejectedCandidates / reasons` 并拒绝执行
  - invocation pipeline 会在全部 preprocess 完成后检查 `cacheDecision`；当状态为 `hit` 且携带缓存文本时，直接返回缓存结果，不再进入 provider.execute
  - `BudgetEstimatePreprocessor` 会按最终组装后的消息估算 token；超预算时优先切到 `fallbackModelId`，无 fallback 时直接返回 deny 结果，不继续调用 provider
  - `UsageBillingPostprocessor` 会产出稳定的 invocation usage ledger 与 `taskUsageDelta`，主链 `recordTaskUsageFromInvocation(...)` 负责做去重落盘并回写 task `llmUsage / budgetState`

当前文档：

- [llm-invocation-lifecycle-plan.md](/docs/runtime/llm-invocation-lifecycle-plan.md) — LLM 前处理、能力注入、token/cost 预检、后处理与计费结算计划
- [package-structure-guidelines.md](/docs/runtime/package-structure-guidelines.md)
- [runtime-interrupts.md](/docs/runtime/runtime-interrupts.md) — 中断控制流规范
- [runtime-layering-adr.md](/docs/runtime/runtime-layering-adr.md) — Runtime 分层 ADR
- [runtime-state-machine.md](/docs/runtime/runtime-state-machine.md) — 状态机参考
