# Run Observatory

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin/src/features/run-observatory`
最后核对：2026-04-19

本文记录 `agent-admin` 第一阶段单 run observability 详情的真实实现。

## 1. 入口

当前没有单独新增新的 dashboard 一级导航，第一阶段入口挂在运行中枢右侧选中 run 面板内：

- `Runtime Summary` 顶部新增 `Workflow Catalog`
- `Runtime Queue` 选择 run
- 右侧 `Selected Run` 中保留原有 summary / trace panel
- 新增 `Execution Observatory` 区块

当前操作链路已经补到“先发起，再观测”：

- 在 `Workflow Catalog` 里选择 workflow preset
- 直接查看该 preset 的 `Workflow Blueprint`
- 输入目标
- 直接从 `agent-admin` 发起一次 run
- 创建成功后自动切到对应 task，并在右侧 `Run Workbench` / `Execution Storyline` / `Workflow Execution Map` / `Node Activity Ledger` / `Execution Observatory` 中查看每个阶段和节点做了什么

## 2. 当前展示内容

第一阶段 observability 面板包含：

- run header
  - goal
  - duration
  - current stage
  - current ministry / worker
- workflow blueprint / execution map
- agent graph overlay
- stage timeline
- trace waterfall
- checkpoint replay summary
- interrupt ledger
- evidence
- diagnostics
- lightweight compare / diff
- 以及 interrupt / evidence / diagnostics 到 checkpoint/span 的轻量关联 badge

## 3. 数据来源

前端不再自己从 raw task/event 推导第二套 timeline，而是直接消费：

- `GET /platform/workflow-presets`
- `GET /platform/run-observatory/:taskId`
- `GET /platform/run-observatory`

当前 workflow launch 不依赖新的专用“run workflow”接口，而是：

- 先从 `workflow-presets` 拉取可执行流程目录
- 用户选择 workflow 后，前端按 preset 的 `command` 拼接实际提交 goal
- 再走现有 `POST /tasks` 创建任务
- 创建成功后复用既有 runtime 观测面板查看执行过程

当前 workflow 可视化分成两层：

- `Workflow Blueprint`
  - 面向 workflow preset
  - 在还没有 run detail 时，也能先看到静态阶段骨架
- `Workflow Execution Map`
  - 面向当前选中的 run
  - 把 `timeline / traces / checkpoints / evidence / diagnostics / interrupts` 按 canonical stage 聚合到同一张卡片里
  - 当前每个 stage 也支持 `送到 Replay Draft`，可直接把某个阶段的重放意图送到上方 workbench
  - 用来回答“当前跑到了哪一步、这个阶段有哪些节点、每个节点做了什么”
- `Run Workbench`
  - 面向当前选中的 run
  - 把本次输入快照、推断出的 workflow command、resolved workflow、当前 stage / node、graph node 过滤、baseline compare 收到同一块抬头区域
  - 还会附带当前节点的局部事件切片，以及直接 `Retry Run` 和 `Rerun From Snapshot` 的入口
  - `Retry Run` 复用当前任务的原始重试链路；`Rerun From Snapshot` 会按当前快照里的 `workflow command + input` 新发起一条 run
  - 当前还补了可编辑的 `Replay Draft`，可以在发起前直接修改 workflow command 和输入目标
  - `Replay Draft` 下方还会显示 `Diff Preview Before Replay`，先展示 command / input 是否发生变化，以及预计会影响的 stage / node
  - 当前从 `Run Workbench` 发起的 replay 会自动把旧 run 挂成 baseline，新 run 打开后直接进入 compare 视角
  - 当前 replay draft 已支持从三处上游入口汇入：
    - `Execution Storyline`
    - `Workflow Execution Map`
    - `Agent Graph Overlay`
  - 当前 replay draft 还会把来源范围结构化展示为 scope chips，而不是只藏在输入文案里
  - replay diff preview 里会显式标记当前是 `scope attached` 还是 `scope cleared`
  - 当前可通过 `保留范围 / 清空范围` 一键决定是否继续带着这组诊断范围生成 replay
  - 当前还新增 `Launch Intent Summary`
    - 在真正发起 replay 之前，显式汇总本次使用的 command、scope 来源、baseline compare、预测影响的 stage / node
  - 当前 replay launch 还会在新 run 打开后显示 `Replay Receipt`
    - 显式回执本次是 scoped 还是 full-run replay，以及 baseline 是否自动挂载
  - 局部事件切片中的 `trace / checkpoint / interrupt` 现在可以直接一跳聚焦到下方 observability 对象
  - 在存在可映射上下文时，还会自动尝试把 graph node scope 一起收缩到最合适的节点工作台
  - 当前还新增了 `Debug Scope` 区，显式展示当前 `focus / node scope / baseline / diff scope`
  - 用来回答“我现在看的到底是哪次运行、原始输入是什么、是不是已经收缩到某个节点、当前是在和谁对比、要不要立刻复跑、要不要立刻跳到某个对象继续诊断”
- `Run Session Timeline`
  - 面向当前 run 的调试会话链
  - 把 `baseline run`、`replay receipt`、`current run` 串成一条最小 lineage
  - 当前已优先消费 run 原生 `lineage` 字段；`replay receipt` 只作为新启动后的即时前端回执补充
  - 用来回答“这次调试是从哪个 baseline 演化出来的、当前 run 是不是由一次 scoped replay 启动的”
- `Execution Storyline`
  - 面向当前选中的 run
  - 把 `timeline / trace / checkpoint / evidence / diagnostic / interrupt / artifact` 统一拉成按时间排序的执行故事线
  - 每一步都会展示 `stage / node / status / metadata`，在可聚焦时还能一跳联动到下方 observability 目标
  - 当前每一步还支持 `送到 Replay Draft`，把该步骤对应的复盘意图直接预填进上方 `Run Workbench`
  - 在 graph node scope 生效时，故事线也会同步收缩到对应节点范围
  - 用来回答“输入进来以后先经过了哪一步、哪个节点实际执行了什么、checkpoint/evidence/interrupt 是按什么顺序出现的”
- `Node Activity Ledger`
  - 面向当前选中的 run
  - 把 `trace / checkpoint / evidence / diagnostic / interrupt` 拉平成按时间排序的节点活动台账
  - 用来回答“同一个节点先做了什么、后触发了什么、什么时候进入 checkpoint / interrupt / diagnostic”
  - 每条活动都可直接复用现有 focus 机制，继续跳到对应 `span / checkpoint / evidence`

当前还补了一层 `Agent Graph Overlay`：

- 复用后端 `GET /runtime/architecture` 返回的 `agent` 架构描述符
- 把当前 run 的 `workflow / currentStage / currentMinistry / modelRoute / timeline / checkpoint` 映射到 graph 节点
- 用来回答“这次执行在主链架构图上点亮了哪些节点、当前卡在哪个治理或六部节点上”
- graph 节点现在还支持一跳联动：
  - 如果该节点能映射到具体 `span / checkpoint / evidence`
  - 点击后会直接复用现有 observability focus 机制，滚到对应卡片并展示 `Focused Context`
- graph 节点当前也支持 `送到 Replay Draft`
  - 可直接把某个架构节点的复盘意图送到上方 workbench
- graph 节点现在还支持“节点工作台”过滤：
  - 点击 `只看这个节点`
  - 下方 `timeline / trace / checkpoint / evidence / diagnostics / interrupts` 会切换成该节点相关的局部视图
  - `Compare / Diff` 也会同步切成该节点作用域，只比较这个节点相关的数据
  - compare 顶部会额外展示 `Node Inspector`
    - 汇总该节点作用域下的对象增减数量
    - 汇总字段变化数量
    - 用来快速判断 baseline / current 在这个节点上到底差了多少
  - 当前过滤态会在 observability 顶部显示，可随时清除

当前 Runtime Queue 左侧列表的筛选分为两层：

- `status / model / pricingSource / executionMode / interactionKind`
  - 默认直接透传给 `run-observatory` list 接口
- 当 observability list 拉取失败时
  - 前端才回退到本地 `runtime.recentRuns`，并沿用同一套筛选 helper 做兜底

当前 Runtime / Approvals 顶部的 share link 也会保留主要 runtime 观测视角参数：

- `runtimeTaskId`
- `runtimeStatus`
- `runtimeModel`
- `runtimePricingSource`
- `runtimeExecutionMode`
- `runtimeInteractionKind`
- `runtimeFocusKind`
- `runtimeFocusId`
- `runtimeCompareTaskId`
- `runtimeGraphNodeId`

因此复制链接后，其他人打开可以直接回到同一批 run 的筛选视角；如果当时已经选中了某个 run，右侧 detail 也会直接定位到同一个任务。如果分享前已经从 interrupt / diagnostics / evidence badge 聚焦到了某个 `checkpoint`、`span` 或 `evidence` 卡片、已经选择了某个 baseline compare run，或者已经在 `Agent Graph Overlay` / observability 顶部启用了某个 graph node 的节点级过滤，share link 也会把这些 observability 视角参数一起带上，打开后自动恢复相同 drilldown、compare 与 node-scoped debug 状态。

当前 detail 面板内部还支持一层轻量 drilldown：

- interrupt / diagnostics / evidence 上的 `checkpoint / span / evidence` badge 可点击
- 点击后会在当前 observability 面板内自动滚到并高亮对应的 `Checkpoint / Trace / Evidence` 卡片
- 当存在 focus target 时，面板会额外渲染 `Focused Context` 卡片，展示当前对象摘要、metadata、以及相关 `checkpoint / span / evidence` 跳转入口
- 当前 drilldown 已同步到 dashboard hash，因此刷新页面或复制 share link 后仍能恢复相同 focus target

当前 `Selected Run` 还提供一层 lightweight baseline compare：

- baseline 候选来自当前 observability list 的同批筛选结果
- 默认自动挑选当前选中 run 之外的第一个候选，用户也可手动切换
- 当前对比维度为：
  - `status`
  - `stage`
  - `duration`
  - `models`
  - `flags`（interrupt / fallback / recoverable / evidence warning）
  - `diagnosticFlags`
- 当前还会额外拉取 baseline 的 `RunBundleRecord`，补充：
  - `timeline / trace / checkpoint / interrupt / evidence / diagnostics` 的结构级数量差异
  - `trace node / diagnostic kind / interrupt kind / evidence source` 的增减项
- 当前还会把新增/移除的 `trace / checkpoint / diagnostic / evidence / interrupt` 项目本身列出来，便于直接阅读对象级变化
- 该 compare 目前仍是前端聚合出的 diff，不依赖新的 compare API
- 当前 compare baseline 已同步到 dashboard hash / share url，可随页面刷新和分享链接一起恢复
- 当前 graph node 过滤也会同步到 dashboard hash / share url，可随页面刷新和分享链接一起恢复

当前 compare 已经支持一层“同 ID 对象的字段级 diff”：

- 例如同一个 `traceId` 在 baseline / current 之间
- `status / model / latency / summary / metadata` 分别改了什么
- 当前已覆盖：
  - `trace`
  - `checkpoint`
  - `diagnostic`
  - `evidence`
  - `interrupt`
- 当前仍是前端基于 baseline/current detail payload 聚合出的对比结果，不依赖新的 compare API

当前实现文件：

- [run-observatory-panel.tsx](/apps/frontend/agent-admin/src/features/run-observatory/run-observatory-panel.tsx:1)
- [runtime-queue-selected-run.tsx](/apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-queue-selected-run.tsx:1)
- [runtime-workflow-catalog-card.tsx](/apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-workflow-catalog-card.tsx:1)
- [runtime-execution-story-card.tsx](/apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-execution-story-card.tsx:1)
- [runtime-workflow-execution-map-card.tsx](/apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-workflow-execution-map-card.tsx:1)
- [runtime-node-activity-ledger-card.tsx](/apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-node-activity-ledger-card.tsx:1)
- [runtime-agent-graph-overlay-card.tsx](/apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-agent-graph-overlay-card.tsx:1)
- [admin-api-platform.ts](/apps/frontend/agent-admin/src/api/admin-api-platform.ts:1)
- [admin-api-tasks.ts](/apps/frontend/agent-admin/src/api/admin-api-tasks.ts:1)

## 4. 当前约束

- 右侧保留既有 trace panels，避免第一阶段回退已有观测视图
- 右侧 `Selected Run` 空态当前会明确提示：需要先回到上方 `Workflow Catalog` 选择 preset、输入 goal 并发起运行；当前不在右侧空态内重复嵌一套 launch 表单
- `RunObservatoryPanel` 只消费后端 `RunBundleRecord`
- diagnostics、timeline、checkpoint summary 都以后端 projection 为准
- 前端只展示后端给出的关联字段，不在浏览器内二次推导 checkpoint/span 关系

## 5. 后续扩展

后续如果继续推进第二阶段，可以在不改变现有 contract 的前提下补：

- interrupt ledger 深钻与操作联动
- 从 workflow preset 继续下钻到 graph / node 级运行入口与节点说明
