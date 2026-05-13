# knowledge 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/knowledge/`
最后核对：2026-05-10（Knowledge Observability / Eval contract 边界核对）

本目录用于沉淀 `packages/knowledge` 包内部职责、源码边界、运行时契约与迁移状态。面向使用方的 SDK 接入手册已统一迁到 [SDK 文档目录](/docs/sdk/README.md)。

包边界：

- 职责：
  - RAG 知识源接入、文档标准化、chunking、索引写入、检索、重排、citation/context 组装
  - 本地知识 ingestion / overview / artifact snapshot facade
- 允许：
  - knowledge source / chunk repository
  - retrieval contract
  - observability / eval contract
  - chat 检索前路由的纯函数 contract
  - citation contract
  - indexing / retrieval runtime
  - 本地 docs/package manifest ingestion、chunk/embedding receipt 持久化
- 禁止：
  - chat / workflow 主链编排
  - 最终回答生成
  - app view model
  - provider SDK 具体实现
- 依赖方向：
  - `@agent/knowledge` 作为独立发布 SDK，不依赖 repo runtime 包 `@agent/config`、`@agent/core` 或 `@agent/memory`
  - publishable SDK 边界不应直接依赖 workspace `@agent/*` 包；host/server wiring 负责加载仓库运行时配置，并把 settings、embedding provider、vector store、repository adapter 等结构化能力注入 knowledge
  - 被 `runtime`、`agents/*` 与 backend 消费
- 公开入口：
  - 根入口：`@agent/knowledge`
  - SDK core 子路径：`@agent/knowledge/core`
  - Node 默认 runtime 子路径：`@agent/knowledge/node`
  - 官方 adapter 子路径：`@agent/knowledge/adapters/*`

约定：

- `packages/knowledge` 是知识检索宿主，不是 memory 的别名
- 稳定知识契约沉淀到 `packages/knowledge/src/contracts/*`，不要恢复 `packages/core/src/knowledge/*`
- 当前 retrieval/indexing schema source of truth 仍是 `packages/knowledge/src/contracts/*`
- agent/task learning、review evaluation、budget、conflict 与 skill governance contract 的真实宿主是 `@agent/core`，例如 `EvaluationResult`、`LearningEvaluationRecord`、`BudgetState`、`LearningConflict*`、`SkillGovernanceRecommendation`；`@agent/knowledge` 不再提供这些 schema 或 type 的兼容 re-export，调用方必须直接从 `@agent/core` 导入
- Knowledge SDK / RAG eval、trace 与 workbench contract 仍由 `@agent/knowledge` 自己拥有，例如 `KnowledgeEvalCase`、`KnowledgeEvalRun`、`KnowledgeEvalRunResult`、`KnowledgeTrace*`、`KnowledgeWorkbench*` schema/type；不要把这些 knowledge-owned eval contract 误归类为 core 的 agent/task evaluation contract
- 当前 SDK core facade 已落地到 `packages/knowledge/src/core/*`，用于 publishable SDK 的 provider interface、core error、provider health、knowledge base summary 等边界；不要把它误当成 retrieval runtime 现有 contract 的替代源
- 迁移期间禁止重复同一稳定 schema：如果某个 retrieval/indexing schema 从 `contracts` 迁到 `core`，必须同步更新调用方、测试、文档与 compat 导出
- Chroma、OpenSearch、Supabase pgvector 与 LangChain indexing 适配器当前真实宿主是 `packages/knowledge/src/adapters/*`；`packages/adapters/src/{chroma,langchain,opensearch,supabase}` 已删除，不再提供 `@agent/adapters` 兼容入口

当前文档：

- [sdk-architecture.md](/docs/packages/knowledge/sdk-architecture.md)
- [Knowledge SDK 接入指南](/docs/sdk/knowledge.md)
- [indexing-package-guidelines.md](/docs/packages/knowledge/indexing-package-guidelines.md)
- [indexing-contract-guidelines.md](/docs/packages/knowledge/indexing-contract-guidelines.md)
- [knowledge-retrieval-runtime.md](/docs/packages/knowledge/knowledge-retrieval-runtime.md)
- [observability-eval-contracts.md](/docs/packages/knowledge/observability-eval-contracts.md)
- [context-assembly-and-generation.md](/docs/packages/knowledge/context-assembly-and-generation.md)
- [chat-pre-retrieval-routing.md](/docs/packages/knowledge/chat-pre-retrieval-routing.md)
- [source-ingestion-status.md](/docs/packages/knowledge/source-ingestion-status.md)
- [rag-course-reference-gap-analysis.md](/docs/packages/knowledge/rag-course-reference-gap-analysis.md)
- [duyi-knowledge-bases-reference-gap-analysis.md](/docs/packages/knowledge/duyi-knowledge-bases-reference-gap-analysis.md)

说明：`sdk-architecture.md` 记录 SDK target architecture / migration guide，不代表其中所有目标目录、subpath exports 或 optional adapters 当前均已实现。

当前实现补充：

- `packages/knowledge/src/core/index.ts`
  - 是当前已实现的 SDK core 子路径入口，对外通过 `@agent/knowledge/core` 暴露
  - 当前包含 schema-first `KnowledgeBaseSchema` / `ProviderHealthSchema`、`EmbeddingProvider`、`VectorStore`、SDK error 基类、默认常量和 `AsyncPipeline`
  - 不依赖 `@agent/adapters`、`@agent/config`、`@agent/memory` 或任何 vendor SDK；使用方可以实现接口并注入自己的 embedding / vector store
  - 根入口只保留不冲突的显式 re-export；SDK vector 类型在根入口使用 `KnowledgeSdk*` alias，未加 alias 的名字应从 `@agent/knowledge/core` 引入

- `packages/knowledge/src/node/index.ts`
  - 是当前 Node-only SDK runtime 入口，对外通过 `@agent/knowledge/node` 暴露
  - 当前包含 `createDefaultKnowledgeSdkRuntime()`，默认组合 OpenAI-compatible chat provider、OpenAI-compatible embedding provider 与 Supabase pgvector vector store
  - 还包含 `createKnowledgeRuntime()`，用于宿主注入自定义 embedding provider / vector store
  - 这一路径不能从浏览器或前端应用导入，也不会从 `@agent/knowledge` 根入口 re-export

- `packages/knowledge/src/adapters/`
  - 是 `@agent/knowledge` 独立发布包内的官方 adapter 层
  - 通过 LangChain `ChatOpenAI` / `OpenAIEmbeddings` 创建 MiniMax、GLM、DeepSeek 与 OpenAI-compatible provider
  - 承载 LangChain loader/chunker/embedder、Chroma vector store/vector search、OpenSearch keyword search、Supabase pgvector store
  - 对外只暴露 `KnowledgeChatProvider` / `KnowledgeEmbeddingProvider` 等 SDK contract，不泄露 LangChain 或 vendor 原始对象

- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 当前已支持 deterministic query cleanup、轻量 rewrite 与 bounded query variants
  - 会按 query variants 执行多次检索，再按 `chunkId` 合并命中并保留最高分结果
  - diagnostics 会暴露 `originalQuery`、`normalizedQuery`、`rewriteApplied`、`rewriteReason`、`queryVariants`、`executedQueries`
  - `pipeline.queryNormalizer` 支持单个或数组（`resolveNormalizerChain` 串联执行）

- `packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts`
  - 接受 `QueryRewriteProvider` 注入，调用 LLM 进行语义改写
  - 失败时静默降级，不中断检索流程
  - 调用方实现 `QueryRewriteProvider.rewrite(query)` 即可接入任意 LLM

- `packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts`
  - 当前 Hybrid Search 兼容 facade：内部委托 `HybridRetrievalEngine`，对外仍可作为 `KnowledgeSearchService` 注入 `runKnowledgeRetrieval`
  - `HybridRetrievalEngine`、`KnowledgeRetriever` / `KeywordRetriever` / `VectorRetriever`、`RetrievalFusionStrategy` / `RrfFusionStrategy` 与 `diagnostics.hybrid` 已在当前工作区源码落地
  - 真实 Chroma / OpenSearch / Supabase pgvector / LangChain indexing adapter 已迁入 `packages/knowledge/src/adapters/*`；生产凭据、SDK client 与 host 注入仍由 backend / 装配层负责

- `packages/knowledge/src/retrieval/knowledge-chat-routing.ts`
  - 是 Chat Lab / agent-server Knowledge domain 在检索前选择知识库范围的稳定 helper，并由 `@agent/knowledge` 根入口导出
  - 输入是当前用户可访问的 knowledge base 元信息、兼容 ids、`metadata.mentions` 和用户问题
  - 路由顺序为兼容 ids、metadata ids、`@mentions`、问题与知识库元信息匹配、fallback all
  - 显式 mention 不能绑定时抛出 `KnowledgeChatRoutingError(code="knowledge_mention_not_found")`，由宿主转换为自己的 HTTP / service error
  - 这层不做 HTTP 鉴权、repository 读取或最终回答生成；后端不得再维护重复的本地 routing helper

- `packages/knowledge/src/runtime/stages/context-expander.ts`
  - 是检索 runtime 的 context expansion stage contract
  - `runKnowledgeRetrieval()` 在 post-process 后、context assembly 前调用该 stage
  - expanded hits 只进入 `contextAssembler`，不改变 `KnowledgeRetrievalResult.hits`

- `packages/knowledge/src/runtime/stages/context-assembler.ts`
  - 是检索 runtime 的 context assembly stage contract
  - 当前接口为 `assemble(hits, request, options?)`，可兼容旧 string 返回，也可返回 `{ contextBundle, diagnostics }`
  - `contextAssemblyOptions.budget` 可传入上下文预算；默认 ordering 明确记录为 `ranked`，长上下文头尾重排仍是后续增强

- `packages/knowledge/src/retrieval/small-to-big-context-expander.ts`
  - 当前 Small-to-Big 第一阶段实现
  - 从 `hit.metadata.parentId`、`hit.metadata.prevChunkId`、`hit.metadata.nextChunkId` 读取候选 chunk id
  - 通过 `KnowledgeChunkRepository.getByIds()` 回补 parent / neighbor chunk，并复用 runtime resolved filters 做防御过滤

- `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
  - `KnowledgeChunkMetadataSchema` 已显式包含 `parentId`、`prevChunkId`、`nextChunkId`、`sectionId`、`sectionTitle`
  - `HybridKnowledgeSearchProductionConfigSchema` 定义 keyword-only / vector-only / hybrid 模式，以及 OpenSearch index/client、Chroma collection/client、diagnostics、health 的生产装配配置语义
  - 默认 `FixedWindowChunker` 仍不自动生成这些 neighbor metadata；需要结构感知 metadata 时，调用方应显式注入 `StructuredTextChunker`

- `packages/knowledge/src/contracts/schemas/knowledge-observability-eval.schema.ts`
  - 是当前 Knowledge RAG observability / eval 的 schema-first 最小稳定边界
  - 定义 `KnowledgeRagEventSchema`、`KnowledgeRagTraceSchema`、`KnowledgeEvalSampleSchema` 与 `KnowledgeEvalMetricSummarySchema`
  - 覆盖 indexing / retrieval / generation event、query snapshot、retrieval hits/citations、diagnostics 摘要、feedback label、Recall@K / MRR / grounding 等后续指标字段
  - 最小 golden eval 闭环入口为 `runKnowledgeGoldenEval(dataset, observeCase, options?)`，只把手写 golden case 与确定性 observed answer 投影成 `KnowledgeEvalSample[]` 并复用现有指标计算器
  - 当前离线最小 fixture 入口为 `createKnowledgeGoldenEvalFixture()` / `DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET`，包含 9 条样本，覆盖精确编号、政策/FAQ、无答案、中文同义问法与多文档综合；它只用于本地 regression，不是产品默认知识库或 ingestion seed
  - 当前只提供 SDK contract 和 parse 回归，不接 UI、backend service、CLI runner、第三方 exporter 或完整 eval 平台；正确入口见 [observability-eval-contracts.md](/docs/packages/knowledge/observability-eval-contracts.md)

- `packages/knowledge/src/runtime/local-knowledge-store.ts`
  - 是当前本地知识摄取与概览读取的真实宿主
  - 负责 `ingestLocalKnowledge`、`readKnowledgeOverview`、`listKnowledgeArtifacts`、`buildKnowledgeDescriptor`
  - 接受 SDK-local `LocalKnowledgeStoreSettings`，只包含本地 store 真正需要的 `workspaceRoot`、`knowledgeRoot`、`tasksStateFilePath`、embedding settings、`mcp.bigmodelApiKey` 与 `zhipuApiKey`
  - 不调用 `loadSettings()`，也不从 `@agent/config` 读取 repo runtime config；调用方必须先在 host 层完成 config 解析，再传入结构化 settings
  - embedding 执行能力通过 `LocalKnowledgeStoreOptions.embeddingProvider` 注入；knowledge 本地 store 不在内部加载 repo adapter
  - `ingestLocalKnowledge()` 刷新本地 README / docs / manifest 时会合并已有 source/chunk/embedding/receipt snapshot，避免 Runtime Center 读取时清空通过生产来源 ingestion HTTP facade 写入的 `user-upload`、`catalog-sync`、`web-curated` 等记录
  - backend 的 `apps/backend/agent-server/src/runtime/knowledge/runtime-knowledge-store.ts` 仅保留 thin compat re-export
- `packages/knowledge/src/runtime/local-knowledge-store.helpers.ts`
  - 承载本地 docs/package manifest 枚举、chunk 切分、embedding 写盘与 snapshot 读写
  - 定义 `LocalKnowledgeStoreSettings` / `LocalKnowledgeEmbeddingSettings` / `LocalKnowledgeEmbeddingProvider`，这些类型是 SDK-local contract，不从 `@agent/config` 推导
  - 如果继续增长，应优先拆到 `packages/knowledge/src/runtime/` 下的更细 helper，而不是把逻辑再放回 backend

- `packages/knowledge/src/runtime/local-knowledge-source-ingestion.ts`
  - 提供 `ingestKnowledgeSourcePayloads()`，用于把生产来源 payload 写入本地 source/chunk/receipt snapshot，并通过调用方注入的 vector writer 写入统一向量边界
  - backend 当前通过 `RuntimeKnowledgeService.ingestKnowledgeSources()` 调用它，并已暴露 `POST /api/platform/knowledge/sources/ingest` 作为规范化 payload 的最小 HTTP facade；`POST /api/platform/knowledge/sources/user-upload/ingest` 已提供 workspace 内已落盘上传文件的最小 adapter；`POST /api/platform/knowledge/sources/catalog-sync/ingest` 已提供上游 catalog entries 的最小 adapter；`POST /api/platform/knowledge/sources/web-curated/ingest` 已提供上游 curated URL entries 的最小 adapter；`POST /api/platform/knowledge/sources/connector-sync/ingest` 已提供上游 connector sync entries 的最小 adapter；multipart upload / 对象存储下载、外部 catalog 拉取与 connector API 同步 job 仍是后续接线点；真实网页抓取当前明确暂不做
  - backend smoke `apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts` 覆盖 Nest HTTP POST ingestion 后再读取 Runtime Center projection，防止本地 ingestion overview 刷新覆盖生产来源 snapshot

- `packages/knowledge/src/indexing/loaders/source-ingestion-payload-builders.ts`
  - 提供 `buildUserUploadKnowledgePayload()`、`buildCatalogSyncKnowledgePayload()`、`buildWebCuratedKnowledgePayload()`、`buildConnectorSyncKnowledgePayload()`
  - 这层只负责把各来源已有产物规范化为 `KnowledgeSourceIngestionPayload`，并复用正式 schema 校验；不做文件上传、外部网页抓取、catalog 拉取或 connector API 调用

来源接线状态：

- `KnowledgeSource` / `RetrievalRequest` / `RetrievalHit` 的正式 `sourceType` 当前为 `workspace-docs`、`repo-docs`、`connector-manifest`、`catalog-sync`、`user-upload`、`web-curated`
- Retrieval runtime 的 `KnowledgeSource.sourceType` 与 Knowledge API 的 `DocumentSourceType` 不是同一枚举；API 层的 `connector-sync`、`web-url` 等来源进入 retrieval 前，必须由 backend/host 映射为 retrieval source 与 metadata，例如 connector sync 进入 retrieval 时映射为 `sourceType=connector-manifest` 且 `metadata.docType=connector-sync`。不要把 API-only source type 直接塞进 retrieval filters。
- `createKnowledgeSourceIngestionLoader()` 是调用方已有内容产物进入 indexing pipeline 的最小 loader；会校验正式 `sourceType`，并把 source metadata 写入 `Document.metadata`
- source ingestion payload builders 已覆盖 user upload、catalog sync、web curated 与 connector sync 的规范化入口；后续来源 job 应优先调用这些 builder，再交给 HTTP facade、`RuntimeKnowledgeService.ingestUserUploadSource()`、`RuntimeKnowledgeService.ingestCatalogSyncSources()`、`RuntimeKnowledgeService.ingestWebCuratedSources()`、`RuntimeKnowledgeService.ingestConnectorSyncSources()` 或 `RuntimeKnowledgeService.ingestKnowledgeSources()`；其中 web curated 仅表示已整理内容入口，不表示当前要建设网页抓取器
- `runKnowledgeIndexing()` 当前支持 `sourceIndex`、`fulltextIndex`、`vectorIndex` 三边界 fanout；生产 user upload、catalog sync、web curated 或 connector content loader 接入时，应同时写入 `KnowledgeSource`、`KnowledgeChunk` 与 vector record
- `source-ingestion-status.md` 是核对各来源 contract、local ingestion、production wiring 的当前入口
- 当前不新增 `agent-skill` sourceType；agent skills 若进入 Hybrid Search，需要先明确映射策略并补 schema / ingestion / filter 回归

Small-to-Big 测试入口：

- `packages/knowledge/test/small-to-big-context-expander.test.ts` — expander parent / neighbor 回补、去重、missing、filter drop 与 maxExpandedHits 行为
- `packages/knowledge/test/run-knowledge-retrieval.test.ts` — pipeline 中 post-process -> context expansion -> context assembly 的接线与 diagnostics
- `packages/knowledge/test/knowledge-chunk.repository.test.ts` — `KnowledgeChunkRepository.getByIds()` 批量读取顺序与 missing 行为
- `packages/knowledge/test/contracts-boundary.test.ts` — chunk metadata schema 与 Hybrid Search 生产配置 contract 边界
- `packages/knowledge/test/root-exports.test.ts` — `ContextExpander` / `SmallToBigContextExpander` 根入口导出
