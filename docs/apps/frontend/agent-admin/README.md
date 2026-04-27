# agent-admin 文档目录

状态：current
文档类型：index
适用范围：`docs/apps/frontend/agent-admin/`
最后核对：2026-04-19

本目录用于沉淀 `apps/frontend/agent-admin` 相关文档。

当前对应实现目录：

- `src/features/runtime-overview`
  - 运行中枢总览
- `src/features/runtime-overview/components/runtime-agent-tool-execution-projections.ts`
  - Agent Tool Execution 治理摘要投影，按 request、result、node、risk class 与 policy decision 聚合
- `src/features/runtime-overview/components/runtime-run-workbench-card.tsx`
  - Run Workbench 详情区消费 `/api/agent-tools/projection` 后按当前 task 过滤工具执行请求、结果、事件和策略判定，只展示安全摘要
- `src/features/run-observatory/run-observatory-panel.tsx`
  - Run Observatory 详情区消费同一 projection，支持按 blocked/resumed/terminal/high_risk 筛选 agent tool execution 细节
- `src/features/approvals-center`
  - 审批中心
- `src/features/learning-center`
  - 学习中心
- `src/features/workspace-center`
  - Agent Workspace、技能草稿与复用飞轮治理入口
- `src/features/skill-lab`、`src/features/skill-sources-center`
  - 技能实验与来源治理
- `src/features/evidence-center`
  - 证据中心
- `src/features/connectors-center`
  - 连接器与策略
- `src/features/task-traces`
  - 任务轨迹与可观测链路
- `src/features/evals-center`
  - 评测中心
- `src/features/rules-browser`
  - 规则治理
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

当前控制面实现补充：

- dashboard 顶部当前会展示 `Platform Console diagnostics` 的轻量 badge，例如整包聚合耗时与缓存命中状态
- dashboard 顶部当前提供显式“指标快照”按钮，用于调用 `/platform/console/refresh-metrics` 后再刷新整包 console；需要保温 persisted metrics 时优先走此入口，而不是高频反复点击整包刷新
- dashboard 摘要区当前额外展示“控制台趋势”卡片，数据来自 `/platform/console/log-analysis`，用于快速查看最近日志样本里的 `fresh_aggregate / slow` 次数、P95，以及后端统一产出的健康/预警状态
