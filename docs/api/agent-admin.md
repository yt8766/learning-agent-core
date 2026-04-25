# Agent Admin API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文是 `agent-admin` 控制台聚合入口契约。Runtime、Approvals 和 Run Observatory 的专题接口分别见 [runtime.md](/docs/api/runtime.md)、[approvals.md](/docs/api/approvals.md)、[run-observatory.md](/docs/api/run-observatory.md)。

## 总约定

- `agent-admin` 的常规 HTTP 请求通过 `/platform/*` 接口读取。
- dashboard 首页优先请求轻量 shell；详情页按需请求对应 center。
- `diagnostics` 仅用于观测和排障，不得作为业务状态判断来源。

## Platform Console

| 方法   | 路径                                        | 用途                                            | 关键契约                                           |
| ------ | ------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `GET`  | `/platform/console-shell`                   | dashboard 首页轻量数据                          | 返回 summary 级数据；重量中心只保留占位或摘要      |
| `GET`  | `/platform/console`                         | 兼容入口                                        | 默认等价 shell；历史整包聚合必须显式传 `view=full` |
| `POST` | `/platform/console/refresh-metrics?days=30` | 刷新 runtime / evals persisted metrics snapshot | 面向后台任务、运维按钮和治理动作                   |
| `GET`  | `/platform/console/log-analysis?days=7`     | 平台控制台日志趋势                              | 返回趋势样本、预算判断和摘要状态                   |

常用 query：

- `days`
- `status`
- `model`
- `pricingSource`
- `runtimeExecutionMode`
- `runtimeInteractionKind`
- `approvalsExecutionMode`
- `approvalsInteractionKind`

## Refresh 语义

- `console-shell` 适合 `refreshAll`、首页摘要和 shell 级诊断。
- `console?view=full` 只用于兼容、诊断或比对，不作为首页默认依赖。
- Runtime 详情必须请求 `GET /platform/runtime-center`。
- Approvals 详情必须请求 `GET /platform/approvals-center`。
- Run detail 必须请求 `GET /platform/run-observatory/:taskId`。
- `connectors` 读接口不得隐式触发 full discovery refresh；显式刷新应走 connector 专用刷新入口。
- dashboard 不应靠读取 console 接口顺手生产 metrics snapshot；需要刷新时调用 `POST /platform/console/refresh-metrics`。

## 前后端边界

- 后端负责聚合、裁剪、缓存、诊断字段和兼容别名转换。
- 前端负责按页面粒度选择 shell 或 center 接口，不从 shell 占位数据反推详情。
- 前端可以展示 `diagnostics.cacheStatus / generatedAt / timingsMs`，但不得用它替代具体 center 数据。
