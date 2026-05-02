# Knowledge Frontend Core Operations Design

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`、`apps/backend/knowledge-server`、`packages/knowledge`
最后核对：2026-05-02

## 背景

`apps/frontend/knowledge` 当前已有独立前端、登录、工作台外壳、mock/真实 API client、知识库/文档/对话/观测/评测顶层页面和部分测试，但还没有完成生产级知识库核心运营闭环。现有缺口集中在知识库详情、文档详情、真实上传、处理 job 状态、chunk/embedding/indexing 结果展示，以及与 `knowledge-server` 的真实接口收口。

本设计聚焦第一条生产闭环：用户能在 Knowledge App 中创建知识库，上传 Markdown/TXT 文档，后端代理上传到阿里云 OSS，随后创建文档与异步 ingestion job，真实完成 parse、chunk、embedding、vector indexing 和 keyword/fulltext indexing，前端能展示处理状态、错误和 chunk 结果。

## 非目标

- 不做网页抓取、crawler、robots / 版权策略或抓取调度。
- 不做 PDF、DOCX、图片、表格等复杂文件解析。
- 不完成 Chat Lab/RAG 生成闭环、trace 深钻或 eval run 全流程。
- 不让前端直连 OSS，不在前端保存 OSS 凭据。
- 不让 `packages/knowledge` 读取 OSS 环境变量、数据库凭据或 provider secret。

## 用户路径

```text
login
-> knowledge bases
-> create knowledge base
-> knowledge base detail
-> upload .md / .txt
-> backend uploads file to OSS and returns upload result
-> frontend creates document from upload result
-> backend enqueues ingestion job
-> frontend polls job/document status
-> document becomes ready or failed
-> document detail shows metadata, job timeline, chunks, embedding and indexing status
```

## 方案选择

采用后端代理上传 OSS + 异步 ingestion job。

前端把文件上传给 `knowledge-server`，`knowledge-server` 负责上传到阿里云 OSS。上传接口只返回上传成功的链接和标识，不直接返回完整 document/job。随后前端调用创建文档接口，后端创建 document 和 ingestion job，再由 worker 异步处理。这样上传存储和知识库入库解耦，前端能明确展示“已上传但入库失败”这类中间状态。

选择异步 job 而不是同步处理，是因为本阶段要求真实 embedding 和 indexing。同步处理会让上传请求承载解析、模型调用、索引写入等长流程，容易超时，也不利于前端展示处理阶段和重试。

## 前端信息架构

### KnowledgeBasesPage

职责：

- 展示真实知识库列表。
- 提供创建知识库入口。
- 展示状态、文档数、chunk 数、ready/failed 统计、更新时间。
- 点击一行进入 `/knowledge-bases/:id`。

创建知识库 modal 第一阶段字段：

- `name`
- `description`
- `visibility`

### KnowledgeBaseDetailPage

新增路由：`/knowledge-bases/:id`

职责：

- 展示知识库摘要。
- 展示文档列表和处理中 job 摘要。
- 提供 `DocumentUploadPanel`。
- 支持点击文档进入 `/documents/:documentId`。

文档列表至少展示：

- title / filename
- source type
- status
- current stage
- chunk count
- embedded chunk count
- latest error
- updated at

### DocumentUploadPanel

职责：

- 只允许选择 `.md` / `.txt`。
- 调用上传接口，把文件传给 `knowledge-server`。
- 上传成功后展示 `filename`、`size`、`objectKey` 或脱敏 `ossUrl`。
- 自动调用创建文档接口，开始 ingestion。
- 如果创建文档失败，保留上传结果，允许基于同一 `uploadId/objectKey` 重试入库。

前端状态拆分：

```ts
type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'upload_failed';
type IngestionStatus = 'not_started' | 'queued' | 'running' | 'succeeded' | 'failed';
```

### DocumentDetailPage

新增路由：`/documents/:documentId`

职责：

- 展示 document metadata。
- 展示 OSS object key 的脱敏信息，不展示长期敏感签名。
- 展示最新 job timeline。
- 展示 chunk 列表、embedding 状态、vector indexing 状态、keyword indexing 状态。
- 失败时展示稳定错误码、stage 和 redacted message。
- 提供重新处理按钮。

## API Contract

第一阶段前端只调用 `knowledge-server`。base path 仍以 [Knowledge API Contract](/docs/contracts/api/knowledge.md) 为准。

### 上传到 OSS

```http
POST /api/knowledge/bases/:baseId/uploads
Content-Type: multipart/form-data
```

请求字段：

```ts
interface UploadKnowledgeFileRequest {
  file: File;
}
```

返回：

```ts
interface KnowledgeUploadResult {
  uploadId: string;
  knowledgeBaseId: string;
  filename: string;
  size: number;
  contentType: 'text/markdown' | 'text/plain';
  objectKey: string;
  ossUrl: string;
  uploadedAt: ISODateTime;
}
```

上传接口只承诺文件已写入 OSS，不承诺已创建 document、已解析或已可检索。

### 创建文档并启动 ingestion

```http
POST /api/knowledge/bases/:baseId/documents
Content-Type: application/json
```

请求：

```ts
interface CreateDocumentFromUploadRequest {
  uploadId: string;
  objectKey: string;
  filename: string;
  title?: string;
  metadata?: Record<string, unknown>;
}
```

返回：

```ts
interface CreateDocumentFromUploadResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}
```

### 查询与重试

```http
GET  /api/knowledge/bases/:baseId/documents
GET  /api/knowledge/documents/:documentId
GET  /api/knowledge/documents/:documentId/jobs/latest
GET  /api/knowledge/documents/:documentId/chunks
POST /api/knowledge/documents/:documentId/reprocess
```

## 后端边界

### UploadService

职责：

- 接收 multipart 文件。
- 校验用户对 knowledge base 的写权限。
- 校验 `.md` / `.txt`、MIME、大小。
- 生成 `uploadId` 和稳定 `objectKey`。
- 通过 `OssStorageProvider` 上传到阿里云 OSS。
- 返回 `KnowledgeUploadResult`。

不负责 parse、chunk、embedding 或 indexing。

### KnowledgeDocumentService

职责：

- 校验 upload 属于当前 knowledge base 和当前用户可访问范围。
- 创建 `KnowledgeDocument`。
- 创建 `DocumentProcessingJob`。
- 把 job 放入 ingestion queue。
- 提供 document、job、chunk 查询接口。

### IngestionWorker

异步执行：

```text
queued
-> parse
-> clean
-> chunk
-> embed
-> index_vector
-> index_keyword
-> commit
```

每个 stage 都写入 job timeline。失败时记录：

- stable error code
- stage
- redacted message
- occurredAt

worker 从 OSS 读取原始文件，复用 `packages/knowledge` 的 loader/chunker/indexing contract。OSS client、database repository、embedding provider、vector provider 和 keyword/fulltext provider 均由 `knowledge-server` 注入。

## 错误语义

上传错误：

- `knowledge_upload_invalid_type`
- `knowledge_upload_too_large`
- `knowledge_upload_oss_failed`
- `knowledge_upload_permission_denied`

入库错误：

- `knowledge_upload_not_found`
- `knowledge_document_create_failed`
- `knowledge_ingestion_enqueue_failed`

处理错误：

- `knowledge_parse_failed`
- `knowledge_chunk_failed`
- `knowledge_embedding_failed`
- `knowledge_index_failed`

所有错误必须是 redacted JSON-safe projection，不得暴露 OSS access key、bucket policy、签名 URL secret、provider raw error、SDK stack 或请求头。

## 轮询与重试

轮询策略：

- `queued` / `running`：每 2-3 秒刷新最新 job 和 document。
- `succeeded` / `failed`：停止轮询。
- 页面离开：停止轮询。
- 手动刷新：始终可用。

重试策略：

- 上传失败：用户重新选择文件并上传。
- 创建文档失败：保留 `KnowledgeUploadResult`，允许重试创建 document。
- ingestion 失败：用户点击重新处理，后端从同一 OSS `objectKey` 读取文件并创建新的 job。

## 测试计划

### Frontend

- API client path 测试：
  - upload file
  - create document from upload
  - get latest job
  - get chunks
  - reprocess document
- Hook 测试：
  - 上传成功后自动创建 document。
  - 创建失败时保留 upload result 并允许重试。
  - queued/running 时轮询，succeeded/failed 时停止。
- 页面测试：
  - knowledge base detail 展示上传入口和文档列表。
  - document detail 展示 timeline、chunk、embedding/indexing 状态和错误。
  - 无权限用户看不到上传和重试操作。

### Backend

- Controller contract 测试：
  - multipart 上传 Markdown/TXT。
  - 拒绝非法类型和超大文件。
  - 创建 document from upload。
  - 查询 latest job 和 chunks。
- Service 测试：
  - fake OSS provider 成功/失败。
  - fake repository 创建 document/job。
  - enqueue 失败时返回稳定错误。
- Worker 测试：
  - Markdown/TXT -> parse -> chunk -> embed -> vector index -> keyword index -> commit。
  - embedding/indexing 失败时 job 进入 failed 并记录 stage error。

### packages/knowledge

只补可复用 parse/chunk/indexing contract 或 helper 测试。不把 OSS client 或阿里云 SDK 放入 `packages/knowledge`。

## 验收标准

- 用户可以创建知识库。
- 用户可以上传 `.md` / `.txt` 到后端，后端上传到 OSS 并返回 `KnowledgeUploadResult`。
- 前端可展示“文件已上传到 OSS”。
- 前端自动或手动基于 upload result 创建 document。
- 后端创建 ingestion job 并异步处理。
- 前端可看到 job timeline 和当前 stage。
- 后端真实完成 parse、chunk、embedding、vector indexing 和 keyword/fulltext indexing。
- document 最终进入 `ready` 或 `failed`。
- 文档详情可展示 chunk、embedded count、indexing 状态和错误原因。
- failed job 可重新处理，且重试复用同一 OSS object key。
- 无权限用户不能上传或重试；前端隐藏操作，后端强校验。
- 本阶段不新增任何网页抓取入口。

## 实施拆分

1. 更新 API contract 与前端 provider contract。
2. 实现 `knowledge-server` OSS upload provider 与 upload endpoint。
3. 实现 document/job repository 与 create document from upload。
4. 实现 ingestion worker：parse、chunk、embed、index。
5. 实现前端 knowledge base detail、document detail、upload panel 和轮询 hook。
6. 补齐前后端测试和文档索引。
