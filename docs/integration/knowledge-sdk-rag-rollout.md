# Knowledge SDK RAG Rollout

状态：history
文档类型：integration
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`apps/backend/agent-server/src/api/knowledge`、`apps/frontend/knowledge`
最后核对：2026-05-08

本主题主文档：`docs/integration/knowledge-sdk-rag-rollout.md`

本文只覆盖：Knowledge SDK RAG rollout 的历史背景、当前 unified `agent-server` knowledge 入口、Supabase pgvector 向量落点、knowledge 前端 Chat Lab 接入状态，以及仍需在 unified backend 下继续评估的 rollout 余项。

> 历史说明：本文记录 Knowledge SDK RAG rollout 的实现背景。standalone `apps/backend/knowledge-server` 已在 Unified Backend Hard Cut 中删除；当前后端运行主体是 unified `apps/backend/agent-server`。

当前正确入口：

- API controller：`apps/backend/agent-server/src/api/knowledge`
- 领域实现：`apps/backend/agent-server/src/domains/knowledge`
- SDK 默认 runtime provider：`apps/backend/agent-server/src/domains/knowledge/runtime/knowledge-sdk-runtime.provider.ts`
- RAG service 与 adapter：`apps/backend/agent-server/src/domains/knowledge/services`、`apps/backend/agent-server/src/domains/knowledge/rag`

## 当前结论

知识库向量的生产落点仍是 Supabase/PostgreSQL + pgvector。当前由 unified `agent-server` 的 knowledge domain 接入 SDK runtime：文档上传入库会生成 chunk embedding，并写入数据库表 `knowledge_document_chunks.embedding vector(1536)`；`metadata jsonb` 保存租户、知识库、文档、标题、文件名、ordinal、tags 等过滤和展示字段。

前端 Chat Lab 已接真实 `/api/chat`，发送 OpenAI Chat Completions 风格 payload：`model`、`messages`、`metadata.conversationId`、`metadata.mentions`、`stream:false`。UI 已从 Ant Design X demo card 布局改为 Codex 风格双栏工作台：左侧会话/知识库，右侧顶部运行栏、消息线程、底部 composer、引用卡片、trace link 和 feedback。

后端 Chat API 由 `apps/backend/agent-server/src/api/knowledge` 暴露，并委托 `apps/backend/agent-server/src/domains/knowledge` 内的 service。`KnowledgeDocumentService.chat()` 先做用户可访问知识库路由与 membership 校验；`KNOWLEDGE_SDK_RUNTIME.enabled=true` 时调用 SDK embedding、Supabase pgvector search 和 chat provider；disabled 时只保留 repository deterministic fallback。

`packages/knowledge` 已提供 Node 默认 runtime：`@agent/knowledge/node` 的 `createDefaultKnowledgeSdkRuntime()` 默认组合 OpenAI-compatible chat provider、OpenAI-compatible embedding provider 与 Supabase pgvector vector store。根入口不导出该 node-only factory。

## 后端接入 SDK 默认实现

当前接入入口是 `apps/backend/agent-server/src/domains/knowledge/runtime/knowledge-sdk-runtime.provider.ts`，由 `KnowledgeDomainModule` 注册 `KNOWLEDGE_SDK_RUNTIME` token。HTTP 层位于 `apps/backend/agent-server/src/api/knowledge`，不再存在 standalone knowledge backend package。

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

半配置规则：没有 SDK env 时可以 disabled fallback；只要出现任一 SDK env 但缺少关键项，服务启动失败。

## 历史 rollout 余项

这些条目来自 rollout 阶段，后续应按 unified `agent-server` 的 knowledge domain 继续评估，而不是恢复 standalone backend：

- Chat Lab 真实流式输出；当前 `/chat` 是普通 JSON response。
- 真实 conversation/message 持久化；当前 Chat Lab 会话列表主要是本地状态。
- feedback 的长期仓储和统计闭环；当前 endpoint 用于按钮真实模式闭环。
- 真实 observability trace 详情与 Chat Lab traceId 的后端 span 数据对齐。
- 异步 ingestion worker / 队列；当前文档处理仍是同步 MVP。
- 按文档 metadata.embeddingModelId 选择 embedding provider/model 的真实校验；当前先保存为 metadata。
- `tenantId` 在空知识库向量检索时的 workspace 解析；当前无文档时使用 `default` fallback，后续应从 knowledge base record 直接读取 workspace。
- conversation/message/feedback/trace repository 的长期实现。
- 生产迁移脚本与 Supabase dashboard 运维说明；当前 schema 由启动期 `KNOWLEDGE_SCHEMA_SQL` 初始化。

`packages/knowledge` 还缺：

- Browser/client SDK 正式入口；前端仍应通过后端 API，不直连 SDK provider 或向量库。
- 更多默认 vector store adapter（Qdrant、Milvus、Pinecone 等）；当前 Supabase pgvector 是默认推荐。
- 更完整的 tracing/eval/observability SDK facade。
- default runtime 的多 provider preset；当前默认 provider 是 OpenAI-compatible。

## 优先阅读

- [Knowledge SDK 接入指南](/docs/packages/knowledge/sdk.md)
- [Knowledge API Contract](/docs/contracts/api/knowledge.md)
- [Knowledge Frontend](/docs/apps/frontend/knowledge/knowledge-frontend.md)
