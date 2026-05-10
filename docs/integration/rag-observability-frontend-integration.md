# RAG Observability Frontend Integration

状态：current
文档类型：integration
适用范围：`apps/frontend/knowledge`、`apps/frontend/agent-admin`、Knowledge RAG diagnostics 展示
最后核对：2026-05-10

本文定义 Knowledge RAG 产品化任务 4 的前端展示与接口接线方案。当前只沉淀展示设计、字段来源、兼容策略和后续 UI 实现拆分；本轮不要求重型 UI 实现。

本主题主文档：`docs/integration/rag-observability-frontend-integration.md`

本文只覆盖：Knowledge Chat Lab、Knowledge Observability、agent-admin Runtime Center、Evidence Center 与 Knowledge Governance 如何消费 RAG diagnostics、chunk metadata、trace/eval display contract。API 路径、请求/响应 schema、SSE 事件与权限错误仍以 `docs/contracts/api/knowledge.md` 为准；retrieval runtime 与 observability/eval schema 细节仍以 `docs/packages/knowledge/knowledge-retrieval-runtime.md` 和 `docs/packages/knowledge/observability-eval-contracts.md` 为准。

## 目标与非目标

目标：

- 让 Knowledge Chat Lab、Knowledge Observability、agent-admin Runtime Center、Evidence Center 和 Knowledge Governance 在同一套 RAG diagnostics 语义下展示。
- 明确 hybrid diagnostics、chunk metadata、trace/eval contract 的前端消费边界。
- 给后续真正 UI 实现提供可拆分任务和验证点，避免页面直接读取 raw repository record、raw metadata 或 vendor payload。

非目标：

- 不新增接口路径，不改变 `docs/contracts/api/knowledge.md` 的 canonical API contract。
- 不把 `packages/knowledge/src` 内部类型直接暴露给应用层。
- 不在前端展示完整 chunk 正文、完整 prompt、完整 context、embedding 向量、provider request/response、SDK error object、raw headers 或任何 secret/token/password/apiKey。

## 权威契约来源

前端实现必须按以下顺序确认字段：

1. `docs/contracts/api/knowledge.md`
   - Chat Lab：`ChatRequest`、`ChatResponse`、`KnowledgeChatRoute`、`KnowledgeChatDiagnostics`、`Citation`、`KnowledgeRagStreamEvent` 语义。
   - Observability：`ObservabilityMetrics`、`RagTrace`、`RagTraceDetail`、`RagTraceSpan`、`RetrievalSnapshot`。
2. `docs/packages/knowledge/knowledge-retrieval-runtime.md`
   - 单次检索 runtime diagnostics，尤其是 `diagnostics.hybrid`、`diagnostics.filtering`、`diagnostics.postRetrieval`、`diagnostics.contextAssembly`。
   - backend Runtime Center projection 中的 `knowledgeSearchStatus` 与可选 `knowledgeSearchLastDiagnostics`。
3. `docs/packages/knowledge/observability-eval-contracts.md`
   - SDK 层 `KnowledgeRagTraceSchema`、`KnowledgeRagEventSchema`、`KnowledgeEvalSampleSchema` 和 metric summary 的稳定边界。
   - `attributes`、error record、trace/eval sample 的 redaction 规则。
4. `docs/apps/frontend/knowledge/knowledge-frontend.md`
   - Knowledge App provider/hook/page 分层、Chat Lab SSE 消费和 Observability 页面现状。
5. `docs/apps/frontend/agent-admin/README.md`
   - Runtime Center、Evidence Center 与 Knowledge Governance 当前只消费后端稳定 projection。

## 页面职责拆分

### Knowledge Chat Lab

定位：面向知识库运营和 evaluator 的单次问答验证台。它解释“这次回答如何选库、如何检索、引用了什么”，不承担全局 runtime 治理。

数据来源：

- 请求：`POST /api/knowledge/chat`，OpenAI Chat Completions 风格 payload：`model`、`messages`、`metadata.conversationId`、`metadata.mentions`、`stream: true`。
- 流式事件：`planner.completed`、`retrieval.completed`、`answer.delta`、`answer.completed`、`rag.completed`、`rag.error`。
- 最终投影：`rag.completed.result` 或非流式 `ChatResponse`。

展示建议：

- 顶部或回答底部状态行展示 planner/retrieval 摘要：
  - planner 类型、选择理由、search mode、confidence。
  - 第一条 executed query、final hit count、selected knowledge base 数量。
- 回答 footer 展示 `route.reason`：
  - `mentions`：用户通过 `@知识库名` 明确限定。
  - `metadata-match`：后端根据问题与知识库元信息自动路由。
  - `fallback-all`：未命中明确范围，回退到当前用户可访问知识库。
  - `legacy-ids`：仅作为迁移兼容标记，新前端不得主动发送旧 id payload。
- diagnostics 卡片只展示 `KnowledgeChatDiagnostics` 的 redacted 字段：
  - `normalizedQuery`
  - `queryVariants`
  - `retrievalMode`
  - `hitCount`
  - `contextChunkCount`
- 如果 SSE 的 `retrieval.completed.retrieval.diagnostics` 带有 runtime hybrid drilldown，可在“高级诊断”折叠区展示：
  - `hybrid.retrievalMode`
  - `enabledRetrievers`
  - `failedRetrievers`
  - `fusionStrategy`
  - `candidateCount`
  - `prefilterApplied`
  - `postRetrieval.filtering/ranking/diversification` 的数量与策略摘要
  - `contextAssembly.selectedCount/droppedCount/truncatedCount/estimatedTokens` 等预算摘要（字段存在时展示）
- citation card 必须展示 `title`、`quote` 或 `contentPreview`、`score` 或 `uri`，并提供 trace link 与 feedback 操作。

禁止：

- 不展示 SDK citation 原始对象、model 自称的 citation id、完整 chunk text、raw metadata、embedding、vendor 字段。
- 不把 `metadata.debug` 当作绕过脱敏的开关；debug 只影响是否请求后端已脱敏的诊断摘要。
- 不在浏览器端基于 raw knowledge base records 自行做权限或选库推断；选库结果以后端 `route` 为准。

### Knowledge Observability

定位：面向 owner/admin/maintainer 的 RAG 运行观测页。它解释“多次 RAG run 的质量、延迟、失败、引用和阶段表现”，不替代 Chat Lab 的当前回答上下文。

数据来源：

- `GET /api/knowledge/observability/metrics`
- `GET /api/knowledge/observability/traces`
- `GET /api/knowledge/observability/traces/:id`

展示建议：

- Metrics strip：
  - `traceCount`、`questionCount`
  - `averageLatencyMs`、`p95LatencyMs`、`p99LatencyMs`
  - `errorRate`、`timeoutRate`、`noAnswerRate`、`negativeFeedbackRate`、`citationClickRate`
  - `stageLatency[]` 按 `stage` 或 span `name` 聚合展示。
- Trace list：
  - `question`、`knowledgeBaseIds`、`status`、`latencyMs`、`hitCount`、`citationCount`、`feedbackRating`、`createdAt`。
  - 支持 API 已声明的过滤：`knowledgeBaseId`、`status`、`from`、`to`、分页与 keyword。
  - feedback/errorCode 过滤若尚未进入 API contract，只能作为当前页 client-side 辅助视图或 future extension 标注。
- Trace detail：
  - summary：问题、回答摘要、状态、延迟、命中数、引用数、feedback。
  - span timeline：`spans[].stage/name/status/latencyMs/startedAt/endedAt`，失败 span 展示 `error.code/message/requestId`，不展开 raw error。
  - retrieval snapshot：`vectorHits`、`keywordHits`、`mergedHits`、`rerankedHits`、`selectedChunks`。每个 hit 只展示 `chunkId/documentId/title/contentPreview/score/rank`。
  - citations：复用 Chat citation display projection。
  - eval 入口：仅对同时具备 trace 读取和 eval 写入权限的角色展示“加入评测数据集”。

兼容策略：

- 稳定 trace projection 优先读取 `id/question/spans`。
- 历史 raw trace 兼容只能 display-only：缺 `question` 时回退 `operation`，缺 `stage` 时回退 `name`，`spans.status=ok` 可显示为 succeeded-like 状态，但不得把 legacy raw payload 扩展为新调试字段。
- `retrievalSnapshot`、`usage`、`feedbackRating` 均为可选；缺失时展示空态，不阻断详情页。

### agent-admin Runtime Center

定位：后台治理面的运行中枢。它解释“当前 host 是否正确装配 knowledge retrieval/provider，以及最近一次主链知识检索是否有明显降级”，不复制 Knowledge App 的 Chat Lab 或 Observability 详情。

数据来源：

- Runtime Center projection 中的 `knowledgeSearchStatus`。
- 可选 `knowledgeSearchLastDiagnostics`。

展示建议：

- Wenyuan & Cangjing 卡片展示 host 装配态：
  - `configuredMode`
  - `effectiveMode`
  - `vectorConfigured`
  - `hybridEnabled`
  - `vectorProviderId`
  - `vectorProviderHealth.status`
  - `vectorProviderHealth.consecutiveFailures`
  - warning/diagnostic count。
- 最近一次 query 摘要：
  - `query`
  - `hitCount/total`
  - `searchedAt`
  - `diagnostics.hybrid.retrievalMode`
  - `diagnostics.hybrid.enabledRetrievers`
  - `diagnostics.hybrid.failedRetrievers`
  - `diagnostics.hybrid.candidateCount`
  - `diagnostics.hybrid.fusionStrategy`
  - `diagnostics.hybrid.prefilterApplied`
  - `diagnostics.postRetrieval` 的 filter/rank/diversify compact summary（字段完整时展示）。

禁止：

- Runtime Center 不根据 `knowledgeSearchLastDiagnostics` 推断 provider health；health 只来自 `knowledgeSearchStatus`。
- 单次 query diagnostics 不代表全局可用性；全局状态以 host 装配态和 health check 为准。
- 不展示 provider endpoint、API key、raw SDK error、raw request/response。

### agent-admin Evidence / Knowledge Governance

定位：后台治理面的证据和知识治理入口。它解释“某个 agent run 或证据链是否使用了知识检索，以及检索结果是否可追溯”，不展示完整检索上下文。

数据来源：

- Evidence detail 的 `detail.knowledgeRetrievalDiagnostics`。
- Knowledge Governance 的 `KnowledgeGovernanceProjection`。
- 未来可通过 trace id 跳转到 Knowledge Observability，但跨应用跳转只传稳定 id/query 参数，不传 raw payload。

展示建议：

- Evidence card：
  - query、hit/total、retrieval mode。
  - hybrid drilldown：enabled/failed retrievers、fusion strategy、candidate count。
  - post-retrieval 摘要：filter dropped/masked count、ranking strategy、diversification strategy。
  - trace id 或 citation ids 存在时展示跳转入口。
- Knowledge Governance：
  - 知识库 health、provider health、ingestion 来源、最近检索诊断、agent usage 和 evidence 关联。
  - 图形展示只使用 governance projection；React Flow node/edge 是展示 adapter，不进入 API contract 或 dashboard state。

兼容策略：

- `knowledgeRetrievalDiagnostics` 是可选调试 drilldown，不是 evidence 的必填事实。
- 字段不完整时只显示已有摘要；不得在前端合成“成功/失败”事实。
- Evidence 和 Governance 都不展示未脱敏文档内容、raw repository record、raw metadata 或 vendor payload。

## Chunk Metadata 展示边界

后端已经把 chunk metadata 作为过滤与归因契约保留，但前端展示必须区分“可用于后端过滤”和“可展示给用户”的字段。

允许展示：

- Chat citation：`title`、`uri/sourceUri`、`quote`、`contentPreview`、`score`、`rank`、`page`、`metadata.title`、`metadata.sourceUri`、`metadata.tags`。
- Trace hit preview：`chunkId`、`documentId`、`title`、`contentPreview`、`score`、`rank`。
- Document chunk 页面：后端已脱敏并截断的 chunk preview、ordinal、section title/path、document/source display fields（字段存在时）。

只能作为后端过滤或调试摘要，不直接展示原值：

- `allowedRoles`
- `trustClass`
- `status`
- `docType`
- `parentId/prevChunkId/nextChunkId`
- `sectionId`
- embedding model/provider metadata

禁止展示或持久化到前端状态：

- 完整 `metadata: Record<string, unknown>` dump。
- `raw`、`vendor`、`embedding`、`vector`、`prompt`、`context`、`headers`、`authorization`、`apiKey`、`secret`、`token`、`password` 及其嵌套对象。
- 第三方 SDK response/error object、provider request config、repository internal record。

若后续产品需要展示新的 metadata 字段，必须先把字段加入 API display projection 或 `@agent/knowledge` schema，并写明脱敏、截断和兼容策略。

## Eval 展示接线

Eval UI 不直接计算 SDK 内部指标。后续实现按 contract 消费：

- `KnowledgeEvalSampleSchema`：把 golden query、expected answer/chunk/citation、observed answer、feedback、`traceId` 绑定为样本。
- `KnowledgeEvalMetricSummarySchema`：展示 `recallAtK`、`mrr`、`emptyRetrievalRate`、`groundedCitationRate`、`noAnswerAccuracy`。

展示建议：

- Chat Lab negative feedback 或 “加入评测” 创建 eval sample 时，只传 message/trace/citation 稳定 id 与用户选择的 dataset/tags。
- Observability trace detail 的 “加入评测” 入口从 `RagTraceDetail` 生成候选样本摘要，但最终写入必须以后端 eval API 为准。
- Evals page 展示指标趋势和 run compare，不从 raw trace span 自行重算 recall/MRR。

## 后续 UI 实现任务拆分

1. Knowledge API/provider 层
   - 对齐 `KnowledgeFrontendApi` 的 chat SSE、observability trace detail、eval sample 入口。
   - 增加前端 view model adapter，把 SDK/RAG event 投影为 Chat Lab/Trace UI DTO。
   - 验证点：provider 单测覆盖 legacy 缺字段、rag.completed 优先级、citation projection redaction。

2. Knowledge Chat Lab
   - 把底部状态行拆成 planner、retrieval、answer 三段。
   - 新增 diagnostics 折叠区，只读展示 route、diagnostics、hybrid drilldown 和 context assembly 摘要。
   - 验证点：SSE fixture 下 0 hit、vector failed fallback、missing `postRetrieval` 均能稳定显示。

3. Knowledge Observability
   - Trace list/detail 使用稳定 projection，保留 legacy fallback display-only。
   - retrieval snapshot 使用 HitPreview 卡片，不展示 raw metadata。
   - 验证点：owner/admin/maintainer 可访问；viewer/evaluator 不请求 trace detail；fixture fallback 不泄漏 raw payload。

4. agent-admin Runtime Center
   - 保持 host 装配态与单次 query diagnostics 分区展示。
   - 对 `knowledgeSearchLastDiagnostics` 做字段存在性防御，缺失时显示“暂无最近检索”。
   - 验证点：keyword-only、hybrid、vector health degraded、last diagnostics 缺失四类 fixture。

5. agent-admin Evidence / Knowledge Governance
   - Evidence card 增加 query/hit/hybrid/post-retrieval compact summary。
   - Knowledge Governance 继续只消费 `KnowledgeGovernanceProjection`，不接 raw domain records。
   - 验证点：`knowledgeRetrievalDiagnostics` 缺失、字段不完整、maskedCount 存在/缺失均不崩溃。

6. Eval 入口
   - Chat Lab 与 Trace Detail 的“加入评测”只收集稳定 ids、datasetId、tags。
   - Evals page 后续从 eval run summary 展示指标，不从 trace raw span 计算。
   - 验证点：权限 gating、partial run、failedCases 展示。

## 最低验证建议

文档变更：

```bash
pnpm check:docs
```

后续真实 UI 实现按影响范围补充：

```bash
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/agent-admin test
```

若实现触达 `@agent/knowledge` 或 `@agent/core` contract，还必须先更新对应 schema/test，再跑 package 侧 contract 回归。
