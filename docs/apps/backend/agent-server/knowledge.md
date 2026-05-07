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
apps/backend/agent-server/src/api/knowledge/legacy-knowledge.controller.ts
apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts
apps/backend/agent-server/src/domains/knowledge/services/knowledge-base.service.ts
```

新增 shell 暴露：

```text
GET /api/knowledge/bases
GET /api/knowledge/v1/bases
```

当前 `src/domains/knowledge` 已迁入这些内存闭环能力：

- `KnowledgeMemoryRepository`：base/member/upload/document/job/chunk/chat conversation/message 的内存 repository contract。
- `KnowledgeBaseService`：base 创建、列表、member 管理和 owner/viewer 权限校验。
- `KnowledgeUploadService`：Markdown/TXT 上传校验、UTF-8 文件名修复、内存 OSS 写入和 upload record 保存。
- `KnowledgeDocumentService`：从 upload 创建 document/job、内存 ingestion queue/worker、chunk 生成、document/job/chunk 查询、reprocess 与 delete。
- `InMemoryOssStorageProvider`：统一后端迁移期的本地 storage provider。

真实 `knowledge-server` 的 Postgres repository、RAG SDK/provider、frontend settings、provider health、eval 等能力仍在后续任务迁入 `src/domains/knowledge`。独立 `apps/backend/knowledge-server` 在迁移完成前仍保留历史客户端兼容价值，但新增后端能力应优先向统一 `agent-server` Knowledge domain 收敛。

历史 `apps/backend/agent-server/src/knowledge` 保留为 runtime-internal 参考实现，覆盖 RAG、ingestion、observability、evals、vector store provider 等纵向能力。迁移时应把可复用服务收敛到 `src/domains/knowledge` 的 service / repository / provider 边界，而不是继续扩展旧目录。

## 分层职责

新统一后端 domain 的分层职责：

- `src/api/knowledge/*`：canonical `/api/knowledge/*` 与 legacy `/api/knowledge/v1/*` HTTP shell。
- `src/domains/knowledge/repositories/*`：Knowledge domain repository contract 和内存实现；后续 Postgres 实现必须在这里拆分后接入，不要复用旧 `src/knowledge` token。
- `src/domains/knowledge/services/*`：base、upload、document、ingestion queue/worker 等领域服务。
- `src/domains/knowledge/storage/*`：OSS provider contract 和内存实现；vendor SDK 只能停留在 provider 边界。
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

Legacy runtime-internal Knowledge backend still lives in `apps/backend/agent-server/src/knowledge`. The standalone frontend-facing Knowledge backend app now lives in `apps/backend/knowledge-server`.

| Env                         | Values                        | Purpose                                                   |
| --------------------------- | ----------------------------- | --------------------------------------------------------- |
| `KNOWLEDGE_REPOSITORY`      | `memory`, `postgres`          | Selects business data persistence.                        |
| `KNOWLEDGE_VECTOR_STORE`    | `memory`, `supabase-pgvector` | Selects retrieval vector storage.                         |
| `DATABASE_URL`              | PostgreSQL connection string  | Required when `KNOWLEDGE_REPOSITORY=postgres`.            |
| `SUPABASE_URL`              | Supabase project URL          | Required when `KNOWLEDGE_VECTOR_STORE=supabase-pgvector`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key     | Required only on the backend for vector writes/search.    |

历史 production-cutover Task 5 已完成 `agent-server` 内部 Nest provider wiring。没有 `DATABASE_URL` 且没有显式选择 provider 时，`KNOWLEDGE_REPOSITORY=memory` 会绑定 `InMemoryKnowledgeRepository` 与 `InMemoryKnowledgeSessionRepository`，不要求 `DATABASE_URL`，也不会创建 SQL client。新的前端业务集成不再依赖这一路径，必须优先接入 `apps/backend/knowledge-server`。

`DATABASE_URL` 存在时，Knowledge 默认切到 postgres repository；也可以显式设置 `KNOWLEDGE_REPOSITORY=postgres`。postgres 模式会通过 provider module 边界创建单例 `pg.Pool`，并包装成项目内 `KnowledgeSqlClient` token（`KNOWLEDGE_SQL_CLIENT`）。业务 repository 只依赖该项目自定义 SQL client contract，不直接接触 `pg` 类型；`PostgresKnowledgeRepository` 与 `PostgresKnowledgeSessionRepository` 注入同一个 SQL client。SQL client provider 参与 Nest shutdown lifecycle，模块关闭时会调用可选 `close()` 释放 pool。测试可通过 Nest `overrideProvider(KNOWLEDGE_SQL_CLIENT)` 替换为 fake client，避免连接真实数据库。显式启用 postgres mode 时必须配置 `DATABASE_URL`，缺失时由 provider config parser 拒绝启动。

postgres 模式下，Knowledge 登录不再使用任意账号 stub，而是通过 `PostgresKnowledgeAdminAuthenticator` 读取数据库超管凭据。当前兼容两类管理员表：agent-server 侧的 `admin_accounts` / `admin_password_credentials`，以及 llm-gateway 侧的 `admin_principals` / `admin_credentials`。只有启用状态的 `super_admin` / owner 账号可映射为 Knowledge `owner` 用户；登录成功后仍签发 Knowledge 自己的双 token，refresh session 存入 `knowledge_auth_sessions`。

Task 6 已接入 vector store provider wiring。`KNOWLEDGE_VECTOR_STORE=memory` 会绑定本地 no-op `KnowledgeVectorStore`，用于本地开发和测试，不要求 Supabase 凭据。`KNOWLEDGE_VECTOR_STORE=supabase-pgvector` 会通过 backend-only `KNOWLEDGE_VECTOR_STORE` token 创建 Supabase pgvector wrapper：agent-server 只从 `@agent/adapters` 根入口导入 `SupabasePgVectorStoreAdapter`，并使用内置 `fetch` 实现 `SupabaseRpcClientLike`，不会新增或依赖 `@supabase/supabase-js`。RPC 请求只在后端携带 `SUPABASE_SERVICE_ROLE_KEY`，该 key 不允许出现在 frontend config 或 API response 中。

当前 Task 6 的真实接线范围是 ingestion/indexing：`KnowledgeModule` 会把 `KNOWLEDGE_VECTOR_STORE` 注入 `KnowledgeIngestionService`，上传文档完成 chunk 和 embedding 后会调用 vector store `upsert()`。本地 `KnowledgeVectorStore` contract 返回 `{ inserted }` / `{ deleted }`，Supabase adapter 返回 `upsertedCount` / `deletedCount`，由 `knowledge-vector-store.factory.ts` 中的 wrapper 做映射；search 结果同样映射为本地 `{ matches }`。

Supabase pgvector wrapper 在调用 adapter 前会校验 upsert chunk embedding 与 search query embedding 必须是 1536 维，和 `knowledge_chunks.embedding vector(1536)` 保持一致；维度不匹配会直接抛出 `Supabase pgvector embeddings must contain 1536 dimensions`，避免短维度 deterministic embedding 误写入生产 vector store。Supabase RPC response body 会先读取 text，再尝试 `JSON.parse`；空响应使用 `null`，非 JSON 文本会保留原始 text；非 2xx 响应统一返回 `{ data: null, error: { status, body } }` 交给 adapter 归一化。

RAG 当前仍走 `KnowledgeRagRetriever`，默认实现是基于 repository chunks 的 deterministic retriever。本轮没有生产 query embedder，也没有把 vector store 伪装成 RAG retriever；后续需要先接入 1536 维 query embedding provider，再新增真正的 Supabase vector retriever，并继续保持 retriever / generator provider 边界。

## PostgreSQL / Supabase Schema

生产数据库 schema 入口为 `apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql`。该文件是 production cutover MVP 的 PostgreSQL / Supabase 持久化边界，覆盖 knowledge base、document、chunk、chat message、trace、eval dataset、eval run、eval result 与 auth session 表。

Schema 默认启用 `vector` extension，`knowledge_chunks.embedding` 使用 `vector(1536)`，并通过 `knowledge_chunks_embedding_idx` 保持与 production cutover 目标 embedding 维度和 Supabase pgvector 检索路径兼容。Task 5 wiring 时实际 embedder 输出必须保持 1536 维；当前 deterministic local embedder 仅用于本地测试/占位。业务记录默认使用 tenant-scoped primary key，跨知识库文档记录使用 `(tenant_id, knowledge_base_id, id)`，其余主记录使用 `(tenant_id, id)`。

`knowledge_eval_results` 对齐当前 `KnowledgeEvalResultRecord`，保存 `status`、`question`、`actual_answer`、`retrieved_chunk_ids`、`citations`、`retrieval_metrics`、`generation_metrics`、`trace_id`、`error_message`、`created_at` 与 `updated_at`，而不是泛化的 `input` / `expected` / `actual` / `metrics` 形态。

`knowledge_eval_runs` 对齐当前 `KnowledgeEvalRunRecord`，其中 `metadata` 使用 `jsonb not null default '{}'::jsonb` 持久化，`created_by` 允许为空以对应可选的 `createdBy`。Postgres repository 写入 jsonb 字段时统一先 `JSON.stringify` 并在 SQL 参数位置显式 `::jsonb` cast；写入 `knowledge_chunks.embedding` 时先转为 pgvector 字符串（如 `[0.1,0.2]`）并使用 `::vector` cast，避免把 JS array/object 直接传入数据库边界。

`knowledge_auth_sessions` 持久化 refresh token session 状态，包含 `user_id`、`refresh_token_hash`、`expires_at`、`revoked_at` 与 `rotated_to_session_id`，并以 `id` 作为 primary key。当前 session repository 接口没有 tenantId，因此本轮 schema 不要求 `tenant_id`。其中 `rotated_to_session_id` 用于记录 refresh token rotation 后的新 session id，必须与 session repository 的 rotation 语义保持一致；`refresh_token_hash` 带有独立索引，用于 refresh lookup。

## 当前 API 接线

已接线的 production-facing endpoint：

- Auth：`POST /auth/login`、`POST /auth/refresh`、`GET /auth/me`、`POST /auth/logout`
- Knowledge bases：`GET/POST /knowledge-bases`、`GET /knowledge-bases/:id`
- Documents：`GET /documents`、`GET /documents/:id`、`POST /knowledge-bases/:id/documents/upload`、`POST /documents/:id/reprocess`、jobs/chunks 查询
- Chat：`POST /chat`、`POST /messages/:id/feedback`
- Observability：`GET /observability/metrics`、`GET /observability/traces`、`GET /observability/traces/:id`
- Evals：`GET/POST /eval/datasets`、`GET/POST /eval/runs`、`POST /eval/runs/compare`、`GET /eval/runs/:id/results`，以及 `/evals/*` alias

公开 API 会忽略 body 中的 `tenantId` / `createdBy` 这类可伪造字段，当前 MVP 固定使用服务端上下文 `ws_1` / `user_demo`。内部 service 仍保留显式 tenant 参数，供测试和后续任务编排使用。

## 观测与评测

RAG 成功路径先写 trace，再写 assistant message，避免 assistant message 引用悬空 trace id。失败路径尽量 best-effort 写 failed trace，但不能吞掉原始业务错误。

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
