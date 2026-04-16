# Runtime-Agent 循环依赖消费清单

状态：snapshot
文档类型：evaluation
适用范围：`packages/runtime`、`agents/supervisor`、`agents/coder`、`agents/reviewer`、`agents/data-report`
最后核对：2026-04-16

本主题配套文档：

- [Turbo 循环依赖治理六阶段方案](/Users/dev/Desktop/learning-agent-core/docs/evals/turbo-cycle-reduction-stage-six-plan.md)
- [验证体系规范](/Users/dev/Desktop/learning-agent-core/docs/evals/verification-system-guidelines.md)

本文只回答一个问题：

- `packages/runtime` 现在到底从 `agents/*` 消费了什么

这样后续做 contract 拆分时，可以先从高价值、低风险的边开始动，而不是一边找引用一边猜。

## 1. 总结

当前 `packages/runtime` 对 `agents/*` 的消费可以分成四类：

### 1.1 Specialist / Ministry 实现类

来自：

- `@agent/agents-supervisor`
- `@agent/agents-coder`
- `@agent/agents-reviewer`

代表导出：

- `LibuRouterMinistry`
- `HubuSearchMinistry`
- `LibuDocsMinistry`
- `GongbuCodeMinistry`
- `BingbuOpsMinistry`
- `XingbuReviewMinistry`

这类依赖当前直接把 runtime 绑到了具体 specialist 实现宿主上。

### 1.2 Workflow / Routing 决策函数

主要来自：

- `@agent/agents-supervisor`

代表导出：

- `resolveWorkflowPreset`
- `resolveWorkflowRoute`
- `resolveSpecialistRoute`
- `buildResearchSourcePlan`

这类依赖偏“策略/路由 contract”，比 Ministry 实现更适合优先收敛成稳定接口。

### 1.3 Execution Step / Evidence helper

主要来自：

- `@agent/agents-supervisor`

代表导出：

- `initializeTaskExecutionSteps`
- `markExecutionStepStarted`
- `markExecutionStepBlocked`
- `markExecutionStepCompleted`
- `markExecutionStepResumed`
- `mergeEvidence`

这类导出其实更像共享执行协议或 task lifecycle helper，不像 supervisor 专属实现。

### 1.4 Bootstrap / Data-report contract

来自：

- `@agent/agents-supervisor`
- `@agent/agents-data-report`
- `@agent/agents-coder`

代表导出：

- `listBootstrapSkills`
- `appendDataReportContext`
- `buildDataReportContract`
- `ExecutorAgent`

这类里有些是稳定 contract，有些是直接实现依赖，需要继续拆开看。

## 2. Runtime -> Supervisor 消费清单

当前 `packages/runtime` 从 `@agent/agents-supervisor` 消费了以下内容。

### 2.1 Ministry 实现类

- `HubuSearchMinistry`
- `LibuDocsMinistry`
- `LibuRouterMinistry`

主要使用位置：

- `packages/runtime/src/flows/ministries/runtime-stage-research.ts`
- `packages/runtime/src/flows/ministries/review-stage-nodes.ts`
- `packages/runtime/src/flows/ministries/runtime-stage-execution.ts`
- `packages/runtime/src/graphs/main/main.graph.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-pipeline-orchestrator.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-execution-helpers.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-bridge.ts`
- `packages/runtime/src/graphs/main/pipeline/main-graph-pipeline-graph.ts`

判断：

- 这是当前最大的实现级耦合来源
- 不适合先做“局部小搬运”
- 更适合在后续阶段通过 specialist descriptor / facade / registry 去间接化

当前状态更新：

- `RouterMinistryLike` 已在 `@agent/shared` 建立，runtime 中大部分吏部参数位已不再依赖 `LibuRouterMinistry`
- `ResearchMinistryLike` 已在 `@agent/shared` 建立，runtime 的 research stage / pipeline graph 已改为依赖接口而非 `HubuSearchMinistry` 具体类型
- `DeliveryMinistryLike` 已在 `@agent/shared` 建立，runtime 的 research / execute / review 路径已改为依赖接口而非 `LibuDocsMinistry` 具体类型
- 目前允许保留具体类引用的位置已进一步收缩到：
  - runtime orchestration 装配点
  - runtime 本地 compat barrel
  - graph wiring 仍需从 `@agent/agents-supervisor` 导入 stage runner 的少量入口

### 2.2 Workflow / Routing / Planning

- `resolveWorkflowPreset`
- `resolveWorkflowRoute`
- `resolveSpecialistRoute`
- `buildResearchSourcePlan`

主要使用位置：

- `packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle.ts`
- `packages/runtime/src/graphs/main/task/main-graph-task-runtime.ts`
- `packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle-governance.ts`
- `packages/runtime/src/graphs/main/background/main-graph-learning-jobs.ts`
- `packages/runtime/src/graphs/main/task/task-workflow-resolution.ts`
- `packages/runtime/src/flows/ministries/runtime-stage-research.ts`

判断：

- 这是最值得优先抽 contract 的一组
- 它们本质更像“runtime 消费的策略接口”，不一定应该长期待在 supervisor 宿主里

推荐方向：

- 优先评估是否能迁到 `packages/core`
- 或下沉成 runtime-facing workflow contract facade

当前状态更新：

- `resolveWorkflowPreset`
- `buildWorkflowPresetPlan`
- `GENERAL_PRESET`
- `WORKFLOW_PRESETS`

已在本轮下沉到 `@agent/shared`

- `packages/runtime` 中直接消费 workflow preset registry / plan 的位置已改为从 `@agent/shared` 导入
- `agents/supervisor/src/workflows/workflow-preset-*.ts` 当前保留 compat re-export
- `buildResearchSourcePlan` 已在本轮下沉到 `@agent/shared`
- `resolveWorkflowRoute` 与其 `signals/readiness` 纯决策栈已在本轮下沉到 `@agent/shared`
- `resolveSpecialistRoute` 已在本轮下沉到 `@agent/shared`

### 2.3 Execution Step / Evidence helper

- `initializeTaskExecutionSteps`
- `markExecutionStepStarted`
- `markExecutionStepBlocked`
- `markExecutionStepCompleted`
- `markExecutionStepResumed`
- `mergeEvidence`

主要使用位置：

- `packages/runtime/src/flows/ministries/runtime-stage-research.ts`
- `packages/runtime/src/flows/ministries/runtime-stage-execution.ts`
- `packages/runtime/src/flows/ministries/runtime-stage-execution-resume.ts`
- `packages/runtime/src/flows/approval/bootstrap-interrupt-nodes.ts`
- `packages/runtime/src/flows/approval/research-skill-interruption.ts`
- `packages/runtime/src/flows/chat/direct-reply-interrupt-nodes.ts`
- `packages/runtime/src/graphs/main/task/main-graph-task-factory.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-execution-helpers.ts`
- `packages/runtime/src/flows/ministries/runtime-stage-helpers.ts`

判断：

- 这是第二优先级的 contract 候选
- 它们更像 task lifecycle / execution protocol helper，而不是 supervisor 独占实现

推荐方向：

- 评估迁到 `packages/core` 或 `packages/runtime` 内部 shared contract/helper
- 迁移难度通常低于 Ministry 实现类

### 2.4 Bootstrap registry

- `listBootstrapSkills`

主要使用位置：

- `packages/runtime/src/capabilities/capability-pool-bootstrap.ts`

判断：

- 这是一个很小但很关键的装配点依赖
- 很适合作为第一批小切口候选

推荐方向：

- 抽成 bootstrap skill descriptor contract
- 让 runtime 依赖描述，而不是 supervisor 包的导出实现

当前状态更新：

- 已在本轮迁移到 `@agent/shared`
- `packages/runtime/src/capabilities/capability-pool-bootstrap.ts` 已不再从 `@agent/agents-supervisor` 导入该符号
- `agents/supervisor/src/bootstrap/bootstrap-skill-registry.ts` 当前改为 compat re-export

## 3. Runtime -> Coder 消费清单

当前 `packages/runtime` 从 `@agent/agents-coder` 消费：

- `GongbuCodeMinistry`
- `BingbuOpsMinistry`
- `ExecutorAgent`

主要使用位置：

- `packages/runtime/src/flows/ministries/runtime-stage-execution.ts`
- `packages/runtime/src/flows/ministries/runtime-stage-execution-resume.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-pipeline-orchestrator.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-execution-helpers.ts`
- `packages/runtime/src/graphs/main/pipeline/main-graph-pipeline-graph.ts`
- `packages/runtime/src/flows/approval/recovery-node.ts`

判断：

- `GongbuCodeMinistry` / `BingbuOpsMinistry` 属于 specialist 实现类，和 supervisor 里的 Ministry 类问题类似
- `ExecutorAgent` 是更强的实现耦合，后续需要重点评估 recovery 链路为什么必须拿到 coder 实现包

推荐方向：

- 暂不建议优先从 Ministry 实现类下手
- 可以先看 `ExecutorAgent` 是否能被更薄的 executor contract 替换

当前状态更新：

- `CodeExecutionMinistryLike` 已在 `@agent/shared` 建立，runtime 的 execute / approval-resume 路径已不再依赖 `GongbuCodeMinistry` 具体类型
- `OpsExecutionMinistryLike` 已在 `@agent/shared` 建立，runtime 的 execute 路径已不再依赖 `BingbuOpsMinistry` 具体类型
- `ApprovedExecutionAgentLike` 已在 `@agent/shared` 建立，`recovery-node.ts` 已不再直接依赖 `ExecutorAgent`
- 当前 `@agent/agents-coder` 在 runtime 内剩余直接引用已收缩到：
  - runtime 本地 compat barrel
  - orchestration 装配点
- approval recovery 的 `GongbuCodeMinistry` 本地实例装配已在本轮收敛进统一 assembly helper
- 下一阶段建议继续处理：
  - 再决定是否需要把 `ExecutorAgent` 整体做成独立 facade，而不是只治理 recovery-only 消费面

## 4. Runtime -> Reviewer 消费清单

当前 `packages/runtime` 从 `@agent/agents-reviewer` 消费：

- `XingbuReviewMinistry`

主要使用位置：

- `packages/runtime/src/flows/ministries/review-stage-nodes.ts`
- `packages/runtime/src/review-stage.types.ts`
- `packages/runtime/src/graphs/main/main.graph.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-pipeline-orchestrator.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-execution-helpers.ts`
- `packages/runtime/src/graphs/main/orchestration/main-graph-bridge.ts`
- `packages/runtime/src/graphs/main/pipeline/main-graph-pipeline-graph.ts`

判断：

- 当前 reviewer 侧依赖集中度反而更高，几乎都是围绕 Ministry 实现
- 它更像第二批 specialist contract 收敛对象，不是第一刀最佳切口

当前状态更新：

- `ReviewMinistryLike` 已在 `@agent/shared` 建立
- runtime 的 review stage、review callbacks、bridge 与 pipeline graph 参数位已改为依赖接口
- 当前 `@agent/agents-reviewer` 在 runtime 内剩余直接引用已收缩到：
  - runtime 本地 compat barrel
  - orchestration 装配点

## 5. Runtime -> Data-report 消费清单

当前 `packages/runtime` 从 `@agent/agents-data-report` 消费：

- `appendDataReportContext`
- `buildDataReportContract`

主要使用位置：

- `packages/runtime/src/graphs/main/task/task-workflow-resolution.ts`

判断：

- 这是一个相对干净的 contract 形态
- 比 specialist 实现类更接近“可迁移稳定接口”

推荐方向：

- 后续可评估把 data-report contract 下沉到 `packages/core` 或 `packages/shared`
- 这条边可能比 Ministry 实现类更容易收敛

当前状态更新：

- `buildDataReportContract` 与 `appendDataReportContext` 已在本轮下沉到 `@agent/shared`
- `packages/runtime/src/graphs/main/task/task-workflow-resolution.ts` 已不再从 `@agent/agents-data-report` 直接导入
- `agents/data-report/src/flows/data-report/contract.ts` 当前保留 compat re-export
- 当前 runtime 对 `@agent/agents-data-report` 的直接 import 面已清零

## 6. Agents -> Runtime 反向消费清单

反向依赖里，当前更值得关注的是：

### 6.1 Supervisor -> Runtime

当前 supervisor 明确消费：

- `StreamingExecutionCoordinator`
- `ExecutionStepRecord`

主要位置：

- `agents/supervisor/src/flows/ministries/hubu-search-ministry.ts`
- `agents/supervisor/src/flows/ministries/hubu-search/*`

判断：

- 这是 `runtime <-> supervisor` 环的另一半
- 后续拆 `runtime -> supervisor` 时，必须同时评估 supervisor 是否只需要 runtime contract，而不是 runtime 实现细节

### 6.2 Coder / Reviewer -> Runtime

当前 coder / reviewer 反向消费相对更轻：

- `BaseAgent`
- `AgentRuntimeContext`
- `StreamingExecutionCoordinator`

判断：

- 这里已经有部分 contract-like 使用方式
- 后续可以对比 supervisor 侧依赖，看看是否可以统一成更薄的 runtime-facing contract

## 7. 第一批最值得落地的切口

如果下一轮要真正开始改代码，当前推荐优先级如下：

### 7.1 第一优先级

- `listBootstrapSkills`
- `resolveWorkflowPreset`
- `resolveWorkflowRoute`
- `resolveSpecialistRoute`

原因：

- 这些导出更接近稳定策略 contract
- 迁移价值高于迁 Ministry 实现类
- 相对容易先做“接口迁移，不动整条执行链”

当前进度：

- `listBootstrapSkills` 已完成迁移
- `resolveWorkflowPreset` / `buildWorkflowPresetPlan` / `GENERAL_PRESET` / `WORKFLOW_PRESETS` 已完成迁移
- `buildResearchSourcePlan` / `mergeEvidence` / `temporal-context` helper 已完成迁移
- `resolveWorkflowRoute` / `workflow-route-signals` / `workflow-route-readiness` 已完成迁移
- `resolveSpecialistRoute` 已完成迁移
- `initializeTaskExecutionSteps` / `markExecutionStep*` / `buildExecutionStepSummary` 已完成迁移
- 下一批仍建议优先处理：
  - `mergeEvidence` 在 learning flow 的重复实现收敛
  - `LibuRouterMinistry`
  - `HubuSearchMinistry` / `LibuDocsMinistry`

### 7.2 第二优先级

- `initializeTaskExecutionSteps`
- `markExecutionStep*`
- `mergeEvidence`

原因：

- 这些 helper 语义稳定
- 更像共享执行协议，而不是 supervisor 私货

当前状态补充：

- runtime 侧前几批纯策略 contract 已基本切到 `@agent/shared`
- `runtime -> supervisor` 当前残余已明显收缩到 Ministry 实现类和 `LibuRouterMinistry` / `Executor` 相关实现边
- `LibuRouterMinistry` 已完成第一层接口收敛：runtime 大部分使用点已改为依赖 `RouterMinistryLike`，只在装配点与少量本地 type barrel 保留具体类

### 7.3 第三优先级

- `appendDataReportContext`
- `buildDataReportContract`

原因：

- 这组 contract 边界已经相对清晰
- 很适合作为“单独一条依赖边瘦身”的试点

### 7.4 暂缓优先级

- `LibuRouterMinistry`
- `HubuSearchMinistry`
- `LibuDocsMinistry`
- `GongbuCodeMinistry`
- `BingbuOpsMinistry`
- `XingbuReviewMinistry`
- `ExecutorAgent`

原因：

- 它们仍然偏实现宿主
- 直接迁移更容易牵一发而动全身

## 8. 当前结论

这轮审计后的清晰结论是：

- `runtime -> supervisor` 的确是最该先拆的边
- 但第一刀不该先拆 Ministry 实现类
- 最值得先动的是 supervisor 暴露给 runtime 的策略 contract 与 execution helper

这意味着下一轮真正开始动代码时，最合理的切口不是“大重构 runtime 和 supervisor”，而是：

1. 先迁一小组稳定 contract
2. 保持行为不变
3. 再复查 package graph 是否收薄
