# Shared 删包前 Checklist

状态：history
文档类型：history
适用范围：`packages/shared`、`packages/core`、`packages/runtime`、`apps/backend/agent-server`、`agents/*`
最后核对：2026-04-18

补充说明：

- `packages/shared` 已于 `2026-04-18` 从 workspace 删除。
- 本文档保留为退场过程的历史台账；下文中“blocker”与“不可删除”描述对应的是迁移过程中的阶段性状态。

本文记录的是删包前最后一类 blocker：

- 哪些 stable contract 已经不再构成 blocker
- 哪些 runtime overlay 仍然卡住 `packages/shared`
- 哪些 consumption facade 仍需保留

当时结论：

- 当时仍不适合直接删除 `packages/shared`
- stable contract 主定义基本已经收敛到 `@agent/core`
- 当时真正 blocker 只剩 `runtime overlay + consumption facade + 少量 compat`
- `KnowledgeStoreRecord` / `KnowledgeSourceRecord` / `KnowledgeChunkRecord` / `KnowledgeEmbeddingRecord` / `KnowledgeIngestionReceiptRecord` 已迁入 `@agent/core`，`shared` 仅保留 compat 出口
- `LearningConflictRecord` / `LearningConflictScanResult` 已迁入 `@agent/core`，`shared` 仅保留 compat 出口
- `AgentTokenEvent` 已迁入 `@agent/core`，`shared` 仅保留 compat 出口
- `PlanMode` 已迁入 `@agent/core`，`shared` 仅保留 compat 出口
- `SourcePolicyMode` / `WorkerDomain` / `SpecialistDomain` / `ExecutionStepRoute` / `ExecutionStepStage` / `ExecutionStepStatus` / `ExecutionStepOwner` 已迁入 `@agent/core`，`shared` 仅保留 compat 出口

## 0. 现在还差什么才能删 shared

当前剩余 blocker 已固定收口为四类，后续实现和判定都按这四类执行：

### 0.1 runtime overlay blocker

这些类型里，真正还由 `shared` 承接 runtime-only host 的部分已经进一步缩小；`TaskRecord` / `ChatCheckpointRecord` 当前已降成 compat alias，learning 记录也已退出 shared 公开面，interrupt 也已不再被 shared 内部其它类型复用：

- 少量 approval compat 出口
- 少量 specialist / chat-session widening

固定口径：

- `TaskRecord` / `ChatCheckpointRecord` 现在已直接 alias 到 `@agent/core`，shared 仅保留命名 overlay field slice 作为 compat 出口
- `LearningJob` / `LearningQueueItem` 已从 shared 公开面移除，runtime / memory 当前各自使用宿主本地 learning record
- 只要这批 overlay 还留在 `shared`，包本身就不能删除

### 0.2 consumption facade blocker

这些内容不是 core stable contract，而是消费层 facade；没有新宿主前不能删：

- admin/runtime 组合投影视图

补充：

- `platform-console` 的 stable 主 contract 已在 `@agent/core`
- shared 当前保留的 `platform-console` 更接近 compat 默认泛型包装，而不是 active facade blocker
- `packages/shared/src/types/platform-console.ts` 的默认泛型现在也已直接回指 `@agent/core` 的 `TaskRecord` / `ChatSessionRecord` / `SkillCard` / `RuleRecord` / `EvidenceRecord`
- `platform-console` 当前已经是纯 compat-only 包装，而不是 shared 消费 facade blocker
- `packages/shared/src/types/governance.ts` 中除 `ApprovalInterruptRecord` 外，其余 `ApprovalRecord` / `ApprovalPolicyRecord` / `ApprovalScopeMatchInput` / `ApprovalScopePolicyRecord` / `McpCapability` 已全部降成 core compat alias
- `runtime-centers*` 已完成 shared 退场；backend 与 admin 当前都只消费各自宿主内的本地 `RuntimeCenterRecord`
- `agent-admin` 本地类型层已承接 `LearningCenterRecord` / `EvalsCenterRecord`，对应 shared facade 宿主已删除
- `agent-admin` 的 `ApprovalScopePolicyRecord` 已回收到本地 `governance.ts`，`InstalledSkillRecord` / `SkillInstallReceipt` / `CompanyAgentRecord` 已改为以 `@agent/core` 为 stable base；前端控制台只在宿主内保留 widening
- `agent-admin` 的 `ApprovalDecisionRecord` / `EvidenceRecord` 已改为直接从 `@agent/core` 消费，并新增本地 `tasking-task.types.ts` 承接 `TaskRecord` overlay；admin 业务类型文件已不再直接从 `@agent/shared` 导入

### 0.3 host-local helper / facade

shared 原先承接的 helper reclaim 已经迁空并删除实现；当前这类 helper 已全部回收到 runtime / backend / supervisor / frontend 各自宿主，不再构成 shared blocker。

### 0.4 compat-only

这些内容当前仍保留 shared 入口，但语义已经是 compat，不再误记为 stable contract 主定义：

- `AgentRole`
- `SubgraphId`
- `ExecutionPlanRecord`
- workflow / prompt / bootstrap compat 子路径

总判定：

- 这四类不是“忘了迁”，而是 shared 当前合法白名单。
- 只有当这四类之外的内容清空后，shared 才算真正收口到可讨论删除的终态。

### 0.5 仍可继续从 shared 迁出的内容

这些内容如果后续在主链里还出现从 `@agent/shared` 导入，应继续迁向 `@agent/core` 或真实宿主：

- 已在 `@agent/core` 根出口存在的 stable contract
- 仍残留在主链里的 planning / orchestration / governance / memory / skills 稳定类型
- 只作为 compat alias 暂存、但没有真实 widening 的 shared 类型出口

当前重点排查宿主：

- `agents/supervisor/src/flows/supervisor/*`
- `agents/supervisor/src/workflows/*`
- `packages/runtime/src/graphs/main/*`
- `packages/runtime/src/session/*`
- `apps/backend/agent-server/src/runtime/*`
- `packages/memory/src/repositories/runtime-state-repository.ts`

完成判定：

- 文件中不再出现“稳定字段只因图省事仍从 `@agent/shared` 导入”。
- 同一文件若同时依赖 stable contract 和 overlay，必须拆成 `@agent/core + @agent/shared` 双导入。

当前进度补充：

- `packages/runtime/src/utils/*`、`packages/runtime/src/capabilities/*`、`packages/runtime/src/graphs/main/{background,knowledge,lifecycle,pipeline,orchestration}/*`、`packages/runtime/src/flows/ministries/{review-stage-helpers,review-stage-persistence,governance-stage-helpers,runtime-stage-execute}.ts`
  - 本轮继续把 `TaskRecord` 业务直连统一压到 `packages/runtime/src/runtime/runtime-task.types.ts`
  - `context-compression-pipeline.ts`、`capability-pool-{governance,merge,explanation}.ts`、`main-graph-background.ts`、`main-graph-knowledge.ts`、`main-graph-lifecycle-{routing,approval-timeout,persistence,background}.ts`、`task-bootstrap-interrupt-graph.ts`、`direct-reply-interrupt-graph.ts`、`main-graph-pipeline-graph.ts`、`main-graph-execution-helpers.ts` 当前已不再直接从 `@agent/shared` 导入 `TaskRecord`
  - runtime 主链里剩余的 `TaskRecord` shared 入口已进一步收敛为：
    - `packages/runtime/src/runtime/runtime-task.types.ts`
    - `packages/runtime/src/session/session-task.types.ts`
    - `packages/runtime/src/graphs/main/task/main-graph-task.types.ts`
    - `packages/runtime/src/flows/ministries/review-stage-state.ts`
    - `packages/runtime/src/flows/ministries/runtime-stage-helpers.ts`
    - `packages/runtime/src/capabilities/capability-pool-bootstrap.ts`
  - 其中前三处属于已接受的宿主内 aggregate bridge；后三区分别对应 runtime overlay / runtime-only helper 白名单，而不是新的 stable contract 漏迁
- `packages/runtime/src/flows/ministries/*`、`packages/runtime/src/graphs/main/orchestration/*`、`packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle-approval-action.ts`、`packages/runtime/src/flows/approval/research-skill-interruption.ts`
  - 本轮继续把 `TaskRecord` 主链签名从 shared 收回到 runtime 本地 bridge，并把 `AgentRole` / `SourcePolicyMode` / `GovernanceReportRecord` 等稳定 contract 切回 `@agent/core`
  - 本轮继续把 `TaskRecord` 三个本地 bridge、`SpecialistFindingRecord` widening、`ApprovalInterruptRecord` widening 一并收回 runtime 本地宿主
  - runtime 当前业务主链已不再有任何文件直接从 `@agent/shared` 读取稳定 contract 或 aggregate record
- `packages/runtime/src/runtime/runtime-specialist-finding.types.ts`
  - 本轮已新增 runtime 本地 `SpecialistFindingRecord` bridge 宿主
  - `runtime-stage-research.ts` 与 `review-stage-state.ts` 当前已不再直接从 `@agent/shared` 导入该 widening record
- `packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle-learning.ts`、`packages/runtime/src/graphs/main/background/main-graph-learning-jobs.ts`
  - `CreateDocumentLearningJobDto` / `CreateResearchLearningJobDto`、`ActionIntent`、`EvidenceRecord`、`SkillCard` 已继续切回 `@agent/core`
  - `runtime-learning.types.ts` 已继续改为 runtime 本地宿主，不再经由 `@agent/shared` 借道 learning runtime-only record
- `packages/runtime/src/flows/approval/risk-interrupts.ts`
  - `runtime-approval.types.ts` 已继续承接 runtime interrupt widening bridge
  - 该文件当前已不再直接从 `@agent/shared` 导入 `ApprovalInterruptRecord`
- runtime 最新 shared 命中已进一步收敛为 `0` 个源码文件：
  - `runtime-task.types.ts`、`session-task.types.ts`、`main-graph-task.types.ts`、`runtime-specialist-finding.types.ts`、`runtime-approval.types.ts` 当前都已经切成本地宿主
  - runtime 主链现在不再以 shared 消费点的形式阻止删包；剩下的 blocker 是 shared 包内仍保留的 overlay / compat host 本身
- `packages/memory/src/repositories/runtime-state-task.types.ts`
  - `RuntimeStateTaskRecord` 已继续改为 memory 本地 snapshot 宿主
  - memory 当前业务主链也已不再直接从 `@agent/shared` 导入 `TaskRecord`
- shared 外部源码消费已进一步收敛为 `0`
  - 最新全仓搜索中，`packages/shared` 之外已不再有源码或测试文件 import `@agent/shared`
  - 这说明 shared 当前已不再被仓库外部实现侧直接依赖，删包 blocker 已经完全收敛到 shared 包自身内容
- shared 工作区依赖已进一步收敛为 `1`
  - 各业务包 `package.json` 中的 `@agent/shared` 工作区依赖已全部移除
  - 当前保留 `@agent/shared` 包名的 manifest 只剩 `packages/shared/package.json` 本身
- `packages/shared/src/types/runtime-centers.ts`
  - 本轮已从 shared 公开 barrel 中移除，并删除旧 facade 宿主文件
  - 仓库业务代码当前已不再存在从 `@agent/shared` 导入 `RuntimeCenterRecord` 的消费点
  - `runtime-centers*` 已不再属于 shared 删包 blocker

- `packages/runtime/src/session/*`、`packages/runtime/src/graphs/main/lifecycle/*`、`packages/runtime/src/graphs/main/task/*`
  - 当前剩余 shared 导入点已收敛到约 `38` 处
  - 其中大多数已经不是 stable contract 漏迁，而是下列白名单残留：
    - `TaskRecord` / `LearningJob` / `LearningQueueItem`
    - `AgentRole`
    - `getMinistryDisplayName` / `normalizeExecutionMode`
    - `appendDataReportContext` / `buildDataReportContract`
    - `ExecutionPlanRecord` 一类已确认存在 stricter typing 回归风险的 compat 入口
- `packages/runtime/src/session/*`、`packages/runtime/src/graphs/main/*`、`agents/supervisor/src/flows/*`、`agents/supervisor/src/workflows/*`、`packages/memory/src/repositories/runtime-state-repository.ts`、`apps/backend/agent-server/src/runtime/*`
  - 继续复核后，当前已基本看不到新的 stable contract 主定义误留 shared 的主链调用点
  - 剩余 shared 依赖已主要收敛为：
    - `TaskRecord`
    - `AgentRole`
    - `SubgraphId`
    - `getMinistryDisplayName` / `normalizeExecutionMode` / `normalizeMinistryId`
    - `getSpecialistDisplayName` / `normalizeSpecialistDomain`
    - `appendDataReportContext` / `buildDataReportContract`
    - `ExecutionPlanRecord`、`execution-steps` 细粒度别名、`BootstrapSkillRecord` 这类 compat-only 入口
    - 少量 approval/runtime overlay 类型，例如 `ApprovalInterruptRecord`
- `packages/runtime/src/session/*`、`packages/runtime/src/graphs/main/task/*`、`agents/supervisor/src/flows/supervisor/*`、`agents/supervisor/src/workflows/*`
  - 最新继续清理后，runtime session / runtime task 业务文件中的 shared 直连已不再包含 `TaskRecord`
  - `agents/supervisor/src/flows/supervisor/*` 与 `agents/supervisor/src/workflows/*` 的业务文件 shared 直连已清到 `0`
  - 其余 shared 命中主要来自：
    - 宿主内 helper / compat host（`session-task.types.ts`、`main-graph-task.types.ts`、`session-architecture-helpers.ts`、`task-architecture-helpers.ts`、`workflow-architecture-helpers.ts`、`supervisor-architecture-helpers.ts`）
    - 少量仍明确属于 compat-only 的共享类型出口
- `packages/runtime/src/graphs/main/pipeline/*`、`packages/runtime/src/graphs/main/orchestration/*`、`packages/runtime/src/flows/ministries/*`
  - 本轮继续把 `AgentRole` 从 `@agent/shared` 拆到 `@agent/core`
  - 当前这些主链文件如果仍保留 shared 双导入，主要原因已收敛为 `TaskRecord` overlay，而不是 stable primitive 仍宿主在 shared
- `packages/runtime/src/graphs/main/lifecycle/*`
  - 本轮继续把 `AgentRole` / `SubgraphId` 从 `@agent/shared` 拆到 `@agent/core`
  - lifecycle 主链当前保留 shared 依赖的主要原因也已收敛为 `TaskRecord` 这类 runtime overlay，以及少量 widening / interrupt 记录
- `packages/runtime/src/flows/approval/*`、`packages/runtime/src/flows/ministries/*`、`packages/runtime/src/graphs/main/orchestration/*`
  - 本轮继续把 `ActionIntent`、`ApprovalResumeInput`、`ApprovalDecision`、`ReviewRecord`、`TaskStatus`、`ExecutionTrace`、`ModelRouteDecision`、`AgentExecutionState`、`AgentMessage` 等稳定 contract 从 `@agent/shared` 拆回 `@agent/core`
  - runtime 主链当前对 `@agent/shared` 的直连，已经基本收敛为：
    - `TaskRecord`
    - `CurrentSkillExecutionRecord` / `GovernanceReportRecord` / `SpecialistFindingRecord` 一类 overlay 相关运行态记录
    - `getMinistryDisplayName` / `normalizeExecutionMode` / `normalizeMinistryId` 一类 helper reclaim
- `packages/runtime/src/runtime/runtime-architecture-helpers.ts`
  - 本轮已新增 runtime 本地 helper 宿主，承接 `getMinistryDisplayName`、`normalizeMinistryId`、`normalizeExecutionMode`、`getSpecialistDisplayName`、`normalizeSpecialistDomain`
  - `session-architecture-helpers.ts`、`capability-pool.shared.ts`、`capability-pool-governance.ts`、`runtime-stage-{research,execution}.ts`、`main-graph-execution-helpers.ts` 当前已不再直接从 shared 导入这些 helper reclaim
- `packages/runtime/src/runtime/runtime-learning.types.ts`
  - 本轮已新增 runtime 本地 learning record 宿主，集中承接 `LearningJob` / `LearningQueueItem`
  - `main.graph.ts`、`main-graph-runtime-modules.ts`、`main-graph-learning-jobs.ts`、`main-graph-lifecycle-{types,state,queries,learning,learning-queue}.ts` 与 `flows/learning/*` 当前已不再直接从 shared 导入 `LearningJob` / `LearningQueueItem`
  - runtime 当前剩余 shared 命中已不再包含 learning 主链
- `packages/runtime/src/runtime/runtime-task.types.ts`
  - 当前已成为 runtime 主链统一的 `TaskRecord` 本地 bridge 宿主
  - runtime 业务主链里凡是不需要直接承担 overlay host 语义的文件，应继续优先经由这层消费，而不是直接从 `@agent/shared` 读取 `TaskRecord`
- `packages/core/src/spec/primitives.ts`
  - 已补齐 `AgentRole` / `SubgraphId` 的 core primitive 宿主
  - `packages/runtime` / `agents/supervisor` 的本地 helper 当前统一经由 `AgentRoleValue` / `SubgraphIdValue` 消费这类类型别名
- `packages/runtime/src/session/*`
  - 最新继续清理后，`session-coordinator.ts`、`session-coordinator-turns.ts`、`session-coordinator-session-ops.ts`、`session-coordinator-sync.ts`、`session-coordinator-approvals.ts`、`session-coordinator-approval-policy.ts`、`session-coordinator-thinking*.ts`、`session-coordinator-learning.ts` 均已不再直接从 `@agent/shared` 导入 `TaskRecord`
  - session 主链当前只剩两类 shared 命中：
    - `session-task.types.ts` 作为宿主内本地 aggregate 适配层，集中承接 `TaskRecord` overlay 兼容读路径
    - `session-architecture-helpers.ts` 作为 helper reclaim / compat host，集中承接 `AgentRole`、`getMinistryDisplayName`、`normalizeExecutionMode`
  - 这意味着 session 主链已不再存在“稳定字段顺手从 shared 整包导入”的业务文件调用点
- `packages/runtime/src/graphs/main/task/*`
  - 本轮已新增 `main-graph-task.types.ts` 作为宿主内本地 aggregate 适配层，集中承接 `TaskRecord` overlay 兼容读路径
  - `main-graph-task-runtime*.ts`、`main-graph-task-factory.ts`、`task-record-builder.ts`、`task-factory.types.ts`、`task-skill-intervention.ts`、`task-execution-plan.ts`、`main-graph-task-context.ts` 与 `main-graph-task-drafts.ts` 已不再直接从 `@agent/shared` 导入 `TaskRecord`
  - `main-graph-task-context.ts` 同步拆出 `main-graph-task-context-helpers.ts`，当前已回落到 400 行以内；这类本地桥接与 helper 收口继续固定在 runtime 宿主内完成，不再回推 shared
- `apps/backend/agent-server/src/runtime/knowledge/*`
  - `Knowledge*Record` 已切到 `@agent/core`
  - `packages/shared/src/types/knowledge-store.ts` 已退化为 compat re-export，不再承载主定义
- `packages/runtime/src/graphs/main/lifecycle/*`、`packages/runtime/src/graphs/main/main.graph.ts`、`packages/memory/src/repositories/runtime-state-repository.ts`
  - `LearningConflictRecord` / `LearningConflictScanResult` 已切到 `@agent/core`
  - `packages/shared/src/types/knowledge-learning.ts` 仅保留 compat re-export，不再承载主定义
- `packages/memory/src/repositories/runtime-state-repository.ts`
  - `RuntimeStateSnapshot` 已新增本地 `RuntimeStateLearningJob` / `RuntimeStateLearningQueueItem`
  - memory 当前不再直接从 shared 导入 `LearningJob` / `LearningQueueItem`
  - 本轮已新增 `runtime-state-task.types.ts` 作为宿主内本地 aggregate 适配层，`runtime-state-repository.ts` 也已不再直接从 `@agent/shared` 导入 `TaskRecord`
- `apps/frontend/agent-admin/src/types/admin/*`
  - 本轮已新增本地 `learning.ts` / `evals.ts` 类型宿主
  - `centers.ts` 已不再直接从 `@agent/shared` 导入 `LearningCenterRecord` / `EvalsCenterRecord`
  - `runtime.ts` 已不再直接从 `@agent/shared` 导入 `ApprovalScopePolicyRecord`
  - `governance.ts` 已改为从 `@agent/core` 承接 `InstalledSkillRecord` / `SkillInstallReceipt` / `CompanyAgentRecord` 的 stable base
  - `tasking.ts` 已改为从 `@agent/core` 承接 `ApprovalDecisionRecord` / `EvidenceRecord`，并通过本地 `tasking-task.types.ts` 承接 `TaskRecord` overlay
  - `console-centers*` 的前端本地类型宿主已落地
- `packages/shared/src/types/skills-sources.ts` 已删除
  - `SkillSourcesCenterRecord` facade 已迁到 backend 的 `runtime-centers.records.ts` 与 admin 的 `governance.ts` 本地宿主
- `packages/shared/src/types/console-centers.ts`、`console-centers-learning.ts`、`console-centers-evals.ts` 已删除
  - `LearningCenterRecord` / `EvalsCenterRecord` 的 shared facade 宿主已清空，前端与 backend 继续各自使用本地真实宿主
- `agents/data-report/src/flows/data-report/contract.ts`
  - 已承接 `appendDataReportContext` / `buildDataReportContract` 的主实现宿主
- `packages/shared/src/workflows/data-report-contract.ts`
  - 当前已退化为指向 `@agent/agents-data-report` 的 compat re-export
- `packages/runtime/src/graphs/main/task/task-architecture-helpers.ts`
  - 已不再从 `@agent/shared` 借道 data-report contract helper
- `agents/supervisor/src/bootstrap/bootstrap-skill-registry.ts`
  - 已承接本地 `BootstrapSkillRecord` 定义
- `packages/runtime/src/capabilities/capability-pool-bootstrap.ts`
  - 已改为从 `@agent/agents-supervisor` 消费 `BootstrapSkillRecord`
- `packages/shared/src/types/skills-capabilities.ts`
  - 当前只剩 `BootstrapSkillRecord` 的 compat 定义，不再是 runtime capability bootstrap 的主链消费入口
- `packages/runtime/src/graphs/main/task/task-architecture-helpers.ts`
  - 已改为从 `@agent/core` 消费 `ExecutionPlanRecord`
- `packages/shared/src/types/tasking-planning.ts`
  - 当前只剩 `ExecutionPlanRecord` 的 compat type export，不再是 runtime task 主链的计划记录宿主
- `packages/skill/src/skill-registry.ts`
  - `PluginDraft` 已回收到 skill 本地宿主
  - `packages/skill/src/*` 当前已不再直接从 shared 导入 `PluginDraft`
- `packages/runtime/src/graphs/main/main.graph.ts`、`packages/runtime/src/graphs/main/main-graph-runtime-modules.ts`
  - `AgentTokenEvent` 已切到 `@agent/core`
  - `packages/shared/src/types/tasking-orchestration.ts` 仅保留 compat re-export，不再承载主定义
- `agents/supervisor/src/flows/supervisor/planning-stage-helpers.ts`、`agents/supervisor/src/workflows/planning-question-policy.ts`
  - `PlanMode` 已切到 `@agent/core`
  - `packages/shared/src/types/tasking-planning.ts` 仅保留 compat re-export，不再承载主定义
- `packages/runtime/src/flows/approval/risk-interrupts.ts`
  - `PendingApprovalRecord` 已切到 `@agent/core`
  - shared 侧只保留 `ApprovalInterruptRecord` 这一类 runtime overlay 相关导入
- `packages/runtime/src/graphs/main/main-graph.types.ts`、`packages/runtime/src/graphs/main/pipeline/task-bootstrap-interrupt-graph.ts`
  - `ApprovalResumeInput`、`ActionIntent`、`TaskStatus`、`ToolUsageSummaryRecord` 已切到 `@agent/core`
  - shared 侧只保留 `TaskRecord` / `AgentRole` 这类 overlay 或 compat 相关导入
- `packages/runtime/src/graphs/main/orchestration/main-graph-execution-helpers.ts`
  - `ApprovalDecision`、`ApprovalResumeInput`、`CreateTaskDto`、`QueueStateRecord`、`ReviewRecord`、`TaskStatus` 已切到 `@agent/core`
  - shared 侧只保留 `TaskRecord` / `AgentRole` 与 `getMinistryDisplayName` 这类 overlay 或 helper reclaim 相关导入
- `packages/runtime/src/graphs/main/orchestration/main-graph-bridge.ts`
  - `ApprovalResumeInput`、`CreateTaskDto`、`MemoryRecord`、`QueueStateRecord`、`ReviewRecord`、`RuleRecord`、`SkillCard`、`WorkflowPresetDefinition` 已切到 `@agent/core`
  - shared 侧只保留 `TaskRecord` / `AgentRole` / `SubgraphId` / `AgentExecutionState` / `AgentMessage` / `ModelRouteDecision` / `ExecutionTrace` 这类 overlay 或 compat 相关导入
- `packages/runtime/src/graphs/main/pipeline/main-graph-pipeline-graph.ts`
  - `ApprovalDecision`、`CreateTaskDto`、`ToolUsageSummaryRecord` 已切到 `@agent/core`
  - shared 侧只保留 `TaskRecord` / `AgentRole` 这类 overlay 或 helper reclaim 相关导入
- `agents/supervisor/src/workflows/research-source-planner.ts`、`agents/supervisor/src/workflows/execution-steps.ts`、`apps/backend/agent-server/src/runtime/skills/remote-skill-discovery.service.ts`、`packages/skill/src/agent-skill-loader.ts`、`packages/runtime/src/graphs/main/task/task-workflow-resolution.ts`、`packages/runtime/src/governance/model-routing-policy.ts`、`packages/runtime/src/capabilities/capability-pool-governance.ts`、`packages/runtime/src/governance/profile-policy.ts`
  - `SourcePolicyMode`、`WorkerDomain`、`SpecialistDomain`、`ExecutionStepRoute`、`ExecutionStepStage`、`ExecutionStepStatus`、`ExecutionStepOwner` 已切到 `@agent/core`
  - shared 侧只保留 `TaskRecord` / `ExecutionPlanRecord` 与 helper reclaim 等白名单残留
- `agents/supervisor/src/workflows/specialist-routing.ts`、`apps/backend/agent-server/src/runtime/skills/runtime-skill-sources.service.ts`、`packages/runtime/src/graphs/main/task/task-factory.types.ts`、`packages/runtime/src/capabilities/capability-pool.shared.ts`、`packages/runtime/src/capabilities/capability-pool-bootstrap.ts`
  - 新增复核后，`SpecialistDomain`、`WorkerDomain`、`CapabilityAttachmentRecord`、`CapabilityAugmentationRecord`、`CapabilityOwnershipRecord`、`LocalSkillSuggestionRecord`、`RequestedExecutionHints` 等稳定类型已继续切到 `@agent/core`
  - shared 侧继续只保留 `TaskRecord`、`BootstrapSkillRecord`、`MinistryId`、`SpecialistLeadRecord` 与 helper reclaim 相关导入
- `apps/backend/agent-server/src/runtime/skills/local-skill-search.ts`
  - 已去掉对 shared `SkillSourcePriority` 的顺手导入，直接改为从 `SkillSourceRecord['priority']` 推导
- `apps/backend/agent-server/src/runtime/skills/remote-skill-discovery.service.ts`、`apps/backend/agent-server/src/runtime/skills/local-skill-search.ts`、`apps/backend/agent-server/src/runtime/centers/runtime-runtime-center.ts`、`apps/backend/agent-server/src/runtime/centers/runtime-connectors-center.ts`、`packages/runtime/src/governance/worker-registry.ts`、`packages/runtime/src/governance/profile-policy.ts`
  - 已去掉对 shared `RuntimeProfile` alias 的借道，统一改为直接消费 `@agent/config` 的 runtime profile primitive
- `agents/coder/src/capabilities/execution-mode-guard.ts`、`agents/supervisor/src/workflows/research-source-planner.ts`、`packages/runtime/src/runtime/agent-runtime-context.ts`
  - `ExecutionMode` 已补入 `@agent/core` 根出口并改为默认从 core 消费
  - shared 侧继续只保留 `normalizeExecutionMode` 一类兼容 helper，不再承担该稳定类型的主宿主
- `packages/memory/src/repositories/runtime-state-repository.ts`、`apps/backend/agent-server/src/platform/platform.controller.ts`、`apps/backend/agent-server/src/runtime/centers/runtime-centers-governance-counselors.ts`
  - `CounselorSelectorConfig` 已补入 `@agent/core` 并改为默认从 core 消费
  - `packages/shared/src/types/tasking-planning.ts` 仅保留 compat re-export，不再承载主定义
- `packages/runtime/src/runtime/agent-runtime-context.ts`、`packages/runtime/src/governance/worker-registry.ts`、`packages/runtime/src/governance/profile-policy.ts`、`packages/runtime/src/graphs/main/main.graph.ts`、`packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle-queries.ts`、`packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle-governance.ts`
  - `WorkerDefinition` 已补入 `@agent/core` 并改为默认从 core 消费
  - `packages/shared/src/types/skills-capabilities.ts` 仅保留 compat re-export，不再承载主定义
- `packages/shared/src/types/runtime-centers.ts`
  - facade 内部依赖的 `ApprovalPolicyRecord`、`ApprovalScopePolicyRecord`、`ConnectorHealthRecord`、`ExecutionTrace`、`EvidenceRecord`、`CapabilityGovernanceProfileRecord`、`GovernanceProfileRecord`、`RuntimeProfile` 已继续切回 `@agent/core` / `@agent/config`
  - 当前旧 shared 宿主已删除，runtime center 消费组合层已完全回到 backend / admin 本地宿主
- `packages/shared/src/types/skills.ts`
  - `CompanyAgentRecord`、`InstalledSkillRecord`、`SkillInstallReceipt`、`SkillManifestRecord`、`SkillSourceRecord` 已继续改为直接复用 `@agent/core`
  - `packages/shared/src/types/skills-sources.ts` 已删除，shared 公共 surface 不再承接 `SkillSourcesCenterRecord`
- `packages/shared/src/types/platform-console.ts` / `packages/shared/src/types/tasking-task-record.ts`
  - `CompanyAgentRecord` 默认泛型入口与 `ProfilePolicyHintRecord` 已继续切回 `@agent/core`
  - `platform-console` wrapper 已不再默认绑定 `SkillSourcesCenterRecord`
  - `platform-console` wrapper 也已不再默认绑定 shared `RuntimeCenterRecord`
  - shared 当前更明确地只保留 runtime overlay 连接与 compat 默认泛型包装，而不是 skill source facade 本体、runtime center facade 本体或稳定 skill 记录主定义
- `packages/shared/src/types/runtime-centers.ts`
  - 旧 facade 宿主本轮已删除，相关 runtime center 组合面当前只保留在 backend / admin 本地类型层
- `packages/shared/src/types/runtime-centers-briefing.ts` / `packages/shared/src/types/runtime-centers-tools.ts`
  - `RuntimeCenterDailyTechBriefingRunStatRecord`、`RuntimeCenterDailyTechBriefingScheduleStateRecord`、`RuntimeCenterDailyTechBriefingAuditRecord`、`RuntimeCenterDailyTechBriefingCategoryRecord` 已内联回 `RuntimeCenterDailyTechBriefingRecord`
  - `RuntimeCenterToolFamilyRecord`、`RuntimeCenterToolRecord`、`RuntimeCenterToolUsageRecord` 已内联回 `RuntimeCenterToolsRecord`
  - shared 当前继续保留的是 briefing/tools 主记录 facade，而不是这批仅供主记录拼装使用的细粒度辅助类型
- `packages/shared/src/types/runtime-centers-analytics.ts` / `packages/shared/src/types/runtime-centers-execution.ts`
  - 两个子域宿主文件已删除；其历史内容在本轮终态里不再由 shared 继续承接
- `packages/shared/src/types/runtime-centers-briefing.ts` / `packages/shared/src/types/runtime-centers-tools.ts`
  - 两个子域宿主文件也已删除；对应组合面当前只保留在 backend / admin 本地宿主

### 0.6 需要先有新宿主，之后才能迁出的内容

这类内容不是 core stable contract，也不是 runtime overlay；要删 `shared`，必须先确定新宿主：

- `runtime-centers*`
- admin/runtime 组合投影视图
- workflow / prompt / bootstrap compat 子路径

补充：

- `platform-console` 不再单列为 active facade 迁移项；shared 侧当前更适合作为 compat-only 默认泛型包装处理

允许的新宿主方向只有三类：

1. backend/admin 本地 facade 层
2. 新的 consumption contract 包
3. 各真实宿主本地类型层

在新宿主未落地前，不允许宣称 `shared` 可删除。

## 1. 为什么现在不能直接删

`packages/shared` 当前不是单一职责包，而是三种职责的混合体：

1. `core` 主 contract 的 compat / widening facade
2. 前端和控制台消费友好的组合类型层
3. 一部分本应属于 `runtime / agents / tools / frontend` 的 helper、workflow contract、prompt helper

这意味着“删除 shared”不是简单的 `shared -> core` 迁移，而是三类动作同时发生：

- 一部分迁入 `core`
- 一部分迁回真实业务宿主
- 一部分保留为更薄的新 facade，或者下沉到消费侧局部类型层

## 2. 当前风险分布

本轮对全仓 `@agent/shared` 消费点做了快速统计，结果如下：

```text
105 packages/runtime
 81 apps/backend
 35 agents/supervisor
 35 packages/tools
 17 packages/memory
 15 agents/coder
 10 apps/frontend
  5 packages/shared
  4 packages/evals
  4 packages/skill
  3 agents/reviewer
  2 packages/adapters
  1 packages/core
  1 agents/data-report
```

这组分布说明：

- `shared` 当前深度参与主链 runtime、backend API、supervisor workflow、tools 执行治理
- 它不是“只有前端在用的展示包”
- 删除动作的主风险不在前端，而在 `runtime + backend + supervisor + tools`

## 3. 现在 shared 里到底有什么

结合当前源码，`packages/shared` 至少包含四类内容。

### 3.1 已适合继续并入 core 的内容

这些内容满足“稳定、跨包、非纯展示层”的判断，应继续以 `core` 为唯一主宿主：

- `tasking-*`
- `governance`
- `connectors`
- `execution-trace`
- `knowledge-*` 中稳定主 contract
- `channels`
- `delivery`
- `platform-console` 的稳定主 contract
- `skills-search`
- `workflow-route` 结果 contract 相关稳定结构

当前补充：

- `knowledge-store` 这条已经完成迁移，不再属于“仍留在 shared 的稳定主 contract”
- `learning-conflict` 这条已经完成迁移，不再属于“仍留在 shared 的稳定主 contract”
- `agent-token-event` 这条已经完成迁移，不再属于“仍留在 shared 的稳定主 contract”
- `plan-mode` 这条已经完成迁移，不再属于“仍留在 shared 的稳定主 contract”
- `source-policy-mode / worker-domain / specialist-domain / execution-step-*` 这条已经完成迁移，不再属于“仍留在 shared 的稳定主 contract”

这部分是最典型的“shared 不该继续持有主定义”的区域。

### 3.2 应保留为消费组合层的内容

这些内容不适合机械并入 `core`，因为它们更像 UI / console / consumption facade：

- `runtime-centers*`
- `skills-capabilities` 中前端和治理友好的组合字段
- `platform-console` 默认泛型包装
- `tasking-chat.ts`、`tasking-task-record.ts` 中仍有真实 widening 的 overlay

这部分如果未来要删 `shared`，需要先给它们找新宿主：

- 要么进入更明确的 frontend/admin contract 包
- 要么进入 `shared-consumption` 一类更窄的新包
- 要么直接下沉到消费侧局部类型层

### 3.3 明显应迁回真实宿主的内容

这些内容不是稳定 contract，而是带明显执行语义或业务归属的 helper / workflow / prompt：

- `workflows/workflow-route-resolver.ts`
- `workflows/workflow-route-readiness.ts`
- `workflows/workflow-route-signals.ts`
- `workflows/research-source-planner.ts`
- `workflows/execution-steps.ts`
- `workflows/specialist-routing.ts`
- `workflows/workflow-preset-*`
- `prompts/temporal-context.ts`
- `bootstrap/bootstrap-skill-registry.ts`
- `contracts/*-ministry.ts`
- `contracts/approved-execution-agent.ts`
- `workflows/data-report-contract.ts`

这些内容更合理的宿主通常是：

- `agents/supervisor`
- `packages/runtime`
- `agents/data-report`
- `packages/skill`

它们继续留在 `shared`，会让 `shared` 永远删不掉。

### 3.4 已经接近“可删薄”的 compat 层

这部分文件如果继续减薄，未来很可能能直接退化为 alias 或删除：

- `types/tasking-planning.ts`
- `types/tasking-orchestration.ts`
- `types/execution-trace.ts`
- `types/connectors.ts`
- `types/channels.ts`
- `types/skills-search.ts`

这批文件是最适合优先清理的，因为收益高、风险相对可控。

## 4. 删除 shared 的真正前置条件

只有当下面四个条件同时基本满足，才建议讨论“直接删除包”：

1. `core` 已经承接所有稳定主 contract，`shared` 不再保留第二主宿主。
2. `shared` 里的 workflow helper / prompt helper / ministry contract 都迁回真实宿主。
3. `runtime-centers*`、`skills-*` 等剩余消费组合层已经有明确新宿主，或 shared 宿主已清空。
4. 全仓不再存在“必须依赖 `@agent/shared` 才能拿到额外语义”的核心调用点。

当前四条里，第一条已经接近完成，后三条还没有。

## 4.1 当前剩余消费点五分类台账

下面的台账不是“理论分类”，而是当前仓库中剩余 `@agent/shared` 消费点的真实建议归类。

### A. overlay

这些类型仍承载运行态 widening 或跨阶段拼装语义，当前不建议直接迁出 `shared`：

- `TaskRecord`
- `ChatCheckpointRecord`
- `ChatSessionRecord` compat 首入口
- `ChatMessageRecord` compat 首入口
- `ChatEventRecord` compat 首入口
- `ExecutionStepRecord`

说明：

- `TaskRecord`、`ChatCheckpointRecord` 当前已降成 core-hosted compat alias，shared 只保留命名 overlay field slice
- `ChatSessionRecord`、`ChatMessageRecord`、`ChatEventRecord` 的主 contract 已在 `core`，shared 只剩 compat 首入口，不再视为第二主定义 blocker
- `ReviewRecord` 的主 contract 已在 `core`，不再单列为 shared blocker
- `LearningJob` / `LearningQueueItem` 已从 shared 公开面移除，不再列为 shared overlay blocker

主要宿主：

- `packages/runtime/src/session/*`
- `packages/runtime/src/graphs/main/*`
- `packages/runtime/src/flows/*`
- `apps/backend/agent-server/src/runtime/*`

### B. consumption facade

这些类型更像 admin/runtime/platform/skill source 的消费层门面，当前不建议直接并入 `core`：

- `runtime-centers*`
- frontend admin 的 runtime/tasking facade

补充：

- `platform-console` 的 stable base contract 已迁入 `core`
- shared 中 `types/platform-console.ts` 当前主要承担 compat 默认泛型包装

主要宿主：

- `apps/frontend/agent-admin/src/types/admin/*`
- `apps/backend/agent-server/src/runtime/centers/*`
- `apps/backend/agent-server/src/runtime/skills/*`
- `packages/runtime/src/governance/*`

### C. stable contract still misplaced

这类结构已经满足 schema-first / 稳定公共 contract 条件，应继续迁向 `@agent/core`：

- 本轮已完成
  - `UserProfileRecord`
  - `ResolutionCandidateRecord`
  - `MemoryEventRecord`
  - `MemoryEvidenceLinkRecord`
  - `SkillManifestRecord`
  - `SkillSourceRecord`
  - `InstalledSkillRecord`
  - `SkillInstallReceipt`
  - `CompanyAgentRecord`
  - `WorkflowVersionRecord`
  - `WorkflowPresetDefinition`
    说明：

- `WorkflowPresetDefinition` 的主 contract 已迁入 `core`，shared 当前只保留 compat alias
- `SkillManifestRecord` / `SkillSourceRecord` / `InstalledSkillRecord` / `SkillInstallReceipt` / `CompanyAgentRecord` 的主 contract 已迁入 `core`
- backend 已新增本地 `SkillSourcesCenterRecord` facade 类型宿主；admin 侧也已有对应本地 facade 类型宿主
- backend 已新增基于本地 builder 的 `RuntimeCenterRecord` facade 类型宿主；`runtime-runtime-center.ts` 不再直接从 shared 导入该记录名
- backend 已新增本地 `runtime-architecture-helpers.ts`；center/platform/query 主链实现文件已不再直接从 shared 导入 `getMinistryDisplayName` / `normalizeExecutionMode` / `normalizeMinistryId`
- backend 已继续将 `runtime-architecture-helpers.ts` 宿主化为本地实现；`apps/backend/agent-server/src/runtime/*` 当前已不再有任何文件直接从 `@agent/shared` 导入 helper reclaim
- runtime session 已新增本地 `session-architecture-helpers.ts`；`session-node-events.ts`、`session-coordinator-thinking.ts`、`session-coordinator-thinking-helpers.ts` 不再直接从 shared 导入 helper reclaim
- runtime task 已新增本地 `task-architecture-helpers.ts`；`task-workflow-resolution.ts` 不再直接从 shared 导入 data-report compat helper
- supervisor workflow 已新增本地 `workflow-architecture-helpers.ts`；`specialist-routing.ts` 不再直接从 shared 导入 specialist helper reclaim
- supervisor workflow 已继续把 `AgentRole` / `normalizeExecutionMode` 收进 `workflow-architecture-helpers.ts`；`workflow-preset-plan.ts` 与 `research-source-planner.ts` 不再直接从 shared 导入这些 compat/helper 入口
- supervisor workflow 已继续把 specialist compat 类型收进 `workflow-architecture-helpers.ts`；`specialist-routing.ts` 不再直接从 shared 导入 `ContextSliceRecord` / `SpecialistLeadRecord` / `SpecialistSupportRecord`
- `agents/supervisor/src/workflows/execution-steps.ts` 已改为宿主本地窄 task 接口，不再直接从 shared 导入 `TaskRecord`
- `agents/supervisor/src/flows/supervisor/dispatch-stage-helpers.ts` 已去掉未使用的 `TaskRecord` 依赖；`buildContextFilterAudienceSlices` 不再顺手携带 shared task 参数
- `agents/supervisor/src/flows/supervisor/planning-stage-skill-contract.ts` 已改为宿主本地窄 task 接口，不再直接从 shared 导入 `TaskRecord`
- supervisor planning/dispatch 已新增本地 `supervisor-architecture-helpers.ts`；多处 flow 文件不再直接从 shared 导入 `AgentRole`
- supervisor planning/dispatch 已继续把 planning / dispatch 节点统一收口到宿主本地 `SupervisorPlanningTaskLike`；`planning-stage-*`、`dispatch-stage-nodes.ts`、`pipeline-stage-node.types.ts` 与 `context-compression-pipeline.ts` 不再直接从 shared 导入 `TaskRecord`
- runtime task 已继续把 `AgentRole` / `SubgraphId` 收进 `task-architecture-helpers.ts`；`main-graph-task-runtime*.ts`、`main-graph-task-factory.ts`、`task-factory.types.ts`、`main-graph-task-context.ts` 不再直接从 shared 导入这些 compat-only 入口
- runtime task 已继续把 `ExecutionPlanRecord` 收进 `task-architecture-helpers.ts`；`task-execution-plan.ts` 不再直接从 shared 导入这类 compat-only 计划记录入口
- backend runtime helper 已继续改为宿主本地窄接口；`runtime-connector-utils.ts` 与 `runtime-agent-errors.ts` 不再直接从 shared 导入 `TaskRecord`
- backend runtime center 已继续改为宿主本地窄接口；`runtime-connectors-center.ts` 不再直接从 shared 导入 `TaskRecord`
- backend runtime learning/evidence 聚合也已改为宿主本地窄接口；`runtime-learning-evidence-center.types.ts`、`runtime-learning-evidence-center.learning-helpers.ts` 与 `runtime-derived-records.ts` 不再直接从 shared 导入 `TaskRecord`
- backend runtime center / metrics / governance 聚合也已改为宿主本地窄接口；`runtime-runtime-center.ts`、`runtime-analytics.ts`、`runtime-metrics-store.ts` 与 `runtime-governance-store.ts` 不再直接从 shared 导入 `TaskRecord`
- 最新 backend runtime 扫描中，shared 直连已主要收敛为：
  - backend 本地 compat / host 入口（`runtime-centers.records.ts`）
  - 当前 backend runtime 业务文件与 helper reclaim 宿主文件里的 shared 直连已清到 `0`
- `agent-admin` 已显式接入 `@agent/core`，`PlatformApprovalRecord` 不再通过 shared compat 入口进入前端控制台类型层
- `TaskRecord` / `ChatCheckpointRecord` 的剩余工作已不再属于 stable contract 未迁完，而是 overlay 终态治理

### D. host-local helper/facade

这类内容仍从 `shared` 导入，但本质上更接近宿主本地运行辅助或门面，后续应继续判断是否下沉到真实宿主：

- `getMinistryDisplayName`
- `normalizeMinistryId`
- `normalizeExecutionMode`
- `getSpecialistDisplayName`
- `normalizeSpecialistDomain`
- `RUNTIME_CENTER_PAGE_TITLES`

说明：

- `WorkerDefinition`
  - 已迁入 `@agent/core`，不再应写成 shared consumption facade blocker
- `CounselorSelectorConfig`
  - 已迁入 `@agent/core`，不再应写成 shared consumption facade blocker
- `RuntimeProfile`
  - 当前主链稳定消费已统一切到 `@agent/config`
  - 不再应写成 shared blocker；shared 里真正还保留的是 facade 记录与 compat 出口
- `specialist-routing` 中的 `SpecialistLeadRecord` / `SpecialistSupportRecord` / `ContextSliceRecord`
  - 当前保留 shared compat 入口
  - 原因不是遗漏迁移，而是 shared 侧仍承接兼容别名与较宽的 specialist domain 读语义；强行切到 core 会触发 stricter typing 回归
- `execution-steps` 的 route/stage/status/owner 一类别名
  - 已迁入 `@agent/core`
  - 当前不再应作为 shared compat 主因；剩余 shared 依赖仅在 `TaskRecord` 一侧
- `task-execution-plan` / `ExecutionPlanRecord`
  - 当前 runtime 构建链仍保留 shared compat 入口
  - 原因不是 stable contract 宿主错误，而是 core 侧对 `strategyCounselors` 的 `SpecialistDomain[]` 约束更严格；直接切换会触发现有 runtime 计划构建回归

- 这类内容不该阻塞删包判断，但要避免继续增长
- 如果后续发现只服务单一宿主，应继续迁回宿主或拆到更窄 facade 包

### E. compat-only

这类文件已经不应再作为 shared 的删包 blocker，只要保持子路径 compat 即可：

- `workflows/workflow-route-*`
- `workflows/workflow-preset-*`
- `workflows/specialist-routing.ts`
- `workflows/research-source-planner.ts`
- `workflows/execution-steps.ts`
- `prompts/temporal-context.ts`
- `bootstrap/bootstrap-skill-registry.ts`
- `data-report-contract`（当前仍允许作为 compat 过渡项）

### 当前判断

- 真正阻塞删包的主力不是 compat helper
- 真正阻塞删包的是 `overlay + consumption facade + 尚未拆分完成的 skill/workflow widening`

## 5. 现在距离删除 shared 还差什么

下面这份清单按“删包前必须再完成什么”来写，而不是按历史迁移主题来写。

### 5.1 必须先清零的 blocker

#### 1. runtime overlay blocker

下面这些内容里，真正还值得继续压缩的是 shared 自己保留的 compat / widening 出口，而不是业务主链依赖：

- `ApprovalInterruptRecord`

说明：

- `TaskRecord` / `ChatCheckpointRecord` 当前已经不是 runtime overlay blocker；shared 只保留 compat alias 与命名字段切片
- `CurrentSkillExecutionRecord`、`ApprovalResumeInput`、`SpecialistFindingRecord` 当前也已回收到 `@agent/core` 主宿主；shared 只保留 compat barrel，不再算独立 blocker
- `LearningJob` / `LearningQueueItem` 的 runtime 主链消费已经收回 `packages/runtime/src/runtime/runtime-learning.types.ts`，memory 侧也已使用本地 snapshot 记录；shared 当前已不再公开这两类记录
- `ApprovalInterruptRecord` 当前也已不再被 shared 内部其它类型复用；它更接近历史 compat 出口，而不是主链 blocker
- 只有当这些 runtime widening / runtime-only host 进一步瘦成 compat，或者迁到明确新宿主后，才有资格继续讨论删包

#### 2. consumption facade blocker

下面这些内容不是 core 稳定主 contract，而是消费层门面；它们没有新宿主之前，也不能删包：

- admin/runtime 的组合投影视图

说明：

- 这一类内容现在已经越来越像 shared 的真实终态
- `platform-console` 的 stable base contract 已经在 `core`，shared 侧当前只剩 compat 默认泛型包装
- `RuntimeProfile` 已作为稳定 profile primitive 收口到 `@agent/config`，不再计入 shared facade blocker
- 如果未来仍想删包，必须先把它们迁到新的 facade 包、消费侧本地类型层，或更明确的 admin/runtime contract 宿主

#### 3. host-local helper / compat blocker

这类内容不是删包的第一主 blocker，但在 shared 仍有大面积消费时，会阻止 shared 退化成可删除空壳：

- `getMinistryDisplayName`
- `normalizeMinistryId`
- `normalizeExecutionMode`
- `getSpecialistDisplayName`
- `normalizeSpecialistDomain`
- workflow / prompt / bootstrap 的 compat 入口

说明：

- 这类内容不一定要迁进 core
- 但需要继续判断是否迁回真实宿主，或保留为更窄的 compat/helper 包

### 5.2 当前仍然卡住删包的主链宿主

按当前代码搜索，删包前真正还需要继续收口的主链宿主主要是：

- `packages/runtime/src/session/*`
- `packages/runtime/src/graphs/main/*`
- `packages/runtime/src/flows/*`
- `packages/runtime/src/governance/*`
- `apps/backend/agent-server/src/runtime/*`
- `agents/supervisor/src/flows/*`
- `agents/supervisor/src/workflows/*`
- `packages/memory/src/repositories/runtime-state-repository.ts`

这些宿主里剩余的 `@agent/shared` 消费，当前已经主要集中在：

- overlay record
- consumption facade
- helper reclaim
- compat-only 子路径

而不再主要是 stable contract 主定义误放 shared。

### 5.2.1 当前宿主分组台账

下面这份分组是基于当前主链剩余 `@agent/shared` 导入的真实宿主整理出来的，可直接作为后续执行顺序参考。

#### A. runtime overlay 主宿主

这些文件当前继续依赖 shared 是合理的，主要因为它们真实读写 runtime overlay：

- `packages/runtime/src/session/*`
- `packages/runtime/src/graphs/main/task/*`
- `packages/runtime/src/graphs/main/lifecycle/*`
- `packages/runtime/src/graphs/main/background/*`
- `packages/runtime/src/flows/ministries/*`
- `packages/runtime/src/flows/approval/*`
- `packages/runtime/src/flows/learning/*`
- `packages/runtime/src/graphs/main/orchestration/*`
- `packages/runtime/src/graphs/main/pipeline/*`
- `apps/backend/agent-server/src/runtime/helpers/runtime-agent-errors.ts`
- `apps/backend/agent-server/src/runtime/helpers/runtime-governance-aggregation.ts`
- `apps/backend/agent-server/src/runtime/helpers/runtime-connector-utils.ts`
- `apps/backend/agent-server/src/runtime/centers/runtime-learning-evidence-center.*`
- `packages/memory/src/repositories/runtime-state-repository.ts`

这些文件的 shared 依赖主因通常是：

- `TaskRecord`
- `CurrentSkillExecutionRecord`
- `ApprovalInterruptRecord`
- `PendingApprovalRecord`
- `SpecialistFindingRecord`

#### B. consumption facade 主宿主

这些文件当前更像 shared facade 的真实消费侧，而不是 stable contract 漏迁：

- `apps/backend/agent-server/src/runtime/centers/*`
- `apps/backend/agent-server/src/runtime/helpers/runtime-platform-console.ts`
- `apps/backend/agent-server/src/runtime/skills/runtime-skill-sources.service.ts`
- `apps/backend/agent-server/src/runtime/skills/skill-source-sync.service.ts`
- `apps/backend/agent-server/src/runtime/skills/local-skill-search.ts`
- `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`
- `apps/backend/agent-server/src/runtime/knowledge/runtime-knowledge-store*.ts`
- `packages/runtime/src/governance/worker-registry.ts`
- `packages/runtime/src/governance/profile-policy.ts`
- `packages/runtime/src/governance/model-routing-policy.ts`

这些文件的 shared 依赖主因通常是：

- `RuntimeCenterRecord`

#### C. helper reclaim / compat 主宿主

这些文件剩余的 shared 依赖，主要不是 record overlay，而是 helper reclaim 或 compat-only 入口：

- `packages/runtime/src/session/session-node-events.ts`
- `packages/runtime/src/session/session-coordinator-thinking*.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-execution-helpers.ts`
- `packages/runtime/src/graphs/main/task/task-workflow-resolution.ts`
- `apps/backend/agent-server/src/runtime/helpers/runtime-worker-utils.ts`
- `apps/backend/agent-server/src/runtime/centers/runtime-centers-query.helpers.ts`
- `agents/supervisor/src/workflows/specialist-routing.ts`
- `agents/supervisor/src/workflows/research-source-planner.ts`
- `agents/supervisor/src/workflows/execution-steps.ts`
- `agents/supervisor/src/bootstrap/bootstrap-skill-registry.ts`

这类 shared 依赖主因通常是：

- `getMinistryDisplayName`
- `normalizeExecutionMode`
- `normalizeMinistryId`
- `getSpecialistDisplayName`
- `normalizeSpecialistDomain`
- `appendDataReportContext`
- `buildDataReportContract`
- `BootstrapSkillRecord`
- `PluginDraft`

#### D. supervisor mixed-import 主宿主

这些文件是后续最适合继续清 mixed import 的一批，因为它们经常同时依赖 overlay 和已在 core 的稳定 contract：

- `agents/supervisor/src/flows/supervisor/*`
- `agents/supervisor/src/workflows/planning-question-policy.ts`
- `agents/supervisor/src/workflows/workflow-preset-plan.ts`
- `agents/supervisor/src/flows/route/main-route-node.ts`
- `agents/supervisor/src/flows/ministries/*`

它们的下一轮执行规则应继续保持：

- stable contract -> `@agent/core`
- overlay / helper reclaim -> `@agent/shared`

### 5.3 删包前的最终机械判定条件

只有当下面四条同时满足，才建议进入“真的删除 `packages/shared`”阶段：

1. `shared` 不再承载任何 runtime aggregate record 主定义或必要 overlay。
2. `runtime / backend / supervisor / memory` 主链不再默认从 `@agent/shared` 导入关键运行态类型。
3. `shared` 剩余内容全部能归类为极薄的 `compat`，或已经迁到新宿主。
4. 根级搜索中不再出现“核心主链必须依赖 `@agent/shared` 才能工作”的调用点。

### 5.4 当前最准确的结论

如果现在问“还差什么才能删 shared”，答案不是：

- stable contract 还没大量迁完

而是：

- 还差 `runtime overlay`
- 还差 `consumption facade`
- 还差少量 `helper reclaim / compat`
- 还差主链对 shared 的最后一批必要依赖点继续清零

换句话说，shared 当前已经逐步从“稳定 contract 主宿主”退化成“overlay / facade / compat”的残余包，但还没有退化到可删除程度。

## 4.2 当前删包 blocker 白名单

在下面 blocker 未清空前，不建议删除 `packages/shared`：

1. runtime overlay blocker
2. consumption facade blocker
3. 历史 compat 出口仍需保留，但 compat 本身不再单独作为删包 blocker

### runtime overlay blocker

- `TaskRecord`
  - 已开始收敛到 `core base + shared overlay`
  - shared 当前只应保留真正 widened 的运行态字段，例如 `activeInterrupt / interruptHistory / agentStates / messages / review / currentSkillExecution / learning queue` 以及少量 specialist / capability widening
- `ChatCheckpointRecord`
  - 已开始收敛到 `core base + shared overlay`
  - shared 当前只应保留 approval-interrupt、checkpoint 恢复、learning / skill-search 与少量 specialist widening
- `ChatSessionRecord` / `ChatMessageRecord` / `ChatEventRecord`
  - 主 contract 已在 `@agent/core`
  - shared 现阶段只作为 compat 首入口，不再应承担第二主定义
- `ReviewRecord`
  - 主 contract 已在 `@agent/core`
  - 不再单独构成 stable contract blocker
- `LearningJob` / `LearningQueueItem`
  - 已退出 shared 公开面
  - runtime / memory 当前分别使用宿主本地 learning record，不再作为 shared blocker 处理

### consumption facade blocker

- `runtime-centers*`
- admin/runtime 侧仍依赖的 shared-friendly 聚合门面

### 已不再构成 blocker 的 stable contract

- `tasking-planning`
- `tasking-orchestration`
- `tasking-session`
- `tasking-chat`
- `tasking-checkpoint`
- `tasking-task-record` 的 stable base 部分
- `governance` 主 contract
- `connectors`
- `execution-trace`
- `channels`
- `delivery`
- `workflow-route`
- `platform-console` 的 stable base contract

删包前固定判定条件：

1. shared 不再承载任何 runtime 总记录主定义
2. runtime / backend / supervisor 不再把运行态总记录默认从 `@agent/shared` 整包导入
3. shared 剩余内容都能明确归类为 `overlay / consumption facade / compat`
4. 根级搜索里不再出现“只因图省事而把稳定字段继续从 `@agent/shared` 导入”的主链调用点

## 5. 建议的三阶段退场方案

### 阶段一：冻结 shared 的新增职责

从现在开始执行：

- 禁止再往 `packages/shared` 新增稳定主 contract
- 禁止再往 `packages/shared` 新增 workflow helper、prompt helper、runtime helper
- 新增稳定协议默认进 `core`
- 新增流程 helper 默认回到 `runtime / agents/* / tools / frontend`

这一步今天就可以执行，而且应该立即执行。

当前已开始落地的动作：

- `agents/supervisor/src/workflows/*`
  - `workflow-route-signals`
  - `workflow-route-readiness`
  - `workflow-route-resolver`
  - `research-source-planner`
  - `execution-steps`
  - `specialist-routing`
  - `workflow-preset-definitions`
  - `workflow-preset-plan`
  - `workflow-preset-resolver`
  - 已改成 supervisor 宿主下的真实实现，不再只是从 `@agent/shared` 转发
- `packages/runtime/src/utils/prompts/temporal-context.ts`
  - 已改成 runtime 宿主下的真实实现
- `agents/supervisor/src/utils/prompts/temporal-context.ts`
  - 已回退为指向 runtime 宿主的薄转发，避免 temporal prompt helper 再形成第二实现宿主
- `agents/supervisor/src/bootstrap/bootstrap-skill-registry.ts`
  - 已收回 supervisor 作为 bootstrap registry 唯一主宿主
- `packages/shared/src/workflows/*`
  - `workflow-route-*`
  - `workflow-preset-*`
  - `specialist-routing`
  - `research-source-planner`
  - `execution-steps`
  - 已压成指向 `@agent/agents-supervisor` 的 compat re-export
- `packages/shared/src/prompts/temporal-context.ts`
  - 已压成 compat re-export，不再承载 prompt helper 主实现
- `packages/shared/src/bootstrap/bootstrap-skill-registry.ts`
  - 已压成指向 supervisor bootstrap registry 的 compat re-export
- `packages/runtime/src`
  - 以下 runtime 主链 helper 已改为优先从 `@agent/agents-supervisor` 消费，而不是从 `@agent/shared` 直接获取实现：
  - `resolveWorkflowPreset`
  - `resolveWorkflowRoute`
  - `resolveSpecialistRoute`
  - `buildResearchSourcePlan`
  - `mergeEvidence`
  - `initializeTaskExecutionSteps`
  - `markExecutionStepBlocked`
  - `markExecutionStepResumed`
  - `listBootstrapSkills`
- `packages/core/src/contracts/*`
  - `RouterMinistryLike`
  - `ResearchMinistryLike`
  - `ApprovedExecutionAgentLike`
  - `ReviewMinistryLike`
  - `DeliveryMinistryLike`
  - `CodeExecutionMinistryLike`
  - `OpsExecutionMinistryLike`
  - 已迁入 `@agent/core` 作为稳定技术契约主宿主
- `packages/core/src/spec/knowledge-runtime.ts`
  - `EvaluationResultSchema`
  - 已迁入 `@agent/core` 作为 review / delivery 相关稳定评估契约主宿主
- `packages/core/src/spec/governance.ts`
  - `ToolDefinitionSchema`
  - `ToolFamilyRecordSchema`
  - `ToolExecutionRequestSchema`
  - `PermissionCheckResultSchema`
  - `StaticPolicyRuleSchema`
  - 已迁入 `@agent/core` 作为 execution contract 所需的最小治理主契约
- `packages/shared/src/contracts/*`
  - `RouterMinistryLike`
  - `ResearchMinistryLike`
  - `ApprovedExecutionAgentLike`
  - `ReviewMinistryLike`
  - `DeliveryMinistryLike`
  - `CodeExecutionMinistryLike`
  - `OpsExecutionMinistryLike`
  - 已回退为 compat re-export，不再作为主定义宿主
- `packages/shared/src/types/knowledge-learning.ts`
  - `EvaluationResult`
  - 已回退为指向 `@agent/core` 的 compat type export
- `packages/shared/src/types/governance.ts`
  - `ToolDefinition`
  - `ToolFamilyRecord`
  - `ToolExecutionRequest`
  - `PermissionCheckResult`
  - `StaticPolicyRule`
  - 已回退为指向 `@agent/core` 的 compat type export
- `packages/tools`、`agents/coder`、`apps/backend/agent-server`、`packages/runtime`
  - 对已迁入 `@agent/core` 的 execution / governance 主 contract
  - 例如 `ToolDefinition`、`ToolFamilyRecord`、`ToolExecutionRequest`、`PermissionCheckResult`、`StaticPolicyRule` 以及 code / ops ministry contract
  - 已开始优先从 `@agent/core` 直接消费，`@agent/shared` 仅保留兼容出口
  - 这一步说明 shared 的“兼容层”角色正在变成真实默认路径，而不是继续充当第一主入口
- `packages/tools`、`agents/coder`、`agents/reviewer`、`apps/backend/agent-server`、`apps/frontend/agent-chat`
  - 对已在 `@agent/core` 提供 schema-first 主定义、且无需 shared widening 的 primitive / DTO / evaluator contract
  - 例如 `ActionIntent`、`RiskLevel`、`EvaluationResult`、`ToolExecutionResult`、`PatchUserProfileDto`、`ApprovalActionDto`、`CreateTaskDto`、`CreateAgentDiagnosisTaskDto`、`CreateDocumentLearningJobDto`、`CreateResearchLearningJobDto`、`ConfigureConnectorDto`、`InvalidateKnowledgeDto`、`RetireKnowledgeDto`、`SupersedeKnowledgeDto`
  - 已继续开始把消费侧首入口从 `@agent/shared` 切到 `@agent/core`
  - 这说明后续可以优先按“稳定 contract 先直连 core，shared 只留 overlay / compat / facade”的规则继续批量收敛
- `packages/runtime`、`agents/supervisor`
  - 已验证可以采用“`TaskRecord` 等 runtime overlay 继续留在 `@agent/shared`，`ActionIntent`、`ApprovalDecision`、`TaskStatus`、`CreateTaskDto`、`EvaluationResult`、`ToolExecutionResult` 等稳定 contract 改为直连 `@agent/core`”的拆分方式
  - 这一步很关键，因为它证明 shared 退场不需要等待 runtime 全量去 overlay 化后才开始，二者可以并行推进
  - 后续 runtime / supervisor 收敛时，应优先继续拆分这类“稳定 contract”和“shared overlay”混导入的文件头
- `packages/runtime`
  - 针对 `ActionIntent`、`ApprovalDecision`、`TaskStatus`、`CreateTaskDto`、`EvaluationResult`、`ToolExecutionResult`、`RiskLevel` 这一批稳定 contract 的首入口清理，当前已在 runtime 范围内完成一轮定向清零
  - 剩余 `@agent/shared` 依赖主要集中在 `TaskRecord` overlay、session/chat record、workflow helper、capability facade 与兼容层，不再和这批已迁入 core 的稳定 contract 混为同一类问题
  - 这说明下一阶段可以把 runtime 中剩余 shared 依赖继续按“overlay / facade / helper / compat”四类拆分，而不用再回头讨论这些稳定 contract 是否该留在 shared
- `apps/backend/agent-server`
  - `skill-source-sync.service.ts` 已去掉对 shared `RuntimeProfile` alias 的借道，改为直接使用配置侧 runtime profile
  - 这说明 backend runtime skills 主链里剩余 shared 依赖已进一步收敛到 facade / helper / compat，而不是稳定类型误宿主
- `packages/memory`、`agents/supervisor`、`apps/backend/agent-server`
  - `MemoryRecord`、`RuleRecord`、`EvidenceRecord`、`ReflectionRecord`、`MemorySearchRequest`、`MemorySearchResult`、`LearningEvaluationRecord`、`SkillCard`、`ConfiguredConnectorRecord`、`ApprovalPolicyRecord`、`ConnectorHealthRecord`
  - 已继续改为优先从 `@agent/core` 直接消费
  - 这说明 memory / evidence / skill / connector 这批稳定公共 contract 已经不应再把 `@agent/shared` 当默认第一入口
- 当前 shared 剩余内容的推荐归类
  - `overlay`
    例如 `TaskRecord` widening、runtime/session/chat 扩展态、仍依赖 shared-facing widening 的 primitives
  - `consumption facade`
    例如 admin/runtime center、platform console、前端友好组合类型
  - `helper reclaim`
    例如应继续迁回 `runtime / agents-supervisor / skill` 宿主的 workflow、prompt、bootstrap helper
  - `compat`
    仅保留 type alias / re-export 的过渡出口，不再承载主定义

当前 helper reclaim 完成表：

- 已完成并回真实宿主
  - `workflow-route-*` -> `agents/supervisor`
  - `workflow-preset-*` -> `agents/supervisor`
  - `specialist-routing` -> `agents/supervisor`
  - `research-source-planner` -> `agents/supervisor`
  - `execution-steps` -> `agents/supervisor`
  - `temporal-context` -> `packages/runtime`
  - `bootstrap-skill-registry` -> `agents/supervisor`
- shared 终态白名单
  - `overlay`
    - `types/tasking-*` 中 `TaskRecord`、chat/session/runtime widening
    - `LearningJob`、`LearningQueueItem`、`ReviewRecord` 等运行态 record
- `consumption facade`
  - `types/runtime-centers*`
  - `types/platform-console.ts`
  - `compat`
    - `prompts/temporal-context.ts`
    - `bootstrap/bootstrap-skill-registry.ts`
    - `workflows/workflow-route-*`
    - `workflows/workflow-preset-*`
    - `workflows/specialist-routing.ts`
    - `workflows/research-source-planner.ts`
    - `workflows/execution-steps.ts`

## 5.3 现在能不能删包

当前答案仍然是：不能。

原因不是 shared 还在承载真实实现，而是：

- 它仍承载 runtime overlay
- 它仍承载 admin/backend 的 runtime console facade
- 还有少量稳定 contract 候选尚未拆分或迁完

更准确的状态是：

- `shared` 的实现宿主角色已经基本结束
- `shared` 的 compat / overlay / facade 包角色还没有结束

只有当 blocker 清单被清空后，才适合进入“真正删包”阶段。

这说明第一阶段已经从“文档约束”进入“代码级落地”，但 `packages/runtime`、`apps/backend` 以及其他宿主对 `@agent/shared` 的大量主 contract 依赖仍在，shared 还不能直接删除。

### 阶段二：把 shared 拆成三类去向

按下面规则逐步迁移：

- `core`
  - 收稳定主 contract、schema、DTO、事件、payload、接口边界
- `runtime / agents/* / tools / skill`
  - 收流程 helper、prompt helper、bootstrap registry、ministry 技术 contract
- `frontend/admin` 或更窄的新消费层
  - 收 runtime center / console center / skill source 等消费组合类型

### 阶段三：再判断 shared 的终态

走到这一步时，`shared` 会只剩两种可能：

1. 只剩非常薄的 compat alias
2. 只剩一层明确的消费 facade

如果是第一种，就可以考虑直接删除。

如果是第二种，也不一定非删不可，但应该：

- 改名成更精确的包
- 严格限定它只承载 consumption facade

## 6. 我对“删不删”的建议

当前最合理的决策不是：

- “保留 shared 继续长”
- 也不是“现在直接删”

而是：

- 把 `shared` 定位成退场中的过渡包
- 继续减薄
- 不再允许新增主职责
- 待 `runtime / backend / supervisor / tools` 的依赖回收后，再做最终删除判断

## 7. 优先级最高的后续动作

如果下一轮继续推进，建议按这个顺序做：

1. 先把 `packages/shared/src/workflows/*` 迁回 `agents/supervisor` 或 `packages/runtime`
2. 再把 `packages/shared/src/prompts/temporal-context.ts` 迁回明确宿主
3. 再把 `packages/shared/src/contracts/*-ministry.ts`、`approved-execution-agent.ts` 迁到 `core/contracts` 或实际 agent 宿主
4. 同步把 `types/*` 中已无真实 widening 的 compat 文件改成 direct alias
5. 最后继续评估 `platform-console` 的 compat 终态，并复核 remaining overlay / interrupt host 是否还能进一步宿主化

## 8. 当前一句话结论

`shared` 现在不是“该不该删”的问题，而是“必须开始退场，但不能粗暴删除”的问题。
