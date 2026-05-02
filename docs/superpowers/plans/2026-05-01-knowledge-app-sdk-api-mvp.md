# Knowledge App SDK API MVP Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/agent-server/src/knowledge`、`packages/knowledge`
最后核对：2026-05-01

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 2026-05-02 状态补充：本计划是历史 snapshot。`DocumentSourceType.web-url` 只表示 Knowledge App 可承载人工策展或外部系统已整理好的 URL 内容；当前知识库不建设真实网页抓取、robots / 版权策略或抓取调度。实施时以 [Knowledge API Contract](/docs/contracts/api/knowledge.md)、[Knowledge Ingestion API](/docs/contracts/api/knowledge-ingestion.md) 与 [Knowledge Source Ingestion 接线状态](/docs/packages/knowledge/source-ingestion-status.md) 为准。

**Goal:** Build the first API-first MVP slice for `apps/frontend/knowledge`, backed by a stable Knowledge API contract and a publishable `packages/knowledge` SDK core boundary.

**Architecture:** The front end consumes stable API models and never runs RAG internals directly. The backend hosts authentication, permission checks, API mapping, document jobs, chat, traces, and eval stubs first; later it calls `packages/knowledge` runtime/adapters for real ingestion, retrieval, generation, tracing, and evaluation. The SDK is interface-first: `core` defines schema/type/interface/error/pipeline contracts, while default runtime and adapters remain replaceable.

**Tech Stack:** TypeScript, React/Vite style frontend app, NestJS backend in `apps/backend/agent-server`, `zod` schema contracts, JWT access/refresh tokens, pnpm workspaces, Vitest, existing repo docs/check tooling.

---

## Scope

This plan implements the first vertical slice:

- API contract documentation for Knowledge App MVP.
- Product design documentation for `apps/frontend/knowledge`.
- SDK architecture documentation for `packages/knowledge`.
- Frontend app shell, API models, mock client, JWT double-token auth client, and MVP pages.
- `packages/knowledge/src/core` skeleton with schema-first contracts and provider interfaces.
- Backend `src/knowledge` auth and stub API modules returning contract-shaped data.

Out of first implementation scope:

- Real Supabase schema migrations.
- Real pgvector search.
- Real OpenAI calls.
- Real document parser/embedding worker.
- A/B testing, alert rules, provider management UI, API keys, and advanced tuning.

Those are planned as follow-up slices after the MVP UI and contracts are stable.

## File Structure

### Documentation

- Create: `docs/contracts/api/knowledge.md`
  - Stable API contract for frontend/backend.
  - Contains auth, dashboard, knowledge base, document, chat, trace, feedback, eval, pagination, and error semantics.
- Create: `docs/packages/knowledge/sdk-architecture.md`
  - SDK module boundaries, exports, dependency rules, provider interfaces, default adapter policy, and independent publishing constraints.
- Create: `docs/apps/frontend/knowledge/product-design.md`
  - Product IA, routes, MVP pages, role assumptions, interaction loops, and mock-first development sequence.

### Frontend App

- Create: `apps/frontend/knowledge/package.json`
- Create: `apps/frontend/knowledge/tsconfig.json`
- Create: `apps/frontend/knowledge/tsconfig.app.json`
- Create: `apps/frontend/knowledge/vite.config.ts`
- Create: `apps/frontend/knowledge/index.html`
- Create: `apps/frontend/knowledge/src/main.tsx`
- Create: `apps/frontend/knowledge/src/app/App.tsx`
- Create: `apps/frontend/knowledge/src/app/routes.tsx`
- Create: `apps/frontend/knowledge/src/app/protected-route.tsx`
- Create: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`
- Create: `apps/frontend/knowledge/src/types/api.ts`
- Create: `apps/frontend/knowledge/src/api/token-storage.ts`
- Create: `apps/frontend/knowledge/src/api/auth-client.ts`
- Create: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Create: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Create: `apps/frontend/knowledge/src/api/mock-data.ts`
- Create: `apps/frontend/knowledge/src/features/auth/auth-provider.tsx`
- Create: `apps/frontend/knowledge/src/features/auth/login-page.tsx`
- Create MVP page files under:
  - `apps/frontend/knowledge/src/features/overview/overview-page.tsx`
  - `apps/frontend/knowledge/src/features/knowledge-bases/knowledge-bases-page.tsx`
  - `apps/frontend/knowledge/src/features/knowledge-bases/knowledge-base-detail-page.tsx`
  - `apps/frontend/knowledge/src/features/documents/document-detail-page.tsx`
  - `apps/frontend/knowledge/src/features/chat-lab/chat-lab-page.tsx`
  - `apps/frontend/knowledge/src/features/observability/trace-list-page.tsx`
  - `apps/frontend/knowledge/src/features/observability/trace-detail-page.tsx`
  - `apps/frontend/knowledge/src/features/eval-center/eval-datasets-page.tsx`
  - `apps/frontend/knowledge/src/features/eval-center/eval-runs-page.tsx`
  - `apps/frontend/knowledge/src/features/eval-center/eval-run-detail-page.tsx`
- Test:
  - `apps/frontend/knowledge/test/auth-client.test.ts`
  - `apps/frontend/knowledge/test/token-storage.test.ts`
  - `apps/frontend/knowledge/test/mock-api.test.ts`

### SDK Core

- Create: `packages/knowledge/src/core/index.ts`
- Create grouped barrels and files:
  - `packages/knowledge/src/core/schemas/index.ts`
  - `packages/knowledge/src/core/types/index.ts`
  - `packages/knowledge/src/core/interfaces/index.ts`
  - `packages/knowledge/src/core/errors/index.ts`
  - `packages/knowledge/src/core/pipeline/index.ts`
  - `packages/knowledge/src/core/constants/index.ts`
- Modify: `packages/knowledge/src/index.ts`
  - Re-export `./core`.
- Modify: `packages/knowledge/package.json`
  - Add `./core` subpath export.
- Test:
  - `packages/knowledge/test/core-contracts.test.ts`
  - `packages/knowledge/test/root-exports.test.ts`

### Backend Stub API

- Create: `apps/backend/agent-server/src/knowledge/knowledge.module.ts`
- Create:
  - `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.controller.ts`
  - `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.service.ts`
  - `apps/backend/agent-server/src/knowledge/auth/knowledge-jwt.ts`
  - `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.guard.ts`
  - `apps/backend/agent-server/src/knowledge/dashboard/knowledge-dashboard.controller.ts`
  - `apps/backend/agent-server/src/knowledge/knowledge-bases/knowledge-bases.controller.ts`
  - `apps/backend/agent-server/src/knowledge/documents/knowledge-documents.controller.ts`
  - `apps/backend/agent-server/src/knowledge/chat/knowledge-chat.controller.ts`
  - `apps/backend/agent-server/src/knowledge/observability/knowledge-traces.controller.ts`
  - `apps/backend/agent-server/src/knowledge/evals/knowledge-evals.controller.ts`
  - `apps/backend/agent-server/src/knowledge/shared/knowledge-api-fixtures.ts`
  - `apps/backend/agent-server/src/knowledge/shared/knowledge-api-errors.ts`
- Modify: `apps/backend/agent-server/src/app/app.module.ts`
  - Import `KnowledgeModule`.
- Test:
  - `apps/backend/agent-server/test/knowledge/knowledge-auth.controller.spec.ts`
  - `apps/backend/agent-server/test/knowledge/knowledge-stub-api.spec.ts`

---

## Task 1: Write API Contract Documentation

**Files:**

- Create: `docs/contracts/api/knowledge.md`

- [ ] **Step 1: Create the API contract document**

Create `docs/contracts/api/knowledge.md` with this content:

````markdown
# Knowledge API Contract

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`、`apps/backend/agent-server/src/knowledge`、`packages/knowledge/client`
最后核对：2026-05-01

## 1. Base URL

所有接口以 `/api/knowledge/v1` 为前缀。

受保护接口必须带：

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```
````

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

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
```

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

Endpoints:

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

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

Endpoints:

- `GET /knowledge-bases`
- `POST /knowledge-bases`
- `GET /knowledge-bases/:id`
- `PATCH /knowledge-bases/:id`

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

Endpoints:

- `GET /documents`
- `GET /documents/:id`
- `POST /knowledge-bases/:id/documents/upload`
- `GET /documents/:id/jobs`
- `GET /documents/:id/chunks`
- `POST /documents/:id/reprocess`
- `POST /documents/:id/reembed`
- `POST /documents/:id/disable`

Upload response:

```ts
export interface UploadDocumentResponse {
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
  score?: number;
  page?: number;
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

Endpoints:

- `POST /chat`
- `GET /conversations`
- `GET /conversations/:id/messages`
- `POST /messages/:id/feedback`
- `POST /messages/:id/add-to-eval`

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
  stage: TraceSpanStage;
  name: string;
  status: TraceStatus;
  latencyMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
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

Endpoints:

- `GET /observability/metrics`
- `GET /observability/traces`
- `GET /observability/traces/:id`

## 9. Eval

```ts
export type EvalDifficulty = 'easy' | 'medium' | 'hard';
export type EvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface EvalDataset {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  tags: string[];
  caseCount: number;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EvalCase {
  id: ID;
  datasetId: ID;
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds: ID[];
  expectedChunkIds: ID[];
  tags: string[];
  difficulty: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
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
  datasetId: ID;
  knowledgeBaseIds: ID[];
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
  actualAnswer?: string;
  citations: Citation[];
  traceId?: ID;
  retrievalMetrics?: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  judgeResult?: JudgeResult;
  failureCategory?: EvalFailureCategory;
  error?: ApiErrorResponse;
}
```

Endpoints:

- `GET /eval/datasets`
- `POST /eval/datasets`
- `POST /eval/datasets/:id/cases`
- `POST /eval/runs`
- `GET /eval/runs`
- `GET /eval/runs/:id`
- `GET /eval/runs/:id/results`

## 10. Permission Semantics

MVP roles:

- `owner` and `admin`: all MVP actions.
- `maintainer`: create knowledge bases, upload documents, chat, view traces, run evals.
- `evaluator`: view knowledge bases, chat, manage eval datasets and runs.
- `viewer`: chat, view allowed documents, submit feedback.

Backend is the authority. Frontend may hide buttons but must not be trusted for authorization.

## 11. Trace Redaction

Trace payloads must not include tokens, service role keys, provider API keys, raw vendor headers, passwords, or unredacted secret configuration.

````

- [ ] **Step 2: Run docs check**

Run:

```bash
pnpm check:docs
````

Expected: PASS. If it fails because this new docs path is missing an index, update the relevant docs index in the same task.

- [ ] **Step 3: Commit**

```bash
git add docs/contracts/api/knowledge.md
git commit -m "docs: add knowledge api contract"
```

---

## Task 2: Write SDK Architecture Documentation

**Files:**

- Create: `docs/packages/knowledge/sdk-architecture.md`
- Modify: `docs/packages/knowledge/README.md`

- [ ] **Step 1: Add SDK architecture doc**

Create `docs/packages/knowledge/sdk-architecture.md`:

````markdown
# Knowledge SDK Architecture

状态：current
文档类型：architecture
适用范围：`packages/knowledge`
最后核对：2026-05-01

## Goal

`packages/knowledge` is a publishable RAG SDK. It provides schema-first contracts, provider interfaces, default pipelines, optional default adapters, API client helpers, eval primitives, and observability primitives.

## Principles

1. Interface-first: every external capability is injected through an interface.
2. Default implementations are optional and replaceable.
3. Core contracts do not depend on vendor SDKs or monorepo-internal runtime packages.
4. Browser-safe and node-only entrypoints are separate.
5. Vendor responses and errors are converted at adapter boundaries.
6. SDK code does not read host environment variables unless the host explicitly passes values to an adapter factory.

## Target Source Layout

```text
packages/knowledge/src/
  core/
    schemas/
    types/
    interfaces/
    errors/
    pipeline/
    constants/
  client/
  runtime/
  indexing/
  retrieval/
  generation/
  eval/
  observability/
  adapters/
    supabase/
    openai/
    qdrant/
    weaviate/
  node/
  browser/
```
````

## Public Entrypoints

```text
@agent/knowledge
@agent/knowledge/core
@agent/knowledge/client
@agent/knowledge/runtime
@agent/knowledge/indexing
@agent/knowledge/retrieval
@agent/knowledge/eval
@agent/knowledge/observability
@agent/knowledge/browser
@agent/knowledge/node
@agent/knowledge/adapters/supabase
@agent/knowledge/adapters/openai
@agent/knowledge/adapters/qdrant
@agent/knowledge/adapters/weaviate
```

## Core Boundary

`src/core` owns:

- Zod schemas.
- Types inferred from schemas.
- Provider interfaces.
- Error models.
- Pipeline type abstractions.
- Stable status constants.

`src/core` may depend on `zod`.

`src/core` must not depend on:

- `@agent/core`
- `@agent/memory`
- `@agent/config`
- `@agent/adapters`
- `@supabase/supabase-js`
- `openai`
- `node:fs`
- `react`
- NestJS

## MVP Provider Interfaces

```ts
export interface EmbeddingProvider {
  embed(input: EmbedTextInput): Promise<EmbedTextResult>;
  embedBatch?(input: EmbedBatchInput): Promise<EmbedBatchResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface VectorStore {
  upsert(input: VectorUpsertInput): Promise<VectorUpsertResult>;
  search(input: VectorSearchInput): Promise<VectorSearchResult>;
  delete(input: VectorDeleteInput): Promise<VectorDeleteResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface Generator {
  generate(input: GenerateInput): Promise<GenerateResult>;
}

export interface TraceSink {
  startTrace(input: StartTraceInput): Promise<RagTrace>;
  recordSpan(input: RecordTraceSpanInput): Promise<RagTraceSpan>;
  endTrace(input: EndTraceInput): Promise<RagTrace>;
}
```

## MVP Default Adapters

First publishable adapters:

- `adapters/supabase`: document store, chunk store, vector store, keyword search provider, trace sink, eval store.
- `adapters/openai`: embedding provider, generator, eval judge provider.

Adapter dependencies are optional or peer dependencies. They must not be required by `@agent/knowledge/core`.

## Runtime MVP

The first runtime flow is:

```text
query
-> embedding
-> vector search
-> keyword search
-> RRF merge
-> context assembly
-> generation
-> citations
-> trace
```

Query rewrite, rerank, Small-to-Big, and citation checking are extension points after the MVP.

## Frontend Usage Boundary

`apps/frontend/knowledge` may import:

- `@agent/knowledge/core`
- `@agent/knowledge/client`

It must not import:

- `@agent/knowledge/node`
- `@agent/knowledge/adapters/openai`
- `@agent/knowledge/adapters/supabase` when service keys are required
- `@agent/knowledge/runtime` for direct LLM or vector operations

````

- [ ] **Step 2: Link the doc from knowledge README**

Modify `docs/packages/knowledge/README.md` current document list to include:

Add a plain list entry for `sdk-architecture.md` pointing at `docs/packages/knowledge/sdk-architecture.md`. Do not use a clickable Markdown link until that document exists in the same task.

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
````

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/packages/knowledge/sdk-architecture.md docs/packages/knowledge/README.md
git commit -m "docs: describe knowledge sdk architecture"
```

---

## Task 3: Write Frontend Product Design Documentation

**Files:**

- Create: `docs/apps/frontend/knowledge/product-design.md`

- [ ] **Step 1: Create frontend product design doc**

Create `docs/apps/frontend/knowledge/product-design.md`:

````markdown
# Knowledge App Product Design

状态：current
文档类型：product
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-01

## Positioning

`apps/frontend/knowledge` is the Knowledge App. It provides login, knowledge base management, document upload, RAG chat, citation review, trace observability, feedback, eval datasets, eval runs, and MVP dashboard views.

## Routes

```text
/login
/app/overview
/app/knowledge-bases
/app/knowledge-bases/:id
/app/documents/:id
/app/chat-lab
/app/observability/traces
/app/observability/traces/:id
/app/evals/datasets
/app/evals/runs
/app/evals/runs/:id
/app/settings
```
````

## Navigation

- 总览
- 知识库
- 文档
- 对话实验室
- 评测中心
- 观测中心
- 设置

## MVP User Flow

```text
login
-> create knowledge base
-> upload markdown or txt
-> document processing reaches ready
-> ask a question in Chat Lab
-> answer shows citations
-> open trace detail
-> submit negative feedback
-> add message to eval dataset
-> create eval run
-> inspect eval results
```

## Auth Behavior

The frontend stores JWT access and refresh tokens in localStorage. It refreshes access tokens before expiry and after `401 auth_token_expired`, with one retry per request and one shared refresh promise for concurrent refreshes.

## MVP Pages

### Overview

Shows knowledge base count, document count, ready/failed document counts, today question count, average latency, P95/P99, error rate, negative feedback rate, latest eval score, active alert count, recent failed jobs, recent low-score traces, recent eval runs, and top missing knowledge questions.

### Knowledge Bases

Shows searchable table of knowledge bases with status, document counts, chunk count, latest eval score, latest trace time, tags, and create action.

### Knowledge Base Detail

Shows summary tabs for overview, documents, chat, eval, observability, config, and permissions. MVP can render all tab buttons while only overview/documents/chat/eval/observability have data panels.

### Document Detail

Shows document metadata, processing job timeline, latest error, chunk table, and actions for reprocess, reembed, and disable.

### Chat Lab

Shows knowledge base selector, chat thread, citations, feedback controls, Add to Eval dialog, and Trace side panel.

### Trace List and Trace Detail

Trace list shows question, status, latency, hit count, citation count, feedback, and creation time. Trace detail shows span timeline, retrieval snapshot, citations, token usage, and sanitized errors.

### Eval

Dataset page lists datasets and creates datasets. Runs page lists eval runs and starts a run. Run detail shows progress, summary metrics, and case results.

## Mock-first Development

The frontend supports `VITE_USE_MOCK_API=true`. Mock data must cover auth, dashboard, knowledge bases, documents, chunks, chat, traces, and evals.

````

- [ ] **Step 2: Run docs check**

Run:

```bash
pnpm check:docs
````

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/apps/frontend/knowledge/product-design.md
git commit -m "docs: add knowledge app product design"
```

---

## Task 4: Add Frontend API Types

**Files:**

- Create: `apps/frontend/knowledge/src/types/api.ts`
- Test: `apps/frontend/knowledge/test/api-types.test.ts`

- [ ] **Step 1: Write the failing type/runtime shape test**

Create `apps/frontend/knowledge/test/api-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AuthTokens, ChatResponse, DashboardOverview, KnowledgeBase, RagTraceDetail } from '../src/types/api';

describe('knowledge frontend API types', () => {
  it('accepts MVP dashboard, chat, and trace shapes', () => {
    const tokens: AuthTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    };
    const knowledgeBase: KnowledgeBase = {
      id: 'kb_1',
      workspaceId: 'ws_1',
      name: '前端知识库',
      tags: ['frontend'],
      visibility: 'workspace',
      status: 'active',
      documentCount: 1,
      chunkCount: 3,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      createdBy: 'user_1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    };
    const dashboard: DashboardOverview = {
      knowledgeBaseCount: 1,
      documentCount: 1,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      todayQuestionCount: 1,
      activeAlertCount: 0,
      recentFailedJobs: [],
      recentLowScoreTraces: [],
      recentEvalRuns: [],
      topMissingKnowledgeQuestions: []
    };
    const chat: ChatResponse = {
      conversationId: 'conv_1',
      answer: '默认使用顶层静态 import。',
      traceId: 'trace_1',
      citations: [],
      userMessage: {
        id: 'msg_user',
        conversationId: 'conv_1',
        role: 'user',
        content: '动态导入有什么限制？',
        createdAt: '2026-05-01T00:00:00.000Z'
      },
      assistantMessage: {
        id: 'msg_assistant',
        conversationId: 'conv_1',
        role: 'assistant',
        content: '默认使用顶层静态 import。',
        citations: [],
        traceId: 'trace_1',
        createdAt: '2026-05-01T00:00:00.000Z'
      }
    };
    const trace: RagTraceDetail = {
      id: 'trace_1',
      workspaceId: 'ws_1',
      knowledgeBaseIds: ['kb_1'],
      question: '动态导入有什么限制？',
      answer: chat.answer,
      status: 'succeeded',
      createdAt: '2026-05-01T00:00:00.000Z',
      spans: [],
      citations: []
    };

    expect(tokens.tokenType).toBe('Bearer');
    expect(knowledgeBase.name).toBe('前端知识库');
    expect(dashboard.knowledgeBaseCount).toBe(1);
    expect(chat.traceId).toBe('trace_1');
    expect(trace.status).toBe('succeeded');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --dir apps/frontend/knowledge exec vitest run test/api-types.test.ts
```

Expected: FAIL because `apps/frontend/knowledge` and `src/types/api.ts` do not exist yet.

- [ ] **Step 3: Create the API type file**

Create `apps/frontend/knowledge/src/types/api.ts` with the complete type definitions copied from `docs/contracts/api/knowledge.md`. The file must export every type used by the test:

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

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

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

export type DocumentProcessingStage =
  | 'upload_received'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'commit';

export type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'retrying';

export interface ProcessingErrorSummary {
  code: string;
  message: string;
  stage?: DocumentProcessingStage;
}

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

export interface UploadDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
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

export interface Citation {
  id: ID;
  documentId: ID;
  chunkId: ID;
  title: string;
  uri?: string;
  quote: string;
  score?: number;
  page?: number;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type ChatMessageRole = 'user' | 'assistant' | 'system';

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
  usage?: TokenUsage;
}

export interface CreateFeedbackRequest {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
}

export interface FeedbackRecord {
  id: ID;
  workspaceId: ID;
  traceId?: ID;
  messageId?: ID;
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
  createdBy: ID;
  createdAt: ISODateTime;
}

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
  stage: TraceSpanStage;
  name: string;
  status: TraceStatus;
  latencyMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
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

export type EvalDifficulty = 'easy' | 'medium' | 'hard';
export type EvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface EvalDataset {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  tags: string[];
  caseCount: number;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EvalCase {
  id: ID;
  datasetId: ID;
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds: ID[];
  expectedChunkIds: ID[];
  tags: string[];
  difficulty: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
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
  datasetId: ID;
  knowledgeBaseIds: ID[];
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
  actualAnswer?: string;
  citations: Citation[];
  traceId?: ID;
  retrievalMetrics?: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  judgeResult?: JudgeResult;
  failureCategory?: EvalFailureCategory;
  error?: ApiErrorResponse;
}

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

- [ ] **Step 4: Run the type test**

Run:

```bash
pnpm --dir apps/frontend/knowledge exec vitest run test/api-types.test.ts
```

Expected: PASS after the frontend package exists in Task 5. If run before Task 5, the command should be deferred and this test must be included in Task 5 verification.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/knowledge/src/types/api.ts apps/frontend/knowledge/test/api-types.test.ts
git commit -m "feat: add knowledge frontend api types"
```

---

## Task 5: Scaffold Frontend Knowledge App

**Files:**

- Create: `apps/frontend/knowledge/package.json`
- Create: `apps/frontend/knowledge/tsconfig.json`
- Create: `apps/frontend/knowledge/tsconfig.app.json`
- Create: `apps/frontend/knowledge/vite.config.ts`
- Create: `apps/frontend/knowledge/index.html`
- Create: `apps/frontend/knowledge/src/main.tsx`
- Create: `apps/frontend/knowledge/src/app/App.tsx`

- [ ] **Step 1: Create package manifest**

Create `apps/frontend/knowledge/package.json`:

```json
{
  "name": "knowledge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -p tsconfig.app.json && vite build",
    "typecheck": "tsc -p tsconfig.app.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "vite": "^7.2.7",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Run pnpm install**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` gains importer `apps/frontend/knowledge`.

- [ ] **Step 3: Add TypeScript configs**

Create `apps/frontend/knowledge/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

Create `apps/frontend/knowledge/tsconfig.app.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

- [ ] **Step 4: Add Vite config**

Create `apps/frontend/knowledge/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175
  }
});
```

- [ ] **Step 5: Add app entry**

Create `apps/frontend/knowledge/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowledge</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/frontend/knowledge/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `apps/frontend/knowledge/src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Knowledge</h1>
      <p>Knowledge App shell is ready.</p>
    </main>
  );
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
```

Expected: tests pass and typecheck passes.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge pnpm-lock.yaml
git commit -m "feat: scaffold knowledge frontend app"
```

---

## Task 6: Implement Frontend Token Storage and Auth Client

**Files:**

- Create: `apps/frontend/knowledge/src/api/token-storage.ts`
- Create: `apps/frontend/knowledge/src/api/auth-client.ts`
- Test: `apps/frontend/knowledge/test/token-storage.test.ts`
- Test: `apps/frontend/knowledge/test/auth-client.test.ts`

- [ ] **Step 1: Write token storage tests**

Create `apps/frontend/knowledge/test/token-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearTokens, readTokens, saveTokens, shouldRefreshAccessToken } from '../src/api/token-storage';

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  it('saves tokens with absolute expiry timestamps', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 120,
      refreshExpiresIn: 600
    });

    expect(readTokens()).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: Date.now() + 120_000,
      refreshTokenExpiresAt: Date.now() + 600_000
    });
  });

  it('detects access tokens that should refresh soon', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 30,
      refreshExpiresIn: 600
    });

    expect(shouldRefreshAccessToken(60_000)).toBe(true);
  });

  it('clears tokens', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 120,
      refreshExpiresIn: 600
    });
    clearTokens();

    expect(readTokens()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write token storage implementation**

Create `apps/frontend/knowledge/src/api/token-storage.ts`:

```ts
import type { AuthTokens } from '../types/api';

export const AUTH_STORAGE_KEYS = {
  accessToken: 'knowledge_access_token',
  refreshToken: 'knowledge_refresh_token',
  accessTokenExpiresAt: 'knowledge_access_token_expires_at',
  refreshTokenExpiresAt: 'knowledge_refresh_token_expires_at'
} as const;

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export function saveTokens(tokens: AuthTokens, now = Date.now()) {
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.accessToken);
  localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, tokens.refreshToken);
  localStorage.setItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt, String(now + tokens.expiresIn * 1000));
  localStorage.setItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt, String(now + tokens.refreshExpiresIn * 1000));
}

export function readTokens(): StoredTokens | undefined {
  const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
  const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
  const accessTokenExpiresAt = Number(localStorage.getItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt));
  const refreshTokenExpiresAt = Number(localStorage.getItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt));

  if (
    !accessToken ||
    !refreshToken ||
    !Number.isFinite(accessTokenExpiresAt) ||
    !Number.isFinite(refreshTokenExpiresAt)
  ) {
    return undefined;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt
  };
}

export function clearTokens() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt);
}

export function shouldRefreshAccessToken(refreshBeforeMs = 60_000, now = Date.now()) {
  const tokens = readTokens();
  return !tokens || now >= tokens.accessTokenExpiresAt - refreshBeforeMs;
}

export function isRefreshTokenExpired(now = Date.now()) {
  const tokens = readTokens();
  return !tokens || now >= tokens.refreshTokenExpiresAt;
}
```

- [ ] **Step 3: Write auth client tests**

Create `apps/frontend/knowledge/test/auth-client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthClient } from '../src/api/auth-client';
import { clearTokens, readTokens, saveTokens } from '../src/api/token-storage';

describe('AuthClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  it('logs in and stores tokens', async () => {
    const client = new AuthClient({
      baseUrl: '/api/knowledge/v1',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            user: { id: 'user_1', email: 'dev@example.com', roles: ['owner'], permissions: [] },
            tokens: {
              accessToken: 'access',
              refreshToken: 'refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        )
    });

    const session = await client.login({ email: 'dev@example.com', password: 'secret' });

    expect(session.user.email).toBe('dev@example.com');
    expect(readTokens()?.accessToken).toBe('access');
  });

  it('shares concurrent refresh requests', async () => {
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 1,
      refreshExpiresIn: 1209600
    });
    let refreshCalls = 0;
    const client = new AuthClient({
      baseUrl: '/api/knowledge/v1',
      fetcher: async () => {
        refreshCalls += 1;
        return new Response(
          JSON.stringify({
            tokens: {
              accessToken: 'new',
              refreshToken: 'new_refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        );
      }
    });

    await Promise.all([client.refreshTokensOnce(), client.refreshTokensOnce()]);

    expect(refreshCalls).toBe(1);
    expect(readTokens()?.accessToken).toBe('new');
  });

  it('clears tokens when logout is called', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const client = new AuthClient({ baseUrl: '/api/knowledge/v1' });

    client.logout();

    expect(readTokens()).toBeUndefined();
  });
});
```

- [ ] **Step 4: Implement AuthClient**

Create `apps/frontend/knowledge/src/api/auth-client.ts`:

```ts
import type {
  AuthTokens,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RefreshTokenResponse
} from '../types/api';
import { clearTokens, isRefreshTokenExpired, readTokens, saveTokens, shouldRefreshAccessToken } from './token-storage';

export interface AuthClientOptions {
  baseUrl: string;
  refreshBeforeMs?: number;
  fetcher?: typeof fetch;
  onAuthLost?: () => void;
}

export class AuthClient {
  private readonly baseUrl: string;
  private readonly refreshBeforeMs: number;
  private readonly fetcher: typeof fetch;
  private readonly onAuthLost?: () => void;
  private refreshPromise: Promise<AuthTokens> | undefined;

  constructor(options: AuthClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.refreshBeforeMs = options.refreshBeforeMs ?? 60_000;
    this.fetcher = options.fetcher ?? fetch;
    this.onAuthLost = options.onAuthLost;
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    const response = await this.fetcher(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const session = await parseJson<LoginResponse>(response);
    saveTokens(session.tokens);
    return session;
  }

  logout() {
    clearTokens();
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const accessToken = await this.ensureValidAccessToken();
    if (!accessToken) {
      throw new Error('Missing access token');
    }
    const response = await this.fetcher(`${this.baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const result = await parseJson<MeResponse>(response);
    return result.user;
  }

  getAccessToken() {
    return readTokens()?.accessToken ?? null;
  }

  getRefreshToken() {
    return readTokens()?.refreshToken ?? null;
  }

  hasTokens() {
    return Boolean(readTokens());
  }

  clearTokens() {
    clearTokens();
  }

  async ensureValidAccessToken(): Promise<string | null> {
    if (!readTokens()) {
      return null;
    }
    if (isRefreshTokenExpired()) {
      this.handleAuthLost();
      return null;
    }
    if (shouldRefreshAccessToken(this.refreshBeforeMs)) {
      await this.refreshTokensOnce();
    }
    return readTokens()?.accessToken ?? null;
  }

  refreshTokensOnce(): Promise<AuthTokens> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshTokens().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  async refreshTokens(): Promise<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken || isRefreshTokenExpired()) {
      this.handleAuthLost();
      throw new Error('Refresh token expired');
    }
    const response = await this.fetcher(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const result = await parseJson<RefreshTokenResponse>(response);
    saveTokens(result.tokens);
    return result.tokens;
  }

  private handleAuthLost() {
    clearTokens();
    this.onAuthLost?.();
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`);
  }
  return body as T;
}
```

- [ ] **Step 5: Run auth tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge exec vitest run test/token-storage.test.ts test/auth-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/knowledge/src/api/token-storage.ts apps/frontend/knowledge/src/api/auth-client.ts apps/frontend/knowledge/test/token-storage.test.ts apps/frontend/knowledge/test/auth-client.test.ts
git commit -m "feat: add knowledge auth client"
```

---

## Task 7: Add Knowledge API Client With Refresh Retry

**Files:**

- Create: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Test: `apps/frontend/knowledge/test/knowledge-api-client.test.ts`

- [ ] **Step 1: Write failing client retry test**

Create `apps/frontend/knowledge/test/knowledge-api-client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthClient } from '../src/api/auth-client';
import { KnowledgeApiClient } from '../src/api/knowledge-api-client';
import { saveTokens } from '../src/api/token-storage';

describe('KnowledgeApiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  it('refreshes token and retries once on auth_token_expired', async () => {
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const calls: Array<{ url: string; authorization?: string }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      const authorization = new Headers(init?.headers).get('Authorization') ?? undefined;
      calls.push({ url: String(url), authorization });
      if (String(url).endsWith('/dashboard/overview') && calls.length === 1) {
        return new Response(JSON.stringify({ code: 'auth_token_expired', message: 'expired' }), { status: 401 });
      }
      if (String(url).endsWith('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            tokens: {
              accessToken: 'new',
              refreshToken: 'new_refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          knowledgeBaseCount: 0,
          documentCount: 0,
          readyDocumentCount: 0,
          failedDocumentCount: 0,
          todayQuestionCount: 0,
          activeAlertCount: 0,
          recentFailedJobs: [],
          recentLowScoreTraces: [],
          recentEvalRuns: [],
          topMissingKnowledgeQuestions: []
        }),
        { status: 200 }
      );
    };
    const authClient = new AuthClient({ baseUrl: '/api/knowledge/v1', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: '/api/knowledge/v1', authClient, fetcher });

    const result = await apiClient.getDashboardOverview();

    expect(result.knowledgeBaseCount).toBe(0);
    expect(calls.some(call => call.url.endsWith('/auth/refresh'))).toBe(true);
    expect(calls.at(-1)?.authorization).toBe('Bearer new');
  });
});
```

- [ ] **Step 2: Implement KnowledgeApiClient**

Create `apps/frontend/knowledge/src/api/knowledge-api-client.ts`:

```ts
import type {
  ChatRequest,
  ChatResponse,
  CreateFeedbackRequest,
  CreateKnowledgeBaseRequest,
  DashboardOverview,
  EvalDataset,
  EvalRun,
  KnowledgeBase,
  PageResult
} from '../types/api';
import type { AuthClient } from './auth-client';

export interface KnowledgeApiClientOptions {
  baseUrl: string;
  authClient: AuthClient;
  fetcher?: typeof fetch;
}

export class KnowledgeApiClient {
  private readonly baseUrl: string;
  private readonly authClient: AuthClient;
  private readonly fetcher: typeof fetch;

  constructor(options: KnowledgeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authClient = options.authClient;
    this.fetcher = options.fetcher ?? fetch;
  }

  getDashboardOverview() {
    return this.get<DashboardOverview>('/dashboard/overview');
  }

  listKnowledgeBases() {
    return this.get<PageResult<KnowledgeBase>>('/knowledge-bases');
  }

  createKnowledgeBase(input: CreateKnowledgeBaseRequest) {
    return this.post<KnowledgeBase>('/knowledge-bases', input);
  }

  chat(input: ChatRequest) {
    return this.post<ChatResponse>('/chat', input);
  }

  createFeedback(messageId: string, input: CreateFeedbackRequest) {
    return this.post(`/messages/${messageId}/feedback`, input);
  }

  listEvalDatasets() {
    return this.get<PageResult<EvalDataset>>('/eval/datasets');
  }

  listEvalRuns() {
    return this.get<PageResult<EvalRun>>('/eval/runs');
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async request<T>(path: string, init: RequestInit = {}, hasRetried = false): Promise<T> {
    const accessToken = await this.authClient.ensureValidAccessToken();
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });

    if (response.status === 401 && !hasRetried) {
      const errorBody = await response
        .clone()
        .json()
        .catch(() => undefined);
      if (errorBody?.code === 'auth_token_expired') {
        await this.authClient.refreshTokensOnce();
        return this.request<T>(path, init, true);
      }
    }

    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new Error(typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`);
    }
    return body as T;
  }
}
```

- [ ] **Step 3: Run client tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge exec vitest run test/knowledge-api-client.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/knowledge/src/api/knowledge-api-client.ts apps/frontend/knowledge/test/knowledge-api-client.test.ts
git commit -m "feat: add knowledge api client retry"
```

---

## Task 8: Add SDK Core Skeleton

**Files:**

- Create: `packages/knowledge/src/core/index.ts`
- Create: `packages/knowledge/src/core/schemas/index.ts`
- Create: `packages/knowledge/src/core/types/index.ts`
- Create: `packages/knowledge/src/core/interfaces/index.ts`
- Create: `packages/knowledge/src/core/errors/index.ts`
- Create: `packages/knowledge/src/core/pipeline/index.ts`
- Create: `packages/knowledge/src/core/constants/index.ts`
- Modify: `packages/knowledge/src/index.ts`
- Modify: `packages/knowledge/package.json`
- Test: `packages/knowledge/test/core-contracts.test.ts`

- [ ] **Step 1: Write failing core contract test**

Create `packages/knowledge/test/core-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeBaseSchema, KnowledgeValidationError, type EmbeddingProvider, type VectorStore } from '../src/core';

describe('knowledge SDK core contracts', () => {
  it('parses a knowledge base contract', () => {
    const parsed = KnowledgeBaseSchema.parse({
      id: 'kb_1',
      workspaceId: 'ws_1',
      name: '前端知识库',
      tags: ['frontend'],
      visibility: 'workspace',
      status: 'active',
      documentCount: 1,
      chunkCount: 3,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      createdBy: 'user_1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    expect(parsed.name).toBe('前端知识库');
  });

  it('exposes provider interfaces without vendor types', async () => {
    const embeddingProvider: EmbeddingProvider = {
      embed: async input => ({ embedding: input.text.split('').map(() => 0.1), model: 'test' })
    };
    const vectorStore: VectorStore = {
      upsert: async input => ({ upsertedCount: input.records.length }),
      search: async () => ({ hits: [] }),
      delete: async () => ({ deletedCount: 0 })
    };

    await expect(embeddingProvider.embed({ text: 'hello' })).resolves.toMatchObject({ model: 'test' });
    await expect(vectorStore.search({ embedding: [0.1], topK: 5 })).resolves.toEqual({ hits: [] });
  });

  it('uses SDK error base classes', () => {
    const error = new KnowledgeValidationError('Invalid input', { code: 'knowledge.validation_failed' });

    expect(error.code).toBe('knowledge.validation_failed');
    expect(error.category).toBe('validation');
  });
});
```

- [ ] **Step 2: Implement schemas and types**

Create `packages/knowledge/src/core/schemas/index.ts`:

```ts
import { z } from 'zod';

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema)
  ])
);
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

export const KnowledgeBaseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(['private', 'workspace', 'public']),
  status: z.enum(['active', 'disabled', 'archived']),
  documentCount: z.number(),
  chunkCount: z.number(),
  readyDocumentCount: z.number(),
  failedDocumentCount: z.number(),
  latestEvalScore: z.number().optional(),
  latestQuestionCount: z.number().optional(),
  latestTraceAt: z.string().optional(),
  defaultRetrievalConfigId: z.string().optional(),
  defaultPromptTemplateId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProviderHealthSchema = z.object({
  providerId: z.string(),
  status: z.enum(['healthy', 'degraded', 'unknown']),
  checkedAt: z.string(),
  latencyMs: z.number().optional(),
  message: z.string().optional()
});
```

Create `packages/knowledge/src/core/types/index.ts`:

```ts
import type { z } from 'zod';

import type { JsonObjectSchema, JsonValueSchema, KnowledgeBaseSchema, ProviderHealthSchema } from '../schemas';

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;
```

- [ ] **Step 3: Implement interfaces**

Create `packages/knowledge/src/core/interfaces/index.ts`:

```ts
import type { JsonObject, ProviderHealth } from '../types';

export interface EmbedTextInput {
  text: string;
  metadata?: JsonObject;
}

export interface EmbedTextResult {
  embedding: number[];
  model: string;
  usage?: {
    inputTokens?: number;
  };
}

export interface EmbedBatchInput {
  texts: string[];
  metadata?: JsonObject;
}

export interface EmbedBatchResult {
  embeddings: number[][];
  model: string;
}

export interface EmbeddingProvider {
  embed(input: EmbedTextInput): Promise<EmbedTextResult>;
  embedBatch?(input: EmbedBatchInput): Promise<EmbedBatchResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface VectorRecord {
  id: string;
  embedding: number[];
  content?: string;
  metadata?: JsonObject;
}

export interface VectorUpsertInput {
  records: VectorRecord[];
}

export interface VectorUpsertResult {
  upsertedCount: number;
}

export interface VectorSearchInput {
  embedding: number[];
  topK: number;
  filters?: JsonObject;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  content?: string;
  metadata?: JsonObject;
}

export interface VectorSearchResult {
  hits: VectorSearchHit[];
}

export interface VectorDeleteInput {
  ids?: string[];
  filter?: JsonObject;
}

export interface VectorDeleteResult {
  deletedCount: number;
}

export interface VectorStore {
  upsert(input: VectorUpsertInput): Promise<VectorUpsertResult>;
  search(input: VectorSearchInput): Promise<VectorSearchResult>;
  delete(input: VectorDeleteInput): Promise<VectorDeleteResult>;
  healthCheck?(): Promise<ProviderHealth>;
}
```

- [ ] **Step 4: Implement errors, constants, pipeline, and barrels**

Create `packages/knowledge/src/core/errors/index.ts`:

```ts
import type { JsonObject } from '../types';

export type KnowledgeErrorCategory =
  | 'validation'
  | 'ingestion'
  | 'retrieval'
  | 'generation'
  | 'provider'
  | 'evaluation'
  | 'authorization';

export interface KnowledgeErrorOptions {
  code: string;
  category?: KnowledgeErrorCategory;
  retryable?: boolean;
  details?: JsonObject;
  cause?: unknown;
}

export class KnowledgeError extends Error {
  readonly code: string;
  readonly category: KnowledgeErrorCategory;
  readonly retryable: boolean;
  readonly details?: JsonObject;
  override readonly cause?: unknown;

  constructor(message: string, options: KnowledgeErrorOptions) {
    super(message);
    this.name = 'KnowledgeError';
    this.code = options.code;
    this.category = options.category ?? 'provider';
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export class KnowledgeValidationError extends KnowledgeError {
  constructor(message: string, options: Omit<KnowledgeErrorOptions, 'category'>) {
    super(message, { ...options, category: 'validation' });
    this.name = 'KnowledgeValidationError';
  }
}
```

Create `packages/knowledge/src/core/constants/index.ts`:

```ts
export const DEFAULT_TOP_K = 5;
export const DEFAULT_RRF_K = 60;
export const DEFAULT_TRACE_SAMPLE_RATE = 1;
```

Create `packages/knowledge/src/core/pipeline/index.ts`:

```ts
export type AsyncPipeline<TInput, TOutput, TContext = unknown> = (input: TInput, context: TContext) => Promise<TOutput>;
```

Create `packages/knowledge/src/core/index.ts`:

```ts
export * from './schemas';
export * from './types';
export * from './interfaces';
export * from './errors';
export * from './pipeline';
export * from './constants';
```

Modify `packages/knowledge/src/index.ts` by adding:

```ts
export * from './core';
```

- [ ] **Step 5: Add package subpath export**

Modify `packages/knowledge/package.json` `exports` to include:

```json
"./core": {
  "import": {
    "types": "./build/types/knowledge/src/core/index.d.ts",
    "default": "./build/esm/core/index.mjs"
  },
  "require": {
    "types": "./build/types/knowledge/src/core/index.d.ts",
    "default": "./build/cjs/core/index.js"
  }
}
```

- [ ] **Step 6: Update tsup entries**

Modify `packages/knowledge/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

const entry = ['src/index.ts', 'src/core/index.ts'];

export default defineConfig([
  {
    entry,
    format: ['cjs'],
    outDir: 'build/cjs',
    treeshake: true
  },
  {
    entry,
    format: ['esm'],
    outDir: 'build/esm',
    treeshake: true
  }
]);
```

- [ ] **Step 7: Run core tests**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/core-contracts.test.ts test/root-exports.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/knowledge/src/core packages/knowledge/src/index.ts packages/knowledge/package.json packages/knowledge/tsup.config.ts packages/knowledge/test/core-contracts.test.ts
git commit -m "feat: add knowledge sdk core contracts"
```

---

## Task 9: Add Backend Knowledge Auth Stub

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge.module.ts`
- Create: `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.controller.ts`
- Create: `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.service.ts`
- Create: `apps/backend/agent-server/src/knowledge/auth/knowledge-jwt.ts`
- Modify: `apps/backend/agent-server/src/app/app.module.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-auth.controller.spec.ts`

- [ ] **Step 1: Write failing auth controller test**

Create `apps/backend/agent-server/test/knowledge/knowledge-auth.controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeAuthService } from '../../src/knowledge/auth/knowledge-auth.service';

describe('KnowledgeAuthService', () => {
  it('returns access and refresh tokens on login', async () => {
    const service = new KnowledgeAuthService();

    const result = await service.login({ email: 'dev@example.com', password: 'secret' });

    expect(result.user.email).toBe('dev@example.com');
    expect(result.tokens.tokenType).toBe('Bearer');
    expect(result.tokens.accessToken).toContain('knowledge-access');
    expect(result.tokens.refreshToken).toContain('knowledge-refresh');
  });

  it('refreshes tokens', async () => {
    const service = new KnowledgeAuthService();

    const result = await service.refresh({ refreshToken: 'knowledge-refresh:user_1:1' });

    expect(result.tokens.accessToken).toContain('knowledge-access');
    expect(result.tokens.refreshToken).toContain('knowledge-refresh');
  });
});
```

- [ ] **Step 2: Implement auth service and token helper**

Create `apps/backend/agent-server/src/knowledge/auth/knowledge-jwt.ts`:

```ts
export function createKnowledgeAccessToken(userId: string, version = 1) {
  return `knowledge-access:${userId}:${version}`;
}

export function createKnowledgeRefreshToken(userId: string, version = 1) {
  return `knowledge-refresh:${userId}:${version}`;
}

export function parseKnowledgeRefreshToken(token: string) {
  const [prefix, kind, userId, version] = token.split(':');
  if (prefix !== 'knowledge-refresh' && `${prefix}:${kind}` !== 'knowledge-refresh') {
    return undefined;
  }
  if (prefix === 'knowledge-refresh') {
    return { userId: kind, version: Number(userId) || 1 };
  }
  return { userId, version: Number(version) || 1 };
}
```

Create `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { createKnowledgeAccessToken, createKnowledgeRefreshToken, parseKnowledgeRefreshToken } from './knowledge-jwt';

export interface KnowledgeLoginRequest {
  email: string;
  password: string;
}

export interface KnowledgeRefreshRequest {
  refreshToken: string;
}

@Injectable()
export class KnowledgeAuthService {
  async login(input: KnowledgeLoginRequest) {
    if (!input.email || !input.password) {
      throw new UnauthorizedException({ code: 'auth_invalid_credentials', message: 'Invalid credentials' });
    }
    const user = {
      id: 'user_1',
      email: input.email,
      name: 'Knowledge User',
      currentWorkspaceId: 'ws_1',
      roles: ['owner'],
      permissions: ['knowledge:read', 'knowledge:write', 'document:upload', 'chat:write', 'eval:run', 'trace:read']
    };
    return {
      user,
      tokens: {
        accessToken: createKnowledgeAccessToken(user.id),
        refreshToken: createKnowledgeRefreshToken(user.id),
        tokenType: 'Bearer' as const,
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };
  }

  async refresh(input: KnowledgeRefreshRequest) {
    const parsed = parseKnowledgeRefreshToken(input.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException({ code: 'auth_refresh_token_invalid', message: 'Invalid refresh token' });
    }
    return {
      tokens: {
        accessToken: createKnowledgeAccessToken(parsed.userId, parsed.version + 1),
        refreshToken: createKnowledgeRefreshToken(parsed.userId, parsed.version + 1),
        tokenType: 'Bearer' as const,
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };
  }

  async me() {
    return {
      user: {
        id: 'user_1',
        email: 'dev@example.com',
        name: 'Knowledge User',
        currentWorkspaceId: 'ws_1',
        roles: ['owner'],
        permissions: ['knowledge:read', 'knowledge:write', 'document:upload', 'chat:write', 'eval:run', 'trace:read']
      }
    };
  }
}
```

- [ ] **Step 3: Add controller and module**

Create `apps/backend/agent-server/src/knowledge/auth/knowledge-auth.controller.ts`:

```ts
import { Body, Controller, Get, Post } from '@nestjs/common';

import {
  KnowledgeAuthService,
  type KnowledgeLoginRequest,
  type KnowledgeRefreshRequest
} from './knowledge-auth.service';

@Controller('knowledge/v1/auth')
export class KnowledgeAuthController {
  constructor(private readonly authService: KnowledgeAuthService) {}

  @Post('login')
  login(@Body() body: KnowledgeLoginRequest) {
    return this.authService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: KnowledgeRefreshRequest) {
    return this.authService.refresh(body);
  }

  @Get('me')
  me() {
    return this.authService.me();
  }

  @Post('logout')
  logout() {
    return { ok: true };
  }
}
```

Create `apps/backend/agent-server/src/knowledge/knowledge.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { KnowledgeAuthController } from './auth/knowledge-auth.controller';
import { KnowledgeAuthService } from './auth/knowledge-auth.service';

@Module({
  controllers: [KnowledgeAuthController],
  providers: [KnowledgeAuthService]
})
export class KnowledgeModule {}
```

Modify `apps/backend/agent-server/src/app/app.module.ts` by importing and adding `KnowledgeModule` to module imports.

- [ ] **Step 4: Run backend auth tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge/knowledge-auth.controller.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/src/app/app.module.ts apps/backend/agent-server/test/knowledge/knowledge-auth.controller.spec.ts
git commit -m "feat: add knowledge auth api stub"
```

---

## Task 10: Add Backend Knowledge MVP Stub APIs

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/shared/knowledge-api-fixtures.ts`
- Create controllers under `apps/backend/agent-server/src/knowledge/**`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-stub-api.spec.ts`

- [ ] **Step 1: Write stub fixture tests**

Create `apps/backend/agent-server/test/knowledge/knowledge-stub-api.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { knowledgeApiFixtures } from '../../src/knowledge/shared/knowledge-api-fixtures';

describe('knowledge API fixtures', () => {
  it('contains MVP dashboard, chat, trace, and eval data', () => {
    expect(knowledgeApiFixtures.dashboard.knowledgeBaseCount).toBeGreaterThan(0);
    expect(knowledgeApiFixtures.knowledgeBases.items[0]?.name).toBe('前端知识库');
    expect(knowledgeApiFixtures.chatResponse.traceId).toBe(knowledgeApiFixtures.traceDetail.id);
    expect(knowledgeApiFixtures.evalRuns.items[0]?.summary?.totalScore).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Create fixtures**

Create `apps/backend/agent-server/src/knowledge/shared/knowledge-api-fixtures.ts`:

```ts
const now = '2026-05-01T00:00:00.000Z';

export const knowledgeApiFixtures = {
  knowledgeBases: {
    items: [
      {
        id: 'kb_frontend',
        workspaceId: 'ws_1',
        name: '前端知识库',
        tags: ['frontend'],
        visibility: 'workspace',
        status: 'active',
        documentCount: 1,
        chunkCount: 2,
        readyDocumentCount: 1,
        failedDocumentCount: 0,
        latestEvalScore: 86,
        latestQuestionCount: 12,
        latestTraceAt: now,
        createdBy: 'user_1',
        createdAt: now,
        updatedAt: now
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  documents: {
    items: [
      {
        id: 'doc_frontend_conventions',
        workspaceId: 'ws_1',
        knowledgeBaseId: 'kb_frontend',
        title: '前端规范',
        filename: 'frontend.md',
        sourceType: 'user-upload',
        status: 'ready',
        version: 'v1',
        chunkCount: 2,
        embeddedChunkCount: 2,
        createdBy: 'user_1',
        createdAt: now,
        updatedAt: now
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  chunks: {
    items: [
      {
        id: 'chunk_1',
        documentId: 'doc_frontend_conventions',
        knowledgeBaseId: 'kb_frontend',
        chunkIndex: 0,
        content: '默认使用顶层静态 import，动态导入只用于代码分割或浏览器专属重资产加载。',
        tokenCount: 32,
        status: 'ready',
        embeddingModel: 'mock-embedding',
        embeddingStatus: 'ready',
        createdAt: now,
        updatedAt: now
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  jobs: [
    {
      id: 'job_1',
      documentId: 'doc_frontend_conventions',
      status: 'succeeded',
      currentStage: 'commit',
      stages: [
        { stage: 'upload_received', status: 'succeeded', latencyMs: 10 },
        { stage: 'parse', status: 'succeeded', latencyMs: 20 },
        { stage: 'chunk', status: 'succeeded', latencyMs: 15 },
        { stage: 'embed', status: 'succeeded', latencyMs: 30 },
        { stage: 'index_vector', status: 'succeeded', latencyMs: 12 },
        { stage: 'index_keyword', status: 'succeeded', latencyMs: 9 },
        { stage: 'commit', status: 'succeeded', latencyMs: 5 }
      ],
      createdAt: now,
      startedAt: now,
      completedAt: now
    }
  ],
  chatResponse: {
    conversationId: 'conv_1',
    answer: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
    traceId: 'trace_1',
    citations: [
      {
        id: 'cite_1',
        documentId: 'doc_frontend_conventions',
        chunkId: 'chunk_1',
        title: '前端规范',
        quote: '默认使用顶层静态 import',
        score: 0.91
      }
    ],
    userMessage: {
      id: 'msg_user',
      conversationId: 'conv_1',
      role: 'user',
      content: '动态导入有什么限制？',
      createdAt: now
    },
    assistantMessage: {
      id: 'msg_assistant',
      conversationId: 'conv_1',
      role: 'assistant',
      content: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
      traceId: 'trace_1',
      citations: [
        {
          id: 'cite_1',
          documentId: 'doc_frontend_conventions',
          chunkId: 'chunk_1',
          title: '前端规范',
          quote: '默认使用顶层静态 import',
          score: 0.91
        }
      ],
      createdAt: now
    }
  },
  traceDetail: {
    id: 'trace_1',
    workspaceId: 'ws_1',
    conversationId: 'conv_1',
    messageId: 'msg_assistant',
    knowledgeBaseIds: ['kb_frontend'],
    question: '动态导入有什么限制？',
    answer: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
    status: 'succeeded',
    latencyMs: 880,
    hitCount: 1,
    citationCount: 1,
    createdBy: 'user_1',
    createdAt: now,
    citations: [
      {
        id: 'cite_1',
        documentId: 'doc_frontend_conventions',
        chunkId: 'chunk_1',
        title: '前端规范',
        quote: '默认使用顶层静态 import',
        score: 0.91
      }
    ],
    spans: [
      {
        id: 'span_embedding',
        traceId: 'trace_1',
        stage: 'embedding',
        name: 'Embedding',
        status: 'succeeded',
        latencyMs: 100
      },
      {
        id: 'span_vector',
        traceId: 'trace_1',
        stage: 'vector_search',
        name: 'Vector Search',
        status: 'succeeded',
        latencyMs: 120
      },
      {
        id: 'span_generation',
        traceId: 'trace_1',
        stage: 'generation',
        name: 'Generation',
        status: 'succeeded',
        latencyMs: 600
      }
    ],
    retrievalSnapshot: {
      vectorHits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_frontend_conventions',
          title: '前端规范',
          contentPreview: '默认使用顶层静态 import',
          score: 0.91,
          rank: 1
        }
      ],
      keywordHits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_frontend_conventions',
          title: '前端规范',
          contentPreview: '动态导入',
          score: 0.88,
          rank: 1
        }
      ],
      mergedHits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_frontend_conventions',
          title: '前端规范',
          contentPreview: '默认使用顶层静态 import',
          score: 0.91,
          rank: 1
        }
      ],
      rerankedHits: [],
      selectedChunks: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_frontend_conventions',
          title: '前端规范',
          contentPreview: '默认使用顶层静态 import',
          score: 0.91,
          rank: 1
        }
      ]
    }
  },
  evalDatasets: {
    items: [
      {
        id: 'dataset_1',
        workspaceId: 'ws_1',
        name: '前端规范评测集',
        tags: ['frontend'],
        caseCount: 1,
        createdBy: 'user_1',
        createdAt: now,
        updatedAt: now
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  evalRuns: {
    items: [
      {
        id: 'run_1',
        workspaceId: 'ws_1',
        datasetId: 'dataset_1',
        knowledgeBaseIds: ['kb_frontend'],
        status: 'succeeded',
        caseCount: 1,
        completedCaseCount: 1,
        failedCaseCount: 0,
        summary: { totalScore: 86, retrievalScore: 90, generationScore: 82 },
        createdBy: 'user_1',
        createdAt: now
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  evalResults: {
    items: [
      {
        id: 'result_1',
        runId: 'run_1',
        caseId: 'case_1',
        status: 'succeeded',
        actualAnswer: '默认使用顶层静态 import。',
        citations: [],
        traceId: 'trace_1',
        retrievalMetrics: { recallAtK: 1, mrr: 1 },
        generationMetrics: { faithfulness: 0.86, answerRelevance: 0.9 }
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  },
  dashboard: {
    knowledgeBaseCount: 1,
    documentCount: 1,
    readyDocumentCount: 1,
    failedDocumentCount: 0,
    todayQuestionCount: 12,
    averageLatencyMs: 880,
    p95LatencyMs: 1200,
    p99LatencyMs: 1600,
    errorRate: 0,
    noAnswerRate: 0.02,
    negativeFeedbackRate: 0.08,
    latestEvalScore: 86,
    activeAlertCount: 0,
    recentFailedJobs: [],
    recentLowScoreTraces: [],
    recentEvalRuns: [],
    topMissingKnowledgeQuestions: ['如何配置多知识库检索？']
  }
} as const;
```

- [ ] **Step 3: Add controllers that return fixtures**

Create controller files that expose the MVP endpoints and return `knowledgeApiFixtures`. For example, create `apps/backend/agent-server/src/knowledge/dashboard/knowledge-dashboard.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

import { knowledgeApiFixtures } from '../shared/knowledge-api-fixtures';

@Controller('knowledge/v1/dashboard')
export class KnowledgeDashboardController {
  @Get('overview')
  getOverview() {
    return knowledgeApiFixtures.dashboard;
  }
}
```

Create equivalent controllers for:

- `knowledge/v1/knowledge-bases`
- `knowledge/v1/documents`
- `knowledge/v1/chat`
- `knowledge/v1/observability`
- `knowledge/v1/eval`

Each controller must return the fixture shape declared in `docs/contracts/api/knowledge.md`.

- [ ] **Step 4: Register controllers in KnowledgeModule**

Modify `apps/backend/agent-server/src/knowledge/knowledge.module.ts` to include every stub controller.

- [ ] **Step 5: Run backend stub tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge/knowledge-stub-api.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-stub-api.spec.ts
git commit -m "feat: add knowledge mvp api stubs"
```

---

## Task 11: Build Frontend Mock MVP Pages

**Files:**

- Create: `apps/frontend/knowledge/src/api/mock-data.ts`
- Create: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Create MVP feature page files listed in File Structure.
- Modify: `apps/frontend/knowledge/src/app/App.tsx`
- Create: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`
- Create: `apps/frontend/knowledge/src/app/protected-route.tsx`
- Create: `apps/frontend/knowledge/src/features/auth/auth-provider.tsx`
- Create: `apps/frontend/knowledge/src/features/auth/login-page.tsx`

- [ ] **Step 1: Create mock data**

Create `apps/frontend/knowledge/src/api/mock-data.ts` using the same fixture objects from `knowledge-api-fixtures.ts`, adjusted to import local API types:

```ts
import type {
  DashboardOverview,
  EvalDataset,
  EvalRun,
  KnowledgeBase,
  KnowledgeDocument,
  RagTraceDetail
} from '../types/api';

export const mockKnowledgeBases = [
  {
    id: 'kb_frontend',
    workspaceId: 'ws_1',
    name: '前端知识库',
    tags: ['frontend'],
    visibility: 'workspace',
    status: 'active',
    documentCount: 1,
    chunkCount: 2,
    readyDocumentCount: 1,
    failedDocumentCount: 0,
    latestEvalScore: 86,
    latestQuestionCount: 12,
    latestTraceAt: '2026-05-01T00:00:00.000Z',
    createdBy: 'user_1',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z'
  }
] satisfies KnowledgeBase[];

export const mockDocuments = [
  {
    id: 'doc_frontend_conventions',
    workspaceId: 'ws_1',
    knowledgeBaseId: 'kb_frontend',
    title: '前端规范',
    filename: 'frontend.md',
    sourceType: 'user-upload',
    status: 'ready',
    version: 'v1',
    chunkCount: 2,
    embeddedChunkCount: 2,
    createdBy: 'user_1',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z'
  }
] satisfies KnowledgeDocument[];

export const mockDashboard = {
  knowledgeBaseCount: 1,
  documentCount: 1,
  readyDocumentCount: 1,
  failedDocumentCount: 0,
  todayQuestionCount: 12,
  averageLatencyMs: 880,
  p95LatencyMs: 1200,
  p99LatencyMs: 1600,
  errorRate: 0,
  noAnswerRate: 0.02,
  negativeFeedbackRate: 0.08,
  latestEvalScore: 86,
  activeAlertCount: 0,
  recentFailedJobs: [],
  recentLowScoreTraces: [],
  recentEvalRuns: [],
  topMissingKnowledgeQuestions: ['如何配置多知识库检索？']
} satisfies DashboardOverview;

export const mockTraceDetail = {
  id: 'trace_1',
  workspaceId: 'ws_1',
  knowledgeBaseIds: ['kb_frontend'],
  question: '动态导入有什么限制？',
  answer: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
  status: 'succeeded',
  latencyMs: 880,
  hitCount: 1,
  citationCount: 1,
  createdAt: '2026-05-01T00:00:00.000Z',
  spans: [
    {
      id: 'span_embedding',
      traceId: 'trace_1',
      stage: 'embedding',
      name: 'Embedding',
      status: 'succeeded',
      latencyMs: 100
    },
    {
      id: 'span_vector',
      traceId: 'trace_1',
      stage: 'vector_search',
      name: 'Vector Search',
      status: 'succeeded',
      latencyMs: 120
    },
    {
      id: 'span_generation',
      traceId: 'trace_1',
      stage: 'generation',
      name: 'Generation',
      status: 'succeeded',
      latencyMs: 600
    }
  ],
  citations: []
} satisfies RagTraceDetail;

export const mockEvalDatasets = [
  {
    id: 'dataset_1',
    workspaceId: 'ws_1',
    name: '前端规范评测集',
    tags: ['frontend'],
    caseCount: 1,
    createdBy: 'user_1',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z'
  }
] satisfies EvalDataset[];

export const mockEvalRuns = [
  {
    id: 'run_1',
    workspaceId: 'ws_1',
    datasetId: 'dataset_1',
    knowledgeBaseIds: ['kb_frontend'],
    status: 'succeeded',
    caseCount: 1,
    completedCaseCount: 1,
    failedCaseCount: 0,
    summary: { totalScore: 86, retrievalScore: 90, generationScore: 82 },
    createdBy: 'user_1',
    createdAt: '2026-05-01T00:00:00.000Z'
  }
] satisfies EvalRun[];
```

- [ ] **Step 2: Add mock client**

Create `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`:

```ts
import type { ChatRequest, ChatResponse, PageResult } from '../types/api';
import {
  mockDashboard,
  mockDocuments,
  mockEvalDatasets,
  mockEvalRuns,
  mockKnowledgeBases,
  mockTraceDetail
} from './mock-data';

export class MockKnowledgeApiClient {
  async getDashboardOverview() {
    return mockDashboard;
  }

  async listKnowledgeBases() {
    return page(mockKnowledgeBases);
  }

  async listDocuments() {
    return page(mockDocuments);
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    return {
      conversationId: input.conversationId ?? 'conv_1',
      answer: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
      traceId: mockTraceDetail.id,
      citations: [],
      userMessage: {
        id: 'msg_user',
        conversationId: input.conversationId ?? 'conv_1',
        role: 'user',
        content: input.message,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: 'msg_assistant',
        conversationId: input.conversationId ?? 'conv_1',
        role: 'assistant',
        content: '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。',
        traceId: mockTraceDetail.id,
        citations: [],
        createdAt: new Date().toISOString()
      }
    };
  }

  async getTrace() {
    return { trace: mockTraceDetail };
  }

  async listTraces() {
    return page([mockTraceDetail]);
  }

  async listEvalDatasets() {
    return page(mockEvalDatasets);
  }

  async listEvalRuns() {
    return page(mockEvalRuns);
  }
}

function page<T>(items: T[]): PageResult<T> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}
```

- [ ] **Step 3: Add simple App Shell**

Create `apps/frontend/knowledge/src/app/layout/app-shell.tsx`:

```tsx
import type { ReactNode } from 'react';

const navItems = ['总览', '知识库', '文档', '对话实验室', '评测中心', '观测中心', '设置'];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <aside style={{ borderRight: '1px solid #ddd', padding: 20 }}>
        <h1 style={{ fontSize: 20 }}>Knowledge</h1>
        <nav style={{ display: 'grid', gap: 8 }}>
          {navItems.map(item => (
            <button key={item} style={{ textAlign: 'left', padding: 8 }}>
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Add MVP pages**

Create `apps/frontend/knowledge/src/features/overview/overview-page.tsx`:

```tsx
import { mockDashboard } from '../../api/mock-data';

export function OverviewPage() {
  return (
    <section>
      <h2>总览</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Metric label="知识库" value={mockDashboard.knowledgeBaseCount} />
        <Metric label="文档" value={mockDashboard.documentCount} />
        <Metric label="今日问答" value={mockDashboard.todayQuestionCount} />
        <Metric label="P95" value={`${mockDashboard.p95LatencyMs}ms`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
```

Create analogous simple pages for knowledge bases, document detail, chat lab, trace list/detail, eval datasets, eval runs, and eval run detail. Each page must read from `mock-data.ts` and render at least one list/detail section.

- [ ] **Step 5: Wire App to Overview**

Modify `apps/frontend/knowledge/src/app/App.tsx`:

```tsx
import { AppShell } from './layout/app-shell';
import { OverviewPage } from '../features/overview/overview-page';

export function App() {
  return (
    <AppShell>
      <OverviewPage />
    </AppShell>
  );
}
```

- [ ] **Step 6: Run frontend verification**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge
git commit -m "feat: build knowledge frontend mock mvp"
```

---

## Verification Matrix

Run these before claiming the full MVP plan implementation is complete:

```bash
pnpm check:docs
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
pnpm --dir packages/knowledge exec vitest run test/core-contracts.test.ts test/root-exports.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge/knowledge-auth.controller.spec.ts test/knowledge/knowledge-stub-api.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

If a command fails because a later task has not been implemented yet, do not mark the full plan complete. Complete the missing task first.

## Self-Review

Spec coverage:

- API contract covered by Task 1.
- SDK architecture covered by Task 2 and Task 8.
- Frontend product design covered by Task 3 and Task 11.
- JWT double-token localStorage auth covered by Task 6 and Task 7.
- Backend refresh endpoint and stub APIs covered by Task 9 and Task 10.
- Frontend mock-first MVP covered by Task 4, Task 5, Task 6, Task 7, and Task 11.

Placeholder scan:

- This plan contains no `TBD`, no `TODO`, and no unspecified code steps for the first MVP skeleton.
- Task 11 intentionally asks for analogous simple pages after providing the concrete pattern. During execution, implement each named page file with concrete markup before marking Task 11 complete.

Type consistency:

- API type names match across docs, frontend tests, mock client, and backend fixture examples.
- Auth token field names are consistently `accessToken`, `refreshToken`, `expiresIn`, and `refreshExpiresIn`.
