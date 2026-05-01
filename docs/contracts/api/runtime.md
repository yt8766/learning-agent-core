# Runtime API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-05-01

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

返回值 `PlatformConsoleRecord["runtime"]` 至少应包含 dashboard 展示需要的 summary、任务/队列投影、模型与成本统计、approval scope policy、工具摘要与知识检索装配状态；新增字段必须保持向后兼容。

知识检索状态字段：

| 字段                    | 类型                                                                 | 说明                                                                |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `knowledgeSearchStatus` | `RuntimeCenterKnowledgeSearchStatusRecord \| undefined`              | RuntimeHost 当前知识检索装配态，不是单次 query diagnostics。        |
| `configuredMode`        | `"keyword-only" \| "vector-only" \| "hybrid"`                        | 配置期望模式。                                                      |
| `effectiveMode`         | `"keyword-only" \| "vector-only" \| "hybrid"`                        | 实际生效模式；例如 vector client 缺失时可从 `hybrid` 降为 keyword。 |
| `vectorProviderId`      | `string \| undefined`                                                | provider 标识，只用于观测，不包含凭据或 raw endpoint。              |
| `vectorConfigured`      | `boolean`                                                            | host 是否配置了 vector 路径。                                       |
| `hybridEnabled`         | `boolean`                                                            | 当前是否实际启用 hybrid 检索。                                      |
| `keywordProviderHealth` | `{ status; checkedAt; latencyMs?; message?; consecutiveFailures? }`  | keyword provider 连通性；当前 OpenSearch provider 可返回该字段。    |
| `vectorProviderHealth`  | `{ status; checkedAt; latencyMs?; message?; consecutiveFailures? }`  | vector provider 连通性；经短 TTL 缓存和超时保护。                   |
| `diagnostics`           | `{ code: string; severity: "info" \| "warning"; message: string }[]` | 装配期 diagnostics；不得透传第三方 raw error 或凭据。               |
| `checkedAt`             | `string`                                                             | RuntimeHost 状态生成时间；provider health 字段有各自检查时间。      |

生产配置样例见仓库根目录 `.env.example` 的 knowledge retrieval 区块。常用组合：

- `KNOWLEDGE_RETRIEVAL_MODE=keyword-only`：只使用本地 snapshot keyword，或设置 `KNOWLEDGE_KEYWORD_PROVIDER=opensearch` 接入 OpenSearch。
- `KNOWLEDGE_RETRIEVAL_MODE=vector-only`：设置 `KNOWLEDGE_VECTOR_PROVIDER=chroma`、Chroma collection、embedding endpoint/model。
- `KNOWLEDGE_RETRIEVAL_MODE=hybrid`：同时接入 `KNOWLEDGE_KEYWORD_PROVIDER=opensearch` 与 `KNOWLEDGE_VECTOR_PROVIDER=chroma`。

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
