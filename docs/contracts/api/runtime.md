# Runtime API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文记录 Runtime Center 查询、导出与筛选契约。

## Runtime Center

| 方法  | 地址                                  | 参数                                                                                                                                                                    | 返回值                                                    | 说明                                                                                              |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET` | `/api/platform/runtime-center`        | query: `days?: number`、`status?: string`、`model?: string`、`pricingSource?: string`、`executionMode?: string`、`interactionKind?: string`                             | `PlatformConsoleRecord["runtime"]`                        | 获取 Runtime Center projection；backend 只做 HTTP 适配和 context 注入。                           |
| `GET` | `/api/platform/runtime-center/export` | query: `days?: number`、`status?: string`、`model?: string`、`pricingSource?: string`、`executionMode?: string`、`interactionKind?: string`、`format?: "csv" \| "json"` | `{ filename: string; mimeType: string; content: string }` | 导出 Runtime Center；`format` 默认由调用方决定，前端 admin 默认为 `csv`，chat 导出默认为 `json`。 |

参数说明：

| 参数              | 类型              | 默认值 | 说明                                           |
| ----------------- | ----------------- | ------ | ---------------------------------------------- |
| `days`            | `number`          | `30`   | 查询最近多少天；由后端整数解析 pipe 处理。     |
| `status`          | `string`          | 无     | 任务状态筛选，取值应与 `TaskStatus` 保持一致。 |
| `model`           | `string`          | 无     | 模型名称或模型 id 筛选。                       |
| `pricingSource`   | `string`          | 无     | 价格来源筛选。                                 |
| `executionMode`   | `string`          | 无     | 执行模式筛选；见下方 canonical 规则。          |
| `interactionKind` | `string`          | 无     | 交互类型筛选；见下方取值。                     |
| `format`          | `"csv" \| "json"` | 无     | 仅导出接口支持。                               |

返回值 `PlatformConsoleRecord["runtime"]` 至少应包含 dashboard 展示需要的 summary、任务/队列投影、模型与成本统计、approval scope policy 与工具摘要；新增字段必须保持向后兼容。

## Execution Mode

canonical 写出值：

- `plan`
- `execute`
- `imperial_direct`

兼容读取别名：

- `standard -> execute`
- `planning-readonly -> plan`

新任务、新导出、新分享链接只应写出 canonical 值。

## Interaction Kind

当前支持：

- `approval`
- `plan-question`
- `supplemental-input`

## CSV 导出

导出结果必须额外包含：

- `filterExecutionMode`
- `filterInteractionKind`
- 每条 run 的 `executionMode`
- 每条 run 的 `interactionKind`

## 生产与消费边界

- Runtime Center 返回体由 `@agent/runtime` projection 组装。
- Backend 不在 controller/service 中重建 runtime projection。
- Frontend 不自行维护 execution mode legacy alias 映射；以后端返回和本文 canonical 规则为准。
- 查询接口不应隐式刷新 metrics snapshot；需要刷新时调用 [agent-admin.md](/docs/contracts/api/agent-admin.md) 中的 `POST /api/platform/console/refresh-metrics`。
