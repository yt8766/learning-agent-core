# Knowledge API Contract

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`、`apps/backend/knowledge-server`、`apps/backend/agent-server/src/knowledge`、`packages/knowledge/client`
最后核对：2026-05-02

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
  | 'upload_received'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'failed'
  | 'commit';

export type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'retrying';

export interface ProcessingErrorSummary {
  code: string;
  message: string;
  stage?: DocumentProcessingStage;
}

export interface DocumentProcessingStageRecord {
  stage: DocumentProcessingStage;
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
  currentStage?: DocumentProcessingStage;
  stages: DocumentProcessingStageRecord[];
  error?: ProcessingErrorSummary;
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
```

Endpoint contract:

| Method | Path                                    | Query / Body                                                                | Response                            | 主要错误码                                                                                                                       | 权限                                        |
| ------ | --------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| GET    | `/documents`                            | query: `PageQuery & { knowledgeBaseId?: ID; status?: DocumentStatus }`      | `PageResult<KnowledgeDocument>`     | `auth_unauthorized`, `auth_forbidden`, `validation_error`                                                                        | owner, admin, maintainer, evaluator, viewer |
| GET    | `/documents/:id`                        | path: `id`                                                                  | `KnowledgeDocument`                 | `auth_unauthorized`, `auth_forbidden`, `document_not_found`                                                                      | owner, admin, maintainer, evaluator, viewer |
| POST   | `/knowledge-bases/:id/documents/upload` | path: `id`; multipart fields: `file`, optional `title`, optional `metadata` | `UploadDocumentResponse`            | `auth_unauthorized`, `auth_forbidden`, `knowledge_base_not_found`, `unsupported_file_type`, `file_too_large`, `validation_error` | owner, admin, maintainer                    |
| GET    | `/documents/:id/jobs`                   | path: `id`; query: `PageQuery`                                              | `PageResult<DocumentProcessingJob>` | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `validation_error`                                                  | owner, admin, maintainer                    |
| GET    | `/documents/:id/chunks`                 | path: `id`; query: `PageQuery`                                              | `PageResult<DocumentChunk>`         | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `validation_error`                                                  | owner, admin, maintainer, evaluator, viewer |
| POST   | `/documents/:id/reprocess`              | path: `id`; optional body: `{ reason?: string }`                            | `ReprocessDocumentResponse`         | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `document_job_conflict`                                             | owner, admin, maintainer                    |
| POST   | `/documents/:id/reembed`                | path: `id`; optional body: `{ embeddingModel?: string; reason?: string }`   | `DocumentProcessingJob`             | `auth_unauthorized`, `auth_forbidden`, `document_not_found`, `document_job_conflict`                                             | owner, admin, maintainer                    |
| POST   | `/documents/:id/disable`                | path: `id`; optional body: `{ reason?: string }`                            | `KnowledgeDocument`                 | `auth_unauthorized`, `auth_forbidden`, `document_not_found`                                                                      | owner, admin, maintainer                    |

Upload response:

```ts
export interface UploadDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface ReprocessDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
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

export interface ChatMessage {
  id: ID;
  conversationId: ID;
  role: ChatMessageRole;
  content: string;
  citations?: Citation[];
  traceId?: ID;
  feedback?: MessageFeedbackSummary;
  createdAt: ISODateTime;
}

export interface ChatRequest {
  conversationId?: ID;
  /**
   * MVP backend also accepts a singular knowledgeBaseId for the current
   * repository-backed RAG path. New callers should prefer knowledgeBaseIds.
   */
  knowledgeBaseId?: ID;
  knowledgeBaseIds: ID[];
  message: string;
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
  retrieval?: {
    matches: Citation[];
    topK: number;
  };
  usage?: TokenUsage;
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

`ChatRequest.debug` 在 MVP 后端可以忽略；如启用，仅对 `owner`、`admin`、`maintainer` 生效，且不得改变 trace、citation、error、span payload 的 redaction 边界。

当前后端横向 MVP 的 `POST /chat` 已从纯 fixture 回声改为 repository-backed deterministic RAG：先按知识库检索 chunks，再用命中内容生成回答，随后保存 user message、`rag.chat` trace 和 assistant message。公开 body 为兼容旧前端仍可携带历史 `tenantId` / `createdBy` 字段，但服务端组装 RAG input 时必须忽略这些字段，当前 MVP 固定使用服务端上下文 `ws_1` / `user_demo`；内部调用 `KnowledgeRagService.answer()` 仍可显式传入租户和创建人。未配置 repository / rag service 的旧测试路径仍允许返回 fixture fallback。空 `message` 返回稳定 `400 validation_error` 语义；无检索命中时返回“未在当前知识库中找到足够依据。”并写入 succeeded trace。

Chat citation 必须是稳定 display projection，不得透传完整 chunk 文本或原始 metadata。当前 MVP 保留 `chunkId`、`documentId`、`text`、`quote`、`title`、`score`、`rank` 等前端字段，其中 `text` / `quote` / `contentPreview` 分别最多 240 / 160 / 120 字符；`metadata` 仅允许 `title`、`sourceUri`、`tags`，不得包含 `raw`、`vendor`、`embedding`、`secret`、`token`、`password` 等敏感或大字段。

Endpoint contract:

| Method | Path                          | Query / Body                                           | Response                                                                                 | 主要错误码                                                                                                    | 权限                                        |
| ------ | ----------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| POST   | `/chat`                       | body: `ChatRequest`                                    | `ChatResponse`                                                                           | `auth_unauthorized`, `auth_forbidden`, `validation_error`, `knowledge_base_not_found`, `provider_unavailable` | owner, admin, maintainer, evaluator, viewer |
| GET    | `/conversations`              | query: `PageQuery & { knowledgeBaseId?: ID }`          | `PageResult<{ id: ID; title?: string; createdAt: ISODateTime; updatedAt: ISODateTime }>` | `auth_unauthorized`, `auth_forbidden`, `validation_error`                                                     | owner, admin, maintainer, evaluator, viewer |
| GET    | `/conversations/:id/messages` | path: `id`; query: `PageQuery`                         | `PageResult<ChatMessage>`                                                                | `auth_unauthorized`, `auth_forbidden`, `conversation_not_found`, `validation_error`                           | owner, admin, maintainer, evaluator, viewer |
| POST   | `/messages/:id/feedback`      | path: `id`; body: `CreateFeedbackRequest`              | `ChatMessage`                                                                            | `auth_unauthorized`, `auth_forbidden`, `message_not_found`, `validation_error`                                | owner, admin, maintainer, evaluator, viewer |
| POST   | `/messages/:id/add-to-eval`   | path: `id`; body: `{ datasetId: ID; tags?: string[] }` | `EvalCase`                                                                               | `auth_unauthorized`, `auth_forbidden`, `message_not_found`, `eval_dataset_not_found`, `validation_error`      | owner, admin, maintainer, evaluator         |

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
export type EvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

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
