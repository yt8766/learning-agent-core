# runtime 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/runtime/`
最后核对：2026-05-03

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
  - 依赖 `@agent/config`、`@agent/core`、`@agent/adapters`、`@agent/memory`、`@agent/tools`、`@agent/skill`
  - 当前仍存在对 `agents/*` 的编排依赖，后续应继续向 contract / registry 方向收敛
- 公开入口：
  - 根入口：`@agent/runtime`
  - `package.json` 的 `types` / conditional export types 指向 `build/types/runtime/src/index.d.ts`，该声明文件由 `pnpm --dir packages/runtime build:types` 生成。`packages/runtime` 的 `turbo:test:unit` 会先执行 `build:types` 再跑 unit tests，因为 `turbo-typecheck-manifests.test.ts` 会在干净 CI 环境中校验这些 package type exports 是否指向真实声明产物。

与 `apps/backend/agent-server/src/runtime` 的边界：

- `packages/runtime`
  - canonical runtime host
  - 负责主链编排、session lifecycle、approval/recover、background semantics、runtime-facing facade
  - `session/session-coordinator-direct-reply.ts` 是 agent-chat 会话普通问答 fast path：在无执行、检索、审批、skill、connector、报表或代码修改意图时，直接调用通用 LLM provider 并写入 session messages/events/checkpoint，不创建 runtime task，也不进入 supervisor / 六部 graph
  - direct-reply 在持久化最终 assistant 消息和完成事件前会清理 `<think>...</think>` 与未闭合 `<think>` 尾段；前端 thinking panel 负责展示可见思考块，runtime 只保证最终正文不泄漏模型内部标签
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

- `packages/runtime` 的专项文档统一放在 `docs/packages/runtime/`
- 新增 runtime facade、session 语义、governance 边界或 graph 主链宿主变化后，需同步更新本目录文档
- `ChatSessionRecord.titleSource` 是 session title 自动生成与手动改名保护的稳定字段：`manual` 和 `generated` 会阻止后续自动摘要覆盖标题，旧会话缺省视为可继续派生
- `runtime/llm-facade.ts` 当前作为 LLM retry / structured generation facade 的真实宿主
- `runtime/concurrency` 当前作为 agent 批量异步任务并发控制 helper 的真实宿主；它提供 `runWithConcurrency`，用于保序结果、失败汇总、取消信号透传与并发上限控制
- `contracts/llm-facade.ts` 已删除；这类 helper 不再额外包一层 runtime contract 壳
  - `runtime/model-invocation` 当前已收敛两条最小语义：
  - `CapabilityInjectionPreprocessor` 对 `direct-reply` 维持保守按需注入，默认不放行 MCP；若 hint 显式请求 MCP，会写入 `rejectedCandidates / reasons` 并拒绝执行
  - invocation pipeline 会在全部 preprocess 完成后检查 `cacheDecision`；当状态为 `hit` 且携带缓存文本时，直接返回缓存结果，不再进入 provider.execute
  - `BudgetEstimatePreprocessor` 会按最终组装后的消息优先调用 provider token estimate；provider 未提供估算器时才回退到轻量字符估算。超预算时优先切到 `fallbackModelId`，无 fallback 时直接返回 deny 结果，不继续调用 provider
  - `UsageBillingPostprocessor` 会产出稳定的 invocation usage ledger 与 `taskUsageDelta`；当上游 usage 只回传 `costUsd` 时，会在 pipeline 内补算 `costCny`，避免 task `budgetState.costConsumedCny` 长期缺口。主链 `recordTaskUsageFromInvocation(...)` 负责做去重落盘并回写 task `llmUsage / budgetState`
  - `LearningFlow.persistReviewArtifacts(...)` 在已安装 skill 被 `SkillRegistry.recordExecutionResult(...)` 接受后，会通过 runtime 装配层 callback 写入 `RuntimeStateSnapshot.workspaceSkillReuseRecords`。runtime 只负责记录“实际复用 skill”的稳定信号；Workspace Center HTTP 输出仍由 `apps/backend/agent-server` 读取 runtime state 并经 `packages/platform-runtime` 白名单 projection 生成。
  - `LocalSandboxExecutor` 的 `browse_page` 路径支持注入 `browserArtifactWriter`，用于把 replay/snapshot/screenshot 写入稳定 artifact repository；未注入时写入 `artifacts/runtime/browser-replays/<sessionId>/` 显式 artifact storage，不再使用 root `data/browser-replays`。

当前文档：

- [artifact-storage.md](/docs/packages/runtime/artifact-storage.md) — runtime / report generated artifacts 的显式 `artifacts/*` 默认路径与 root `data/*` 清理边界
- [agentos-runtime-profile.md](/docs/packages/runtime/agentos-runtime-profile.md) — Agent Runtime Profile、Context Manifest、ToolRequest / PolicyDecision 与 QualityGate 的第一阶段治理模型
- [contract-import-boundaries.md](/docs/packages/runtime/contract-import-boundaries.md) — P3-1 后 runtime/backend/agents 的迁出 contract 导入边界
- [execution-trajectory-factories.md](/docs/packages/runtime/execution-trajectory-factories.md) — Execution Fabric 与 Task Trajectory runtime factories
- [langgraph-postgres-checkpointer.md](/docs/packages/runtime/langgraph-postgres-checkpointer.md) — LangGraph `MemorySaver` / PostgreSQL `PostgresSaver` 切换与初始化边界
- [llm-invocation-lifecycle-plan.md](/docs/packages/runtime/llm-invocation-lifecycle-plan.md) — LLM 前处理、能力注入、token/cost 预检、后处理与计费结算计划
- [package-structure-guidelines.md](/docs/packages/runtime/package-structure-guidelines.md)
- [runtime-concurrency.md](/docs/packages/runtime/runtime-concurrency.md) — agent 运行期批量异步任务并发控制 helper
- [runtime-interrupts.md](/docs/packages/runtime/runtime-interrupts.md) — 中断控制流规范
- [runtime-layering-adr.md](/docs/packages/runtime/runtime-layering-adr.md) — Runtime 分层 ADR
- [sandbox-browser-artifacts.md](/docs/packages/runtime/sandbox-browser-artifacts.md) — `browse_page` replay/generated artifact writer seam 与显式 artifact storage 默认路径
- [runtime-state-machine.md](/docs/packages/runtime/runtime-state-machine.md) — 状态机参考
