# Knowledge SDK RAG Rollout

状态：current
文档类型：integration
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-07

本主题主文档：`docs/integration/knowledge-sdk-rag-rollout.md`

本文只覆盖：Knowledge SDK 默认 RAG runtime、统一 agent-server Knowledge domain 接入、standalone knowledge-server 迁移状态、Supabase pgvector 向量落点、knowledge 前端 Chat Lab 接入状态，以及下一步仍缺的前后端/package 边界。

## 当前结论

知识库向量的生产落点是 Supabase/PostgreSQL + pgvector。统一 `agent-server` Knowledge domain 启用 SDK runtime 后，文档上传入库会生成 chunk embedding，并写入数据库表 `knowledge_document_chunks.embedding vector(1536)`；`metadata jsonb` 只保存租户、知识库、文档、标题、文件名、ordinal、tags 等过滤和展示字段。standalone `knowledge-server` 在迁移完成前仍保留同类历史实现。

前端 Chat Lab 的知识问答目标入口是 `/api/knowledge/chat`，发送 OpenAI Chat Completions 风格 payload：`model`、`messages`、`metadata.conversationId`、`metadata.mentions`，并可用 `stream:false` 获取 JSON 或 `stream:true` 获取 SSE。`/api/chat` 属于 agent-chat 主链，不承载 Knowledge Chat Lab。UI 已从 Ant Design X demo card 布局改为 Codex 风格双栏工作台：左侧会话/知识库，右侧顶部运行栏、消息线程、底部 composer、引用卡片、trace link 和 feedback。

统一后端 Chat API 已接 SDK RAG。`KnowledgeApiController` 使用本地域 schema 解析请求，`KnowledgeRagService` 先做用户可访问知识库路由与 membership 校验；`KNOWLEDGE_SDK_RUNTIME.enabled=true` 时调用 SDK embedding、Supabase pgvector search 和 chat provider，并支持 `streamKnowledgeRag()` SSE；disabled 时保留 repository deterministic fallback，JSON 与 SSE 都走同一 domain service 持久化 message 与 trace。

`packages/knowledge` 已提供 Node 默认 runtime：`@agent/knowledge/node` 的 `createDefaultKnowledgeSdkRuntime()` 默认组合 OpenAI-compatible chat provider、OpenAI-compatible embedding provider 与 Supabase pgvector vector store。根入口不导出该 node-only factory。

## 后端接入 SDK 默认实现

统一后端接入入口是 `apps/backend/agent-server/src/domains/knowledge/runtime/knowledge-sdk-runtime.provider.ts`，由 `KnowledgeDomainModule` 注册 `KNOWLEDGE_SDK_RUNTIME` token。standalone `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-sdk-runtime.provider.ts` 仅作为迁移期间历史入口。

最小环境变量：

```text
DATABASE_URL=postgres://...
KNOWLEDGE_CHAT_MODEL=<chat-model>
KNOWLEDGE_EMBEDDING_MODEL=<embedding-model>
KNOWLEDGE_LLM_API_KEY=<provider-api-key>
```

可选环境变量：

```text
KNOWLEDGE_LLM_BASE_URL=<openai-compatible-base-url>
KNOWLEDGE_CHAT_MAX_TOKENS=2048
KNOWLEDGE_EMBEDDING_DIMENSIONS=1536
KNOWLEDGE_EMBEDDING_BATCH_SIZE=64
```

接入流程：

1. `DATABASE_URL` 触发 Postgres repository 与 `KNOWLEDGE_SCHEMA_SQL` 初始化。
2. Schema 初始化创建 pgvector extension、`knowledge_document_chunks.embedding vector(1536)` 和三组 RPC：`upsert_knowledge_chunks`、`match_knowledge_chunks`、`delete_knowledge_document_chunks`。
3. Runtime provider 创建 Postgres-backed `SupabaseRpcClientLike`，把 SDK adapter 的 RPC 调用映射到 Postgres function。
4. Runtime provider 调用 `createDefaultKnowledgeSdkRuntime()`。
5. Ingestion worker 调用 `embedBatch()` + `upsert()`。
6. Chat service 调用 `embedText()` + `search()` + `generate()`。

统一后端半配置规则：没有 SDK env 或 SDK env 不完整时返回 disabled fallback，不阻断 agent-server 启动；只有完整配置才创建 SDK runtime 和 SQL client。

## 仍缺什么

前端还缺：

- Chat Lab 前端消费 unified `/api/knowledge/chat` 的 SSE 事件并渲染增量输出；后端 `stream:true` 已返回 `KnowledgeRagStreamEvent`。
- 前端切到 unified `/api/knowledge/conversations` 与 `/api/knowledge/conversations/:id/messages`，避免继续依赖本地会话状态。
- feedback 统计闭环；当前 unified endpoint 已写入 message feedback，但治理统计仍需接入。
- 真实 observability trace 详情与 Chat Lab traceId 的后端 span 数据对齐。

后端还缺：

- 按文档 metadata.embeddingModelId 选择 embedding provider/model 的真实校验；当前先保存为 metadata。
- `tenantId` 在空知识库向量检索时的 workspace 解析；当前无文档时使用 `default` fallback，后续应从 knowledge base record 直接读取 workspace。
- trace repository 的长期实现与 observability projection。
- 生产迁移脚本与 Supabase dashboard 运维说明；当前 schema 由启动期 `KNOWLEDGE_SCHEMA_SQL` 初始化。

`packages/knowledge` 还缺：

- Browser/client SDK 正式入口；前端仍应通过后端 API，不直连 SDK provider 或向量库。
- 更多默认 vector store adapter（Qdrant、Milvus、Pinecone 等）；当前 Supabase pgvector 是默认推荐。
- 更完整的 tracing/eval/observability SDK facade。
- default runtime 的多 provider preset；当前默认 provider 是 OpenAI-compatible。

## 优先阅读

- [Knowledge SDK 接入指南](/docs/packages/knowledge/sdk.md)
- [Agent Server Knowledge 后端](/docs/apps/backend/agent-server/knowledge.md)
- [Knowledge API Contract](/docs/contracts/api/knowledge.md)
- [Knowledge Frontend](/docs/apps/frontend/knowledge/knowledge-frontend.md)
