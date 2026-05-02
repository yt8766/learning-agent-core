# Knowledge Server

状态：current
文档类型：reference
适用范围：`apps/backend/knowledge-server`
最后核对：2026-05-02

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

`KnowledgeModule` 注册 `KNOWLEDGE_SDK_RUNTIME` token，默认由 `src/knowledge/runtime/knowledge-sdk-runtime.provider.ts` 创建。该 provider 建立可注入 runtime 边界；当前文档 ingestion worker 已在 enabled runtime 下接入 SDK 默认 embedding provider 与 vector store，chat 仍使用 repository-backed deterministic RAG。

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

### Supabase / pgvector Contract

生产 canonical store 是 Supabase/PostgreSQL + pgvector。`KNOWLEDGE_SCHEMA_SQL` 会创建 `vector` extension，并让 `knowledge_document_chunks` 持有 `metadata jsonb` 与 `embedding vector(1536)`，同时声明 `upsert_knowledge_chunks`、`match_knowledge_chunks`、`delete_knowledge_document_chunks` 三组 RPC，供 SDK adapter 写入、向量检索和按文档清理 chunks。

三组 RPC 都要求显式传入 `tenant_id`，并用 `knowledge_documents.workspace_id = tenant_id` 做硬边界；函数签名保留 `tenant_id default null` 仅用于让缺参进入函数体后得到稳定错误，缺失或空字符串会直接抛错，不允许把 `tenant_id = null` 当成跨租户 wildcard。`upsert_knowledge_chunks` 对 chunk `id` 冲突还会追加 `document_id` ownership guard，并检查 `row_count`，避免跨文档/租户 chunk 覆盖被静默计入成功。

`match_knowledge_chunks` 的 `filters` 使用 snake_case JSON，例如 `{ "document_ids": [...], "tags": [...], "metadata": { "phase": "eval" } }`，与 SDK adapter 入参映射一致。`documentIds` 仅作为兼容旧调用方的 fallback；新调用必须使用 `document_ids`。`tags` 会按 chunk metadata 中的 `tags` 数组做任一命中，`metadata` 使用 JSONB containment 做精确键值过滤。空数组和空 metadata 对象等同于未启用该 filter。

缺少 pgvector 时，配置 `DATABASE_URL` 的 schema init 会失败，服务不应静默降级；需要先在目标 Postgres/Supabase 环境安装或启用 pgvector。

`InMemoryKnowledgeRepository` 只适合本地测试和 demo 闭环。生产环境必须配置真实 `DATABASE_URL` 指向 Postgres/Supabase，避免 RAG chunk、embedding 和 RPC contract 只存在于进程内存。

## Build Boundary

`tsconfig.json` 在开发与测试阶段会把 `@agent/core` 映射到 `packages/core/src/index.ts`，便于本地类型检查直接消费 core 源码。`tsconfig.build.json` 必须清空 `paths`，让生产构建通过 workspace 包边界解析 `@agent/core`；如果继承开发期 paths 且保持 `rootDir: "./src"`，`tsc -p tsconfig.build.json` 会把 `packages/core/src` 纳入当前服务编译图，并触发 `TS6059: file is not under rootDir`。

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

`KnowledgeIngestionWorker` 目前仍是同步处理闭环：读取 upload 内容，按段落切 Markdown/TXT，并在 worker/provider 边界完成后续状态提交，不把 ingestion 逻辑内联到 controller。

当 `KNOWLEDGE_SDK_RUNTIME` 为 enabled 时，Worker 会调用 SDK 默认 runtime 的 `embeddingProvider.embedBatch({ texts })` 生成 chunk embeddings，再调用 `vectorStore.upsert({ records })` 写入 Supabase/PostgreSQL pgvector。每条 vector record 使用 chunk 自身的 `id/content/embedding`，metadata 至少包含 `tenantId`（来自 `document.workspaceId`）、`knowledgeBaseId`、`documentId`、`ordinal`、`title`、`filename`，并在 `document.metadata.tags` 是 `string[]` 时透传 `tags`。成功后 repository 只保存 `DocumentChunkRecord` 已定义的 chunk 状态字段，不把 embedding 数组强塞回文档 chunk record；document 会进入 `ready`，`embeddedChunkCount = chunkCount`，job stages 会记录 `embed` 与 `index_vector` 成功。

当 SDK embedding 或 vector upsert 失败时，Worker 会把 document 标为 `failed`，把 latest job 标为 `failed`，`currentStage` 停在失败阶段，并写入 `knowledge_embedding_failed` 或 `knowledge_index_failed` 以及错误消息；失败文档不能被标成 `ready`。当前同步调用链会把该 `KnowledgeServiceError` 抛回调用方，同时保留 repository 中可查询的 failed document/job 状态。

当 `KNOWLEDGE_SDK_RUNTIME` 为 disabled 时，Worker 保留本地测试和 demo fallback：chunks 的 embedding/vector/keyword 状态直接标记为 `succeeded`，document/job 进入成功状态，但不会写入 Supabase pgvector。这个模式只用于本地开发、单元测试和横向 demo，不是生产 ingestion 路径。

`DocumentProcessingJobRecord.progress` 是给前端进度条使用的稳定投影。同步 MVP 在处理完成后返回 `percent: 100`，并填充 `processedChunks` / `totalChunks`；后续异步 worker 可以按 stage 更新，但不能让前端直接依赖内部 provider 状态或第三方向量库响应。

`GET /api/knowledge/embedding-models` 返回前端可选择的 embedding model display projection。当前 MVP 从 `KNOWLEDGE_EMBEDDING_MODEL_ID`、`KNOWLEDGE_EMBEDDING_PROVIDER` 和是否存在 embedding API key 推导默认项，只暴露 `id/label/provider/status`，不暴露任何 secret。前端把选择结果写入 `CreateDocumentFromUploadRequest.metadata.embeddingModelId`，后端先保存为 metadata；真实 embedding provider 接入时应在 worker/provider 边界读取并校验该字段。

`DELETE /api/knowledge/documents/:documentId` 使用 document 所属 knowledge base 的 membership 做权限校验。删除时以数据库 document record 为主记录，`knowledge_document_jobs` 和 `knowledge_document_chunks` 通过外键级联清理；OSS object 通过 `OssStorageProvider.deleteObject()` 做 best-effort 清理，OSS 404 / NoSuchKey 按幂等删除处理，不把第三方 SDK 细节暴露给 API caller。

## Frontend MVP Endpoints

`KnowledgeFrontendMvpController` 暂时承接 knowledge 前端真实模式会调用、但独立 knowledge 服务尚未纵向实现的根级 API。当前目标是横向打通页面，避免前端进入真实 API 模式后出现 404；这些接口返回空列表或零值指标，不代表最终业务实现。

`GET /api/documents` 已接到 `KnowledgeDocumentService.listDocuments()`，会按当前用户可访问的 knowledge base 聚合文档；可选 `knowledgeBaseId` query 用于详情页过滤。上传成功但列表为空时，优先检查当前请求是否命中这个根级 endpoint，以及用户是否是目标知识库成员。

当前已接线：

- `GET /api/dashboard/overview`
- `GET /api/documents`
- `POST /api/chat`
- `POST /api/messages/:messageId/feedback`
- `POST /api/documents/:documentId/reprocess`
- `GET /api/observability/metrics`
- `GET /api/observability/traces`
- `GET /api/observability/traces/:traceId`
- `GET /api/eval/datasets`
- `GET /api/eval/runs`
- `GET /api/eval/runs/:runId/results`
- `POST /api/eval/runs/compare`

`POST /api/chat` 当前是 repository-backed deterministic RAG：入口优先接受 OpenAI Chat Completions 风格请求，即 `model`、`messages`、`metadata`、`stream: false`。服务层从最后一条 user message 归一化查询文本，前端新 Chat Lab 只发送 `metadata.conversationId`、`metadata.debug` 与 `metadata.mentions`；`metadata.knowledgeBaseIds` 和旧的顶层 `message` / `knowledgeBaseIds` 字段仅保留兼容。检索前路由由 `@agent/knowledge` 的 `resolveKnowledgeChatRoute()` 承担，顺序为：兼容 knowledge base ids 优先；显式 `@mentions` 按当前用户可访问知识库的 id / name 绑定范围；无 mention 时按问题 tokens 与知识库 name / description / metadata 做 deterministic metadata routing；仍无命中时回退全部可访问知识库。`KnowledgeChatRoutingError` 在 service 层转换为 `KnowledgeServiceError`，再由 controller 映射为 HTTP 400。随后校验当前用户对目标知识库的 membership，读取对应 document chunks，按查询词命中率返回 answer 和 citation projection。citation 只包含 display-safe 字段，例如 `title`、`quote`、`score`、`documentId`、`chunkId`。请求中的知识库 ID 必须是真实存在且当前用户具备 membership 的 base；缺失 base 返回 `knowledge_base_not_found` 对应的 404，未授权 base 返回 `knowledge_permission_denied` 对应的 403，缺少 user message 返回 `knowledge_chat_message_required` 对应的 400，显式 mention 找不到可访问知识库返回 `knowledge_mention_not_found` 对应的 400，不能泄漏为 500。`POST /api/messages/:messageId/feedback` 是横向 MVP 的反馈回显 endpoint，用于前端按钮真实模式闭环；长期反馈仓储后续应另行接入 repository。

## PostgreSQL Tables

当前表结构以 [knowledge-schema.sql.ts](/Users/dev/Desktop/learning-agent-core/apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts) 为唯一源码。不要在文档中手写第二份长期 SQL 定义，避免字段名如 `metadata` / `metadata_json`、`stages` / `stages_json` 与 repository mapper 漂移。

## Verification

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm --dir apps/backend/knowledge-server build
pnpm check:docs
```
