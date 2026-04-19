# Runtime Centers API

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-19

本主题主文档：

- 总体对接关系仍以 [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md) 为准

本文只覆盖：

- `agent-admin` 依赖的 runtime center / approvals / platform console 接口
- run observability detail 接口入口
- admin 侧筛选字段与兼容别名语义

## 1. 这篇文档说明什么

本文档说明 `agent-admin` 当前依赖的 Runtime Center / Approvals Center / Platform Console 相关接口和筛选语义。

## 2. Platform Console

- `GET /platform/console-shell?days=30&status=&model=&pricingSource=&runtimeExecutionMode=&runtimeInteractionKind=&approvalsExecutionMode=&approvalsInteractionKind=`
  - 获取 admin dashboard 首页壳子所需的轻量 Platform Console 数据
  - 当前保留 `runtime / approvals / learning / evals / skills / rules / tasks / sessions / diagnostics` 等首页必要摘要
  - `runtime` 当前只返回 summary 级字段，Runtime 页面详情仍应继续请求 `GET /platform/runtime-center`
  - `learning` 当前只返回 summary 级字段，学习页面详情仍应继续请求 `GET /learning/center`
  - `evals` 当前只返回 summary 级字段，评测页面详情仍应继续请求 `GET /platform/evals-center`
  - `archives` 页面当前会单独并行请求 `GET /platform/runtime-center` 与 `GET /platform/evals-center`，不再依赖 shell 中的历史详情
  - `skills` 页面当前会单独并行请求 `GET /skills` 与 `GET /rules`，不再依赖 shell 中的全量技能/规则列表
  - `tasks / sessions / checkpoints` 当前已不再承担 admin 首屏或 page-center 刷新的关键依赖，shell 默认可返回空摘要
  - 当前会把 `evidence / connectors / skillSources / companyAgents` 这类重量级中心裁成空占位，要求前端按需继续请求各自 center 接口
  - 适合 `refreshAll`、首页 summary cards 与 shell 级诊断信息，不适合作为所有中心详情的唯一数据源

- `GET /platform/console?days=30&status=&model=&pricingSource=&runtimeExecutionMode=&runtimeInteractionKind=&approvalsExecutionMode=&approvalsInteractionKind=`
  - 默认返回与 `console-shell` 一致的轻量 shell 结果，用于兼容历史调用方继续访问旧地址但不再落回慢聚合
  - 如需历史整包聚合，必须显式追加 `view=full`
  - 也就是说：
    - `GET /platform/console?...` => 默认 shell
    - `GET /platform/console?...&view=full` => legacy full 聚合
  - 当前只会对 `runtime` 与 `approvals` 两块做过滤裁剪
  - 其他 center 仍保持全量返回
  - 后端当前对同一 runtime 进程内的同参数请求做 `15s` 短 TTL 缓存，并对并发相同请求做 in-flight 去重，避免 dashboard 刷新放大整包重算成本
  - 返回体当前附带 `diagnostics.cacheStatus / diagnostics.generatedAt / diagnostics.timingsMs`，用于观测本次 console 聚合来自缓存还是实时生成，以及各片段耗时；该字段是诊断辅助信息，前端可展示但不应反向驱动业务逻辑
  - `connectors` 片段当前默认只返回最近一次已知 discovery / governance 状态，不会在该读接口里自动触发全量 connector discovery refresh；显式刷新仍走 `POST /platform/connectors-center/:connectorId/refresh`
  - `runtime / evals` 片段当前在 Platform Console 内部优先读取 persisted metrics snapshot；当快照为空时，会回退一次 live 聚合补齐首屏数据，因此不会长期卡在空历史状态。该聚合接口默认不再把每次 dashboard 刷新都变成 usage/eval metrics 写回；单独查询 Runtime Center / Evals Center 仍保持 live 聚合
  - 推荐联调基线脚本：`pnpm exec tsx apps/backend/agent-server/scripts/measure-platform-console.ts --url http://127.0.0.1:3000/api/platform/console?days=30`

- `POST /platform/console/refresh-metrics?days=30`
  - 显式刷新 runtime / evals 的 persisted metrics snapshot
  - 供后续后台任务、运维入口或治理按钮复用，不要求调用方再通过读取控制台接口兜底生产快照
  - 后端当前还会在 runtime bootstrap 完成后非阻塞预热一次 `30d` snapshot，以减少首开控制台时落回 live 聚合的概率
  - runtime schedule runner 启动后会每 `30` 分钟再走一次同入口刷新 `30d` snapshot，用于把首开预热延伸成持续保温

- `GET /platform/console/log-analysis?days=7`
  - 返回基于 backend 日志文件的 platform console 趋势统计
  - 统计源当前固定为 `apps/backend/agent-server/logs/performance-YYYY-MM-DD.log`
  - 当前聚合事件固定为：
    - `runtime.platform_console.fresh_aggregate`
    - `runtime.platform_console.slow`
  - 返回：
    - `sampleCount`
    - `summary.status / summary.reasons / summary.budgetsMs`
    - 按事件分组的 `count`
    - `totalDurationMs` 的 `min / max / avg / p50 / p95`
    - 分片 `timingsMs` 的 `p50 / p95 / max`
    - `latestSamples`
  - 当前预算口径由后端集中维护：`fresh aggregate p95 <= 600ms`、`slow p95 <= 1200ms`
  - 当前主要服务 `agent-admin` 顶部“控制台趋势”卡片，不建议前端自行读原始日志文件

## 3. Runtime Center

- `GET /platform/runtime-center?days=30&status=&model=&pricingSource=&executionMode=&interactionKind=`
  - 获取 Runtime Center 数据
  - backend 当前通过 `@agent/runtime` 的 runtime center projection 组装返回体，自身只保留 query/context 注入与 HTTP 适配

- `GET /platform/learning-center`
  - 获取 Learning Center 数据
  - full / summary projection 当前由 `@agent/runtime` 提供；backend 负责注入规则候选派生和本地 skill suggestion 查询

`executionMode` 的 canonical 写出始终对应 `executionPlan.mode`：

- `plan`
- `execute`
- `imperial_direct`

兼容读取旧别名：

- `standard -> execute`
- `planning-readonly -> plan`

`interactionKind` 当前支持：

- `approval`
- `plan-question`
- `supplemental-input`

导出接口：

- `GET /platform/runtime-center/export?...`
  - 沿用同一组 runtime 过滤参数
  - CSV 当前额外包含：
    - `filterExecutionMode`
    - `filterInteractionKind`
    - 每条 run 的 `executionMode`
    - 每条 run 的 `interactionKind`

## 4. Approvals Center

- `GET /platform/approvals-center?executionMode=&interactionKind=`
  - 获取 Approvals Center 数据
- `GET /platform/approvals-center/export?...`
  - 导出 Approvals Center

当前支持：

- `executionMode`
- `interactionKind`

CSV 当前额外包含：

- `filterExecutionMode`
- `filterInteractionKind`
- 每条审批项的 `executionMode`
- 每条审批项的 `interactionKind`

## 5. Run Observatory

- `GET /platform/run-observatory`
  - 返回 run observability summary 列表
  - 当前支持：
    - `status`
    - `executionMode`
    - `interactionKind`
    - `q`
    - `hasInterrupt`
    - `hasFallback`
    - `hasRecoverableCheckpoint`
- `GET /platform/run-observatory/:taskId`
  - 返回单次 run 的 observability detail
  - 当前用于 `agent-admin` Runtime Center 右侧 `Execution Observatory` 面板
  - 返回 payload 不是 raw task dump，而是后端基于 task、latest checkpoint、trace、interrupt、external sources 聚合出的 `RunBundleRecord`

详见：

- [Run Observatory API](/docs/integration/run-observatory-api.md)

## 6. 当前约束

- 新任务、新导出、新分享链接只应写出 canonical `executionMode`
- 前后端筛选参数必须保持同一套语义，不要在 admin 侧再造别名

## 7. 继续阅读

- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
- [backend 文档目录](/docs/backend/README.md)
