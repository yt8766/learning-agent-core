# Trustworthy RAG Workbench Design

> 历史说明：本文记录 standalone `auth-server` / `knowledge-server` 方案形成时的设计背景。当前实现已 hard cut 到 unified `apps/backend/agent-server`；正确入口见 `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md`。

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-03

## 背景

当前知识库已经具备较完整的工程骨架：`packages/knowledge` 提供检索 runtime、hybrid search、source ingestion contract、post-retrieval、small-to-big context expansion 与 provider adapter 边界；`apps/backend/knowledge-server` 已有知识库、上传、文档、chunk、deterministic Chat Lab、权限与 OSS 边界；`apps/frontend/knowledge` 已有独立知识库前端、真实 API provider、文档上传、Chat Lab、评测与观测页面骨架。

下一阶段不应重新做一个普通聊天知识库，而应把现有骨架推进为可信 RAG 工作台 MVP：用户能判断知识是否健康、资料是否真正入库、问答依据是否可靠、失败发生在哪个阶段，以及变更是否造成效果退化。

## 目标

本设计目标是把知识库从“上传 + deterministic Chat Lab MVP”推进到“可信 RAG 工作台 MVP”。

产品目标：

- 知识库可运营：能看到健康状态、文档处理状态、失败原因、provider 状态和最近检索情况。
- 问答可解释：Chat Lab 能展示路由、检索命中、citation、trace 和 feedback。
- 质量可回归：评测页能运行最小数据集，并比较两次 run 的关键指标。
- 故障可定位：观测页能复盘一次 ingestion、RAG 或 eval 的关键阶段。

工程目标：

- ingestion 有明确 job 状态机、失败记录和 retry/reprocess 语义。
- embedding、vector、keyword、generation、rerank、safety 等第三方能力都通过项目自有 provider/adapter 边界接入。
- RAG 从 deterministic answer 升级为 route -> retrieval -> post-retrieval -> context assembly -> generation -> citation grounding 的生产链路。
- trace、eval、provider health 成为正式 contract，而不是页面 mock projection。

## 非目标

- 不做真实网页抓取器。`web-curated` 继续表示人工或外部系统已经整理、清洗、判定后的内容入口。
- 不新增 `agent-skill` 一等 `sourceType`。代理技能先通过 `workspace-docs` / `repo-docs` + `metadata.docType = "agent-skill"` 表达。
- 不引入复杂权限矩阵。MVP 只稳定 `owner`、`editor`、`viewer` 的知识库 membership 语义。
- 不把 `apps/frontend/knowledge` 做成 `agent-chat` 或 `agent-admin` 的复制品；它是知识运营工作台。

## 产品能力

### 知识库健康概览

每个知识库应有后端投影的健康状态：

- `ready`：可检索，最近一次索引成功。
- `indexing`：有文档正在处理。
- `degraded`：部分文档失败、provider 异常或索引滞后。
- `empty`：没有可检索内容。
- `error`：关键链路不可用。

概览页展示文档数、chunk 数、成功/失败 job 数、最近更新时间、最近一次检索命中、embedding/vector/keyword/generation provider 健康状态和 warnings。前端不自行推导健康状态。

### 文档处理流水线

上传后文档必须展示可解释阶段：

- `uploaded`
- `parsing`
- `chunking`
- `embedding`
- `indexing`
- `succeeded`
- `failed`
- `cancelled`

每个 job 暴露 `progress.percent`、当前 stage、错误 code/message、`retryable`、attempt 和时间戳。失败时页面能告诉用户是解析、embedding、indexing、storage 还是权限问题，并提供合适的重试或重新上传动作。

### Chat Lab 可解释问答

Chat Lab 的定位是 RAG 调试与可信问答验证，不是普通聊天页。

每次提问展示：

- 解析出的 `@mentions`。
- 实际路由到的知识库和路由原因。
- normalized query / query variants，可折叠。
- citation cards：title、quote、score、source、chunk/document 标识和 trace link。
- 生成耗时、provider 和 token usage。
- feedback：有用、无用、引用错误、答案不完整。

LLM 可以生成正文，但 citation 必须来自 retrieval hits。模型返回的 citation 只能作为参考信号，不能直接进入最终 citation projection。

### 最小评测闭环

评测第一阶段必须真实可跑，范围保持小：

- 用户能创建或导入 eval dataset。
- 每个 case 包含 question，以及 expected chunks、expected documents 或 expected answer note。
- 运行后产出 recall@K、citation accuracy、answer relevance 的基础指标。
- 至少支持两次 run compare，并展示退化或提升。

### 观测与故障定位

Observability 页面应能定位一次请求，而不只是展示零值指标卡。

一次 trace 至少包含：

- route：选择了哪些知识库，为什么。
- retrieval：召回数量、topK、filters、hybrid mode。
- post-retrieval：filter/rank/diversify 的变化。
- generation：模型、耗时、token usage、失败原因。
- citations：最终展示引用与原始 hit 的对应关系。

## 工程架构

### `packages/knowledge`

`packages/knowledge` 是稳定知识能力包，不承接业务 API 编排。

职责：

- schema-first contracts：health、ingestion job、RAG answer/citation、eval、trace、provider health。
- indexing pipeline：loader、chunker、embedder、source/fulltext/vector fanout contract。
- retrieval runtime：query normalize、hybrid retrieval、post-retrieval、context expansion、context assembly。
- provider interfaces：embedding、vector store、keyword search、chat generation、reranker、safety scanner。
- official adapters：Supabase pgvector、Chroma、OpenSearch、OpenAI-compatible 等项目自有 adapter。

第三方 SDK 对象、错误、response、stream 和 vendor-specific 类型不能穿透到公共 contract、业务 service、前端 DTO 或持久化结构。

### `apps/backend/knowledge-server`

`knowledge-server` 是 Knowledge 产品 API 的 canonical backend。Controller 只做 HTTP DTO parse、auth/membership、service 调用和错误映射。

建议服务边界：

- `KnowledgeIngestionService`：创建 job、推进 stage、记录失败、处理 retry/reprocess。
- `KnowledgeIngestionWorker`：解析文件、切块、embedding、写 vector/fulltext/source index。
- `KnowledgeRagService`：路由知识库、检索、组装 context、调用 LLM、生成 answer/citation。
- `KnowledgeEvalService`：dataset/case/run/metrics/compare。
- `KnowledgeTraceService`：trace/span 记录与查询。
- `KnowledgeProviderHealthService`：embedding/vector/keyword/generation provider 健康状态。

Repository 继续收敛 PostgreSQL 与 memory 实现。Postgres、OSS、LLM、embedding、vector DB SDK 都必须留在 repository/storage/provider/adapter 边界内。

### `apps/frontend/knowledge`

前端只通过 `KnowledgeApiProvider` 消费 `KnowledgeFrontendApi`，页面和 hooks 不直接 new client、不 import mock data、不绕过 provider。

页面职责：

- `KnowledgeBasesPage`：知识库健康概览和状态入口。
- `KnowledgeBaseDetailPage`：文档、chunk、job、成员和 provider 状态。
- `DocumentsPage` / `DocumentDetailPage`：上传、进度、失败、retry、chunk 预览。
- `ChatLabPage`：RAG 调试、citation、trace、feedback。
- `EvalsPage`：dataset、run、compare。
- `ObservabilityPage`：trace list/detail、provider metrics。

前端不自行推导 `ready/degraded/indexing/error`，只展示后端 projection。

## 主数据流

### 上传入库

```text
Frontend upload
  -> knowledge-server upload endpoint
  -> upload record + object storage
  -> document record + ingestion job
  -> worker parsing/chunking/embedding/indexing
  -> source/chunk/vector/fulltext writes
  -> job progress + trace/events
  -> frontend polling or future SSE projection
```

### RAG 问答

```text
ChatLab request
  -> auth + membership
  -> resolveKnowledgeChatRoute()
  -> retrieval runtime
  -> post-retrieval + context assembly
  -> LLM generation provider
  -> citation grounding check
  -> answer + citations + traceId
  -> feedback endpoint
```

### 评测

```text
Eval dataset
  -> cases
  -> run same RAG service in eval mode
  -> collect retrieval/generation/citation metrics
  -> persist run results
  -> compare with prior run
```

## 数据契约

### Knowledge Base Health

```ts
type KnowledgeBaseHealthStatus = 'ready' | 'indexing' | 'degraded' | 'empty' | 'error';

interface KnowledgeBaseHealth {
  knowledgeBaseId: string;
  status: KnowledgeBaseHealthStatus;
  documentCount: number;
  searchableDocumentCount: number;
  chunkCount: number;
  failedJobCount: number;
  lastIndexedAt?: string;
  lastQueriedAt?: string;
  providerHealth: {
    embedding: 'ok' | 'degraded' | 'unconfigured';
    vector: 'ok' | 'degraded' | 'unconfigured';
    keyword: 'ok' | 'degraded' | 'unconfigured';
    generation: 'ok' | 'degraded' | 'unconfigured';
  };
  warnings: Array<{ code: string; message: string }>;
}
```

### Document Ingestion Job

```ts
type IngestionStage =
  | 'uploaded'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

interface IngestionJobProjection {
  id: string;
  documentId: string;
  stage: IngestionStage;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: {
    percent: number;
    processedChunks?: number;
    totalChunks?: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    stage: IngestionStage;
  };
  attempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### RAG Answer

```ts
interface RagAnswer {
  id: string;
  conversationId: string;
  messageId: string;
  answer: string;
  citations: RagCitation[];
  route: {
    requestedMentions: string[];
    selectedKnowledgeBaseIds: string[];
    reason: 'mentions' | 'metadata-match' | 'fallback-all' | 'legacy-ids';
  };
  diagnostics?: {
    normalizedQuery: string;
    queryVariants: string[];
    retrievalMode: 'keyword-only' | 'vector-only' | 'hybrid' | 'none';
    hitCount: number;
    contextChunkCount: number;
  };
  traceId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}
```

`RagCitation` 必须包含真实 retrieval hit 的 `chunkId`、`documentId`、`title`、`quote` 和 `score`。

### Trace / Span

```ts
type KnowledgeTraceOperation = 'ingestion.document' | 'rag.chat' | 'eval.run' | 'provider.health';

interface KnowledgeTrace {
  traceId: string;
  operation: KnowledgeTraceOperation;
  knowledgeBaseId?: string;
  documentId?: string;
  status: 'ok' | 'error' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  spans: KnowledgeSpan[];
}

interface KnowledgeSpan {
  spanId: string;
  name:
    | 'route'
    | 'parse'
    | 'chunk'
    | 'embed'
    | 'index'
    | 'retrieve'
    | 'rerank'
    | 'assemble-context'
    | 'generate'
    | 'evaluate';
  startedAt: string;
  endedAt?: string;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean | null>;
  error?: { code: string; message: string };
}
```

Attributes 只允许脱敏、结构化、JSON-safe 字段。

### Eval

```ts
interface EvalCase {
  id: string;
  datasetId: string;
  question: string;
  expectedChunkIds?: string[];
  expectedDocumentIds?: string[];
  expectedAnswerNote?: string;
}

interface EvalRunResult {
  runId: string;
  caseId: string;
  answerId: string;
  metrics: {
    recallAtK?: number;
    citationAccuracy?: number;
    answerRelevance?: number;
  };
  traceId: string;
}
```

## 状态机约束

- ingestion job stage 单向推进。
- 失败 job 不原地改回 running；retry/reprocess 创建新 attempt 或新 job，并生成新 trace。
- retry 复用 durable document/upload 记录。MVP 可以整文档重跑，后续再优化为从 chunk/embedding/index 阶段续跑。
- RAG 无命中文档时返回正常 answer envelope，citations 为空，不返回 500。
- provider health degraded 不一定阻止页面使用，但必须进入 health projection 和 trace warning。
- 所有长期 DTO 先落 schema，再通过 `z.infer` 推导类型。

## 错误处理

统一错误 envelope：

```ts
interface KnowledgeErrorResponse {
  code: string;
  message: string;
  retryable: boolean;
  traceId?: string;
  details?: Record<string, string | number | boolean | null>;
}
```

核心错误 code：

- `knowledge_permission_denied`
- `knowledge_base_not_found`
- `knowledge_upload_invalid_file`
- `knowledge_upload_storage_failed`
- `knowledge_ingestion_parse_failed`
- `knowledge_ingestion_embedding_failed`
- `knowledge_ingestion_index_failed`
- `knowledge_rag_route_failed`
- `knowledge_rag_retrieval_failed`
- `knowledge_rag_generation_failed`
- `knowledge_eval_run_failed`
- `knowledge_provider_unavailable`

`details` 只能放 stage、providerId、documentId、attempt 等稳定脱敏字段，不放 vendor 原始 response、secret、完整堆栈或隐私正文。

## 权限

权限继续以 knowledge base membership 为准。

- `owner`：成员管理、删除知识库、删除文档、运行评测、查看全部 traces。
- `editor`：上传文档、retry/reprocess、删除自己上传或具备权限的文档、运行 Chat Lab。
- `viewer`：查看知识库、文档、chunks，运行 Chat Lab。

RAG 路由只在当前用户可访问知识库内选择。用户显式 mention 不可见知识库时，不能泄露该知识库真实存在。

## 降级与恢复

上传恢复：

- storage upload 失败时不创建 document/job，用户重新上传。
- document job 失败时保留 document、upload、failed job、trace，并允许 retry/reprocess。

RAG 降级：

- explicit mention 找不到：400，用户修正输入。
- 无可访问知识库：200 envelope，answer 表达没有可用上下文，citations 为空。
- 检索无命中：200 envelope，answer 表达未找到足够依据，citations 为空。
- vector provider 失败但 keyword 可用：降级 keyword-only，trace warning。
- generation provider 失败：返回稳定错误 envelope 和 traceId；如已有 retrieval hits，页面可展示“已检索到依据，但生成失败”。
- citation grounding 失败：不返回模型编造引用；按策略返回空 citations + warning，或让本次生成失败。

Eval 降级：

- 单 case 失败不丢弃整批结果。
- run 支持 `running`、`completed`、`failed`、`partial`。
- compare 明确成功 case 数、失败 case 数和可比较样本范围。

## 测试策略

### Contract / Schema

`packages/knowledge/test` 覆盖：

- `KnowledgeBaseHealth` 状态 parse。
- `IngestionJobProjection` running、failed、retryable error、succeeded。
- `RagAnswer` citation 必须绑定 chunk/document/title/quote/score。
- `KnowledgeTrace` / `KnowledgeSpan` 拒绝非 JSON-safe vendor 对象。
- `EvalCase` / `EvalRunResult` 支持 expected chunks、metrics、traceId。

### Backend

`apps/backend/knowledge-server/test/knowledge` 覆盖：

- upload -> document -> ingestion job 状态推进。
- parse / embedding / indexing 阶段失败时记录正确错误和 retryable。
- `reprocessDocument()` 创建新 attempt，不把失败 job 原地改回 running。
- `KnowledgeRagService` 只在当前用户可访问知识库内路由。
- vector 失败时降级 keyword-only，并写 trace warning。
- generation 失败时返回稳定错误 envelope 和 traceId。
- citation projection 来自 retrieval hit，不信任模型 citation。
- eval run 单 case 失败时整体 partial，并保留成功结果。

### Repository

Memory 与 Postgres repository 最终应验证同一语义：

- job / attempt / trace / eval result 持久化。
- document 删除级联 chunks/jobs，storage 删除 best-effort。
- membership 权限查询不被全局角色绕过。
- provider health projection 可保存或实时聚合。

### Frontend

`apps/frontend/knowledge/test` 覆盖：

- 知识库列表显示 health status、warning、provider 状态。
- 文档上传弹窗选择知识库和 embedding model。
- 文档 job 显示 stage/progress/error/retry。
- Chat Lab 发送 OpenAI Chat Completions 风格 payload，包含 mentions，不发送旧顶层 `knowledgeBaseIds`。
- Chat Lab 展示 route、citations、trace link、feedback。
- Eval 页面展示 run metrics 和 compare delta。
- Observability 页面打开 trace detail，展示 route/retrieval/generation spans。

### Demo / Integration

至少保留两个最小闭环：

- ingestion demo：上传 Markdown/TXT，创建 document，worker 生成 chunks/job succeeded，页面看到 ready。
- RAG demo：同一知识库提问，命中 chunk，生成 answer，citation card 指向真实 chunk，trace 能打开。

本地无真实 LLM / embedding provider 时允许 fake provider，但 fake 必须走同一 provider interface，不能在 service 内写专用分支。

## 验证命令

实现阶段按影响范围执行，最低组合：

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/<new-contract-tests>
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec vitest run --config vitest.config.js apps/frontend/knowledge/test/<affected-tests>
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm check:docs
```

如果修改共享包导出、workspace 依赖或 build 配置，再补对应 build、lockfile 和治理检查。

## 后续实施建议

后续 implementation plan 应按以下顺序拆分：

1. 稳定 `packages/knowledge` contract：health、job、RAG answer、trace、eval。
2. 后端补 ingestion job 状态机、trace service 和 provider health projection。
3. 后端升级 RAG service：generation provider、citation grounding、trace。
4. 前端接 health/job/route/trace projection。
5. 补最小 eval dataset/run/compare 闭环。
6. 清理过时 mock projection 和旧 Chat Lab 兼容路径。
