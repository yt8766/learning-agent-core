状态：current
文档类型：architecture
适用范围：`apps/backend/agent-server/src/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-07

# Agent Server Knowledge 后端

> Status: unified backend migration in progress.
> `apps/backend/agent-server/src/domains/knowledge` 是统一后端目标下的新 Knowledge domain shell。
> `apps/backend/agent-server/src/knowledge` 仍是历史 runtime-internal / stub 路径；不要把新增主业务继续堆回旧目录。

当前统一后端新增了 Knowledge domain route shell：

```text
apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts
apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts
apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts
apps/backend/agent-server/src/domains/knowledge/services/*
```

新增 shell 暴露：

```text
GET /api/knowledge/bases
POST /api/knowledge/bases
GET /api/knowledge/bases/:baseId/members
POST /api/knowledge/bases/:baseId/members
GET /api/knowledge/documents
POST /api/knowledge/bases/:baseId/uploads
POST /api/knowledge/bases/:baseId/documents
GET /api/knowledge/documents/:documentId
GET /api/knowledge/documents/:documentId/jobs/latest
GET /api/knowledge/documents/:documentId/chunks
POST /api/knowledge/documents/:documentId/reprocess
DELETE /api/knowledge/documents/:documentId
GET /api/knowledge/embedding-models
POST /api/knowledge/chat
GET /api/knowledge/rag/model-profiles
GET /api/knowledge/conversations
GET /api/knowledge/conversations/:id/messages
POST /api/knowledge/messages/:messageId/feedback
GET /api/knowledge/v1/bases
POST /api/knowledge/v1/bases
...same document/chat/member endpoints under /api/knowledge/v1
GET /api/knowledge/workspace/users
POST /api/knowledge/workspace/users/invitations
GET /api/knowledge/settings/model-providers
GET /api/knowledge/settings/api-keys
POST /api/knowledge/settings/api-keys
GET /api/knowledge/settings/storage
GET /api/knowledge/settings/security
PATCH /api/knowledge/settings/security
GET /api/knowledge/chat/assistant-config
PATCH /api/knowledge/chat/assistant-config
```

当前 `src/domains/knowledge` 已迁入这些内存闭环能力：

- `KnowledgeMemoryRepository`：base/member/upload/document/job/chunk/chat conversation/message 的内存 repository 实现。
- `PostgresKnowledgeRepository`：`KnowledgeRepository` 的 PostgreSQL 实现，已按 `mapper + helper + repository` 拆分，避免把历史独立知识库服务的 400+ 行仓库整文件搬回统一域。
- `createKnowledgeRepositoryProvider()`：统一 domain 的 repository provider factory。默认和 `KNOWLEDGE_REPOSITORY=memory` 绑定 `KnowledgeMemoryRepository`；`KNOWLEDGE_REPOSITORY=postgres` 时要求 `DATABASE_URL`，先执行 `runtime/knowledge-schema.sql.ts`，再绑定 `PostgresKnowledgeRepository`。`KnowledgeBaseService`、`KnowledgeUploadService`、`KnowledgeDocumentService`、`KnowledgeIngestionWorker` 与 `KnowledgeRagService` 都只能消费 `KNOWLEDGE_REPOSITORY` token，不允许再直接注入 memory repository 具体类。
- `createKnowledgeSdkRuntimeProvider()`：统一 domain 的 SDK runtime provider。只有 `DATABASE_URL`、`KNOWLEDGE_CHAT_MODEL`、`KNOWLEDGE_EMBEDDING_MODEL`、`KNOWLEDGE_LLM_API_KEY` 等 SDK 环境完整时才启用；未配置或部分配置时返回 `{ enabled:false, runtime:null }`，不会创建 LLM runtime 或 SQL client，也不能阻断统一后端启动。启用后会执行同一份 `runtime/knowledge-schema.sql.ts`，并把 SDK vector RPC 映射到 Postgres function SQL。
- `KnowledgeBaseService`：base 创建、列表、member 管理和 owner/viewer 权限校验。
- `KnowledgeUploadService`：Markdown/TXT 上传校验、UTF-8 文件名修复、对象存储写入和 upload record 保存。
- `KnowledgeDocumentService`：从 upload 创建 document/job、内存 ingestion queue/worker、chunk 生成、document/job/chunk 查询、reprocess 与 delete。
- `KnowledgeIngestionQueue` / `KnowledgeIngestionWorker`：由 `KnowledgeDomainModule.onModuleInit()` 启动，模块销毁时 stop；不要在 HTTP service 内手动 drain 队列。
- `KnowledgeFrontendSettingsService`：workspace users、invitation、model providers、API keys、storage/security/assistant config 的前端治理面投影。
- `KnowledgeProviderHealthService`：embedding/vector/keyword/generation 探针聚合；未配置返回 `unconfigured`，探针异常返回 `degraded`。
- `KnowledgeEvalService`：dataset/case/run/result lifecycle、RAG runner 适配、`@agent/knowledge/evals` deterministic judge 与 run comparison projection；统一域内已接 `KnowledgeRagService.answer()`。
- `KnowledgeTraceService`：RAG / ingestion / eval 等链路的 JSON-safe trace/span 内存投影，span attributes 只保留 string/number/boolean/null。
- `KnowledgeRagModelProfileService`：RAG model profile schema 校验、摘要投影和 enabled profile 解析；默认 profile 读取 `KNOWLEDGE_*_MODEL` 环境变量并回退到本地占位 model id。
- `src/domains/knowledge/rag/knowledge-rag-sdk.facade.ts`：统一 domain 内的 SDK RAG facade，负责把 `@agent/knowledge` 的 `runKnowledgeRag()` / `streamKnowledgeRag()` 编排封装在领域边界内。facade 消费 repository、SDK runtime、planner provider、search adapter 与 answer provider，并输出统一 `KnowledgeChatResponse` projection 或 `KnowledgeRagStreamEvent`。
- `src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`：统一 domain 内的 SDK answer provider 与 deterministic planner fallback。answer provider 只消费项目自己的 `KnowledgeSdkRuntimeProviderValue`，SDK generate/stream 异常会记录为 provider last error，再由 facade/service 映射为稳定 `KnowledgeServiceError`。
- `src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts`：统一 domain 内的 `@agent/knowledge` `KnowledgeSearchService` adapter。启用 SDK runtime 时优先 query embedding + vector search；vector 缺失、失败或命中无法映射 repository chunk 时回退 repository keyword / 中文 substring 检索，并返回统一 diagnostics。
- `KnowledgeRagService`：统一后端稳定 RAG service 边界。默认未配置 SDK runtime 时保持 repository-backed 本地关键词答案，并支持同一套 RAG event contract 的 deterministic SSE fallback；`createKnowledgeSdkRuntimeProvider()` 启用后会通过 `KnowledgeRagSdkFacade` 走 SDK planner / search / answer JSON 或 streaming 编排，同时仍由 service 负责持久化 chat messages 与 trace。
- `rag/*` 纯 provider：已迁入 HyDE query expansion、structured planner、rerank 和 hallucination detector provider。它们只消费项目自定义 LLM boundary / `@agent/knowledge` contract，不直接接触 vendor SDK。
- `src/domains/knowledge/storage/knowledge-oss-storage.provider.ts`：统一 storage provider factory。默认绑定 `InMemoryOssStorageProvider`；`KNOWLEDGE_OSS_PROVIDER=aliyun` 且 `ALIYUN_OSS_BUCKET`、`ALIYUN_OSS_REGION`、`ALIYUN_OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_ID`、`ALIYUN_OSS_ACCESS_KEY_SECRET` / `OSS_ACCESS_KEY_SECRET` 完整时绑定 `AliyunOssStorageProvider`。upload/document/ingestion 只消费 `KNOWLEDGE_OSS_STORAGE` token，不再直接绑定内存 provider。
- 统一 `KnowledgeApiController` 同时挂载 `/api/knowledge/*` 与 `/api/knowledge/v1/*`，公开 document/upload/chat/conversation/feedback endpoint 都经由同一 controller + domain service。不要再把 legacy v1 别名单独注册成第二套 controller，以免同一路径重复匹配。

统一 `agent-server` Knowledge domain 已是 frontend-facing Knowledge API 的 canonical backend host。`/api/knowledge/v1/*` 只保留历史客户端兼容价值；新增后端能力应优先向 `src/domains/knowledge` 收敛。统一后端当前已迁入 Chat Lab RAG JSON 响应与 `stream:true` SSE streaming；HTTP controller 只做请求归一化、鉴权、错误映射和 SSE 封帧，RAG 事件语义由 `KnowledgeRagService` / `KnowledgeRagSdkFacade` 负责。

历史 `apps/backend/agent-server/src/knowledge` 保留为 runtime-internal 参考实现，覆盖 RAG、ingestion、observability、evals、vector store provider 等纵向能力。迁移时应把可复用服务收敛到 `src/domains/knowledge` 的 service / repository / provider 边界，而不是继续扩展旧目录。

## 分层职责

新统一后端 domain 的分层职责：

- `src/api/knowledge/*`：canonical `/api/knowledge/*`、frontend settings API 与 legacy `/api/knowledge/v1/*` HTTP shell；请求体验证优先使用 `@agent/core` schema，document/chat 本地域 schema 位于 `src/domains/knowledge/domain/*`。
- `src/domains/knowledge/repositories/*`：Knowledge domain repository contract、memory/postgres 实现、postgres mapper 与 helper；不要复用旧 `src/knowledge` token。
- `src/domains/knowledge/runtime/*`：Knowledge domain 的 runtime provider factory、Postgres client boundary 与 schema bootstrap。只允许这里读取 `KNOWLEDGE_REPOSITORY` / `DATABASE_URL` 并创建 `pg.Pool`；service、controller、RAG facade 不直接接触 `pg` 或环境变量。
- `src/domains/knowledge/rag/*`：HyDE、planner、rerank、hallucination detector 等 RAG 组合 provider。这里可以消费 `@agent/knowledge` 的稳定 provider contract，但 vendor SDK client 创建必须继续留在 adapter / provider factory 边界。
- `src/domains/knowledge/services/*`：base、upload、document、ingestion queue/worker、frontend settings、provider health、eval、trace、RAG observability、RAG model profile、RAG facade 等领域服务；service 只注入 repository / storage / runtime token，不绑定具体 provider 类。
- `src/domains/knowledge/storage/*`：OSS provider contract、memory provider、Aliyun OSS provider 与 storage provider factory；vendor SDK 只能停留在 provider 边界。
- `src/domains/knowledge/domain/*`：document/upload/chat/RAG 相关本地域类型和 schema。

历史 `src/knowledge` 的职责：

- `knowledge.controller.ts`：transport 层，暴露 auth、knowledge bases、documents、chat、observability、evals API。
- `knowledge.service.ts`：应用 facade，负责 public API 的服务端上下文覆盖、fixture fallback、service 分发和 DTO projection。
- `knowledge-auth.service.ts`：JWT access token + refresh token rotation、refresh token hash、logout no-op/idempotent 语义。
- `knowledge-ingestion.service.ts`：上传文件处理、parser、chunker、embedder、vector store upsert orchestration。
- `knowledge-rag.service.ts`：检索、回答生成、citation projection、message/trace 持久化。
- `knowledge-observability.service.ts`：只聚合 `operation="rag.chat"` trace，输出 metrics、trace list、trace detail projection。
- `knowledge-eval.service.ts`：dataset/case/run/result lifecycle、runner/judge provider、retrieval/generation metrics、run comparison。
- `repositories/*`：持久化边界；`KnowledgeModule` 通过 provider config 在 `memory` 与 `postgres` repository 之间切换，service contract 不变。

## Provider 边界

第三方能力必须先经过项目自定义 provider / adapter：

- document parser
- embedder
- vector store
- RAG retriever / generator
- eval runner / judge
- trace sink / repository

第三方 SDK 对象、vendor response、raw headers、provider error 不允许穿透到 API DTO、SDK core contract、graph state 或持久化 display projection。

## Knowledge Runtime Providers

Legacy runtime-internal Knowledge backend still lives in `apps/backend/agent-server/src/knowledge`. The frontend-facing Knowledge backend now lives in `apps/backend/agent-server/src/domains/knowledge`.

| Env                         | Values                        | Purpose                                                   |
| --------------------------- | ----------------------------- | --------------------------------------------------------- |
| `KNOWLEDGE_REPOSITORY`      | `memory`, `postgres`          | Selects business data persistence.                        |
| `KNOWLEDGE_VECTOR_STORE`    | `memory`, `supabase-pgvector` | Selects retrieval vector storage.                         |
| `DATABASE_URL`              | PostgreSQL connection string  | Required when `KNOWLEDGE_REPOSITORY=postgres`.            |
| `SUPABASE_URL`              | Supabase project URL          | Required when `KNOWLEDGE_VECTOR_STORE=supabase-pgvector`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key     | Required only on the backend for vector writes/search.    |

统一 `src/domains/knowledge` 当前由 `createKnowledgeRepositoryProvider()` 负责 repository 选择。未设置 `KNOWLEDGE_REPOSITORY` 时默认使用 `memory`；显式设置为 `postgres` 时必须同时提供 `DATABASE_URL`。统一 domain 不因为单独存在 `DATABASE_URL` 自动切换到 postgres，避免本地环境误连数据库。

历史 `src/knowledge` production-cutover Task 5 已完成内部 Nest provider wiring。没有 `DATABASE_URL` 且没有显式选择 provider 时，`KNOWLEDGE_REPOSITORY=memory` 会绑定 `InMemoryKnowledgeRepository` 与 `InMemoryKnowledgeSessionRepository`，不要求 `DATABASE_URL`，也不会创建 SQL client。新的前端业务集成不再依赖这一路径，必须优先接入 `src/domains/knowledge`。

历史 `src/knowledge` 路径中，`DATABASE_URL` 存在时默认切到 postgres repository；也可以显式设置 `KNOWLEDGE_REPOSITORY=postgres`。该 postgres 模式会通过 provider module 边界创建单例 `pg.Pool`，并包装成项目内 `KnowledgeSqlClient` token（`KNOWLEDGE_SQL_CLIENT`）。业务 repository 只依赖该项目自定义 SQL client contract，不直接接触 `pg` 类型；`PostgresKnowledgeRepository` 与 `PostgresKnowledgeSessionRepository` 注入同一个 SQL client。SQL client provider 参与 Nest shutdown lifecycle，模块关闭时会调用可选 `close()` 释放 pool。测试可通过 Nest `overrideProvider(KNOWLEDGE_SQL_CLIENT)` 替换为 fake client，避免连接真实数据库。显式启用 postgres mode 时必须配置 `DATABASE_URL`，缺失时由 provider config parser 拒绝启动。

postgres 模式下，Knowledge 登录不再使用任意账号 stub，而是通过 `PostgresKnowledgeAdminAuthenticator` 读取 agent-server 侧的 `admin_accounts` / `admin_password_credentials` 数据库超管凭据。只有启用状态的 `super_admin` 账号可映射为 Knowledge `owner` 用户；登录成功后仍签发 Knowledge 自己的双 token，refresh session 存入 `knowledge_auth_sessions`。

Task 6 已接入 vector store provider wiring。`KNOWLEDGE_VECTOR_STORE=memory` 会绑定本地 no-op `KnowledgeVectorStore`，用于本地开发和测试，不要求 Supabase 凭据。`KNOWLEDGE_VECTOR_STORE=supabase-pgvector` 会通过 backend-only `KNOWLEDGE_VECTOR_STORE` token 创建 Supabase pgvector wrapper：agent-server 只从 `@agent/adapters` 根入口导入 `SupabasePgVectorStoreAdapter`，并使用内置 `fetch` 实现 `SupabaseRpcClientLike`，不会新增或依赖 `@supabase/supabase-js`。RPC 请求只在后端携带 `SUPABASE_SERVICE_ROLE_KEY`，该 key 不允许出现在 frontend config 或 API response 中。

当前 Task 6 的真实接线范围是 ingestion/indexing：`KnowledgeModule` 会把 `KNOWLEDGE_VECTOR_STORE` 注入 `KnowledgeIngestionService`，上传文档完成 chunk 和 embedding 后会调用 vector store `upsert()`。本地 `KnowledgeVectorStore` contract 返回 `{ inserted }` / `{ deleted }`，Supabase adapter 返回 `upsertedCount` / `deletedCount`，由 `knowledge-vector-store.factory.ts` 中的 wrapper 做映射；search 结果同样映射为本地 `{ matches }`。

Supabase pgvector wrapper 在调用 adapter 前会校验 upsert chunk embedding 与 search query embedding 必须是 1536 维，和 `knowledge_chunks.embedding vector(1536)` 保持一致；维度不匹配会直接抛出 `Supabase pgvector embeddings must contain 1536 dimensions`，避免短维度 deterministic embedding 误写入生产 vector store。Supabase RPC response body 会先读取 text，再尝试 `JSON.parse`；空响应使用 `null`，非 JSON 文本会保留原始 text；非 2xx 响应统一返回 `{ data: null, error: { status, body } }` 交给 adapter 归一化。

RAG 当前仍走 `KnowledgeRagRetriever`，默认实现是基于 repository chunks 的 deterministic retriever。本轮没有生产 query embedder，也没有把 vector store 伪装成 RAG retriever；后续需要先接入 1536 维 query embedding provider，再新增真正的 Supabase vector retriever，并继续保持 retriever / generator provider 边界。

## PostgreSQL / Supabase Schema

生产数据库 schema 入口为 `apps/backend/agent-server/src/domains/knowledge/runtime/knowledge-schema.sql`。该文件是统一 Knowledge Domain 的 PostgreSQL / Supabase 持久化边界，覆盖 knowledge base、document、chunk、chat message、eval dataset、eval case、eval run 与 eval case result 表。

Schema 默认启用 `vector` extension，`knowledge_chunks.embedding` 使用 `vector(1536)`，并通过 `knowledge_chunks_embedding_idx` 保持与 production cutover 目标 embedding 维度和 Supabase pgvector 检索路径兼容。Task 5 wiring 时实际 embedder 输出必须保持 1536 维；当前 deterministic local embedder 仅用于本地测试/占位。业务记录默认使用 tenant-scoped primary key，跨知识库文档记录使用 `(tenant_id, knowledge_base_id, id)`，其余主记录使用 `(tenant_id, id)`。

`knowledge_eval_case_results` 对齐当前 `KnowledgeEvalCaseResultRecord`，保存 `status`、`actual_answer`、`citations`、`retrieval_metrics`、`generation_metrics`、`judge_result`、`failure_category`、`trace_id` 与 `error`，而不是泛化的 `input` / `expected` / `actual` / `metrics` 形态。

`knowledge_eval_runs` 对齐当前 `KnowledgeEvalRunRecord`，保存 `knowledge_base_ids`、`summary` 与 `failed_cases` JSONB 字段；`workspace_id` 与 `created_by` 是必填，用于统一域鉴权与列表过滤。Postgres repository 写入 jsonb 字段时统一先 `JSON.stringify` 并在 SQL 参数位置显式 `::jsonb` cast；写入 `knowledge_document_chunks.embedding` 时先转为 pgvector 字符串（如 `[0.1,0.2]`）并使用 `::vector` cast，避免把 JS array/object 直接传入数据库边界。

`knowledge_auth_sessions` 持久化 refresh token session 状态，包含 `user_id`、`refresh_token_hash`、`expires_at`、`revoked_at` 与 `rotated_to_session_id`，并以 `id` 作为 primary key。当前 session repository 接口没有 tenantId，因此本轮 schema 不要求 `tenant_id`。其中 `rotated_to_session_id` 用于记录 refresh token rotation 后的新 session id，必须与 session repository 的 rotation 语义保持一致；`refresh_token_hash` 带有独立索引，用于 refresh lookup。

## 历史 src/knowledge API 接线

以下是历史 `apps/backend/agent-server/src/knowledge` 路径曾经接线的 production-facing endpoint。新 Knowledge Chat Lab / document 能力应优先使用上文统一 `src/domains/knowledge` 的 `/api/knowledge/*` endpoint。

- Auth：`POST /auth/login`、`POST /auth/refresh`、`GET /auth/me`、`POST /auth/logout`
- Knowledge bases：`GET/POST /knowledge-bases`、`GET /knowledge-bases/:id`
- Documents：`GET /documents`、`GET /documents/:id`、`POST /knowledge-bases/:id/documents/upload`、`POST /documents/:id/reprocess`、jobs/chunks 查询
- Chat：`POST /chat`、`POST /messages/:id/feedback`
- Observability：`GET /observability/metrics`、`GET /observability/traces`、`GET /observability/traces/:id`、`GET /observability/traces/:id/artifacts`
- Evals：`GET/POST /eval/datasets`、`POST /eval/datasets/:datasetId/cases`、`GET /eval/datasets/:datasetId/cases`、`GET/POST /eval/runs`、`POST /eval/runs/compare`、`GET /eval/runs/:runId/results`

公开 API 会忽略 body 中的 `tenantId` / `createdBy` 这类可伪造字段，当前 MVP 固定使用服务端上下文 `ws_1` / `user_demo`。内部 service 仍保留显式 tenant 参数，供测试和后续任务编排使用。

## 观测与评测

RAG 成功路径先写 trace，再写 assistant message，避免 assistant message 引用悬空 trace id。失败路径尽量 best-effort 写 failed trace，但不能吞掉原始业务错误。

统一 `src/domains/knowledge` 观测切片当前由 `KnowledgeObservabilityService` 负责，配套 `InMemoryKnowledgeTraceRepository`、`KnowledgeMetricsWindow`、`KnowledgeTraceSampler` 和 `KnowledgeTraceProjector`。JSON 与 SSE RAG 路径记录稳定 route / retrieve / generate spans；projector 只输出 DTO 白名单字段，span attributes/input/output 仅允许 JSON scalar 或 scalar array，artifact 必须带 sampling/redaction metadata，不允许 `vendorRaw`、provider response、raw headers 或完整 prompt/context 穿透到 API。

metrics 输出覆盖 `averageLatencyMs`、`p95LatencyMs`、`p99LatencyMs`、`qps`、`errorRate`、`timeoutRate`、`noAnswerRate`、`citationClickRate`、`feedbackDistribution` 和 `stageLatency`。`/observability/traces/:id/artifacts` 是 sampled artifact 的唯一明细入口；前端完整深钻展示属于 `apps/frontend/knowledge`，agent-admin 只能消费摘要。

Eval run 当前同步执行，后续可以替换为队列；`KnowledgeEvalRunner` 和 `KnowledgeEvalJudge` 是可替换接口。`compareRuns()` 返回后端真实 DTO：

```ts
{
  baselineRunId: string;
  candidateRunId: string;
  totalScoreDelta: number;
  retrievalScoreDelta: number;
  generationScoreDelta: number;
  perMetricDelta: Record<string, number>;
}
```

## Fixture Fallback

为了横向 MVP 和旧测试，部分 service 在 repository/provider 不可用时保留 fixture fallback。新增生产能力时必须优先走 repository/provider；fallback 只能用于 demo 或未装配依赖的本地场景，不能成为长期真实数据路径。

`KnowledgeService` 默认保持 `fixtureFallback: true`，用于 demo/local 与历史 stub API 测试。`KnowledgeModule` 通过 factory provider 创建 `KnowledgeService`：当 `KNOWLEDGE_REPOSITORY=memory` 时保留 demo fixture fallback；当 repository provider 切到 `postgres` 等生产模式时自动传入 `fixtureFallback: false`，避免空库、缺失数据或 provider 未接线时被 `knowledge-api-fixtures.ts` 掩盖。

关闭 fixture fallback 后，repository 空数据必须按真实生产语义返回：knowledge base list 与 document list 返回空 page；缺失 knowledge base、document、trace 或 eval run 抛出明确 `NotFoundException`；chat 必须走 `KnowledgeRagService` 或 repository-backed RAG 路径，未装配 RAG service/repository 时抛出清晰错误；observability/eval list 在真实 service 或 repository 可用时走对应 service，未装配时返回空 page/零 metrics，而不是返回 fixture ids（例如 `kb_frontend`、`doc_frontend_conventions`、`trace_1`、`dataset_1`）。

即使在 memory/demo fallback 模式下，`getKnowledgeBase(id)` 也只允许返回匹配的已知 fixture id；未知 id 必须抛出 `NotFoundException`，不能静默替换成第一条 fixture。
