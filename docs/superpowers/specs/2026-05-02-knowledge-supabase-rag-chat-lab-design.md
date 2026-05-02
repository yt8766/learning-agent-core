# Knowledge Supabase RAG Chat Lab Design

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-02

## 背景

当前 knowledge 横向 MVP 已经打通上传、文档、chunk、Chat Lab 与基础 API，但仍存在三类核心断点：

- `knowledge-server` 的文档 chunk 只写入业务 repository。`embedding_status` 与 `vector_index_status` 当前是同步 MVP 的状态投影，不代表真实 embedding 或向量库写入已经发生。
- `POST /api/chat` 当前是 repository-backed deterministic RAG：按 chunk 文本关键词打分，再把 quote 拼接成 answer。它没有调用大模型生成回答。
- 前端 Chat Lab 目前更像 Ant Design X demo，缺少 Codex 参考图中的左侧项目/会话导航、极简中央 composer、对话流、执行步骤、耗时、引用、反馈与 trace 操作。

本设计确认采用方案 C：业务元数据、chunk 文本与向量统一落到 Supabase PostgreSQL + pgvector，后端通过 Knowledge SDK 默认能力接入，前端只消费稳定 HTTP API。

## 目标

1. 将知识库生产数据统一收敛到 Supabase PostgreSQL + pgvector。
2. 让上传入库链路真实执行 `parse -> chunk -> embed -> index_vector -> commit`，只有向量写入成功后才把 document 标记为 ready。
3. 让 Chat Lab 调用的 `/api/chat` 变成真实 RAG：知识库路由、query embedding、pgvector 检索、context/citation 组装、大模型生成。
4. 生成一份 SDK 使用文档，明确默认 provider、Supabase pgvector 接入、后端装配方式、环境变量与错误语义。
5. 将前端 Chat Lab 重做为 Codex 风格对话实验室，而不是 Pro 管理后台或 Ant Design X showcase。

## 非目标

- 不在浏览器端直连 Supabase service role、embedding provider 或 chat provider。
- 不把第三方 SDK response、vendor error、raw header、provider secret 写入 API DTO、trace 或前端状态。
- 第一阶段不承诺 `stream: true` SSE；先完成 `stream: false` 的真实 JSON RAG 闭环。
- 不建设网页抓取、外部 catalog 拉取或 connector 同步 job；这些来源只通过既有 ingestion payload 边界进入。

## 数据与向量存储设计

生产 canonical store 是 Supabase PostgreSQL + pgvector。业务表、chunk 文本、向量索引、trace/eval 后续扩展都在同一套 PostgreSQL 运维体系中，减少双数据面造成的权限、备份、删除一致性和调试成本。

`knowledge-server` 继续拥有业务 API 与权限语义，但 production repository 应指向 Supabase/Postgres。`InMemoryKnowledgeRepository` 只保留测试、本地无凭据 demo 和 contract 回归，不再作为生产 fallback 描述。

最小表/RPC 边界：

- `knowledge_bases`、`knowledge_base_members`、`knowledge_uploads`、`knowledge_documents`、`knowledge_document_jobs` 继续承载业务元数据。
- `knowledge_document_chunks` 承载 chunk 文本、ordinal、token_count、status、metadata，并包含 pgvector embedding 或与 pgvector chunk 表保持同事务/同 RPC 写入。
- `upsert_knowledge_chunks`：接收 `knowledge_base_id`、`document_id`、chunk records、embedding 和 metadata，写入 chunk 文本与 vector。
- `match_knowledge_chunks`：接收 `knowledge_base_id`、query embedding、topK、filters，返回 chunk id、document id、text、score、metadata。
- `delete_knowledge_document_chunks`：按 knowledge base/document 删除 chunk 与 vector，避免删除文档后检索残留。

如果现有 `SupabasePgVectorStoreAdapter` 仍保持 RPC-only 形态，后端可以复用它，但需要确保 chunk 文本与 vector 的 canonical 写入不再分裂到两个互不一致的 repository。

## SDK 默认能力设计

`@agent/knowledge` 对后端暴露默认 runtime bundle。bundle 只返回项目自有 contract：

- `KnowledgeEmbeddingProvider`
- `KnowledgeChatProvider`
- `KnowledgeSdkVectorStore`
- `KnowledgeRagRuntime` 或等价 facade

默认 provider 组合：

- chat provider：优先读取 `KNOWLEDGE_CHAT_PROVIDER` / `KNOWLEDGE_CHAT_MODEL`，默认可用 MiniMax/OpenAI-compatible adapter。
- embedding provider：优先读取 `KNOWLEDGE_EMBEDDING_PROVIDER` / `KNOWLEDGE_EMBEDDING_MODEL_ID` / `KNOWLEDGE_EMBEDDING_DIMENSIONS`。
- vector store：Supabase pgvector，使用 SDK 的 `SupabasePgVectorStoreAdapter` 或后续默认 factory 创建。

SDK 文档必须包含：

- 环境变量清单。
- Supabase RPC client 最小接口。
- Supabase SQL/RPC 约定。
- 后端 Nest provider 装配示例。
- 自定义 provider 替换方式。
- 浏览器端禁止事项。
- 错误语义：provider unavailable、vector store error、dimension mismatch、permission denied、no answer。

## 后端入库流程

`KnowledgeIngestionWorker` 从同步 demo 升级为真实 SDK 入库：

1. 校验知识库 membership 与 upload record。
2. 从对象存储读取文件。
3. parse Markdown/TXT。
4. chunk 文本并生成稳定 chunk id / metadata。
5. 调用 SDK embedding provider 生成 batch embeddings。
6. 调用 Supabase pgvector vector store upsert。
7. 更新 document `chunkCount`、`embeddedChunkCount` 与 `status=ready`。
8. 更新 job stages 与 progress。

失败规则：

- parse/chunk 失败：document failed，job stage failed。
- embedding provider 缺配置或调用失败：返回 provider error，不允许标记 embedded succeeded。
- vector upsert 失败或维度不匹配：`index_vector` failed，不允许 document ready。
- 删除 document 时必须删除业务 record 与 vector；删除失败不能静默造成检索残留。

## 后端 Chat RAG 流程

`POST /api/chat` 保持 OpenAI Chat Completions 风格：

- `model`
- `messages`
- `metadata.conversationId`
- `metadata.mentions`
- `metadata.debug`
- 兼容旧 `knowledgeBaseIds`，但新前端不再发送。

执行流程：

1. 从最后一条 user message 提取 query。
2. 用 `resolveKnowledgeChatRoute()` 根据可访问 knowledge base、mentions 和 query 选择检索范围。
3. 校验当前用户对目标 knowledge base 的 membership。
4. 调用 SDK embedding provider 生成 query embedding。
5. 调用 Supabase pgvector 检索 topK chunks。
6. 组装 citation-safe context，不把完整 raw metadata、embedding 或 vendor 字段返回前端。
7. 调用 SDK chat provider 生成 answer。
8. 返回 `ChatResponse`：answer、assistantMessage、citations、traceId、diagnostics/steps 的 display projection。

无命中不是错误，返回 no-answer 文案和空 citations。provider 不可用、Supabase RPC 错误、维度不匹配、权限错误应映射为稳定项目错误码，不泄漏第三方 raw error。

## 前端 Chat Lab 设计

Chat Lab 是真实 RAG 对话实验室，不直接知道 Supabase、embedding provider 或 chat provider。

布局对标 Codex 参考图：

- 左侧浅色 rail：新对话、搜索、知识库、自动化/评测入口、项目/知识库列表、会话列表、设置。
- 主区域顶部：当前知识库/项目标题、模型选择、提交/运行状态、trace/调试入口。
- 空态中央：大标题“我们该构建什么？”风格的引导标题与大 composer。
- composer：支持 `@知识库` mention、自动审查/调试开关、模型选择、提交按钮。
- 对话态：用户消息靠右，assistant 回复靠左；回答显示处理耗时、可折叠步骤、引用卡、复制、赞踩、trace。
- 底部固定 composer：续聊时不跳回页面顶部。

视觉原则：

- 保留 Ant Design 作为基础组件库可以，但不能呈现 Ant Design Pro 管理台风格。
- 避免大卡片套卡片；Chat Lab 主体验应像工作台，不像 dashboard。
- 文案不解释功能教程，功能通过控件、状态和结果自然呈现。

## 接口与状态投影

`ChatResponse` 需要补齐或确认 display-safe 字段：

- `answer`
- `citations[]`
- `traceId`
- `assistantMessage`
- `steps[]`：`route`、`embed`、`retrieve`、`generate`、`review` 等阶段投影。
- `durationMs`
- `knowledgeBaseIds`
- `model`

`Citation` 只允许 title、quote/contentPreview、score、rank、documentId、chunkId、sourceUri/tags 等 display-safe 字段。禁止返回 embedding、vendor raw metadata、secret、token、完整 prompt 或完整 chunk raw metadata。

## 测试与验证

最小验证分层：

- SDK：provider bundle factory、Supabase adapter RPC mapping、错误转换、root exports。
- 后端：ingestion worker 的 embed/upsert 成功与失败、chat route + vector search + chat provider generate、权限错误、no-answer。
- 前端：Chat Lab 发送 OpenAI-style payload、展示 citations/steps/duration、错误态、Codex 风格关键布局。
- 文档：SDK 使用文档、knowledge-server 接入说明、frontend Chat Lab 文档同步。

受影响验证命令按 `docs/packages/evals/verification-system-guidelines.md` 分流，预计至少包含：

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test apps/backend/knowledge-server/test apps/frontend/knowledge/test
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm check:docs
```

## 交付顺序

1. 更新 API/SDK 文档与 Supabase pgvector SQL/RPC contract。
2. 在 SDK 增加默认 runtime bundle 或明确默认 factory。
3. 改造 `knowledge-server` production repository/vector store 装配。
4. 改造 ingestion worker，真实写入 pgvector。
5. 改造 `/api/chat`，真实执行 embedding、vector search 与 chat generation。
6. 重做前端 Chat Lab 为 Codex 风格。
7. 补齐测试、文档和过时说明清理。

## 风险

- Supabase pgvector 维度与 embedding provider 输出维度不一致会导致入库失败；必须在启动和 upsert 前校验。
- 把业务 chunk 与 vector 分开写入容易造成删除残留；需要 RPC 或事务边界保证一致性。
- Chat provider 接入后可能增加延迟；前端必须显示处理中步骤和错误态。
- 旧 deterministic RAG 测试可能需要改成 provider mock，不应继续断言 quote 拼接就是最终 answer。
