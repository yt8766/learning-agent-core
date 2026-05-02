# agent-admin 文档目录

状态：current
文档类型：index
适用范围：`docs/apps/frontend/agent-admin/`
最后核对：2026-05-01

本目录用于沉淀 `apps/frontend/agent-admin` 相关文档。

当前对应实现目录：

- `src/pages/runtime-overview`
  - 运行中枢总览
- `src/pages/runtime-overview/components/runtime-agent-tool-execution-projections.ts`
  - Agent Tool Execution 治理摘要投影，按 request、result、node、risk class 与 policy decision 聚合
- `src/pages/runtime-overview/components/runtime-run-workbench-card.tsx`
  - Run Workbench 详情区消费 `/api/agent-tools/projection` 后按当前 task 过滤工具执行请求、结果、事件和策略判定，只展示安全摘要
- `src/pages/run-observatory/run-observatory-panel.tsx`
  - Run Observatory 详情区消费同一 projection，支持按 blocked/resumed/terminal/high_risk 筛选 agent tool execution 细节
- `src/pages/approvals-center`
  - 审批中心
- `src/pages/learning-center`
  - 学习中心
- `src/pages/workspace-center`
  - Agent Workspace、技能草稿与复用飞轮治理入口
- `src/pages/skill-lab`、`src/pages/skill-sources-center`
  - 技能实验与来源治理
- `src/pages/evidence-center`
  - 证据中心
- `src/pages/connectors-center`
  - 连接器与策略
- `src/pages/task-traces`
  - 任务轨迹与可观测链路
- `src/pages/evals-center`
  - 评测中心
- `src/pages/workflow-lab`
  - 工作流实验台，当前用于 `company-live` 与 `data-report-json` 的管理台侧运行测试
- `src/pages/errors`
  - 401 / 403 / 404 / 500 / 503 全屏错误展示；`/login` 才使用登录页视觉，错误状态不复用登录卡片；401 由 `/401` 显式错误路由承载，不代表正常未登录入口
- `src/pages/rules-browser`
  - 规则治理
- `src/app/admin-routes.tsx`
  - React Router 路由表与登录保护；`/login`、Dashboard 中心 path route、显式错误页都从这里声明，不再在 `App` 里手写 pathname 分发表
- `src/pages/auth/store/admin-auth-store.ts`
  - Zustand 登录态 store；保留 `adminAuthStore` 兼容 facade 给 API runtime 与旧调用点使用
- `src/components`、`src/hooks`、`src/store`
  - 通用组件、hooks、状态管理

约定：

- `agent-admin` 的专项文档统一放在 `docs/apps/frontend/agent-admin/`
- 运行中枢、审批中枢、学习中枢、技能工坊、证据中心、连接器与策略相关变化后，需同步更新本目录文档
- 工具执行治理展示优先消费后端稳定 projection；Runtime Summary、Run Workbench 与 Run Observatory 都不应从 raw task dump 反推工具状态，也不渲染 raw input / vendor payload

当前文档：

- [overview.md](/docs/apps/frontend/agent-admin/overview.md)
- [run-observatory.md](/docs/apps/frontend/agent-admin/run-observatory.md)
- [agent-workspace-center.md](/docs/apps/frontend/agent-admin/agent-workspace-center.md)
- [shadcn-admin-visual-refresh.md](/docs/apps/frontend/agent-admin/shadcn-admin-visual-refresh.md)

当前控制面实现补充：

- Workflow Lab 当前通过 `src/pages/workflow-lab/registry/workflow.registry.ts` 注册可测试 workflow。`data-report-json` 会把表单值映射为 `/api/workflow-runs` 的 `workflowId: "data-report-json"` payload，并提供最小 `structuredSeed`，用于在 admin 内测试报表 JSON / `report-bundle.v1` 生成链路。调试 UI 已对齐 LangSmith Studio Graph mode 的公开语义：中栏先展示 graph canvas，再展示原始 node timeline，右栏承载选中节点输入 / 输出 / 错误详情；参考取证见 [LangSmith Studio Graph Mode 参考行为](/docs/research/langsmith-studio/BEHAVIORS.md)。
- dashboard 顶部当前会展示 `Platform Console diagnostics` 的轻量 badge，例如整包聚合耗时与缓存命中状态
- dashboard 根布局当前挂载 `NavigationProgress` 顶部加载条，参考 `satnaing/shadcn-admin` 的 root navigation progress；当整包刷新或页面中心切换刷新进行中时显示 2px 顶部进度反馈
- dashboard 顶部当前提供显式“指标快照”按钮，用于调用 `/platform/console/refresh-metrics` 后再刷新整包 console；需要保温 persisted metrics 时优先走此入口，而不是高频反复点击整包刷新
- dashboard 摘要区当前额外展示“控制台趋势”卡片，数据来自 `/platform/console/log-analysis`，用于快速查看最近日志样本里的 `fresh_aggregate / slow` 次数、P95，以及后端统一产出的健康/预警状态
- Runtime Overview 的 “Wenyuan & Cangjing” 卡片当前会展示 Runtime Center payload 中的 `knowledgeSearchStatus`，包括 configured/effective retrieval mode、vector/provider 状态、provider health 和 warning 数；该字段是 host 装配与 provider 连通性观测，不代表单次检索 diagnostics。单次 query 最近快照通过 `knowledgeSearchLastDiagnostics` 可选字段透出，当前 UI 展示 hit/total、`diagnostics` 中的 hybrid drilldown（retrievalMode、enabledRetrievers、failedRetrievers、candidateCount、fusionStrategy、prefilterApplied），以及 `diagnostics.postRetrieval` 存在且字段完整时的 filter、rank、diversify 紧凑摘要；其中 filtering diagnostics 支持可选 `maskedCount`，存在时展示 masked 数，字段缺失时按 legacy payload 静默跳过。
- Evidence Center 的 `cangjing` 证据卡片当前会读取 `detail.knowledgeRetrievalDiagnostics` 并展示最近检索的 query、hit/total、filter/rank/diversify 摘要。该字段只作为调试 drilldown，前端必须容忍缺失或字段不完整，不能把它当作 evidence 的必填事实。
- `App` 当前只负责 `QueryClientProvider` 与 `RouterProvider` 装配；实际路由表在 `src/app/admin-routes.tsx`。未登录访问受保护入口会由 React Router `<Navigate>` 导向 `/login`，不复用 401 错误页；显式 `/401`、`/403`、`/404`、`/500`、`/503` 渲染对应错误页；未知路径渲染 404。Dashboard 中心页使用 path route，例如 `/learning`、`/runtime`、`/approvals`；`/login#/learning` 会按登录态规范化为 `/login` 或 `/learning`，不能作为 dashboard 地址保留。
