# Knowledge API Contract

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`、`apps/backend/knowledge-server`、`apps/backend/agent-server/src/knowledge`、`packages/knowledge/client`
最后核对：2026-05-03

> 当前 canonical 业务入口：`apps/backend/knowledge-server`。`apps/backend/agent-server` 中仍存在的 knowledge 入口仅作为迁移期间兼容路径，不再承接新增 knowledge 主业务。

## 1. Base URL

第一阶段 canonical knowledge-server 接口以 `/api/knowledge` 为前缀。迁移期间旧 `agent-server` 兼容接口仍以 `/api/knowledge/v1` 为前缀。

## Backend Ownership

Knowledge API canonical endpoints are served by `apps/backend/knowledge-server`.
The frontend calls `VITE_KNOWLEDGE_SERVICE_BASE_URL`，默认 `http://127.0.0.1:3020/api`。
`apps/backend/agent-server/src/knowledge` 只保留迁移兼容路径。

受保护接口必须带：

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

上传接口使用 `multipart/form-data`。

## 2. Common Models

```ts
export type ID = string;
export type ISODateTime = string;

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ApiErrorDetailValue = string | number | boolean | null | string[] | number[];

export interface ApiErrorDetails {
  summary?: string;
  fields?: Record<string, string>;
  data?: Record<string, ApiErrorDetailValue>;
  itemIds?: ID[];
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: ApiErrorDetails;
  requestId?: string;
}
```

分页接口默认 `page=1`、`pageSize=20`，`pageSize` 最大为 `100`；超出范围时后端返回 `400 validation_error`。`score`、`rate`、`metrics` 字段默认使用 `0-1` 小数区间；面向产品展示的 `latestEvalScore`、`EvalReportSummary.*Score` 使用 `0-100` 分。

`ApiErrorResponse.details` 必须是 redacted JSON-safe projection，只能保存字段级错误、摘要、稳定枚举或资源 ID；不得透传 SDK error 对象、raw headers、request config、vendor response、provider stack、secret、token 或第三方原始错误对象。

## 3. Auth

登录使用 JWT 双 Token。前端把 `accessToken`、`refreshToken`、两个过期时间存入 localStorage。退出登录只删除本地 token。

```ts
export type WorkspaceRole = 'owner' | 'admin' | 'maintainer' | 'evaluator' | 'viewer';

export interface CurrentUser {
  id: ID;
  email: string;
  name?: string;
  avatarUrl?: string;
  currentWorkspaceId?: ID;
  roles: WorkspaceRole[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: CurrentUser;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
}

export interface MeResponse {
  user: CurrentUser;
}
```

`POST /auth/logout` 是 MVP no-op / optional endpoint：后端可以返回空成功响应，但不承诺撤销服务端 refresh token。前端退出登录以删除本地 `accessToken`、`refreshToken` 和过期时间为准。

Endpoint contract:

| Method | Path            | Query / Body                               | Response               | 主要错误码                                                                     | 权限               |
| ------ | --------------- | ------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------ | ------------------ |
| POST   | `/auth/login`   | body: `LoginRequest`                       | `LoginResponse`        | `auth_invalid_credentials`, `validation_error`                                 | public             |
| POST   | `/auth/refresh` | body: `RefreshTokenRequest`                | `RefreshTokenResponse` | `auth_refresh_token_expired`, `auth_refresh_token_invalid`, `validation_error` | public             |
| GET    | `/auth/me`      | none                                       | `MeResponse`           | `auth_unauthorized`, `auth_token_expired`                                      | authenticated user |
| POST   | `/auth/logout`  | optional body: `{ refreshToken?: string }` | `{ ok: true }`         | `auth_unauthorized`                                                            | authenticated user |

Auth errors:

- `auth_invalid_credentials`
- `auth_unauthorized`
- `auth_token_expired`
- `auth_refresh_token_expired`
- `auth_refresh_token_invalid`
- `auth_forbidden`

前端必须在 access token 过期前 60 秒主动刷新；业务接口返回 `401 auth_token_expired` 时，必须 refresh 并重试原请求一次。多个并发请求同时触发刷新时，必须共享同一个 refresh promise。

## 4. Dashboard

`GET /dashboard/overview`

```ts
export interface DashboardOverview {
  knowledgeBaseCount: number;
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  todayQuestionCount: number;
  averageLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  errorRate?: number;
  noAnswerRate?: number;
  negativeFeedbackRate?: number;
  latestEvalScore?: number;
  activeAlertCount: number;
  recentFailedJobs: DocumentProcessingJob[];
  recentLowScoreTraces: RagTrace[];
  recentEvalRuns: EvalRun[];
  topMissingKnowledgeQuestions: string[];
}
```

Endpoint contract:

| Method | Path                  | Query / Body | Response            | 主要错误码                            | 权限                     |
| ------ | --------------------- | ------------ | ------------------- | ------------------------------------- | ------------------------ |
| GET    | `/dashboard/overview` | none         | `DashboardOverview` | `auth_unauthorized`, `auth_forbidden` | owner, admin, maintainer |

## 5. KnowledgeBase

```ts
export type KnowledgeBaseStatus = 'active' | 'disabled' | 'archived';
export type KnowledgeBaseVisibility = 'private' | 'workspace' | 'public';
export type KnowledgeProviderHealthStatus = 'ok' | 'degraded' | 'unconfigured';
export type KnowledgeBaseHealthStatus = 'ready' | 'indexing' | 'degraded' | 'empty' | 'error';

export interface KnowledgeBaseHealth {
  knowledgeBaseId: ID;
  status: KnowledgeBaseHealthStatus;
  documentCount: number;
  searchableDocumentCount: number;
  chunkCount: number;
  failedJobCount: number;
  lastIndexedAt?: ISODateTime;
  lastQueriedAt?: ISODateTime;
  providerHealth: {
    embedding: KnowledgeProviderHealthStatus;
    vector: KnowledgeProviderHealthStatus;
    keyword: KnowledgeProviderHealthStatus;
    generation: KnowledgeProviderHealthStatus;
  };
  warnings: Array<{ code: string; message: string }>;
}

export interface KnowledgeBase {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  icon?: string;
  tags: string[];
  visibility: KnowledgeBaseVisibility;
  status: KnowledgeBaseStatus;
  documentCount: number;
  chunkCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  latestEvalScore?: number;
  latestQuestionCount?: number;
  latestTraceAt?: ISODateTime;
  defaultRetrievalConfigId?: ID;
  defaultPromptTemplateId?: ID;
  health?: KnowledgeBaseHealth;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  tags?: string[];
  visibility: KnowledgeBaseVisibility;
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: KnowledgeBaseVisibility;
  status?: KnowledgeBaseStatus;
  defaultRetrievalConfigId?: ID;
  defaultPromptTemplateId?: ID;
}
```

Endpoint contract:

| Method | Path                   | Query / Body                                   | Response                    | 主要错误码                                                                            | 权限                                        |
| ------ | ---------------------- | ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| GET    | `/knowledge-bases`     | query: `PageQuery`                             | `PageResult<KnowledgeBase>` | `auth_unauthorized`, `auth_forbidden`, `validation_error`                             | owner, admin, maintainer, evaluator, viewer |
| POST   | `/knowledge-bases`     | body: `CreateKnowledgeBaseRequest`             | `KnowledgeBase`             | `auth_unauthorized`, `auth_forbidden`, `validation_error`, `kb_name_conflict`         | owner, admin, maintainer                    |
| GET    | `/knowledge-bases/:id` | path: `id`                                     | `KnowledgeBase`             | `auth_unauthorized`, `auth_forbidden`, `knowledge_base_not_found`                     | owner, admin, maintainer, evaluator, viewer |
| PATCH  | `/knowledge-bases/:id` | path: `id`; body: `UpdateKnowledgeBaseRequest` | `KnowledgeBase`             | `auth_unauthorized`, `auth_forbidden`, `knowledge_base_not_found`, `validation_error` | owner, admin, maintainer                    |

### 5.1 Knowledge Base Health

`GET /api/knowledge/bases` and `GET /api/knowledge/bases/:id` may return each base with optional `health`.

`health.status` is the backend-owned readiness projection: `ready | indexing | degraded | empty | error`. Clients must display it and must not infer readiness from local document counts alone.

`health.providerHealth.embedding/vector/keyword/generation` is a stable provider health map with values `ok | degraded | unconfigured`. It is a project projection, not a vendor SDK status object.

`health.warnings[]` contains stable `{ code, message }` pairs. Warning `code` values are intended for filtering and alert grouping; warning `message` values are display-safe and redacted.

## 6. Document and Chunk

```ts
export type DocumentSourceType =
  | 'user-upload'
  | 'web-url'
  | 'catalog-sync'
  | 'connector-sync'
  | 'workspace-docs'
  | 'repo-docs';

export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'parsing'
  | 'cleaning'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'disabled'
  | 'deprecated';

export interface KnowledgeDocument {
  id: ID;
  workspaceId: ID;
  knowledgeBaseId: ID;
  title: string;
  filename?: string;
  sourceType: DocumentSourceType;
  uri?: string;
  mimeType?: string;
  status: DocumentStatus;
  version: string;
  chunkCount: number;
  embeddedChunkCount: number;
  tokenCount?: number;
  latestJobId?: ID;
  latestError?: ProcessingErrorSummary;
  metadata?: Record<string, unknown>;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DocumentProcessingStage =
  | 'uploaded'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type LegacyDocumentProcessingStage =
  | 'queued'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'commit';

export type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ProcessingErrorSummary {
  code: string;
  message: string;
  retryable?: boolean;
  stage?: DocumentProcessingStage;
}

export interface DocumentProcessingStageRecord {
  stage: LegacyDocumentProcessingStage;
  status: ProcessingJobStatus;
  latencyMs?: number;
  error?: ProcessingErrorSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
}

export interface DocumentProcessingJob {
  id: ID;
  documentId: ID;
  status: ProcessingJobStatus;
  stage: DocumentProcessingStage;
  currentStage?: LegacyDocumentProcessingStage;
  stages: DocumentProcessingStageRecord[];
  progress: {
    percent: number;
    processedChunks?: number;
    totalChunks?: number;
  };
  error?: ProcessingErrorSummary;
  attempts: number;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export type ChunkStatus = 'ready' | 'failed' | 'disabled' | 'deprecated';

export interface DocumentChunk {
  id: ID;
  documentId: ID;
  knowledgeBaseId: ID;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  status: ChunkStatus;
  embeddingModel?: string;
  embeddingStatus?: 'missing' | 'ready' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface KnowledgeUploadResult {
  uploadId: ID;
  knowledgeBaseId: ID;
  filename: string;
  size: number;
  contentType: 'text/markdown' | 'text/plain';
  objectKey: string;
  ossUrl: string;
  uploadedAt: ISODateTime;
}

export interface EmbeddingModelOption {
  id: ID;
  name: string;
  provider: string;
  dimension?: number;
  description?: string;
  status?: 'active' | 'disabled' | 'available' | 'unconfigured' | 'degraded';
}

export interface UploadKnowledgeFileRequest {
  knowledgeBaseId: ID;
  file: File;
}

export interface CreateDocumentFromUploadRequest {
  uploadId: ID;
  objectKey: string;
  filename: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentFromUploadResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface DocumentChunksResponse {
  items: DocumentChunk[];
  total: number;
}
```

`web-url` 是 Knowledge App 文档元数据里的来源枚举，用于承载人工策展或外部系统已经整理好的 URL 内容；当前知识库不建设真实网页抓取链路。进入 retrieval/runtime 前，API 层来源仍需由 host 映射到正式 `KnowledgeSource.sourceType`，例如 curated URL 内容映射为 `web-curated`。

### 6.1 Two-step Markdown/TXT upload

当前生产闭环只支持 Markdown/TXT 文件上传，不做网页抓取，也不支持 PDF/DOCX 等复杂文件解析。前端不得直连 OSS；前端只把文件提交给 `knowledge-server`，由后端代理上传到 OSS 并返回 `KnowledgeUploadResult`。

Step 1：上传原始文件到 OSS。

```http
POST /api/knowledge/bases/:baseId/uploads
Content-Type: multipart/form-data
```

Multipart fields:

| Field  | Type | Required | Notes                                                          |
| ------ | ---- | -------- | -------------------------------------------------------------- |
| `file` | File | yes      | 仅接受 `.md` / `.txt`；MIME 为 `text/markdown` 或 `text/plain` |

Response: `KnowledgeUploadResult`

该接口只承诺原始文件已写入 OSS，不承诺已创建 document、已解析、已切块、已 embedding 或已可检索。

Step 2：基于 upload result 创建 document 并启动 ingestion job。

```http
POST /api/knowledge/bases/:baseId/documents
Content-Type: application/json
```

Body: `CreateDocumentFromUploadRequest`

Response: `CreateDocumentFromUploadResponse`

`uploadId` 与 `objectKey` 必须指向同一个 knowledge base 下由 Step 1 产生的上传结果。后端负责校验上传归属、当前用户权限、文件类型、幂等/冲突语义，并创建 `KnowledgeDocument` 与初始 `DocumentProcessingJob`。

前端上传页必须通过上传弹窗显式展示目标 knowledge base 与 embedding model 选择，不能把这些选择器常驻在文档列表顶部。当前横向 MVP 允许把 `embeddingModelId` 放入 `CreateDocumentFromUploadRequest.metadata.embeddingModelId`，由后端保存为 document metadata；后续接入真实异步 embedding provider 时应继续使用同一 display contract，不让 provider secret、SDK response 或向量细节穿透到前端。

`DocumentProcessingJob.progress.percent` 是前端进度条的稳定投影，取值范围 `0-100`。文档列表 Table 必须以行内进度列展示每个 document 的线上处理进度；上传弹窗内的进度只表示当前文件选择/上传动作。同步 MVP 会按 `parsing/chunking/embedding/indexing/succeeded` 写入 `15/35/60/85/100`，异步实现必须按稳定 `stage` 保持单调推进。`processedChunks` 与 `totalChunks` 只用于展示，不作为前端判断任务终态的依据；终态仍以 `status` 为准。`currentStage` 和 `stages[].stage` 是 legacy 投影，保留给旧 UI；新 UI 默认读取 `stage/progress/error/attempts`。

失败 job 的 `error` 必须包含稳定 `code/message/stage`，可重试失败还必须包含 `retryable: true`。当前 embedding / indexing 失败分别返回 `knowledge_ingestion_embedding_failed` 与 `knowledge_ingestion_index_failed`；`POST /documents/:documentId/reprocess` 必须创建新的 job id，并把 `attempts` 设置为上一条 job attempts + 1。

### 6.2 Ingestion Job Projection

`GET /api/knowledge/documents/:documentId/jobs/latest` returns stageful job progress.

Stable stages are `uploaded`, `parsing`, `chunking`, `embedding`, `indexing`, `succeeded`, `failed`, and `cancelled`. Legacy timeline stages may still be returned under `currentStage` and `stages[]`, but new UI must read `stage`, `progress`, `error`, and `attempts`.

Failed jobs include `error.code`, `error.message`, `error.retryable`, and `error.stage`. Retryable failures expose `retryable: true`; clients may show a retry action, but recovery must call `POST /api/knowledge/documents/:documentId/reprocess` so the backend creates a new attempt.

`POST /chat` 的 Chat Lab 响应在 legacy `answer/citations/traceId` 外还返回 `route` 与 `diagnostics`。`route.reason` 使用稳定枚举 `legacy-ids | mentions | metadata-match | fallback-all`；`diagnostics.retrievalMode` 使用 `hybrid | none` 作为当前 MVP 展示投影。`citations` 只能来自后端 retrieval/vector hit 投影，模型生成阶段返回的自带 citation 不得穿透到响应。

Eval run 的最小后端语义是“部分失败可交付”：单个 case 失败时，`status` 返回 `partial`，`results` 保留成功 case 的 `KnowledgeEvalRunResult`，`failedCases[]` 记录 `{ caseId, code, message }`，其中 code 固定为 `knowledge_eval_run_failed`。全部成功为 `completed`，全部失败为 `failed`。

Endpoint contract:

| Method | Path                                   | Query / Body                                                              | Response                                                                  | 主要错误码                                                                                                                                                                                    | 权限                                        |
| ------ | -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| GET    | `/documents`                           | query: `PageQuery & { knowledgeBaseId?: ID; status?: DocumentStatus }`    | `PageResult<KnowledgeDocument>`                                           | `auth_unauthorized`, `auth_forbidden`, `validation_error`                                                                                                                                     | owner, admin, maintainer, evaluator, viewer |
| GET    | `/knowledge/embedding-models`          | none                                                                      | `PageResult<EmbeddingModelOption>` 或 `{ items: EmbeddingModelOption[] }` | `auth_unauthorized`, `auth_forbidden`                                                                                                                                                         | owner, admin, maintainer                    |
| GET    | `/knowledge/documents/:id`             | path: `id`                                                                | `KnowledgeDocument`                                                       | `auth_unauthorized`, `auth_forbidden`, `document_not_found`                                                                                                                                   | owner, admin, maintainer, evaluator, viewer |
| POST   | `/knowledge/bases/:id/uploads`         | path: `id`; multipart fields: `file`                                      | `KnowledgeUploadResult`                                                   | `auth_unauthorized`, `auth_forbidden`, `knowledge_base_not_found`, `knowledge_upload_invalid_type`, `knowledge_upload_too_large`, `knowledge_upload_oss_failed`, `validation_error`           | owner, admin, maintainer                    |
| POST   | `/knowledge/bases/:id/documents`       | path: `id`; body: `CreateDocumentFromUploadRequest`                       | `CreateDocumentFromUploadResponse`                                        | `auth_unauthorized`, `auth_forbidden`, `knowledge_base_not_found`, `knowledge_upload_not_found`, `knowledge_document_create_failed`, `knowledge_ingestion_enqueue_failed`, `validation_error` | owner, admin, maintainer                    |
| GET    | `/knowledge/documents/:id/jobs/latest` | path: `id`                                                                | `DocumentProcessingJob`                                                   | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `document_job_not_found`                                                                                                         | owner, admin, maintainer                    |
| GET    | `/documents/:id/jobs`                  | path: `id`; query: `PageQuery`                                            | `PageResult<DocumentProcessingJob>`                                       | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `validation_error`                                                                                                               | owner, admin, maintainer                    |
| GET    | `/knowledge/documents/:id/chunks`      | path: `id`; query: `PageQuery`                                            | `DocumentChunksResponse`                                                  | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `validation_error`                                                                                                               | owner, admin, maintainer, evaluator, viewer |
| POST   | `/knowledge/documents/:id/reprocess`   | path: `id`; optional body: `{ reason?: string }`                          | `ReprocessDocumentResponse`                                               | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `document_job_conflict`                                                                                                          | owner, admin, maintainer                    |
| DELETE | `/knowledge/documents/:id`             | path: `id`                                                                | `DeleteDocumentResponse`                                                  | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `knowledge_permission_denied`                                                                                                    | owner, admin, maintainer                    |
| POST   | `/documents/:id/reembed`               | path: `id`; optional body: `{ embeddingModel?: string; reason?: string }` | `DocumentProcessingJob`                                                   | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `document_job_conflict`                                                                                                          | owner, admin, maintainer                    |
| POST   | `/documents/:id/disable`               | path: `id`; optional body: `{ reason?: string }`                          | `KnowledgeDocument`                                                       | `auth_unauthorized`, `auth_forbidden`, `document_not_found`                                                                                                                                   | owner, admin, maintainer                    |

Legacy single-step upload response retained for migration-only callers:

```ts
export interface UploadDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface ReprocessDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface DeleteDocumentResponse {
  ok: true;
}
```

## 7. Chat, Citation, Feedback

```ts
export interface Citation {
  id: ID;
  documentId: ID;
  chunkId: ID;
  title: string;
  uri?: string;
  quote: string;
  text?: string;
  contentPreview?: string;
  score?: number;
  rank?: number;
  page?: number;
  metadata?: {
    title?: string;
    sourceUri?: string;
    tags?: string[];
  };
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type OpenAIChatMessageRole = 'developer' | 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIChatTextContentPart {
  type: 'text';
  text: string;
}

export interface OpenAIChatMessage {
  role: OpenAIChatMessageRole;
  content: string | OpenAIChatTextContentPart[];
}

export interface KnowledgeChatMention {
  type: 'knowledge_base';
  id?: ID;
  label?: string;
}

export interface ChatMessage {
  id: ID;
  conversationId: ID;
  role: ChatMessageRole;
  content: string;
  citations?: Citation[];
  traceId?: ID;
  route?: KnowledgeChatRoute;
  diagnostics?: KnowledgeChatDiagnostics;
  feedback?: MessageFeedbackSummary;
  createdAt: ISODateTime;
}

export interface ChatRequest {
  /**
   * OpenAI Chat Completions compatible request surface. `model` is accepted
   * for API shape compatibility. Backend model/provider selection is owned by
   * the Knowledge SDK runtime provider, not by browser-side secrets.
   */
  model?: string;
  messages?: OpenAIChatMessage[];
  metadata?: {
    conversationId?: ID;
    knowledgeBaseId?: ID;
    knowledgeBaseIds?: ID[] | string;
    mentions?: KnowledgeChatMention[];
    debug?: boolean | string;
  };
  stream?: false;
  /**
   * Legacy compatibility fields. New frontend callers must prefer
   * model/messages/metadata.
   */
  conversationId?: ID;
  knowledgeBaseId?: ID;
  knowledgeBaseIds?: ID[];
  message?: string;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  debug?: boolean;
}

export interface ChatResponse {
  conversationId: ID;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  answer: string;
  citations: Citation[];
  traceId: ID;
  route?: KnowledgeChatRoute;
  diagnostics?: KnowledgeChatDiagnostics;
  retrieval?: {
    matches: Citation[];
    topK: number;
  };
  usage?: TokenUsage;
}

export interface KnowledgeChatRoute {
  requestedMentions: string[];
  selectedKnowledgeBaseIds: ID[];
  reason: 'legacy-ids' | 'mentions' | 'metadata-match' | 'fallback-all';
}

export interface KnowledgeChatDiagnostics {
  normalizedQuery: string;
  queryVariants: string[];
  retrievalMode: 'keyword-only' | 'vector-only' | 'hybrid' | 'none';
  hitCount: number;
  contextChunkCount: number;
}

export interface RagModelProfileSummary {
  id: ID;
  label: string;
  description?: string;
  useCase: 'coding' | 'daily' | 'balanced';
  enabled: boolean;
}

export interface KnowledgeChatConversation {
  id: ID;
  userId: ID;
  title: string;
  activeModelProfileId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type FeedbackCategory =
  | 'helpful'
  | 'not_helpful'
  | 'wrong_citation'
  | 'hallucination'
  | 'missing_knowledge'
  | 'too_slow'
  | 'unsafe'
  | 'other';

export interface MessageFeedbackSummary {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
}

export interface CreateFeedbackRequest {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
}
```

`POST /chat` 的请求面优先对齐 OpenAI Chat Completions：客户端传 `model`、`messages` 和 `metadata`，后端从最后一条 `role: "user"` 的 message 归一化出查询文本。新 Chat Lab 只发送 `metadata.conversationId`、`metadata.debug` 和从文本 `@知识库名` 中解析出的 `metadata.mentions`，不再发送 `metadata.knowledgeBaseIds`；检索范围由后端在检索前根据 mention、问题内容和可访问 knowledge base 元信息决定。`metadata.knowledgeBaseIds` 可为数组或逗号分隔字符串，仅保留迁移兼容；这是 knowledge server 的扩展字段，不得透传给 OpenAI provider。`stream: true` 已支持 Server-Sent Events；服务端会发送 SDK RAG event，包括 `planner.completed`、`retrieval.completed`、`answer.delta`、`answer.completed`、`rag.completed` 和 `rag.error`。客户端必须把 `rag.completed.result` 视为最终 answer projection；非 delta 场景仍可能只有 `answer.completed` 和 `rag.completed`，不保证每次都有 token delta。旧字段 `conversationId`、`knowledgeBaseId`、`knowledgeBaseIds`、`message` 仅保留迁移兼容，新前端不得继续发送旧 payload。

```json
{
  "model": "knowledge-rag",
  "messages": [{ "role": "user", "content": "core包如何设计的" }],
  "metadata": {
    "conversationId": "frontend",
    "debug": true,
    "mentions": [{ "type": "knowledge_base", "label": "前端知识库" }]
  },
  "stream": true
}
```

`ChatRequest.metadata.debug` 在 MVP 后端可以忽略；如启用，仅对 `owner`、`admin`、`maintainer` 生效，且不得改变 trace、citation、error、span payload 的 redaction 边界。

当前 `knowledge-server` 横向 MVP 的 `POST /chat` 已从纯 fixture 回声改为 SDK RAG：检索前通过 `@agent/knowledge` 的 `resolveKnowledgeChatRoute()` 解析路由，兼容 `knowledgeBaseIds` 优先；其次用 `metadata.mentions` 按知识库 id / name 绑定范围；没有 mention 时，用问题 tokens 与可访问知识库 `name` / `description` / metadata 做 deterministic metadata routing；仍无命中时回退检索当前用户全部可访问知识库。随后 service 校验目标知识库 membership。`model` 传入 `RagModelProfileSummary.id`；`knowledge-rag` / `knowledge-default` 仅作为默认兼容 alias。`KnowledgeRagService` 会在 RAG 执行前创建或复用当前用户 conversation，先持久化 user message；非流式成功或 SSE `rag.completed` 后持久化 assistant message，包含 answer、citations、route、diagnostics、traceId 和 modelProfileId。`KNOWLEDGE_SDK_RUNTIME.enabled=true` 时，后端调用 SDK 默认 runtime：`embeddingProvider.embedText()` 生成 query embedding，`vectorStore.search()` 访问 Supabase/PostgreSQL pgvector，`chatProvider.generate()` 调用 OpenAI-compatible 大模型生成回答。`KNOWLEDGE_SDK_RUNTIME.enabled=false` 时仅保留 repository-backed deterministic fallback，用于本地测试和 demo。空 user message 返回稳定 `400 knowledge_chat_message_required`；显式 mention 找不到可访问知识库返回 `400 knowledge_mention_not_found`；缺失 base 返回 `404 knowledge_base_not_found`；未授权 base 返回 `403 knowledge_permission_denied`；禁用或不存在的 model profile 返回 `rag_model_profile_disabled` / `rag_model_profile_not_found`；SDK embedding/vector/generation 失败返回 `503 knowledge_chat_failed`。当前 MVP 的 traceId 是稳定显示线索，observability 仍可先保持空投影，后续再接真实 trace repository。

Chat citation 必须是稳定 display projection，不得透传完整 chunk 文本或原始 metadata。当前 MVP 保留 `chunkId`、`documentId`、`text`、`quote`、`title`、`score`、`rank` 等前端字段，其中 `text` / `quote` / `contentPreview` 分别最多 240 / 160 / 120 字符；`metadata` 仅允许 `title`、`sourceUri`、`tags`，不得包含 `raw`、`vendor`、`embedding`、`secret`、`token`、`password` 等敏感或大字段。

Chat Lab 前端必须把 `citations` 展示为引用卡片，而不是只展示标题列表。每张卡片至少展示 `title`、`quote` 或 `contentPreview`、`score` 或 `uri`，并保留 trace link 与 feedback 操作。`POST /messages/:id/feedback` 当前 MVP 返回带 `feedback` 的 assistant message projection，用于验证反馈按钮真实模式不再 404；它不承诺已经接入长期反馈仓储。

### 7.1 Chat Lab RAG Answer

`POST /api/chat` returns `answer`, grounded `citations`, `route`, `diagnostics`, `traceId`, and optional `usage`.

`route` explains why the backend selected the retrieval scope. `diagnostics` is a redacted display projection for normalized query, query variants, retrieval mode, hit count, and assembled context chunk count.

Citations are service-generated from retrieval hits. Clients must not trust model-invented citation IDs, model-authored source references, or vendor-specific citation objects.

Endpoint contract:

| Method | Path                          | Query / Body                                           | Response                                | 主要错误码                                                                                                                                                                                                      | 权限                                        |
| ------ | ----------------------------- | ------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| POST   | `/chat`                       | body: `ChatRequest`                                    | `ChatResponse`                          | `auth_unauthorized`, `auth_forbidden`, `validation_error`, `knowledge_chat_message_required`, `knowledge_mention_not_found`, `knowledge_base_not_found`, `knowledge_permission_denied`, `knowledge_chat_failed` | owner, admin, maintainer, evaluator, viewer |
| GET    | `/rag/model-profiles`         | none                                                   | `{ items: RagModelProfileSummary[] }`   | `auth_unauthorized`, `auth_forbidden`                                                                                                                                                                           | owner, admin, maintainer, evaluator, viewer |
| GET    | `/conversations`              | query: `PageQuery`                                     | `PageResult<KnowledgeChatConversation>` | `auth_unauthorized`, `auth_forbidden`, `validation_error`                                                                                                                                                       | owner, admin, maintainer, evaluator, viewer |
| GET    | `/conversations/:id/messages` | path: `id`; query: `PageQuery`                         | `PageResult<ChatMessage>`               | `auth_unauthorized`, `auth_forbidden`, `conversation_not_found`, `validation_error`                                                                                                                             | owner, admin, maintainer, evaluator, viewer |
| POST   | `/messages/:id/feedback`      | path: `id`; body: `CreateFeedbackRequest`              | `ChatMessage`                           | `auth_unauthorized`, `auth_forbidden`, `message_not_found`, `validation_error`                                                                                                                                  | owner, admin, maintainer, evaluator, viewer |
| POST   | `/messages/:id/add-to-eval`   | path: `id`; body: `{ datasetId: ID; tags?: string[] }` | `EvalCase`                              | `auth_unauthorized`, `auth_forbidden`, `message_not_found`, `eval_dataset_not_found`, `validation_error`                                                                                                        | owner, admin, maintainer, evaluator         |

## 8. Observability

```ts
export type TraceStatus = 'running' | 'succeeded' | 'failed' | 'canceled';

export type TraceSpanStage =
  | 'query_rewrite'
  | 'embedding'
  | 'keyword_search'
  | 'vector_search'
  | 'hybrid_merge'
  | 'rerank'
  | 'context_assembly'
  | 'generation'
  | 'citation_check'
  | 'eval_judge';

/**
 * Repository-backed MVP traces may not yet normalize every span into the
 * canonical TraceSpanStage enum. When `stage` is missing, the backend uses
 * the span `name` as the display/aggregation key.
 */
export type TraceSpanStageKey = TraceSpanStage | string;

export interface RetrievalHitPreview {
  chunkId: ID;
  documentId: ID;
  title: string;
  contentPreview: string;
  score?: number;
  rank: number;
}

export interface RetrievalSnapshot {
  rewrittenQuery?: string;
  vectorHits: RetrievalHitPreview[];
  keywordHits: RetrievalHitPreview[];
  mergedHits: RetrievalHitPreview[];
  rerankedHits: RetrievalHitPreview[];
  selectedChunks: RetrievalHitPreview[];
}

export type TraceSpanPayloadScalar = string | number | boolean | null;

export interface TraceSpanPayloadSummary {
  summary?: string;
  data?: Record<string, TraceSpanPayloadScalar | string[] | number[]>;
  itemIds?: ID[];
}

export interface StageLatencyMetric {
  stage: TraceSpanStageKey;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export interface ObservabilityMetrics {
  traceCount: number;
  questionCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  timeoutRate: number;
  noAnswerRate: number;
  negativeFeedbackRate: number;
  citationClickRate: number;
  stageLatency: StageLatencyMetric[];
}

export interface RagTrace {
  id: ID;
  workspaceId: ID;
  conversationId?: ID;
  messageId?: ID;
  knowledgeBaseIds: ID[];
  question: string;
  answer?: string;
  status: TraceStatus;
  latencyMs?: number;
  hitCount?: number;
  citationCount?: number;
  feedbackRating?: 'positive' | 'negative';
  createdBy?: ID;
  createdAt: ISODateTime;
}

export interface RagTraceSpan {
  id: ID;
  traceId: ID;
  stage: TraceSpanStageKey;
  name: string;
  status: TraceStatus;
  latencyMs?: number;
  input?: TraceSpanPayloadSummary;
  output?: TraceSpanPayloadSummary;
  error?: ApiErrorResponse;
  startedAt?: ISODateTime;
  endedAt?: ISODateTime;
}

export interface RagTraceDetail extends RagTrace {
  spans: RagTraceSpan[];
  citations: Citation[];
  retrievalSnapshot?: RetrievalSnapshot;
  usage?: TokenUsage;
}
```

Trace display 字段必须是 redacted display projection：`RagTrace.question` 和 `RagTrace.answer` 最长 `2000` 字符；`RetrievalHitPreview.contentPreview`、`Citation.quote`、`TraceSpanPayloadSummary.summary` 最长 `500` 字符。当前 repository-backed MVP 的 trace metadata 只保存 `questionPreview`、`answerPreview`、`createdBy` 与 `citationSummaries`，不保存完整原始 question / answer / citations。所有展示字段都必须先脱敏、截断和去除 secret，不得包含 token、service role key、provider API key、密码、完整 prompt、完整 context、vendor raw request / response、raw headers、provider SDK 对象或第三方错误原始对象。

`RagTraceSpan.input` 与 `RagTraceSpan.output` 只能保存稳定 redacted projection，不得透传 vendor raw request / response、raw headers、prompt 原文、完整检索上下文、provider SDK 对象或第三方错误原始对象。

当前后端横向 MVP 的 observability 已从静态 fixture 切到 repository trace projection：`GET /observability/metrics`、`GET /observability/traces`、`GET /observability/traces/:id` 优先读取 `operation: "rag.chat"` trace；未装配 repository / observability service 的旧路径仍允许 fixture fallback。API 返回 DTO，不透传 repository raw record。projection 只使用 trace 稳定字段和 metadata 中的 `questionPreview`、`answerPreview`、`citationSummaries`、`createdBy`。`spans` 只投影 `id`、`stage` / `name`、`status`、`latencyMs`、`startedAt`、`endedAt` 等稳定显示字段；`retrievalSnapshot.selectedChunks` 与 `citations` 从 `citationSummaries` 生成。

Metrics 计算规则：无 trace 时 `traceCount`、`questionCount`、延迟、rate 指标全部为 `0` 且 `stageLatency` 为空数组；`p95LatencyMs` / `p99LatencyMs` 使用 nearest-rank，对升序样本取 `ceil(percentile * n) - 1`；`stageLatency` 按 span `stage` 聚合，缺少 `stage` 时按 span `name` 聚合。`citationClickRate` 当前 MVP 固定为 `0`，后续由真实点击事件补齐。

Endpoint contract:

| Method | Path                        | Query / Body                                                                                              | Response               | 主要错误码                                                | 权限                     |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------- | ------------------------ |
| GET    | `/observability/metrics`    | query: `{ knowledgeBaseId?: ID; from?: ISODateTime; to?: ISODateTime }`                                   | `ObservabilityMetrics` | `auth_unauthorized`, `auth_forbidden`, `validation_error` | owner, admin, maintainer |
| GET    | `/observability/traces`     | query: `PageQuery & { knowledgeBaseId?: ID; status?: TraceStatus; from?: ISODateTime; to?: ISODateTime }` | `PageResult<RagTrace>` | `auth_unauthorized`, `auth_forbidden`, `validation_error` | owner, admin, maintainer |
| GET    | `/observability/traces/:id` | path: `id`                                                                                                | `RagTraceDetail`       | `auth_unauthorized`, `auth_forbidden`, `trace_not_found`  | owner, admin, maintainer |

## 9. Eval

```ts
export type EvalDifficulty = 'easy' | 'medium' | 'hard';
export type EvalRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'canceled';

export interface EvalDataset {
  id: ID;
  workspaceId: ID;
  tenantId?: ID;
  name: string;
  description?: string;
  tags: string[];
  caseCount: number;
  cases?: EvalCase[];
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EvalCase {
  id: ID;
  datasetId?: ID;
  question: string;
  expectedAnswer?: string;
  referenceAnswer?: string;
  expectedDocumentIds: ID[];
  expectedChunkIds: ID[];
  tags: string[];
  difficulty: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface CreateEvalDatasetRequest {
  name: string;
  description?: string;
  tags?: string[];
  cases?: CreateEvalCaseRequest[];
  tenantId?: ID; // ignored by public backend API; server context wins
  createdBy?: ID; // ignored by public backend API; server context wins
}

export interface CreateEvalCaseRequest {
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds?: ID[];
  expectedChunkIds?: ID[];
  tags?: string[];
  difficulty?: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
}

export interface EvalReportSummary {
  totalScore?: number;
  retrievalScore?: number;
  generationScore?: number;
  citationScore?: number;
  regressionDelta?: number;
}

export interface EvalRun {
  id: ID;
  workspaceId: ID;
  tenantId?: ID;
  datasetId: ID;
  knowledgeBaseIds: ID[];
  knowledgeBaseId?: ID;
  status: EvalRunStatus;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  modelConfigId?: ID;
  caseCount: number;
  completedCaseCount: number;
  failedCaseCount: number;
  summary?: EvalReportSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

export interface CreateEvalRunRequest {
  datasetId: ID;
  knowledgeBaseIds?: ID[];
  knowledgeBaseId?: ID;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  modelConfigId?: ID;
  tenantId?: ID; // ignored by public backend API; server context wins
  createdBy?: ID; // ignored by public backend API; server context wins
}

export interface RetrievalMetrics {
  recallAtK?: number;
  precisionAtK?: number;
  mrr?: number;
  ndcg?: number;
}

export interface GenerationMetrics {
  faithfulness?: number;
  answerRelevance?: number;
  citationAccuracy?: number;
  hallucinationRisk?: number;
}

export interface JudgeResult {
  score: number;
  reason: string;
  labels?: string[];
}

export type EvalFailureCategory =
  | 'not_retrieved'
  | 'ranked_too_low'
  | 'context_truncated'
  | 'unsupported_citation'
  | 'hallucination'
  | 'irrelevant_answer'
  | 'prompt_failure'
  | 'provider_error';

export interface EvalCaseResult {
  id: ID;
  runId: ID;
  caseId: ID;
  status: 'succeeded' | 'failed';
  question?: string;
  actualAnswer?: string;
  retrievedChunkIds?: ID[];
  citations: Citation[];
  traceId?: ID;
  retrievalMetrics?: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  judgeResult?: JudgeResult;
  failureCategory?: EvalFailureCategory;
  error?: ApiErrorResponse;
}

export interface CompareEvalRunsRequest {
  baselineRunId: ID;
  candidateRunId: ID;
  tenantId?: ID; // ignored by public backend API; server context wins
}

export interface CompareEvalRunsResponse {
  baselineRunId: ID;
  candidateRunId: ID;
  totalScoreDelta: number;
  retrievalScoreDelta: number;
  generationScoreDelta: number;
  perMetricDelta: Record<string, number>;
}
```

当前 repository-backed MVP 说明：

- `POST /eval/datasets` 支持在创建 dataset 时内联 `cases`；`POST /eval/datasets/:id/cases` 仍是纵向接口规划，当前后端 MVP 尚未单独接线。
- 公开 API 会忽略 body 中的 `tenantId` / `createdBy`，服务端 MVP 固定使用 `ws_1` / `user_demo`。内部 service 仍支持显式 tenant，用于任务编排和测试。
- `POST /eval/runs` 当前同步执行 dataset cases，逐 case 调用可替换 `KnowledgeEvalRunner.answerCase()` 与 `KnowledgeEvalJudge.judge()`，最终返回 `succeeded` 或 `failed` run；后续可替换为异步队列。
- retrieval metrics 为 `recallAtK`、`precisionAtK`、`mrr`、`ndcg`；generation metrics 为 deterministic judge 返回的 `faithfulness`、`answerRelevance`、`citationAccuracy`。空 expected / retrieved 场景必须返回有限数值，不能返回 `NaN`。
- `summary.*Score` 在当前 MVP 使用 `0-1` 小数语义；如产品层需要百分制，应在展示层转换。
- `/evals/*` 是 `/eval/*` 的兼容 alias，新增调用方优先使用既有 `/eval/*`，避免前端路径分叉。

Endpoint contract:

| Method | Path                       | Query / Body                                                    | Response                     | 主要错误码                                                                                                      | 权限                                |
| ------ | -------------------------- | --------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| GET    | `/eval/datasets`           | query: `PageQuery`                                              | `PageResult<EvalDataset>`    | `auth_unauthorized`, `auth_forbidden`, `validation_error`                                                       | owner, admin, maintainer, evaluator |
| POST   | `/eval/datasets`           | body: `CreateEvalDatasetRequest`                                | `EvalDataset`                | `auth_unauthorized`, `auth_forbidden`, `validation_error`, `eval_dataset_name_conflict`                         | owner, admin, maintainer, evaluator |
| POST   | `/eval/datasets/:id/cases` | path: `id`; body: `CreateEvalCaseRequest`                       | `EvalCase`                   | `auth_unauthorized`, `auth_forbidden`, `eval_dataset_not_found`, `validation_error`                             | owner, admin, maintainer, evaluator |
| POST   | `/eval/runs`               | body: `CreateEvalRunRequest`                                    | `EvalRun`                    | `auth_unauthorized`, `auth_forbidden`, `eval_dataset_not_found`, `knowledge_base_not_found`, `validation_error` | owner, admin, maintainer, evaluator |
| GET    | `/eval/runs`               | query: `PageQuery & { datasetId?: ID; status?: EvalRunStatus }` | `PageResult<EvalRun>`        | `auth_unauthorized`, `auth_forbidden`, `validation_error`                                                       | owner, admin, maintainer, evaluator |
| POST   | `/eval/runs/compare`       | body: `CompareEvalRunsRequest`                                  | `CompareEvalRunsResponse`    | `auth_unauthorized`, `auth_forbidden`, `eval_run_not_found`, `validation_error`                                 | owner, admin, maintainer, evaluator |
| GET    | `/eval/runs/:id`           | path: `id`                                                      | `EvalRun`                    | `auth_unauthorized`, `auth_forbidden`, `eval_run_not_found`                                                     | owner, admin, maintainer, evaluator |
| GET    | `/eval/runs/:id/results`   | path: `id`; query: `PageQuery`                                  | `PageResult<EvalCaseResult>` | `auth_unauthorized`, `auth_forbidden`, `eval_run_not_found`, `validation_error`                                 | owner, admin, maintainer, evaluator |

## 10. Permission Semantics

MVP roles:

- `owner` and `admin`: all MVP actions.
- `maintainer`: create knowledge bases, upload documents, chat, view traces, run evals.
- `evaluator`: view knowledge bases, chat, list/create eval datasets, create eval cases, create/list eval runs, read eval run results.
- `viewer`: chat, view allowed documents, submit feedback.

Backend is the authority. Frontend may hide buttons but must not be trusted for authorization.

Endpoint / action matrix:

| Action                                    | Owner | Admin | Maintainer | Evaluator | Viewer |
| ----------------------------------------- | ----- | ----- | ---------- | --------- | ------ |
| list/read knowledge bases                 | yes   | yes   | yes        | yes       | yes    |
| create knowledge base                     | yes   | yes   | yes        | no        | no     |
| update knowledge base                     | yes   | yes   | yes        | no        | no     |
| upload/reprocess/reembed/disable document | yes   | yes   | yes        | no        | no     |
| list/read allowed documents and chunks    | yes   | yes   | yes        | yes       | yes    |
| chat with allowed knowledge bases         | yes   | yes   | yes        | yes       | yes    |
| submit feedback                           | yes   | yes   | yes        | yes       | yes    |
| view dashboard overview                   | yes   | yes   | yes        | no        | no     |
| view traces and metrics                   | yes   | yes   | yes        | no        | no     |
| list/create eval datasets                 | yes   | yes   | yes        | yes       | no     |
| create eval cases                         | yes   | yes   | yes        | yes       | no     |
| create/list eval runs                     | yes   | yes   | yes        | yes       | no     |
| read eval run results                     | yes   | yes   | yes        | yes       | no     |

`viewer` 的 list/read 只覆盖后端判定为 allowed 的知识库、文档和 chunk；跨 workspace 或不可见资源必须返回 `auth_forbidden` 或对应 `*_not_found`，避免泄露资源存在性。

## 11. Trace Redaction

Trace payloads and display projections must not include tokens, service role keys, provider API keys, raw vendor headers, passwords, complete prompts, complete retrieved context, provider raw responses, or unredacted secret configuration.
