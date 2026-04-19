# agent-admin 文档目录

状态：current
文档类型：index
适用范围：`docs/frontend/agent-admin/`
最后核对：2026-04-19

本目录用于沉淀 `apps/frontend/agent-admin` 相关文档。

当前对应实现目录：

- `src/features/runtime-overview`
  - 运行中枢总览
- `src/features/approvals-center`
  - 审批中心
- `src/features/learning-center`
  - 学习中心
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

- `agent-admin` 的专项文档统一放在 `docs/frontend/agent-admin/`
- 运行中枢、审批中枢、学习中枢、技能工坊、证据中心、连接器与策略相关变化后，需同步更新本目录文档

当前文档：

- [overview.md](/docs/frontend/agent-admin/overview.md)
- [run-observatory.md](/docs/frontend/agent-admin/run-observatory.md)

当前控制面实现补充：

- dashboard 顶部当前会展示 `Platform Console diagnostics` 的轻量 badge，例如整包聚合耗时与缓存命中状态
- dashboard 顶部当前提供显式“指标快照”按钮，用于调用 `/platform/console/refresh-metrics` 后再刷新整包 console；需要保温 persisted metrics 时优先走此入口，而不是高频反复点击整包刷新
- dashboard 摘要区当前额外展示“控制台趋势”卡片，数据来自 `/platform/console/log-analysis`，用于快速查看最近日志样本里的 `fresh_aggregate / slow` 次数、P95，以及后端统一产出的健康/预警状态
