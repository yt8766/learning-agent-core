# Knowledge RAG SDK Runtime Architecture Design

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-03

## 背景

当前 `packages/knowledge` 已具备 RAG SDK 的关键组件：query normalizer、query rewrite 扩展点、`runKnowledgeRetrieval()`、query variants、hybrid retrieval facade、post-retrieval filter/rank/diversify、context assembler、provider adapter 与 diagnostics 雏形。

但 `apps/backend/knowledge-server` 的 `/api/chat` 仍维护一条平行 RAG 实现：先用规则式 `resolveKnowledgeChatRoute()` 选库，再在 SDK runtime enabled 时直接 `embedText -> vectorStore.search -> chatProvider.generate`，或在 disabled 时读取 repository chunks 做字面打分。这条链路没有消费 SDK retrieval pipeline，也没有把 LLM-first 智能选库做成主链能力。

本设计目标是把 `packages/knowledge` 从“RAG 组件集合”升级为完整 RAG SDK runtime，由 SDK 统一承载检索前计划、检索执行和检索后回答生成。后端只负责权限上下文、provider 注入、search adapter 和 HTTP/SSE transport。

## 目标

- 在 SDK 中建立完整三层 RAG runtime：
  - `PreRetrievalPlanner`：检索前计划，LLM-first 选库、query rewrite、query variants、检索策略。
  - `RetrievalRuntime`：检索执行，复用现有 `runKnowledgeRetrieval()`，执行 hybrid/vector/keyword、post-retrieval 和 context assembly。
  - `RagAnswerRuntime`：检索后回答，grounded prompt、answer generation、citation grounding、no-answer policy。
- 提供两个高层入口：
  - `runKnowledgeRag(input): Promise<KnowledgeRagResult>`
  - `streamKnowledgeRag(input): AsyncIterable<KnowledgeRagStreamEvent>`
- 将知识库路由提升为 SDK 一等能力，而不是 knowledge-server service 胶水逻辑。
- 将 `knowledgeBaseIds` 提升为 retrieval filter 一等字段，打通 planner 输出与 retrieval 输入。
- 定义 schema-first 的 result、policy、diagnostics、stream event 和 error contract。
- 让 `/api/chat` 在不传 `metadata.mentions` / `knowledgeBaseIds` 时，也能由 SDK 基于用户问题、对话摘要和可访问知识库自动生成检索计划。

## 非目标

- 不把 SDK 绑定到 Nest、HTTP、SSE、WebSocket 或浏览器 transport。SDK 只返回 JSON-safe result 或 `AsyncIterable` event。
- 不让前端直连 embedding、vector、planner 或 answer provider。
- 不让 LLM 输出的 citation 直接进入最终 API projection；citation 只能来自 retrieval hits。
- 不在第一阶段实现 agentic multi-hop RAG、自动补查循环或复杂反思 agent。第一阶段先稳定 planner -> retrieval -> answer 主链。
- 不要求第一阶段删除旧 `/api/chat` deterministic fallback，但新主链必须有清晰迁移路径，避免长期平行实现。

## 成熟度差距

当前 SDK 距离成熟 RAG runtime 的主要差距：

- query rewrite 已存在，但没有和知识库路由、检索计划、answer generation 组成统一 runtime。
- `resolveKnowledgeChatRoute()` 是规则路由，不是 LLM-first planner。
- `/api/chat` 未调用 `runKnowledgeRetrieval()`，所以 query normalizer、query variants、post-retrieval 和 context assembly 没进入 Chat Lab 主链。
- knowledge-server 的业务 records 与 SDK `RetrievalHit` 之间缺少正式 search adapter 边界。
- retrieval filters 没有一等 `knowledgeBaseIds`，导致选库结果无法自然进入通用 retrieval contract。
- answer generation 仍在后端 service 分支里拼装，grounding、no-answer、stream events 和 diagnostics 没有 SDK contract 统一约束。

## 总体架构

```text
runKnowledgeRag()
streamKnowledgeRag()
  -> PreRetrievalPlanner
  -> RetrievalRuntime
  -> RagAnswerRuntime
  -> KnowledgeRagResult / KnowledgeRagStreamEvent
```

`runKnowledgeRag(input)` 与 `streamKnowledgeRag(input)` 必须共用同一条内部主链。`streamKnowledgeRag(input)` 最后的 `rag.completed.result` 必须与 `runKnowledgeRag(input)` 的最终结果等价，避免前端、测试、eval 和 trace 分叉。

`knowledge-server` 的职责收敛为：

- 认证当前用户。
- 从 repository 读取当前用户可访问 knowledge bases。
- 投影 routing-safe `KnowledgeBaseRoutingCandidate[]`。
- 注入 `KnowledgeStructuredPlannerProvider`、`KnowledgeSearchService`、`KnowledgeAnswerProvider`。
- 调用 `runKnowledgeRag()` 或 `streamKnowledgeRag()`。
- 将 JSON result 或 SDK stream events 映射为 HTTP JSON / SSE。

## 第一层：PreRetrievalPlanner

`PreRetrievalPlanner` 是检索前计划层，负责回答：

- 用户到底在问什么？
- 是否需要 query rewrite？
- 应该查哪些知识库？
- 应该生成哪些 query variants？
- 本次更适合 vector、keyword 还是 hybrid？
- 低置信度或 planner 失败时如何 fallback？

第一版采用 LLM-first 策略：结构化 planner provider 主导选库和 rewrite，deterministic/embedding router 作为 fallback 与防御。

### 输入

```ts
interface KnowledgePreRetrievalPlannerInput {
  query: string;
  conversation?: KnowledgeRagConversationContext;
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
  plannerProvider: KnowledgeStructuredPlannerProvider;
  policy?: KnowledgeRagPolicy;
  trace?: KnowledgeRagTraceHooks;
  signal?: AbortSignal;
}
```

`conversation` 只能包含安全摘要，不把完整历史无限制塞给 planner：

```ts
interface KnowledgeRagConversationContext {
  summary?: string;
  recentMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

`KnowledgeBaseRoutingCandidate` 是 routing-safe 摘要，不包含 chunk 全文、embedding、secret 或 provider raw metadata：

```ts
interface KnowledgeBaseRoutingCandidate {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  documentCount?: number;
  recentDocumentTitles?: string[];
  domainSummary?: string;
  updatedAt?: string;
  metadata?: Record<string, JsonValue>;
}
```

### Planner Provider

SDK 新增结构化 provider，而不是复用普通 chat provider：

```ts
interface KnowledgeStructuredPlannerProvider {
  plan(input: KnowledgePlannerProviderInput): Promise<KnowledgePlannerProviderResult>;
}
```

planner provider 只返回项目自有 JSON-safe result。具体 OpenAI-compatible、MiniMax、GLM、DeepSeek 或内部 router 的 raw response/error 必须停留在 adapter 层。

### 输出

```ts
interface KnowledgePreRetrievalPlan {
  id: string;
  originalQuery: string;
  rewrittenQuery: string;
  queryVariants: string[];
  selectedKnowledgeBaseIds: string[];
  searchMode?: KnowledgeRagSearchMode;
  selectionReason: string;
  confidence: number;
  fallbackPolicy: KnowledgeRagFallbackPolicy;
  expectedEvidenceTypes?: string[];
  strategyHints?: KnowledgeRetrievalStrategyHints;
  routingDecisions: KnowledgeBaseRoutingDecision[];
  diagnostics: KnowledgePlanningDiagnostics;
}
```

`searchMode` 是 advisory hint，不是强制命令：

```ts
type KnowledgeRagSearchMode = 'hybrid' | 'vector-only' | 'keyword-only';
```

`RetrievalRuntime` 根据可用 adapter 与 provider health 决定实际执行模式，并在 diagnostics 中记录：

```ts
requestedSearchMode;
effectiveSearchMode;
fallbackReason;
```

### 防御规则

SDK 必须对 LLM planner 输出做二次防御：

- `selectedKnowledgeBaseIds` 必须属于 `accessibleKnowledgeBases`。
- 非法或越权 knowledge base id 直接丢弃，并记录 diagnostics。
- `queryVariants` 为空时补 `rewrittenQuery` / `originalQuery`。
- `confidence` clamp 到 `0..1`。
- 低于 `policy.minPlannerConfidence` 时按 `fallbackWhenLowConfidence` 扩大范围。
- planner provider 报错、超时或 schema parse 失败时，按 `fallbackWhenPlannerFails` 降级。

## 第二层：RetrievalRuntime

`RetrievalRuntime` 是检索执行层，负责按 plan 查证据，不重新解释用户意图。

它复用现有 `runKnowledgeRetrieval()`，并把 planner 产物转换成 retrieval request：

```ts
interface KnowledgeRagRetrievalRuntimeInput {
  plan: KnowledgePreRetrievalPlan;
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  policy?: KnowledgeRagPolicy;
  trace?: KnowledgeRagTraceHooks;
  signal?: AbortSignal;
}
```

### Retrieval Filters

SDK retrieval contract 正式新增：

```ts
interface KnowledgeRetrievalFilters {
  knowledgeBaseIds?: string[];
  sourceIds?: string[];
  documentIds?: string[];
  sourceTypes?: KnowledgeSourceType[];
  minTrustClass?: KnowledgeTrustClass;
  trustClasses?: KnowledgeTrustClass[];
  searchableOnly?: boolean;
  docTypes?: string[];
  statuses?: string[];
  allowedRoles?: string[];
}
```

Planner 输出：

```text
selectedKnowledgeBaseIds
```

进入 retrieval request：

```ts
{
  query: plan.rewrittenQuery,
  filters: {
    knowledgeBaseIds: plan.selectedKnowledgeBaseIds
  }
}
```

`RetrievalHit` 建议补齐：

```ts
knowledgeBaseId?: string;
```

第一阶段保持 optional，避免破坏旧 adapter；生产 search adapter 必须填充。

### Search Adapter

SDK 不关心 Postgres、Supabase、Chroma 或 OpenSearch 的具体查询。调用方注入：

```ts
interface KnowledgeSearchService {
  search(request: RetrievalRequest): Promise<RetrievalResult>;
}
```

adapter 负责把 `filters.knowledgeBaseIds` 下推到具体存储：

- Postgres/Supabase：`where knowledge_base_id in (...)`
- Chroma/OpenSearch：metadata filter
- InMemory：record filter

knowledge-server 需要新增 adapter，把业务 `KnowledgeDocumentRecord` / `DocumentChunkRecord` 投影为 SDK `RetrievalHit`。

### 输出

```ts
interface KnowledgeRagRetrievalResult {
  hits: RetrievalHit[];
  total: number;
  citations: Citation[];
  contextBundle?: string;
  diagnostics: RetrievalDiagnostics & {
    requestedSearchMode?: KnowledgeRagSearchMode;
    effectiveSearchMode?: KnowledgeRagSearchMode;
    searchModeFallbackReason?: string;
  };
}
```

## 第三层：RagAnswerRuntime

`RagAnswerRuntime` 是检索后回答层，负责 grounded generation、no-answer 和 citation projection。

### Provider

SDK 新增 answer provider contract：

```ts
interface KnowledgeAnswerProvider {
  generate(input: KnowledgeAnswerProviderInput): Promise<KnowledgeAnswerProviderResult>;
  stream?(input: KnowledgeAnswerProviderInput): AsyncIterable<KnowledgeAnswerProviderStreamEvent>;
}
```

如果调用 `streamKnowledgeRag()` 但 provider 没有 `stream()`，SDK 可以降级到 `generate()`，最后一次性发 `answer.completed`，并在 diagnostics 记录：

```text
streamingFallback: "non-stream-provider"
```

### Grounding

answer runtime 必须强制 citation grounding：

- prompt 中只注入 retrieval context。
- 模型可以生成正文，但不能决定最终 citations。
- `answer.citations` 和 stream/final result 的 citations 只能来自 retrieval hits。
- 无 hits 时默认不调用 answer model，直接返回 no-answer。
- 有低质量 hits 时允许生成保守回答，但必须标记低置信或依据不足。

### No-Answer Policy

```ts
interface KnowledgeNoAnswerPolicy {
  minHitCount: number;
  minTopScore?: number;
  allowAnswerWithoutCitation: boolean;
  responseStyle: 'explicit-insufficient-evidence' | 'ask-clarifying-question';
}
```

默认建议：

- `minHitCount = 1`
- `allowAnswerWithoutCitation = false`
- `responseStyle = "explicit-insufficient-evidence"`

### 输出

```ts
interface KnowledgeRagAnswer {
  text: string;
  noAnswer: boolean;
  citations: Citation[];
  confidence?: number;
  diagnostics: KnowledgeRagAnswerDiagnostics;
}
```

## 高层 Result Contract

```ts
interface KnowledgeRagResult {
  runId: string;
  traceId?: string;
  plan: KnowledgePreRetrievalPlan;
  retrieval: KnowledgeRagRetrievalResult;
  answer: KnowledgeRagAnswer;
  diagnostics: KnowledgeRagDiagnostics;
}
```

`KnowledgeRagDiagnostics` 至少包含：

- planner：query rewrite、selected/considered knowledge bases、confidence、fallback。
- retrieval：query variants、executed queries、hit count、post-retrieval 变化、search mode fallback。
- answer：provider、duration、streaming fallback、no-answer reason、grounded citation count。
- duration：每阶段耗时和总耗时。

## Streaming Contract

SDK 定义项目自己的 `KnowledgeRagStreamEvent`，不复用 OpenAI chat completions chunk。原因是 RAG 流程需要表达 planner、retrieval、citations、diagnostics、error 和 final result，而不只是 token delta。

`streamKnowledgeRag(input)` 返回：

```ts
AsyncIterable<KnowledgeRagStreamEvent>;
```

核心事件：

```text
rag.started
planner.started
planner.completed
retrieval.started
retrieval.completed
answer.started
answer.delta
answer.completed
rag.completed
rag.error
```

事件顺序稳定：

```text
rag.started
planner.started
planner.completed
retrieval.started
retrieval.completed
answer.started
answer.delta*
answer.completed
rag.completed
```

失败时发 `rag.error` 并结束 stream。

### Event Shape

```ts
type KnowledgeRagStreamEvent =
  | { type: 'rag.started'; runId: string; traceId?: string; createdAt: string }
  | { type: 'planner.started'; runId: string }
  | { type: 'planner.completed'; runId: string; plan: KnowledgePreRetrievalPlan }
  | { type: 'retrieval.started'; runId: string; planId: string }
  | { type: 'retrieval.completed'; runId: string; retrieval: KnowledgeRagRetrievalResult }
  | { type: 'answer.started'; runId: string }
  | { type: 'answer.delta'; runId: string; delta: string }
  | { type: 'answer.completed'; runId: string; answer: KnowledgeRagAnswer }
  | { type: 'rag.completed'; runId: string; result: KnowledgeRagResult }
  | { type: 'rag.error'; runId: string; stage: KnowledgeRagStage; error: KnowledgeRagError };
```

后续可扩展：

- `planner.fallback`
- `retrieval.query.started`
- `retrieval.query.completed`
- `retrieval.rerank.completed`
- `context.completed`

第一阶段先保持事件集简洁。

### HTTP/SSE Mapping

knowledge-server 在 `stream: true` 时把 SDK event 映射为 SSE：

```text
event: planner.completed
data: {"type":"planner.completed","runId":"...","plan":{...}}

event: answer.delta
data: {"type":"answer.delta","runId":"...","delta":"..."}

event: rag.completed
data: {"type":"rag.completed","runId":"...","result":{...}}
```

后端不伪造业务事件，只做 transport projection。

启动前错误仍用 HTTP status：

- 无 token：`401`
- 请求 body schema 不合法：`400`
- membership 初始校验失败：`403`

进入 SDK stream 后的业务错误统一用 `rag.error` event。SSE 已开始后不再依赖 HTTP status 表达业务失败。

## Policy

```ts
interface KnowledgeRagPolicy {
  maxSelectedKnowledgeBases: number;
  minPlannerConfidence: number;
  defaultSearchMode: KnowledgeRagSearchMode;
  fallbackWhenPlannerFails: 'deterministic' | 'embedding' | 'search-all-accessible';
  fallbackWhenLowConfidence: 'expand-to-top-n' | 'search-all-accessible' | 'ask-clarifying-question';
  maxQueryVariants: number;
  retrievalTopK: number;
  contextBudgetTokens: number;
  requireGroundedCitations: boolean;
  noAnswer: KnowledgeNoAnswerPolicy;
}
```

默认建议：

```json
{
  "maxSelectedKnowledgeBases": 3,
  "minPlannerConfidence": 0.65,
  "defaultSearchMode": "hybrid",
  "fallbackWhenPlannerFails": "search-all-accessible",
  "fallbackWhenLowConfidence": "expand-to-top-n",
  "maxQueryVariants": 4,
  "retrievalTopK": 8,
  "contextBudgetTokens": 6000,
  "requireGroundedCitations": true
}
```

## Error Contract

```ts
interface KnowledgeRagError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, JsonValue>;
}
```

常见错误码：

- `knowledge_rag_cancelled`
- `knowledge_planner_failed`
- `knowledge_planner_invalid_output`
- `knowledge_retrieval_failed`
- `knowledge_answer_failed`
- `knowledge_provider_unavailable`
- `knowledge_no_accessible_bases`

vendor raw error 不进入 `KnowledgeRagError.details`。

## Cancellation

高层输入支持 `AbortSignal`：

```ts
interface KnowledgeRagRunInput {
  signal?: AbortSignal;
}
```

planner provider、retrieval provider、answer provider stream 都应尊重取消。取消时 stream 发：

```json
{
  "type": "rag.error",
  "stage": "cancelled",
  "error": {
    "code": "knowledge_rag_cancelled",
    "message": "RAG run was cancelled",
    "recoverable": true
  }
}
```

## 目录边界

建议新增：

```text
packages/knowledge/src/rag/
  schemas/
    knowledge-rag-planning.schema.ts
    knowledge-rag-result.schema.ts
    knowledge-rag-stream.schema.ts
    knowledge-rag-policy.schema.ts
  providers/
    structured-planner-provider.ts
    answer-provider.ts
  planning/
    pre-retrieval-planner.ts
    fallback-knowledge-base-router.ts
  retrieval/
    rag-retrieval-runtime.ts
  answer/
    rag-answer-runtime.ts
    grounded-answer-prompt.ts
  runtime/
    run-knowledge-rag.ts
    stream-knowledge-rag.ts
```

保留并复用：

```text
packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts
```

不要重写第二套 retrieval pipeline。

## Knowledge Server 接入边界

`apps/backend/knowledge-server` 迁移后：

- `KnowledgeDocumentService.chat()` 只负责 normalize HTTP request 并调用 SDK runtime facade。
- `KnowledgeRagService` 可以逐步瘦身为 SDK adapter/facade 装配层。
- 新增 `KnowledgeServerSearchServiceAdapter`，把 repository/vector search 投影成 SDK `KnowledgeSearchService`。
- 新增 planner/answer provider adapter，从现有 LLM/OpenAI-compatible provider 注入 SDK。
- `/api/chat`：
  - `stream: false` -> `runKnowledgeRag()` JSON。
  - `stream: true` -> `streamKnowledgeRag()` SSE。

后端不得继续内联 query rewrite、LLM 选库、prompt 拼装、citation grounding 或 stream event 业务语义。

## Frontend Chat Lab 接入边界

`apps/frontend/knowledge` 消费项目自己的 SSE event schema：

```ts
interface KnowledgeRagRunState {
  runId: string;
  phase: 'planning' | 'retrieving' | 'answering' | 'completed' | 'error';
  plan?: KnowledgePreRetrievalPlan;
  citations: Citation[];
  answerText: string;
  diagnostics?: KnowledgeRagDiagnostics;
  error?: KnowledgeRagError;
}
```

事件更新规则：

- `planner.started` -> `phase = planning`
- `planner.completed` -> 保存 plan，展示选库和 confidence
- `retrieval.started` -> `phase = retrieving`
- `retrieval.completed` -> 保存 citations 和 retrieval diagnostics
- `answer.started` -> `phase = answering`
- `answer.delta` -> append assistant text
- `answer.completed` -> 固化 answer
- `rag.completed` -> 保存 final result / diagnostics
- `rag.error` -> 保存 error，结束 run

前端不根据自然语言自行判断知识库，也不从 answer text 反推 citations。

## 迁移计划

1. 在 `packages/knowledge` 新增 schema-first RAG contract、policy、error 和 stream event。
2. 新增 provider interfaces：`KnowledgeStructuredPlannerProvider`、`KnowledgeAnswerProvider`。
3. 实现 `PreRetrievalPlanner`：LLM-first plan、schema parse、防御校验、fallback。
4. 扩展 retrieval filters：`knowledgeBaseIds`，并让 `RetrievalHit` 支持 `knowledgeBaseId?`。
5. 实现 `RagRetrievalRuntime`，包装现有 `runKnowledgeRetrieval()`。
6. 实现 `RagAnswerRuntime`，包含 grounded prompt、no-answer policy、stream delta。
7. 实现 `runKnowledgeRag()` 与 `streamKnowledgeRag()`。
8. knowledge-server 增加 search/provider adapters，并把 `/api/chat` 迁移到 SDK runtime。
9. frontend Chat Lab 增加 `stream: true` 消费与阶段展示。
10. 更新 docs、tests、trace/eval 接入说明，清理旧 deterministic Chat RAG 说明。

## 验证策略

SDK 层：

- planner provider schema parse、非法 id 清理、低置信 fallback、provider failure fallback。
- `knowledgeBaseIds` filter parse 和 adapter 下推。
- `runKnowledgeRag()` 与 `streamKnowledgeRag()` final result 等价。
- `answer.delta` 顺序与 final answer 一致。
- 无 hits 时 no-answer，不调用或保守调用 answer provider。
- 模型伪造 citations 不进入最终 citations。

后端层：

- `/api/chat stream:false` 返回完整 `KnowledgeRagResult` projection。
- `/api/chat stream:true` 返回 SSE，事件顺序稳定。
- 用户无 metadata 时由 planner 自动选库。
- membership 只允许访问当前用户可访问 knowledge bases。
- provider/vector 错误进入稳定错误码或 `rag.error`。

前端层：

- Chat Lab 能展示 planning/retrieving/answering/completed 阶段。
- `answer.delta` 累积为 assistant 文本。
- `rag.completed.result` 能固化 citations、route、diagnostics。
- `rag.error` 有稳定错误态。

文档层：

- 更新 `docs/packages/knowledge/knowledge-retrieval-runtime.md`，说明新 RAG runtime 与旧 retrieval runtime 的关系。
- 更新 `docs/apps/backend/knowledge-server/knowledge-server.md`，说明 `/api/chat` 由 SDK runtime 驱动。
- 更新 `docs/apps/frontend/knowledge/` 对 Chat Lab stream event 的消费说明。

## 开放问题

- planner provider adapter 第一版复用哪个模型配置：独立 `KNOWLEDGE_PLANNER_MODEL`，还是复用 `KNOWLEDGE_CHAT_MODEL`。
- embedding router 是否第一阶段实现，或仅作为 fallback contract 预留。
- `KnowledgeBaseRoutingCandidate.domainSummary` 由上传/ingestion 时生成，还是先由后端按 name/description/recent titles 拼接。
- stream event 是否需要 `sequence` 字段。第一阶段可依赖事件顺序，若后续跨进程转发或持久化 replay，再新增 `sequence`。
