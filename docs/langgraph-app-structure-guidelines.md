# LangGraph 应用结构规范

状态：current
文档类型：convention
适用范围：LangGraph 结构规范
最后核对：2026-04-16

本规范只保留当前项目真正需要的部分，用于约束 `apps/*` 与 `packages/*` 中涉及 LangGraph、运行时编排和测试组织的目录结构。

目标：

- Graph 入口清晰
- 多 Graph / 子图可维护
- 共享能力集中复用
- 测试目录统一，不再与 `src/` 混放

## 1. 适用范围

适用于：

- `packages/runtime`
- `agents/coder`
- `agents/supervisor`
- `agents/data-report`
- `apps/backend/agent-server`
- `apps/worker`

前端不直接承载 LangGraph graph，但也应遵守同样的“源码目录 + 同级 test 目录”原则。

## 2. 当前项目推荐结构

### `packages/runtime`

```text
packages/runtime/
├─ src/
│  ├─ flows/
│  ├─ graphs/
│  ├─ governance/
│  ├─ runtime/
│  ├─ session/
│  ├─ capabilities/
│  ├─ utils/
│  ├─ types/
│  └─ index.ts
├─ test/
│  ├─ graphs/
│  ├─ flows/
│  ├─ session/
│  ├─ runtime/
│  └─ fixtures/
├─ package.json
└─ README.md
```

约束：

- `graphs/` 只放 graph 定义、编译入口、子图组装
- `flows/` 只放节点、prompt、schema、局部 flow 工具
- `capabilities/` 放 runtime 级能力装配
- `utils/` 放无副作用、可稳定复用的纯函数工具，例如 parser、formatter、matcher、normalizer、轻量 mapper
- `session/` 放 checkpoint、事件持久化、恢复与压缩
- 测试统一放 `packages/runtime/test/`，不要继续在 `src/` 下新增 `*.test.ts` 或 `*.int-spec.ts`

对 `packages/runtime/src/session/` 额外约束：

- `session-coordinator.ts`
  - 只保留会话级 facade、对外 API 和依赖装配
- `session-coordinator-sync.ts`
  - 承载 task -> session/checkpoint/messages/events 的同步逻辑
- `session-coordinator-inline.ts`
  - 承载 inline capability 完成态收口、checkpoint 清理、局部纯函数 helper
- `session-coordinator-approval-policy.ts`
  - 承载 approval scope policy 的 match input、upsert、持久化和 auto-allow 记录
- `session-coordinator-approvals.ts`
  - 承载 approve/reject 事件类型、auto-approval 决策和 task/token subscription wiring
- 不要再把 inline capability 收口和 approval policy 持久化规则堆回 `session-coordinator.ts`

对 `packages/runtime/src/graphs/main/` 额外约束：

- `main.graph.ts`
  - 只保留 `AgentOrchestrator` facade、resolver setter、订阅入口与稳定对外 API
- `main-graph-runtime-modules.ts`
  - 承载 runtime 主链 wiring、实例装配与 bridge/lifecycle 的闭环初始化
- `main-graph.types.ts`
  - 承载 orchestrator 依赖、resolver、runtime bundle 的稳定类型边界
- `orchestration/main-graph-pipeline-orchestrator.ts`
  - 只保留 task pipeline / approval recovery 的流程骨架、阶段切换与错误收口
- `orchestration/main-graph-pipeline-orchestrator.types.ts`
  - 承载 pipeline callback、resume/run 参数与 approval recovery 契约
- `orchestration/main-graph-pipeline-orchestrator-graph.ts`
  - 承载 ministry 实例装配、direct-reply graph 与 task pipeline graph 的 callback wiring
- `task/main-graph-task-runtime.ts`
  - 只保留 task runtime facade，不再承担错误类型导出或大段 wiring
- `task/main-graph-task-runtime-errors.ts`
  - 承载 runtime cancel / budget exceed 等错误契约
- 不要再把 runtime 主链 wiring、resolver 类型定义、graph callback map 或错误契约重新堆回 `main.graph.ts` 或 `main-graph-pipeline-orchestrator.ts`

### `agents/coder` / `agents/supervisor` / `agents/data-report`

```text
agents/<domain>/
├─ src/
│  ├─ flows/
│  ├─ graphs/
│  ├─ runtime/
│  ├─ shared/
│  ├─ types/
│  ├─ utils/
│  └─ index.ts
├─ test/
│  ├─ flows/
│  ├─ graphs/
│  ├─ runtime/
│  └─ fixtures/
├─ package.json
└─ README.md
```

约束：

- 专项 agent 的 graph 入口默认放在 `agents/<domain>/src/graphs/*.graph.ts`
- 节点实现、prompt、schema 放在对应 `src/flows/<domain>/`
- `src/utils/prompts/` 可放本宿主复用的提示词 helper，但不要回填 app 层 service

`shared/` 与 `utils/` 的区别：

- `shared/`
  - 放带明确领域语义的共享资产
  - 例如：prompt、schema、事件映射、跨流程协议
- `utils/`
  - 放不带强业务身份的通用函数
  - 例如：字符串规整、数组分组、时间格式化、稳定排序、轻量解析

禁止：

- 把 service、repository、runtime bridge、tool executor 放进 `utils/`
- 把某个 flow 私有的 helper 提前抽成全局 `utils/`
- 用 `utils/` 代替 `shared/` 承载协议、prompt、schema

对 `agents/supervisor/src/flows/supervisor/` 额外约束：

- `pipeline-stage-nodes.ts`
  - 只保留阶段导出 facade
- `planning-stage-intake.ts`
  - 承载 `goal intake`、`route` 这类前置阶段节点
- `planning-stage-nodes.ts`
  - 只保留 manager planning 主链 orchestration
- `planning-stage-budget.ts`
  - 承载 planning micro-budget 与只读探索预算规则
- `planning-stage-skill-contract.ts`
  - 承载技能 contract 编译、步骤角色映射与计划补强
- `dispatch-stage-nodes.ts`
  - 承载 context filter、dispatch order 与 audience slice 装配
- 不要再把 planning orchestration、budget control、skill contract 编译和 dispatch slicing 重新堆回单一 `pipeline-stage-nodes.ts`

对 `agents/supervisor/src/workflows/` 额外约束：

- `workflow-route-registry.ts`
  - 只保留 route facade 与稳定导出面
- `workflow-route-signals.ts`
  - 承载 intent classification、conversation recall、profile adjustment 等信号判定
- `workflow-route-readiness.ts`
  - 承载 connector / capability / approval 的 readiness fallback
- `workflow-route-resolver.ts`
  - 承载最终 route resolve、priority、adapter 与 flow 选择
- `workflow-preset-registry.ts`
  - 只保留 preset facade 与稳定导出面
- `workflow-preset-definitions.ts`
  - 承载 preset definitions 与默认 GENERAL_PRESET
- `workflow-preset-resolver.ts`
  - 承载 explicit / inferred / default preset 解析
- `workflow-preset-plan.ts`
  - 承载 preset -> manager plan 的编译逻辑
- 不要再把 workflow route signal、readiness、preset definitions 和 preset plan builder 重新堆回单一 registry 文件

对 `agents/supervisor/src/flows/ministries/hubu-search/` 额外约束：

- `hubu-search-ministry.ts`
  - 只保留户部研究 orchestration、state 更新与最终结果收口
- `hubu-search-tool-plan.ts`
  - 承载 research tool planning、heuristic fallback 与 llm tool order 解析
- `hubu-search-task-map.ts`
  - 承载 memory / knowledge / skill / web search 的执行任务装配
- `hubu-search-research-generator.ts`
  - 承载 research evidence 的结构化输出生成与 fallback summary
- 不要再把 research task planning、evidence 结构化生成、task map 构建重新堆回 `hubu-search-ministry.ts`

对 `agents/coder/src/flows/ministries/gongbu-code/` 与 `agents/coder/src/flows/chat/nodes/` 额外约束：

- `gongbu-code-ministry.ts`
  - 只保留工部执行主链 orchestration、state 收口、data-report 五段编排与可覆写入口
- `gongbu-code-selection-service.ts`
  - 承载 llm execution selection、schema 调用与 fallback 前的对象生成
- `gongbu-code-tool-resolution.ts`
  - 承载 intent 判定、workflow preferred tool、research source 选择与 tool input 构造
- `gongbu-code-approval-gate.ts`
  - 承载 approval classifier 输入封装与审批预览生成
- `gongbu-code-readonly-batch.ts`
  - 承载 readonly batch tool 选择、streaming step 装配与批量结果归并
- `gongbu-code-execution-runner.ts`
  - 承载单工具请求执行与 web search follow-up read 的结果补强
- `executor-node.ts`
  - 只保留 chat executor orchestration、state 更新与最终结果收口
- `executor-node-skill.ts`
  - 承载 installed skill/runtime skill 收口与 action prompt/success summary 拼装
- `executor-node-tooling.ts`
  - 承载 worker capability -> tool allowlist、intent fallback、tool input 与 workflow preferred tool 解析
- `executor-node-search-followup.ts`
  - 承载 `webSearchPrime` 二段读取、follow-up tool resolve 与结果 merge
- 不要再把工部执行选择、审批 preview、readonly batch 组装或 chat executor 的 skill/tool/search helper 重新堆回单一 `gongbu-code-ministry.ts` 或 `executor-node.ts`

### `apps/backend/agent-server`

```text
apps/backend/agent-server/
├─ src/
│  ├─ chat/
│  ├─ runtime/
│  ├─ platform/
│  ├─ approvals/
│  ├─ skills/
│  ├─ connectors/
│  └─ main.ts
├─ test/
│  ├─ chat/
│  ├─ runtime/
│  ├─ platform/
│  ├─ approvals/
│  ├─ integration/
│  └─ fixtures/
├─ package.json
└─ README.md
```

约束：

- `src/` 只放运行代码
- `test/` 统一承载 service/controller/integration 测试
- `test/integration/` 用于 SSE、checkpoint、runtime center、approval recovery 这类跨模块协同测试

### `apps/worker`

```text
apps/worker/
├─ src/
│  ├─ jobs/
│  ├─ runtime/
│  ├─ recovery/
│  └─ main.ts
├─ test/
│  ├─ jobs/
│  ├─ runtime/
│  ├─ recovery/
│  └─ fixtures/
├─ package.json
└─ README.md
```

### `apps/frontend/agent-chat`

```text
apps/frontend/agent-chat/
├─ src/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  ├─ styles/
│  └─ types/
├─ test/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  └─ fixtures/
├─ package.json
└─ README.md
```

### `apps/frontend/agent-admin`

```text
apps/frontend/agent-admin/
├─ src/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  └─ types/
├─ test/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  └─ fixtures/
├─ package.json
└─ README.md
```

## 3. Graph 入口约束

当前项目不是通用 LangSmith demo，而是多 Agent 运行时，所以只保留对本项目有价值的要求：

- Graph 入口必须清晰可定位
- 一个 graph / 子图应有明确的编译入口或工厂函数
- 不要把 graph 定义散落到 controller、service、hook 里
- 应用层负责路由、暴露和运行管理，不在应用层拼 graph 业务细节

当前推荐：

- runtime 主链图放在 `packages/runtime/src/graphs/`
- 专项 agent 图放在 `agents/<domain>/src/graphs/`
- app 层只依赖稳定公开入口，例如 `@agent/runtime` 与对应 agent facade，不直连源码目录

对 `packages/runtime/src/graphs/main/task/` 额外约束：

- `main-graph-task-factory.ts`
  - 只保留 task 创建 facade、依赖注入与最终装配
- `task-entry-decision.ts`
  - 承载 `requestedMode`、群辅 selector、entry decision 这类纯规则选择
- `task-execution-plan.ts`
  - 承载 execution plan、治理补偿、dispatch/capability 纯计算
- `task-workflow-resolution.ts`
  - 承载 workflow preset、data-report context enrich、specialist route、初始 chat route 解析
- `task-record-builder.ts`
  - 承载 `TaskRecord` 初始化、默认预算/状态切片与队列快照装配
- `task-skill-intervention.ts`
  - 承载本地 skill suggestion、pre-execution intervention、审批等待态注入
- 不要再把上述规则重新堆回 `main-graph-task-factory.ts`

对 `packages/runtime/src/graphs/main/lifecycle/` 额外约束：

- `main-graph-lifecycle.ts`
  - 只保留 lifecycle facade、主链 wiring 与阶段衔接
- `main-graph-lifecycle-routing.ts`
  - 承载 approval / recovery / background / learning 等路由判断
- `main-graph-lifecycle-persistence.ts`
  - 承载 snapshot、queue、lease、trace 这类持久化更新封装
- `main-graph-lifecycle-queries.ts`
  - 承载 task state 查询、恢复判断和 query helper
- `main-graph-lifecycle-governance.ts`
  - 承载 knowledge reuse、counselor selector、auto approval 相关治理决策
- `main-graph-lifecycle-learning.ts`
  - 只保留 learning lifecycle facade、conflict scan、jobs runtime 入口
- `main-graph-lifecycle-learning-queue.ts`
  - 承载 learning queue 处理、task-learning / dream-task 入队策略和候选统计
- `main-graph-lifecycle-approval.ts`
  - 只保留 approval lifecycle 的公开入口与模块聚合
- `main-graph-lifecycle-approval-action.ts`
  - 承载 approval action、skill install 恢复、pending execution resume
- `main-graph-lifecycle-approval-timeout.ts`
  - 承载 interrupt timeout、plan-question 默认继续、timeout 统计更新
- `main-graph-lifecycle-approval.types.ts`
  - 承载 approval lifecycle callback contract 与依赖边界
- 不要把生命周期判断、状态写回和治理补偿重新堆回 `main-graph-lifecycle.ts`

对 `packages/runtime/src/capabilities/` 额外约束：

- `capability-pool.ts`
  - 只保留 capability pool facade 与稳定导出面
- `capability-pool-bootstrap.ts`
  - 承载 bootstrap attachment、workflow/specialist/requested hint 初始化与 seed augmentation 注入
- `capability-pool-merge.ts`
  - 承载 skill search / installed skill 合并与 checkpoint capability state 同步
- `capability-pool-governance.ts`
  - 承载 worker selection preference、ministry stage preference 与 capability affinity 治理判断
- `capability-pool-explanation.ts`
  - 承载 capability redirect / readonly fallback 解释
- `capability-pool.shared.ts`
  - 承载 display mapper、ownership trigger、connector/ministry/specialist tag 与去重纯函数
- 不要再把 capability bootstrap、search merge、governance preference 与 redirect helper 重新堆回单一 `capability-pool.ts`

对 `packages/runtime/src/flows/ministries/review-stage-*` 额外约束：

- `review-stage-nodes.ts`
  - 只保留 review stage 编排、retry/交付分支和阶段级 orchestration
- `review-stage-state.ts`
  - 承载 critique / final review / guardrail / sandbox 等 review outcome state 收口
- `review-stage-persistence.ts`
  - 承载 review 阶段执行摘要压缩与持久化前整理
- `review-stage.types.ts`
  - 承载 review stage 的 callback contract 与结构化返回值
- 不要再把 review state 归并、执行摘要压缩和 callback 协议重新塞回 `review-stage-nodes.ts`

## 4. 多 Graph / 子图约束

当前项目是多 Graph / 多子图系统，但不需要把每条 graph 都拆成独立 package。

推荐做法：

- 主执行图、聊天图、学习图、恢复图留在 `packages/runtime/src/graphs/`
- supervisor、data-report 等专项图留在各自 `agents/*/src/graphs/`
- 共享节点逻辑放对应宿主的 `flows/`
- 共享事件映射、prompt、schema 放宿主的 `shared/` 或稳定公共包

禁止：

- Graph 之间相互直接嵌套调用业务 service 来绕过 graph 边界
- 在 app 层重新拼一套与 runtime / agents 平行的 graph 结构

## 4.1 `zod` 与 `Annotation` 职责边界

在当前项目里，这两个概念不要混用：

- `zod`
  - 负责“数据格式正确性”
  - 用于约束模型输出、结构化结果、schema parse、字段合法性
  - 典型位置：
    - `shared/schemas/*`
    - `flows/*/schemas/*`
    - `utils/schemas/*`
- `Annotation`
  - 负责“图状态如何存储和合并”
  - 用于定义 LangGraph state 中每个字段如何进入图、如何在节点之间传递、如何在多步执行中累积
  - 典型位置：
    - `graphs/chat.graph.ts`
    - `graphs/main-route.graph.ts`
    - `graphs/recovery.graph.ts`
    - `graphs/learning.graph.ts`

判断规则：

- 如果你在解决“模型返回的数据是否合格”，优先想 `zod`
- 如果你在解决“这个字段在 graph 里怎么挂、怎么传、怎么 merge”，优先想 `Annotation`

禁止：

- 用 `Annotation` 代替 `zod` 做字段值合法性校验
- 用 `zod` 代替 `Annotation` 表达图状态累积/合并语义

## 5. 测试目录硬约束

从本规范开始，测试目录统一收敛为“每个项目一个同级 `test/` 目录”：

- `packages/runtime/test`
- `agents/supervisor/test`
- `agents/data-report/test`
- `apps/backend/agent-server/test`
- `apps/worker/test`
- `apps/frontend/agent-chat/test`
- `apps/frontend/agent-admin/test`

规则：

- `src/` 下不再新增新的 `*.test.ts`、`*.spec.ts`、`*.int-spec.ts`
- 旧测试允许逐步迁移，不要求一次性全仓搬迁
- 新增测试必须优先写到各自项目的 `test/` 目录
- `test/fixtures/` 统一承载样本、mock state、mock event、mock tool 数据
- 兼容期内允许根级 `vitest` 同时发现 `src/` 与 `test/`；清理阶段再按项目逐步收紧到只认 `test/`

## 6. LangGraph 测试组织建议

按当前项目需求，推荐：

- graph 级测试：`test/graphs/`
- 节点 / flow 测试：`test/flows/`
- session / checkpoint / interrupt 测试：`test/session/`
- runtime / service / facade 测试：`test/runtime/`
- 前端消息流 / SSE / checkpoint 测试：各前端项目 `test/hooks/` 或 `test/features/`

命名建议：

- 单元测试：`*.test.ts`
- 集成测试：`*.int-spec.ts`
- React 测试：`*.test.tsx` / `*.int-spec.tsx`

## 7. 渐进迁移原则

当前仓库仍有大量测试与源码混放，这是历史状态，允许渐进迁移。

执行规则：

- 新文件按新规范放到 `test/`
- 修改旧测试时，优先就近迁移到对应 `test/` 目录
- 不要求为了一次小修把整个目录全部搬完
- 当某个模块被连续改动时，再成批迁移其测试
- 当前优先批次为：
  - `packages/runtime`
  - `agents/supervisor`
  - `apps/frontend/agent-chat`
- 路径迁移优先保持镜像：
  - `src/graphs/main/foo.test.ts -> test/graphs/main/foo.test.ts`
  - `src/hooks/bar.int-spec.ts -> test/hooks/bar.int-spec.ts`
