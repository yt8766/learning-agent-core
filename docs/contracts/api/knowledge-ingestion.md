# Knowledge Ingestion API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`packages/knowledge`
最后核对：2026-05-01

本文记录生产来源内容进入统一 knowledge ingestion 边界的最小 HTTP 契约。规范化 source payload 接口只接收已经由调用方完成鉴权、下载、清洗后的 source payload；user upload adapter 接口负责读取已经落在 workspace 内的上传文件并转换为相同 ingestion payload。

## 入口

| 方法   | 地址                                                    | 请求体                                   | 返回值                    | 说明                                                                                      |
| ------ | ------------------------------------------------------- | ---------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `POST` | `/api/platform/knowledge/sources/ingest`                | `{ payloads: KnowledgeSourcePayload[] }` | `KnowledgeIndexingResult` | 将规范化来源 payload 写入 source/chunk/receipt snapshot 与向量边界。                      |
| `POST` | `/api/platform/knowledge/sources/user-upload/ingest`    | `UserUploadIngestionRequest`             | `KnowledgeIndexingResult` | 读取 workspace 内已落盘的上传文件，构造 `user-upload` payload 后写入统一 ingestion 边界。 |
| `POST` | `/api/platform/knowledge/sources/catalog-sync/ingest`   | `CatalogSyncIngestionRequest`            | `KnowledgeIndexingResult` | 接收已同步 catalog entry 产物，构造 `catalog-sync` payload 后写入统一 ingestion 边界。    |
| `POST` | `/api/platform/knowledge/sources/web-curated/ingest`    | `WebCuratedIngestionRequest`             | `KnowledgeIndexingResult` | 接收已抓取清洗的 curated web 产物，构造 `web-curated` payload 后写入统一 ingestion 边界。 |
| `POST` | `/api/platform/knowledge/sources/connector-sync/ingest` | `ConnectorSyncIngestionRequest`          | `KnowledgeIndexingResult` | 接收 connector 同步产物，构造 `connector-manifest` payload 后写入统一 ingestion 边界。    |

## 请求体

### 规范化 Source Payload

`payloads` 必须是非空数组。每个元素对齐 `@agent/knowledge` 的 `KnowledgeSourceIngestionPayloadSchema`：

| 字段         | 类型                                                                                                          | 必填 | 说明                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `sourceId`   | `string`                                                                                                      | 是   | 来源稳定 id。重复写入会按 id 覆盖 snapshot。 |
| `documentId` | `string`                                                                                                      | 否   | 文档 id；缺省使用 `sourceId`。               |
| `sourceType` | `"workspace-docs" \| "repo-docs" \| "connector-manifest" \| "catalog-sync" \| "user-upload" \| "web-curated"` | 是   | 正式知识来源类型；不接受 `agent-skill`。     |
| `uri`        | `string`                                                                                                      | 是   | 原始来源 URI 或内部路径。                    |
| `title`      | `string`                                                                                                      | 是   | 展示标题。                                   |
| `trustClass` | `"official" \| "curated" \| "community" \| "unverified" \| "internal"`                                        | 是   | 信任等级。                                   |
| `content`    | `string`                                                                                                      | 是   | 已清洗文本内容。                             |
| `version`    | `string`                                                                                                      | 否   | 调用方版本号；缺省由 runtime facade 生成。   |
| `metadata`   | JSON object                                                                                                   | 否   | 过滤、权限、来源补充字段；不得包含凭据。     |

### User Upload Adapter

`UserUploadIngestionRequest` 字段：

| 字段           | 类型        | 必填 | 说明                                                                                              |
| -------------- | ----------- | ---- | ------------------------------------------------------------------------------------------------- |
| `uploadId`     | `string`    | 是   | 上传来源稳定 id，会作为 `sourceId` 与默认 `documentId`。                                          |
| `filePath`     | `string`    | 是   | 已落盘文件路径；可为 workspace 内相对路径，或解析后仍位于 `settings.workspaceRoot` 内的绝对路径。 |
| `filename`     | `string`    | 否   | 展示原始文件名；缺省取 `filePath` basename。                                                      |
| `title`        | `string`    | 否   | 展示标题；缺省取 `filename`。                                                                     |
| `uploadedBy`   | `string`    | 否   | 上传发起人，写入 `metadata.uploadedBy`。                                                          |
| `allowedRoles` | `string[]`  | 否   | 可访问角色，写入 `metadata.allowedRoles`，供后续检索过滤使用。                                    |
| `mimeType`     | `string`    | 否   | 文件 MIME，写入 `metadata.mimeType`。                                                             |
| `metadata`     | JSON object | 否   | 额外 JSON-safe metadata；不得包含凭据、token 或未脱敏隐私字段。                                   |

### Catalog Sync Adapter

`CatalogSyncIngestionRequest` 字段：

| 字段      | 类型                 | 必填 | 说明                                                               |
| --------- | -------------------- | ---- | ------------------------------------------------------------------ |
| `entries` | `CatalogSyncEntry[]` | 是   | 已由上游 catalog sync 完成鉴权、拉取和清洗后的条目数组，必须非空。 |

`CatalogSyncEntry` 字段：

| 字段         | 类型                                    | 必填 | 说明                                                                    |
| ------------ | --------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `catalogId`  | `string`                                | 是   | catalog 条目稳定 id；payload `sourceId` 生成为 `catalog-${catalogId}`。 |
| `title`      | `string`                                | 是   | catalog 条目标题。                                                      |
| `content`    | `string`                                | 是   | 已清洗文本内容。                                                        |
| `uri`        | `string`                                | 否   | catalog 来源 URI；缺省为 `catalog://${catalogId}`。                     |
| `version`    | `string`                                | 否   | 上游 catalog 版本。                                                     |
| `owner`      | `string`                                | 否   | 条目 owner，写入 `metadata.owner`。                                     |
| `trustClass` | `"official" \| "internal" \| "curated"` | 否   | catalog 信任等级；缺省 `official`，不接受 `community` / `unverified`。  |
| `metadata`   | JSON object                             | 否   | 额外 JSON-safe metadata；不得包含凭据、token 或 vendor raw response。   |

### Web Curated Adapter

`WebCuratedIngestionRequest` 字段：

| 字段      | 类型                | 必填 | 说明                                                                     |
| --------- | ------------------- | ---- | ------------------------------------------------------------------------ |
| `entries` | `WebCuratedEntry[]` | 是   | 已由上游 curated web job 完成 URL 拉取、清洗与安全策略判定后的条目数组。 |

`WebCuratedEntry` 字段：

| 字段         | 类型                                                     | 必填 | 说明                                                                   |
| ------------ | -------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `sourceId`   | `string`                                                 | 是   | curated web 来源稳定 id；作为 payload `sourceId` 与默认 `documentId`。 |
| `url`        | URL string                                               | 是   | 原始网页 URL，会映射到 payload `uri`。                                 |
| `title`      | `string`                                                 | 是   | 网页标题或上游整理标题。                                               |
| `content`    | `string`                                                 | 是   | 已清洗文本内容。                                                       |
| `version`    | `string`                                                 | 否   | 上游抓取版本、etag 或时间戳。                                          |
| `curatedBy`  | `string`                                                 | 否   | 策展来源或团队，写入 `metadata.curatedBy`。                            |
| `trustClass` | `"curated" \| "official" \| "community" \| "unverified"` | 否   | curated web 信任等级；缺省 `curated`。                                 |
| `metadata`   | JSON object                                              | 否   | 额外 JSON-safe metadata；不得包含凭据、cookie、token 或 vendor raw。   |

### Connector Sync Adapter

`ConnectorSyncIngestionRequest` 字段：

| 字段      | 类型                   | 必填 | 说明                                                             |
| --------- | ---------------------- | ---- | ---------------------------------------------------------------- |
| `entries` | `ConnectorSyncEntry[]` | 是   | 已由上游 connector sync 完成鉴权、拉取、清洗和脱敏后的条目数组。 |

`ConnectorSyncEntry` 字段：

| 字段           | 类型                                                                   | 必填 | 说明                                                                                    |
| -------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| `connectorId`  | `string`                                                               | 是   | connector 稳定 id；payload `sourceId` 生成为 `connector-${connectorId}-${documentId}`。 |
| `documentId`   | `string`                                                               | 是   | connector 侧文档稳定 id；作为 payload `documentId`。                                    |
| `title`        | `string`                                                               | 是   | 同步文档标题。                                                                          |
| `content`      | `string`                                                               | 是   | 已清洗文本内容。                                                                        |
| `uri`          | `string`                                                               | 是   | connector 内部 URI 或来源 URL。                                                         |
| `version`      | `string`                                                               | 否   | 上游 connector 文档版本、etag 或同步时间戳。                                            |
| `capabilityId` | `string`                                                               | 否   | connector capability id，写入 `metadata.capabilityId`。                                 |
| `trustClass`   | `"official" \| "curated" \| "community" \| "unverified" \| "internal"` | 否   | connector sync 信任等级；缺省 `internal`。                                              |
| `metadata`     | JSON object                                                            | 否   | 额外 JSON-safe metadata；不得包含凭据、secret、token 或 vendor raw response。           |

Connector sync 当前不新增 `connector-sync` sourceType，而是复用正式 `connector-manifest` sourceType，并通过 `metadata.docType = "connector-sync"` 区分同步内容。

## 返回值

返回 `KnowledgeIndexingResult`：

- `runId`
- `loadedDocumentCount`
- `sourceCount`
- `indexedDocumentCount`
- `skippedDocumentCount`
- `chunkCount`
- `embeddedChunkCount`
- `fulltextChunkCount`
- `warningCount`
- `warnings`

## 错误语义

- 请求体不是对象、`payloads` 缺失、`payloads` 为空数组、字段不符合 schema 时返回 `400 Bad Request`，错误码为 `knowledge_ingestion_invalid_request`。
- user upload 请求体字段不符合 schema 时返回 `400 Bad Request`，错误码为 `knowledge_user_upload_invalid_request`。
- catalog sync 请求体字段不符合 schema、`entries` 为空或 `trustClass` 不在允许范围时返回 `400 Bad Request`，错误码为 `knowledge_catalog_sync_invalid_request`。
- web curated 请求体字段不符合 schema、`entries` 为空或 `url` 非合法 URL 时返回 `400 Bad Request`，错误码为 `knowledge_web_curated_invalid_request`。
- connector sync 请求体字段不符合 schema 或 `entries` 为空时返回 `400 Bad Request`，错误码为 `knowledge_connector_sync_invalid_request`。
- user upload `filePath` 解析后不在 `settings.workspaceRoot` 内、文件不存在或目标不是普通文件时，由 service 抛出稳定错误；调用方应先完成上传落盘和权限判定。
- RuntimeHost 没有提供 `settings` 或 `vectorIndexRepository` 时返回 framework 默认服务错误；这表示 backend composition root 未完成，不应由调用方重试绕过。
- provider / vector writer 的具体失败由 `RuntimeKnowledgeService` 委托链路抛出；controller 不包装第三方 raw error、SDK response 或凭据。

## 实现边界

- Controller 只做 HTTP 适配和 schema parse。
- `RuntimeKnowledgeService.ingestKnowledgeSources()` 是 backend 服务层调度入口。
- `RuntimeKnowledgeService.ingestUserUploadSource()` 是 user upload 文件读取 adapter，负责受控路径解析、文件内容读取、权限 metadata 映射和 builder 调用；它不负责 multipart upload、病毒扫描或对象存储下载。
- `RuntimeKnowledgeService.ingestCatalogSyncSources()` 是 catalog sync entry adapter，负责把上游已同步 catalog entries 映射为 payload；它不负责外部 catalog 拉取、租户鉴权或 vendor response 清洗。
- `RuntimeKnowledgeService.ingestWebCuratedSources()` 是 web curated entry adapter，负责把上游已抓取清洗的 URL 内容映射为 payload；它不负责网页抓取、robots / 版权策略判定、cookie 会话或正文清洗。
- `runtime-web-curated-ingestion-job.ts` 是 web curated 的最小来源 job 编排边界，负责通过注入的 `fetchUrl`、可选 `cleanContent` 与 `trustPolicy` 把 curated URL 来源转换成 `RuntimeKnowledgeService.ingestWebCuratedSources()` 可消费的 entries；真实 HTTP/MCP 抓取器、robots / 版权策略、cookie 会话和调度仍由上游注入。
- `RuntimeKnowledgeService.ingestConnectorSyncSources()` 是 connector sync entry adapter，负责把上游 connector 同步产物映射为 `connector-manifest` payload；它不负责 connector API 调用、凭据使用、分页同步或 vendor response 清洗。
- `@agent/knowledge` 的 `ingestKnowledgeSourcePayloads()` 是本地 runtime store 写入 facade，负责 source/chunk/receipt snapshot 与 vector writer fanout。
- `@agent/knowledge` 的 source ingestion payload builders 是来源产物进入本接口前的推荐规范化入口：user upload、catalog sync、web curated、connector sync 分别使用对应 builder 生成 payload。
- 具体来源 job 后续应复用本接口或同一 service 方法，不应直接写 `data/knowledge/*.json`。
