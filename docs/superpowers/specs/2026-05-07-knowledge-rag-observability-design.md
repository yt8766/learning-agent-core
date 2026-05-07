# Knowledge RAG Observability Design

状态：draft
文档类型：spec
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`apps/frontend/knowledge`、`apps/frontend/agent-admin`
最后核对：2026-05-07

## 背景

当前 Knowledge / RAG 链路已经具备 SDK RAG runtime、统一 `agent-server` Knowledge domain、`KnowledgeTraceService` 内存 trace、RAG diagnostics、provider health、Chat Lab trace link 和 `apps/frontend/knowledge` Observability 页。现状能支持基础调试，但还不是完整生产级观测系统。

本设计目标是在不扩散产品边界的前提下，把 RAG 观测从“内存 trace + 局部 diagnostics”升级为可持久化、可调试、可运营扩展的 RAG Observability Workbench。第一阶段先聚焦 RAG，同时让 trace / metrics contract 可被后续 Runtime Center 统一消费。

## 目标

- 在 `apps/frontend/knowledge` 承载完整知识库观测详情，包括 trace drilldown、retrieval debug、citation feedback 和受控采样 artifact。
- 在 `apps/frontend/agent-admin` 只展示 Runtime 治理摘要、健康状态和跳转入口，不复制知识库产品面。
- 支持性能类指标：Average Latency、P95、P99、QPS、错误率、超时率。
- 支持调试类指标：每步耗时、query rewrite 后内容、召回候选数、rerank 前后变化、prompt/context/answer 采样。
- 支持业务类指标的第一阶段闭环：反馈分布、引用点击、no-answer rate。
- 保持第三方 provider / vendor response / secret / raw header 不穿透 API、trace、前端状态或持久化 display projection。

## 非目标

- 第一阶段不建设完整 Prometheus / OpenTelemetry 平台，只预留导出和 sink 边界。
- 第一阶段不把知识库详情页迁入 `agent-admin`。
- 第一阶段不默认完整保存 prompt、context、answer 原文。
- 第一阶段不重做整个 Knowledge UI 视觉体系，只增强现有 Observability 工作台。

## 产品边界

`apps/frontend/knowledge` 是知识库产品面，必须承载：

- Knowledge base、document、conversation、Chat Lab。
- RAG trace detail、retrieval debug、rerank 对比、citation detail、feedback detail。
- sampled prompt / context / answer 的安全展示。
- 知识库维度的观测筛选、追踪、调试和运营分析。

`apps/frontend/agent-admin` 是 Runtime 治理摘要面，只允许展示：

- Knowledge / RAG 健康状态。
- P95 延迟、错误率、provider health、trace 数等聚合摘要。
- 跳转到 `apps/frontend/knowledge` Observability 的链接。

`agent-admin` 不承载知识库列表、trace drilldown、引用详情、rerank 明细、prompt/context/answer sampled artifact，也不复制 Knowledge 产品操作。

## 设计选型

采用混合观测模型：

- 核心调试证据持久化到 Postgres：trace、span、artifact 摘要、feedback 关联。
- 实时窗口指标先在服务内内存聚合：QPS、短窗口错误率、P95/P99、超时率、provider health。
- 后续通过同一 contract 接入 Prometheus / OpenTelemetry / 外部 trace sink。

prompt、context、answer 的处理策略：

- 默认只保存摘要和结构化字段。
- 支持受控采样保存完整内容。
- 采样内容必须脱敏、限长、记录 sampling reason，并受权限控制。

## 数据模型

### RagTrace

一次 RAG 请求一条 trace。

核心字段：

- `traceId`
- `tenantId`
- `conversationId`
- `messageId`
- `userId`
- `operation = "rag.chat"`
- `status`
- `startedAt`
- `endedAt`
- `latencyMs`
- `selectedKnowledgeBaseIds`
- `modelProfileId`
- `samplingMode`

### RagSpan

RAG 链路每一步一个 span。标准阶段：

- `route`
- `plan`
- `query_rewrite`
- `retrieve_keyword`
- `retrieve_vector`
- `fusion`
- `rerank`
- `context_assembly`
- `answer_generate`
- `citation_grounding`
- `feedback`

span attributes 只能存 JSON-safe 项目自定义摘要，例如：

- `durationMs`
- `candidateCount`
- `hitCount`
- `selectedCount`
- `providerId`
- `retrievalMode`
- `fallbackReason`
- `errorCode`
- `timeoutMs`

禁止写入 secret、raw request header、vendor response、SDK client config、完整第三方错误对象。

### RagArtifact

用于存储可选调试材料。

artifact 类型：

- `query.original`
- `query.rewritten`
- `retrieval.candidates`
- `rerank.before_after`
- `prompt.sampled`
- `context.sampled`
- `answer.sampled`
- `citation.summary`

默认只存摘要。完整 artifact 仅在采样策略命中时保存，且必须包含：

- `samplingReason`
- `redactionStatus`
- `truncated`
- `contentHash`
- `preview`

## 后端架构

新增统一观测边界：

```text
apps/backend/agent-server/src/domains/knowledge/
  services/
    knowledge-observability.service.ts
    knowledge-trace-sampler.ts
    knowledge-metrics-window.ts
    knowledge-trace-projector.ts
  repositories/
    knowledge-trace.repository.ts
```

职责：

- `KnowledgeTraceRepository`：持久化 trace、span、artifact。
- `KnowledgeMetricsWindow`：聚合短窗口 QPS、错误率、超时率、P95/P99。
- `KnowledgeTraceSampler`：决定是否保存完整 prompt/context/answer。
- `KnowledgeTraceProjector`：把内部 trace 投影为前端 DTO，并统一脱敏、限长、错误投影。
- `KnowledgeObservabilityService`：统一 API 查询、filter、metrics、trace detail projection。

RAG 写入点：

- `KnowledgeRagService` 创建 trace 并记录 `route` span。
- `KnowledgeRagSdkFacade` 记录 planner、query rewrite、retrieval、answer diagnostics。
- `KnowledgeServerSearchServiceAdapter` 记录 keyword/vector/hybrid 命中、fallback、provider error code。
- rerank、HyDE、hallucination detector 只写项目自定义摘要。
- message feedback endpoint 写入 `feedback` span，并更新 message feedback。

## API

统一挂在 `/api/knowledge/observability/*`。

```text
GET /api/knowledge/observability/metrics
GET /api/knowledge/observability/traces
GET /api/knowledge/observability/traces/:traceId
GET /api/knowledge/observability/traces/:traceId/artifacts
GET /api/knowledge/observability/health
```

`GET /metrics` 返回：

- `averageLatencyMs`
- `p95LatencyMs`
- `p99LatencyMs`
- `qps`
- `errorRate`
- `timeoutRate`
- `noAnswerRate`
- `feedbackDistribution`
- `citationClickRate`
- `stageLatency`

`GET /traces` 支持筛选：

- 时间范围
- status
- knowledgeBaseId
- conversationId
- modelProfileId
- errorCode
- noAnswer
- feedback 类型

`GET /traces/:traceId` 返回：

- trace detail
- spans
- retrieval snapshot
- citations
- sampled artifact metadata

`GET /traces/:traceId/artifacts` 返回受权限和采样策略保护的 prompt/context/answer 样本。

## 前端设计

`apps/frontend/knowledge` 增强现有 Observability 页为 RAG Observability Workbench。

页面模块：

- Overview：Average Latency、P95、P99、QPS、错误率、超时率、no-answer rate、provider health。
- Trace List：支持按时间、状态、知识库、会话、模型、错误码、no-answer、反馈类型筛选。
- Trace Detail：展示 route、plan、query rewrite、retrieval、fusion、rerank、context assembly、answer generation、citation grounding、feedback。
- Retrieval Debug：展示 keyword hits、vector hits、merged hits、rerank 前后变化、selected chunks、过滤原因。
- Citation & Feedback：展示 citation count、引用点击、wrong citation、unhelpful、helpful、free-form feedback 分布。
- Sampled Artifacts：仅在采样命中时展示 prompt/context/answer，并显示采样原因、脱敏状态、权限提示。

`apps/frontend/agent-admin` 仅补摘要卡片：

- RAG health：healthy / degraded / unconfigured。
- P95 latency。
- error rate。
- provider health。
- Open in Knowledge Observability 链接。

## 安全与权限

- 所有 trace 和 artifact 查询必须走服务端身份与知识库权限校验。
- body 中的 `tenantId`、`userId`、`createdBy` 等可伪造字段不得被信任。
- sampled artifact 默认不可见，必须同时满足采样命中、权限允许、脱敏完成。
- trace/span/artifact 不允许保存 raw vendor response、secret、token、header、SDK client config、完整 stack trace。
- error projection 只暴露稳定错误码、摘要、retryable、provider category。

## 规范更新

需要同步更新：

- `AGENTS.md` 或 `docs/apps/frontend/knowledge/README.md`：明确知识库产品展示、RAG trace drilldown、retrieval debug、citation feedback 归 `apps/frontend/knowledge`。
- `docs/apps/frontend/agent-admin/*`：明确 admin 只展示治理摘要，不复制 Knowledge 深度页面。
- `docs/integration/knowledge-sdk-rag-rollout.md`：把 observability 缺口改为本设计路线。
- `docs/apps/backend/agent-server/knowledge.md`：记录统一 domain 下 Observability service / repository / API 边界。

## 测试策略

Contract / schema：

- `RagTrace`
- `RagSpan`
- `RagArtifact`
- metrics DTO
- trace filter DTO
- artifact sampling policy
- JSON-safe 与脱敏约束

Backend unit：

- trace repository
- trace sampler
- metrics window
- trace projector
- P95/P99
- QPS
- error rate
- timeout rate
- feedback distribution
- citation click rate

Backend integration：

- JSON RAG 请求产生 trace/span/artifact/message。
- SSE RAG 请求产生稳定 stream events 和 trace/span。
- feedback endpoint 写入 feedback span。
- Chat Lab message 的 `traceId` 能跳到 observability detail。

Frontend：

- Observability overview 渲染。
- trace list 筛选。
- trace detail timeline。
- retrieval debug 对比。
- sampled artifact 权限和采样状态。
- agent-admin 仅展示摘要和跳转。

Docs：

- 文档明确 Knowledge / Admin 产品边界。
- 文档不再描述 admin 承载知识库观测详情。

## 分阶段

### Phase 1：Trace 持久化与 API

- 增加 trace/span/artifact repository。
- 增加 metrics window。
- 增加 `/api/knowledge/observability/*`。
- 复用现有内存 trace 作为 fallback。

### Phase 2：RAG 主链埋点

- route、planner、query rewrite、keyword/vector retrieval、fusion、rerank、answer、citation、feedback 标准化为 span。
- SDK diagnostics 投影到 trace attributes。
- provider failure 只记录稳定错误摘要。

### Phase 3：Knowledge Observability UI

- 增强 `apps/frontend/knowledge` Observability 页。
- 接 trace list、trace detail、retrieval debug、citation feedback、sampled artifacts。
- Chat Lab trace link 跳转到 detail。

### Phase 4：Admin 摘要与规范

- `apps/frontend/agent-admin` 只展示 RAG health 摘要和跳转入口。
- 更新 Knowledge / Admin 产品边界规范。
- 更新 rollout 与 backend 文档。

### Phase 5：Hardening

- 采样策略配置化。
- 权限、脱敏、限长、hash 去重。
- provider health 与 metrics 短窗口调优。
- 预留 OpenTelemetry / Prometheus sink。

## 验收标准

- Knowledge Observability 能看到 Average Latency、P95/P99、QPS、错误率、超时率。
- 能追踪单次 RAG 的 route、query rewrite、retrieval、fusion、rerank、context assembly、answer、citation、feedback。
- 能看到召回候选数、rerank 前后变化、selected chunks 和过滤原因。
- 能看到 feedback distribution、citation click rate、no-answer rate。
- sampled prompt/context/answer 默认不保存；命中采样时脱敏、限长、受权限保护。
- `apps/frontend/knowledge` 承载全部知识库详情；`apps/frontend/agent-admin` 不复制知识库产品面。
- 所有新增 API 和持久化 projection 不泄漏 secret、vendor raw、header、SDK client config 或第三方原始错误对象。
