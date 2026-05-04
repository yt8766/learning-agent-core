# Knowledge Server

状态：current
文档类型：reference
适用范围：`apps/backend/knowledge-server`
最后核对：2026-05-04

## 本主题主文档

本文只覆盖：`knowledge-server` 服务边界、知识库成员权限和 `auth-server` token 消费方式。

`knowledge-server` 是 knowledge 前端的 canonical 业务 API 宿主。它不处理账号密码登录，只校验 `auth-server` 签发的 Access Token，并通过 `knowledge_base_members` 判断 `owner | editor | viewer` 权限。

## Canonical Entry

默认本地端口：

```text
http://127.0.0.1:3020/api
```

第一阶段 API：

```text
GET  /api/knowledge/bases
POST /api/knowledge/bases
GET  /api/knowledge/bases/:baseId/members
POST /api/knowledge/bases/:baseId/members
POST /api/knowledge/bases/:baseId/uploads
POST /api/knowledge/bases/:baseId/documents
GET  /api/knowledge/documents/:documentId
GET  /api/knowledge/documents/:documentId/jobs/latest
GET  /api/knowledge/documents/:documentId/chunks
GET  /api/knowledge/embedding-models
POST /api/knowledge/documents/:documentId/reprocess
DELETE /api/knowledge/documents/:documentId
POST /api/chat
GET  /api/rag/model-profiles
GET  /api/conversations
GET  /api/conversations/:id/messages
POST /api/messages/:messageId/feedback
```

前端环境变量：

```text
VITE_KNOWLEDGE_SERVICE_BASE_URL=http://127.0.0.1:3020/api
```

## Runtime Config

`knowledge-server` 通过 `@nestjs/config` 加载服务目录下的 `.env`。启动时优先读取当前工作目录 `.env`，也兼容从仓库根启动时读取 `apps/backend/knowledge-server/.env`。

当前生效 key：

- `PORT` / `HOST`：HTTP 监听地址。
- `API_PREFIX`：全局 API 前缀，默认 `api`。
- `DATABASE_URL`：存在时使用 `PostgresKnowledgeRepository`，缺失时使用 `InMemoryKnowledgeRepository`。
- `KNOWLEDGE_CHAT_MODEL`：Knowledge SDK 默认 chat model。启用 SDK runtime 时必填。
- `KNOWLEDGE_EMBEDDING_MODEL`：Knowledge SDK 默认 embedding model。启用 SDK runtime 时必填。
- `KNOWLEDGE_LLM_API_KEY`：OpenAI-compatible chat / embedding provider 共用 API key。启用 SDK runtime 时必填。
- `KNOWLEDGE_LLM_BASE_URL`：可选，OpenAI-compatible provider 的自定义 base URL。
- `KNOWLEDGE_CHAT_MAX_TOKENS`：可选，chat provider 最大输出 token 数，必须为正整数。
- `KNOWLEDGE_EMBEDDING_DIMENSIONS`：可选，embedding provider 维度，必须为正整数。
- `KNOWLEDGE_EMBEDDING_BATCH_SIZE`：可选，embedding provider 批大小，必须为正整数。
- `KNOWLEDGE_HYDE_ENABLED`：可选，设为 `true` 且 SDK runtime 已启用时，`KnowledgeServerSearchServiceAdapter` 可在向量检索前对查询生成 HyDE 假想答案以辅助 embedding（失败时回退原始查询）。
- `AUTH_SERVER_JWT_SECRET`：用于校验 auth-server 签发的 JWT。
- `AUTH_SERVER_JWT_ISSUER`：JWT issuer，默认 `auth-server`。
- `AUTH_SERVER_JWT_AUDIENCE`：knowledge 接受的 JWT audience，默认 `knowledge`。
- `KNOWLEDGE_SERVER_CORS_ORIGIN` 或 `CORS_ORIGINS`：逗号分隔的 CORS origin。
- `KNOWLEDGE_OSS_PROVIDER`：可选，支持 `aliyun` 或 `memory`。配置为 `aliyun` 时 OSS 环境变量不完整会启动失败；配置为 `memory` 或完全不配置 OSS 变量时才允许使用内存对象存储。
- `ALIYUN_OSS_BUCKET`、`ALIYUN_OSS_REGION`、`ALIYUN_OSS_ACCESS_KEY_ID`、`ALIYUN_OSS_ACCESS_KEY_SECRET`：四者同时存在时启用真实 Aliyun OSS 上传；只要出现任一 OSS 配置但缺关键项，启动直接失败，避免静默回退内存。`ALIYUN_OSS_ENDPOINT` 可选，仅用于自定义 endpoint；V4 签名仍要求 `ALIYUN_OSS_REGION`。访问密钥也兼容 OSS SDK 常用的 `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` 环境变量名。
- `ALIYUN_OSS_PUBLIC_BASE_URL`：可选，覆盖返回给前端的文件访问基准 URL；未配置时返回 OSS endpoint 下的对象 URL。

开发环境会在显式 CORS 配置之外自动允许 knowledge 前端 origin：`localhost:5175` 与 `127.0.0.1:5175`。生产环境只使用显式配置，不自动加入本地开发 origin。

## Permission Model

Auth token 只投影用户身份：

```text
userId
username
roles
```

知识库权限只看 membership：

- `owner`：可查看成员、添加成员。
- `editor`：后续用于文档维护和内容编辑。
- `viewer`：只读访问知识库。

全局 auth 角色不等于知识库成员角色。即使用户有 `admin` 或 `knowledge_user` 全局角色，也必须通过 `knowledge_base_members` 获得具体知识库权限。

## Runtime Repository Selection

当前横向 MVP 支持按环境选择 repository：

- 未配置 `DATABASE_URL` 时，`KnowledgeModule` 使用 `InMemoryKnowledgeRepository`，用于本地开发和单元测试闭环。
- 配置 `DATABASE_URL` 时，`KnowledgeModule` 使用 `PostgresKnowledgeRepository`。
- `AUTH_SERVER_JWT_SECRET` 必须与 `auth-server` 签发 token 的 secret 一致。

PostgreSQL 边界由 `PostgresKnowledgeRepository` 收敛，接收项目自定义的 `PostgresKnowledgeClient`。`pg.Pool` 只在 `src/knowledge/runtime/knowledge-database.provider.ts` 中创建，不穿透到 controller、service 或共享 contract，并且必须通过 `import { Pool } from 'pg'` 命名导入；不要改回默认导入，否则 CommonJS 启动链路会在运行时得到 `undefined.Pool`。

配置 `DATABASE_URL` 时，repository provider 会在暴露 `PostgresKnowledgeRepository` 前执行 `src/knowledge/runtime/knowledge-schema.sql.ts` 中的 `KNOWLEDGE_SCHEMA_SQL`。该启动期 schema init 是上传链路的必要前置条件，会创建 `knowledge_uploads`、`knowledge_documents`、`knowledge_document_jobs`、`knowledge_document_chunks` 等表；如果服务已经在旧代码下启动，需要重启 `knowledge-server` 才会补齐缺失表。

## SDK Runtime Provider

`KnowledgeModule` 注册 `KNOWLEDGE_SDK_RUNTIME` token，默认由 `src/knowledge/runtime/knowledge-sdk-runtime.provider.ts` 创建。该 provider 建立可注入 runtime 边界；当前文档 ingestion worker 已在 enabled runtime 下接入 SDK 默认 embedding provider 与 vector store，chat 在 enabled runtime 下走真实 SDK RAG，在 disabled runtime 下保留 repository-backed deterministic fallback。

本地开发、测试环境，或只启用 Postgres repository 但暂未启用 SDK 主链的部署，可以不配置 SDK 专用 env。`DATABASE_URL` 缺失，或只有 `DATABASE_URL` 而没有任何 `KNOWLEDGE_*` SDK 专用配置时，provider 返回：

```ts
{ enabled: false, reason: 'missing_env', missingEnv: [...], runtime: null }
```

只要出现任一 SDK 专用配置但缺少关键项，启动期会抛出 `KnowledgeSdkRuntimeProviderConfigError`，避免半配置状态静默降级。配置齐全时，provider 会先通过 `createKnowledgeDatabaseClient({ databaseUrl })` 创建项目自有 `PostgresKnowledgeClient`，执行 `KNOWLEDGE_SCHEMA_SQL`，然后调用 `@agent/knowledge/node` 的 `createDefaultKnowledgeSdkRuntime()`。

SDK runtime 的 chat 与 embedding provider 均固定为：

```ts
provider: 'openai-compatible';
```

vector store 使用 Supabase RPC 兼容 client 结构，但底层仍只持有 `PostgresKnowledgeClient`。RPC 适配器把 SDK adapter 发出的 `rpc(name, args)` 转换为 `PostgresKnowledgeClient.query()`：

- `upsert_knowledge_chunks(knowledge_base_id, document_id, records, tenant_id)` -> `select * from upsert_knowledge_chunks($1, $2, $3::jsonb, $4)`
- `match_knowledge_chunks(knowledge_base_id, embedding, top_k, query_text, filters, tenant_id)` -> `select * from match_knowledge_chunks($1, $2::vector, $3, $4, $5::jsonb, $6)`
- `delete_knowledge_document_chunks(knowledge_base_id, document_id, tenant_id)` -> `select * from delete_knowledge_document_chunks($1, $2, $3)`

RPC adapter 返回 `{ data, error }`，不把 `pg.Pool`、vendor response 或数据库异常类型穿透给 SDK 之外的业务层。

## Trustworthy RAG Workbench Boundaries

`KnowledgeDocumentService` owns document/job creation and retry semantics. `KnowledgeIngestionWorker` advances stable ingestion stages and records retryable failures. `KnowledgeRagService` owns route -> retrieval -> context assembly -> generation -> citation grounding. `KnowledgeTraceService` records JSON-safe trace/span projections. `KnowledgeProviderHealthService` aggregates embedding, vector, keyword, and generation provider health.

Failed jobs are immutable for recovery purposes: retry/reprocess creates a new attempt and trace instead of mutating the failed job back to running. Frontend-facing state must be projected through stable DTOs (`stage`, `progress`, `error`, `attempts`, `route`, `diagnostics`, `traceId`) rather than provider internals or repository raw records.

### Supabase / pgvector Contract

生产 canonical store 是 Supabase/PostgreSQL + pgvector。`KNOWLEDGE_SCHEMA_SQL` 会创建 `vector` extension，并让 `knowledge_document_chunks` 持有 `metadata jsonb` 与 `embedding vector(1536)`，同时声明 `upsert_knowledge_chunks`、`match_knowledge_chunks`、`delete_knowledge_document_chunks` 三组 RPC，供 SDK adapter 写入、向量检索和按文档清理 chunks。

三组 RPC 都要求显式传入 `tenant_id`，并用 `knowledge_documents.workspace_id = tenant_id` 做硬边界；函数签名保留 `tenant_id default null` 仅用于让缺参进入函数体后得到稳定错误，缺失或空字符串会直接抛错，不允许把 `tenant_id = null` 当成跨租户 wildcard。`upsert_knowledge_chunks` 对 chunk `id` 冲突还会追加 `document_id` ownership guard，并检查 `row_count`，避免跨文档/租户 chunk 覆盖被静默计入成功。

`match_knowledge_chunks` 的 `filters` 使用 snake_case JSON，例如 `{ "document_ids": [...], "tags": [...], "metadata": { "phase": "eval" } }`，与 SDK adapter 入参映射一致。`documentIds` 仅作为兼容旧调用方的 fallback；新调用必须使用 `document_ids`。`tags` 会按 chunk metadata 中的 `tags` 数组做任一命中，`metadata` 使用 JSONB containment 做精确键值过滤。空数组和空 metadata 对象等同于未启用该 filter。

缺少 pgvector 时，配置 `DATABASE_URL` 的 schema init 会失败，服务不应静默降级；需要先在目标 Postgres/Supabase 环境安装或启用 pgvector。

本地开发推荐使用仓库根级 `docker-compose.yml` 的 `pgvector/pgvector:pg16` 服务，并通过根级脚本 `pnpm docker:up` 启动。如果 `DATABASE_URL` 指向普通 PostgreSQL 镜像或本机未安装 pgvector 的实例，启动会在 `create extension if not exists vector` 阶段报 `extension "vector" is not available`；临时只跑内存 demo 时可以移除 `DATABASE_URL`，让服务回落到 `InMemoryKnowledgeRepository`。

`InMemoryKnowledgeRepository` 只适合本地测试和 demo 闭环。生产环境必须配置真实 `DATABASE_URL` 指向 Postgres/Supabase，避免 RAG chunk、embedding 和 RPC contract 只存在于进程内存。

## Build Boundary

`tsconfig.json` 在开发与测试阶段会把 `@agent/core` 映射到 `packages/core/src/index.ts`，便于本地类型检查直接消费 core 源码。`tsconfig.build.json` 必须清空 `paths`，让生产构建通过 workspace 包边界解析 `@agent/core`；如果继承开发期 paths 且保持 `rootDir: "./src"`，`tsc -p tsconfig.build.json` 会把 `packages/core/src` 纳入当前服务编译图，并触发 `TS6059: file is not under rootDir`。

`tsconfig.build.json` 还必须显式保持 `module: "Node16"` 与 `moduleResolution: "node16"` 配套。TypeScript 5 会校验这两个选项必须成对出现；Nest watch 读取 build config 时不能依赖开发配置继承链隐式补齐，否则可能触发 `TS5110: Option 'module' must be set to 'Node16' when option 'moduleResolution' is set to 'Node16'`。

该 build 边界与 `apps/backend/agent-server`、`apps/backend/auth-server` 保持一致。后续修改 knowledge API contract 或引入更多 `@agent/*` workspace 包时，不要把包源码路径重新写回 build tsconfig。

## Document Upload And Ingestion

文档入库采用两步协议，前端永远不直连 OSS：

1. `POST /api/knowledge/bases/:baseId/uploads` 接收 multipart `file`，当前只允许 Markdown/TXT。`KnowledgeUploadService` 先校验知识库成员权限、文件类型和大小，再通过项目自有 `OssStorageProvider` 写入对象存储，最后保存 upload record 并返回 `KnowledgeUploadResult`。
2. `POST /api/knowledge/bases/:baseId/documents` 接收 `uploadId/objectKey/filename/title/metadata`，`KnowledgeDocumentService` 校验 upload record 归属后创建 document 和 processing job。

上传边界会修复 multipart parser 把 UTF-8 文件名按 latin1 解读导致的 mojibake，例如 `coreåè®¾è®¡ææ¡£.md` 会在入库和后续 document 创建前恢复为 `core包设计文档.md`。OSS object key 仍使用安全字符投影，中文原文件名保存在 upload/document record 中；写入 OSS metadata 前会把非 ASCII 值做 URL 编码，避免中文文件名进入 `x-oss-meta-*` header 后触发 `Invalid character in header content`。

当前横向 MVP 通过 `createAliyunOssStorageProviderFromEnv()` 按环境选择真实 Aliyun OSS provider；未配置任何 OSS 环境变量时注入 `InMemoryOssStorageProvider`，用于本地开发和测试闭环。一旦检测到 `ALIYUN_OSS_*` / `OSS_ACCESS_KEY_*` / `KNOWLEDGE_OSS_PROVIDER=aliyun` 配置但关键项不完整，服务会启动失败，避免页面显示上传成功但实际写入内存。真实 provider 使用 `ali-oss@^6.x` SDK，并启用 V4 签名；SDK client、response、error 和请求头细节只能停留在 `storage/` provider 边界内，不能穿透 controller、service、repository 或 API contract。

`AliyunOssStorageProvider` 对内实现项目自有 `OssStorageProvider`：

- `putObject()`：调用 `client.put(objectKey, Buffer, { headers, meta })`，默认使用 `Standard` 存储、`private` ACL、`Content-Disposition: attachment` 和 `x-oss-forbid-overwrite: true`。
- `getObject()`：调用 `client.get(objectKey)` 并归一化为 `Buffer`、`contentType` 和项目 metadata。
- `deleteObject()`：调用 `client.delete(objectKey)`，404 / NoSuchKey 按幂等删除处理。
- `listObjects()`：调用 `client.list({ prefix, marker, "max-keys" })`，只返回项目自有 object projection。

如果上传返回 `knowledge_upload_oss_failed` 且 message 包含 `HTTP 403 AccessDenied`，优先检查当前 AccessKey 是否对目标 bucket 具备 `oss:PutObject`、`oss:GetObject`、`oss:DeleteObject`，以及排查/诊断时需要的 `oss:ListObjects`。对象 key 统一写入 `knowledge/<baseId>/<uploadId>/<filename>` 前缀；在 OSS 控制台查找时需要展开 `knowledge/` 前缀，而不是只看 bucket 根层的平铺文件。

`KnowledgeDocumentService.createFromUpload()` 和 `reprocessDocument()` 把 document 和 processing job 写入 repository 后，通过 `KnowledgeIngestionQueue.enqueue()` 将 job 加入内存队列，立即向调用方返回 `queued` 状态的 document 与 job。`KnowledgeIngestionQueue` 以 `100ms` 为间隔 drain 所有 pending jobs，按顺序委托 `KnowledgeIngestionWorker.process()` 执行真正的解析、切分、embedding 和索引写入。Queue 捕获 worker 错误并记录日志，不会把 ingestion 异常抛回 HTTP 调用方；document/job 状态由 worker 在 repository 内更新为 `failed`，前端通过轮询 `GET /api/knowledge/documents/:documentId/jobs/latest` 观察进度。

当 `KNOWLEDGE_SDK_RUNTIME` 为 enabled 时，Worker 会调用 SDK 默认 runtime 的 `embeddingProvider.embedBatch({ texts })` 生成 chunk embeddings，再调用 `vectorStore.upsert({ records })` 写入 Supabase/PostgreSQL pgvector。每条 vector record 使用 chunk 自身的 `id/content/embedding`，metadata 至少包含 `tenantId`（来自 `document.workspaceId`）、`knowledgeBaseId`、`documentId`、`ordinal`、`title`、`filename`，并在 `document.metadata.tags` 是 `string[]` 时透传 `tags`。成功后 repository 只保存 `DocumentChunkRecord` 已定义的 chunk 状态字段，不把 embedding 数组强塞回文档 chunk record；document 会进入 `ready`，`embeddedChunkCount = chunkCount`，job stages 会记录 `embed` 与 `index_vector` 成功。

当 SDK embedding 或 vector upsert 失败时，Worker 会把 document 标为 `failed`，把 latest job 标为 `failed`，`currentStage` 继续保留 legacy 阶段名（`embed` / `index_vector`），同时写入稳定展示字段 `stage: embedding | indexing`、`progress`、`attempts` 和结构化 `error`。Job 详情里的结构化错误使用 `knowledge_ingestion_embedding_failed` / `knowledge_ingestion_index_failed`，包含 `retryable` 与失败 `stage`，供前端判断是否显示重试。失败文档不能被标成 `ready`。

当 `KNOWLEDGE_SDK_RUNTIME` 为 disabled 时，Worker 保留本地测试和 demo fallback：chunks 的 embedding/vector/keyword 状态直接标记为 `succeeded`，document/job 进入成功状态，但不会写入 Supabase pgvector。这个模式只用于本地开发、单元测试和横向 demo，不是生产 ingestion 路径。

`KnowledgeDocumentService.chat()` 只负责请求归一化、解析 RAG model profile，并委托 `KnowledgeRagService`。`KnowledgeRagService` 是 Chat Lab 的后端编排边界：读取当前用户可访问知识库，通过 `resolveKnowledgeChatRoute()` 得到目标 knowledge base，逐一校验 membership，记录 `route/retrieve/generate` trace span，并返回稳定 `route` 与 `diagnostics` 投影。随后：

- `KNOWLEDGE_SDK_RUNTIME.enabled = false`：保留 repository deterministic RAG，读取目标知识库 document chunks，按查询词命中率生成 citation projection，并把命中的 quote 拼为 answer；这是本地测试和 demo fallback。
- `KNOWLEDGE_SDK_RUNTIME.enabled = true`：通过 `KnowledgeRagSdkFacade` 调用 `@agent/knowledge` RAG runtime。SDK 启用时始终使用 LLM pre-retrieval planner（`plannerModelId` / 默认 chat model），显式 `knowledgeBaseIds` 作为偏好约束写入 planner 提示而非静默改走确定性 planner；SDK 未启用时仍使用 deterministic planner。检索管道向 `runKnowledgeRag` / `streamKnowledgeRag` 传入 `RetrievalPipelineConfig`，包含基于同一 chat provider 的 `rerankProvider`，由 `@agent/knowledge` 默认 post-retrieval ranker 在命中列表上做一次语义重排（失败则回退纯 deterministic 排序）。retrieval 阶段由 `KnowledgeServerSearchServiceAdapter` 接入 SDK runtime：可选 HyDE 扩展查询后调用 `embeddingProvider.embedText`，再按目标 knowledge base fan-out 调用 `vectorStore.search({ embedding, topK, filters: { tenantId, knowledgeBaseId, query } })`。vector 命中会回查 repository document/chunk 后投影为项目自有 `RetrievalHit` / citation，不把 vector store 原始 hit 泄漏给 service 或前端。

如果 vector search 返回 0 hit 或抛错，`KnowledgeServerSearchServiceAdapter` 会回退到 repository keyword retrieval，并额外用中文 bigram 子串命中兜底连续中文 query，例如 `风险动作审批` 可以命中包含 `风险动作` 与 `审批` 的 chunk。该 fallback 只作为召回兜底，diagnostics 会记录 `enabledRetrievers`、`failedRetrievers`、`candidateCount` 和最终 hit 数；answer 阶段仍只能基于 retrieval hits 生成 grounded citation。非流式回答调用 `chatProvider.generate()`，messages 内包含 system/developer context prompt、原始用户问题和 citation context，要求模型只基于 citations/context 回答，依据不足时明确说明依据不足。

SDK chat 分支保持 grounded citation 规则：`answer` 使用 provider 返回的 `generated.text`，但 `assistantMessage.citations` 与顶层 `citations` 只能来自 retrieval/vector hits 的项目投影，不能采信模型返回的自带 citation。embedding、vector search 或 generation 任一 SDK 错误都会在 service 层转换为 `KnowledgeServiceError('knowledge_chat_failed', message)`，避免第三方 provider / vector adapter error 直接穿透到 controller 或前端。

`KnowledgeRagModelProfileService` 是 Chat Lab 模型选择的权威来源。`GET /api/rag/model-profiles` 只暴露 display-safe summary：`id/label/description/useCase/enabled`，不会返回 planner/answer/embedding provider 内部模型 ID 或 secret。`POST /api/chat` 的 `model` 字段接受 enabled profile id；`knowledge-rag` / `knowledge-default` 仅作为默认兼容 alias。

`KnowledgeRagService` 会在 RAG 执行前创建或复用当前用户 conversation，并先持久化 user message。非流式成功返回前会持久化 assistant message；SSE 模式在收到 SDK `rag.completed` 后持久化 assistant message。assistant record 保存 answer、grounded citations、route、diagnostics、traceId 和 modelProfileId；provider error 或 stream 中断不会写成功 assistant message，只保留可 retry 的 user message。

`POST /api/chat` 支持 `stream: true` 时返回 `text/event-stream`。Controller 只负责把 SDK `KnowledgeRagStreamEvent` 包装为 SSE frame：`event: <event.type>` 加 `data: <JSON event>`，再以空行结尾；`KnowledgeDocumentService`、`KnowledgeRagService` 和 `KnowledgeRagSdkFacade` 只传递结构化 SDK stream event，不拼接 SSE 字符串。SDK 仅在 answer provider 暴露 `stream()` 且 retrieval 已满足 no-answer policy 的 citation/evidence 要求时发送 `answer.delta`；provider 不支持 stream 或检索依据不足时，仍保持 `rag.started -> ... -> answer.completed -> rag.completed` 的非 delta 事件序列。SDK 产出的 `rag.error` 会按同一 SSE framing 写出，HTTP stream 随后关闭。

`KnowledgeEvalService` 提供当前最小 eval 闭环：逐个 eval case 调用注入的 answerer，计算 `recallAtK`、`citationAccuracy` 与 `answerRelevance`，并保留成功 case 的结果。单个 case 失败时不会丢弃已完成结果；run 状态会变成 `partial`，失败项进入 `failedCases`，错误码固定为 `knowledge_eval_run_failed`。

`DocumentProcessingJobRecord.progress` 是给前端进度条使用的稳定投影。Queue 驱动的 ingestion 在 `parsing -> chunking -> embedding -> indexing -> succeeded` 推进时写入 `15/35/60/85/100` 一组稳定百分比，并填充 `processedChunks` / `totalChunks`；前端通过轮询 `jobs/latest` 观察同一 `stage` 更新，不能直接依赖内部 provider 状态或第三方向量库响应。`reprocessDocument()` 必须创建新的 job id，并把 `attempts` 设为上一条 job 的 `attempts + 1`，不得把失败 job 改回 running。

Postgres 持久化同样保存 `stage/progress/error/attempts`；旧环境启动时由 `knowledge-schema.sql.ts` 的 `alter table ... add column if not exists` 补齐字段。`stages/currentStage/errorCode/errorMessage` 是兼容旧前端和旧测试的 legacy 投影，新增 UI 默认读取稳定字段。

`GET /api/knowledge/embedding-models` 返回前端可选择的 embedding model display projection。当前 MVP 与 SDK runtime 使用同一组默认配置：`KNOWLEDGE_EMBEDDING_MODEL` 决定 `id/label`，provider 固定展示为 `openai-compatible`，是否存在 `KNOWLEDGE_LLM_API_KEY` 决定 `available/unconfigured`。该 endpoint 只暴露 `id/label/provider/status`，不暴露任何 secret。前端把选择结果写入 `CreateDocumentFromUploadRequest.metadata.embeddingModelId`，后端先保存为 metadata；真实多 embedding provider 接入时应在 worker/provider 边界读取并校验该字段。

`DELETE /api/knowledge/documents/:documentId` 使用 document 所属 knowledge base 的 membership 做权限校验。删除时以数据库 document record 为主记录，`knowledge_document_jobs` 和 `knowledge_document_chunks` 通过外键级联清理；OSS object 通过 `OssStorageProvider.deleteObject()` 做 best-effort 清理，OSS 404 / NoSuchKey 按幂等删除处理，不把第三方 SDK 细节暴露给 API caller。

## Frontend MVP Endpoints

`KnowledgeFrontendMvpController` 暂时承接 knowledge 前端真实模式会调用、但独立 knowledge 服务尚未纵向实现的根级 API。当前目标是横向打通页面，避免前端进入真实 API 模式后出现 404；这些接口返回空列表或零值指标，不代表最终业务实现。

`GET /api/documents` 已接到 `KnowledgeDocumentService.listDocuments()`，会按当前用户可访问的 knowledge base 聚合文档；可选 `knowledgeBaseId` query 用于详情页过滤。上传成功但列表为空时，优先检查当前请求是否命中这个根级 endpoint，以及用户是否是目标知识库成员。

当前已接线：

- `GET /api/dashboard/overview`
- `GET /api/documents`
- `POST /api/chat`
- `GET /api/rag/model-profiles`
- `GET /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/messages/:messageId/feedback`
- `POST /api/documents/:documentId/reprocess`
- `GET /api/observability/metrics`
- `GET /api/observability/traces`
- `GET /api/observability/traces/:traceId`
- `GET /api/eval/datasets`
- `GET /api/eval/runs`
- `GET /api/eval/runs/:runId/results`
- `POST /api/eval/runs/compare`

`POST /api/chat` 入口优先接受 OpenAI Chat Completions 风格请求，即 `model`、`messages`、`metadata`、`stream`。`stream: false` 或未传 `stream` 时返回原 JSON `KnowledgeChatResponse`；`stream: true` 时返回 SSE，事件类型直接沿用 SDK RAG stream event type。服务层从最后一条 user message 归一化查询文本，前端新 Chat Lab 只发送 `metadata.conversationId`、`metadata.debug` 与 `metadata.mentions`；`metadata.knowledgeBaseIds` 和旧的顶层 `message` / `knowledgeBaseIds` 字段仅保留兼容。检索前路由由 `@agent/knowledge` 的 `resolveKnowledgeChatRoute()` 承担，顺序为：兼容 knowledge base ids 优先；显式 `@mentions` 按当前用户可访问知识库的 id / name 绑定范围；无 mention 时按问题 tokens 与知识库 name / description / metadata 做 deterministic metadata routing；仍无命中时回退全部可访问知识库。`KnowledgeChatRoutingError` 在 service 层转换为 `KnowledgeServiceError`，再由 controller 映射为 HTTP 400。随后校验当前用户对目标知识库的 membership，并根据 `KNOWLEDGE_SDK_RUNTIME` 决定走真实 SDK vector RAG 或 repository deterministic fallback。citation 只包含 display-safe 字段，例如 `title`、`quote`、`score`、`documentId`、`chunkId`。请求中的知识库 ID 必须是真实存在且当前用户具备 membership 的 base；缺失 base 返回 `knowledge_base_not_found` 对应的 404，未授权 base 返回 `knowledge_permission_denied` 对应的 403，缺少 user message 返回 `knowledge_chat_message_required` 对应的 400，显式 mention 找不到可访问知识库返回 `knowledge_mention_not_found` 对应的 400，不能泄漏为 500。`POST /api/messages/:messageId/feedback` 接收 `CreateFeedbackRequest`，通过 `KnowledgeDocumentService.recordFeedback()` 调用 `KnowledgeRepository.updateMessageFeedback()` 写入 `knowledge_chat_messages.feedback` JSONB 字段，并返回更新后的 assistant message；消息不存在时返回 `404 knowledge_chat_message_not_found`。

## PostgreSQL Tables

当前表结构以 [knowledge-schema.sql.ts](/Users/dev/Desktop/learning-agent-core/apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts) 为唯一源码。不要在文档中手写第二份长期 SQL 定义，避免字段名如 `metadata` / `metadata_json`、`stages` / `stages_json` 与 repository mapper 漂移。

## Verification

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm --dir apps/backend/knowledge-server build
pnpm check:docs
```
