# Knowledge RAG Observability Production Slice Design

状态：draft
文档类型：spec
适用范围：`apps/backend/agent-server/src/domains/knowledge`、`apps/frontend/knowledge`、`apps/frontend/agent-admin`、`docs/contracts/api/knowledge.md`
最后核对：2026-05-07

## 背景

当前 Knowledge / RAG 观测已经有 API 形状、基础 schema、内存 trace helper、metrics window、前端 hook 和 Observability 页面骨架，但还没有达到生产可用标准。主要缺口是 RAG 执行链路写入的 `KnowledgeTraceService` 与 Observability API 读取的 trace repository 尚未形成同源闭环，metrics 也没有默认从真实持久化 trace 聚合。

本设计定义生产第一切片：把 RAG JSON、SSE streaming、feedback 到 Observability API 和 Knowledge 前端 drilldown 打通到可运行、可验证、可运营的最小生产闭环。

## 目标

- 生产默认使用 Postgres 持久化 trace、span、artifact；内存 repository 只作为测试和本地 fallback。
- RAG JSON、RAG SSE streaming、message feedback 都写入同一套 trace sink。
- Observability API 的 trace list、trace detail、artifact 和 metrics 与 trace repository 同源。
- prompt、context、answer 默认只保存摘要；完整内容仅在 debug 开关或显式采样命中时保存，并必须脱敏、限长、记录采样原因。
- `apps/frontend/knowledge` 提供可运营 drilldown 工作台：metrics、trace filter/list、span timeline、retrieval snapshot、citation/feedback、sampled artifacts。
- `apps/frontend/agent-admin` 只展示 Knowledge/RAG 摘要和跳转入口，不复制知识库深度页面。

## 非目标

- 不建设完整 OpenTelemetry、Prometheus 或告警平台。
- 不把 Knowledge 产品详情页迁入 `agent-admin`。
- 不默认保存完整 prompt、完整 context、完整 answer 或 vendor raw payload。
- 不重做整个 Knowledge UI 视觉体系，只把现有 Observability 页升级到生产第一切片需要的 drilldown。

## 推荐方案

采用统一 Trace Sink 方案。

`KnowledgeTraceService` 从短期内存 helper 升级为 RAG 观测写入 facade。RAG 执行路径仍只依赖 `KnowledgeTraceService`，由它负责 `startTrace`、`addSpan`、`addArtifact`、`finishTrace`，内部写入 `KnowledgeTraceRepository`，并在完成态记录短窗口 metrics。

`KnowledgeObservabilityService` 只负责查询、过滤、权限前置、metrics 聚合和 DTO projection，不参与 RAG 执行。这样可以避免 RAG service、stream runtime、SDK facade 直接耦合 Postgres、HTTP DTO 或前端展示字段。

备选方案及取舍：

- RAG service 直接写 repository：实现直观，但写入逻辑会分散到 JSON、SSE、SDK facade 和 feedback 入口，后续扩展 eval/ingestion trace 时容易继续扩散。
- 事件总线式 collector：扩展性最好，适合后续外部 sink，但第一切片会引入事件可靠性、flush、异步测试时序等复杂度。

## 后端边界

### Trace Sink

`KnowledgeTraceService` 是唯一 RAG 观测写入入口。

职责：

- 创建 trace，并生成稳定 `traceId`。
- 写入 route、plan、query rewrite、retrieve、fusion、rerank、context assembly、answer generation、citation grounding、feedback 等 span。
- 写入 artifact metadata，以及采样命中的安全 content。
- finish trace 时更新 status、latency、hit count、citation count、no-answer、error code、feedback summary。
- 将完成态 trace 的短窗口指标写入 `KnowledgeMetricsWindow`。

RAG JSON 和 SSE 路径都必须使用同一个生命周期：

1. `startTrace`
2. `addSpan(route)`
3. retrieval / generation / citation 阶段持续 `addSpan`
4. 成功或失败都 `finishTrace`

失败路径只能写稳定错误码、可展示摘要和 retryable/category 等项目自定义字段，不能写 raw exception、stack trace、vendor response、request header、SDK client config 或 secret。

### Repository

新增或收敛为统一 repository contract：

```text
KnowledgeTraceRepository
  createTrace(input)
  addSpan(input)
  addArtifact(input)
  finishTrace(traceId, patch)
  listTraces(filter)
  getTrace(traceId)
  aggregateMetrics(filter)
```

实现：

- `KnowledgePostgresTraceRepository`：生产默认实现，持久化到 Postgres。
- `InMemoryKnowledgeTraceRepository`：测试和本地 fallback，实现同一 contract。

Postgres 表：

- `knowledge_rag_traces`
- `knowledge_rag_trace_spans`
- `knowledge_rag_trace_artifacts`

关键索引：

- `(workspace_id, created_at desc)`
- `(workspace_id, status, created_at desc)`
- `knowledge_base_ids` 使用可索引结构保存；Postgres 实现必须提供按 `workspace_id + knowledgeBaseId + created_at desc` 过滤的索引路径。
- `(trace_id, started_at)`
- `(trace_id, kind)`

### Metrics

`GET /api/knowledge/observability/metrics` 默认从 trace repository 按 filter 聚合历史窗口指标，避免 metrics 和 trace list 不同源。

指标至少包括：

- `traceCount`
- `questionCount`
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

无数据时所有 count、latency 和 rate 返回 `0`，`stageLatency` 返回空数组，禁止返回 `NaN`。

短窗口 `KnowledgeMetricsWindow` 可保留为 realtime 内部补充，但不能成为 production metrics 的唯一数据源。

## Artifact 与安全

第一切片采用默认摘要、受控采样完整内容。

默认写入：

- `kind`
- `preview`
- `sampled`
- `samplingReason`
- `redactionStatus`
- `truncated`
- `contentHash`

仅在 debug 开关或显式采样策略命中时写入 `content`。写入前必须经过 redactor：

- 限长。
- 清理 token、API key、password、service role key、Authorization header 等敏感内容。
- 拒绝 vendor raw request/response、raw headers、SDK client object、完整第三方错误对象。
- 标记 `redactionStatus` 和 `truncated`。

artifact 查询规则：

- 有权限且采样 content 存在时，返回 `content`。
- 无权限、未采样或 redaction 未完成时，只返回 metadata、preview、hash。
- API 与前端只消费 projection DTO，不透传 repository raw record。

## API

统一挂在 `/api/knowledge/observability/*`，兼容 `knowledge/v1` controller alias 的现有路由策略。

```text
GET /api/knowledge/observability/metrics
GET /api/knowledge/observability/traces
GET /api/knowledge/observability/traces/:traceId
GET /api/knowledge/observability/traces/:traceId/artifacts
```

筛选字段：

- `from`
- `to`
- `status`
- `knowledgeBaseId`
- `conversationId`
- `modelProfileId`
- `errorCode`
- `noAnswer`
- `feedback`
- `page`
- `pageSize`

权限：

- owner、admin、maintainer 可查看 traces 和 metrics。
- viewer 可提交 feedback，但不能查看 traces 和 sampled artifacts。
- 服务端不得信任 body/query 中传入的 `workspaceId`、`tenantId`、`userId`、`createdBy`。

## 前端设计

`apps/frontend/knowledge` 的 Observability 页升级为 RAG Observability Workbench。

模块：

- Metrics strip：Trace 数、QPS、平均延迟、P95、P99、错误率、timeout rate、no-answer rate、反馈分布。
- Trace filters：status、knowledge base、conversation、model profile、error code、no-answer、feedback、时间范围。
- Trace list：问题 preview、状态、延迟、命中数、引用数、feedback、创建时间。
- Trace detail：trace metadata、answer preview、route、model profile、错误摘要。
- Span timeline：阶段、状态、耗时、input/output 摘要、错误码。
- Retrieval snapshot：keyword hits、vector hits、merged hits、reranked hits、selected chunks。
- Citation & feedback：citation cards、wrong citation、unhelpful、positive、negative 分布。
- Sampled artifacts：preview、hash、采样原因、redaction/truncation 状态；只有 API 返回 `content` 时展示完整内容。

`apps/frontend/agent-admin` 只展示摘要：

- RAG health。
- P95 latency。
- error rate。
- provider health。
- Open in Knowledge Observability 链接。

## 测试策略

后端测试：

- schema contract：trace、span、artifact、filter、metrics DTO parse。
- repository contract：内存与 Postgres 实现行为一致。
- trace sink：`startTrace` / `addSpan` / `addArtifact` / `finishTrace` 写入 repository，并记录 metrics。
- RAG JSON integration：一次 `/api/knowledge/chat` 请求可以通过 `/observability/traces/:traceId` 查到完整 trace。
- RAG SSE integration：streaming 请求也能写入完成态 trace 和 span。
- feedback integration：`POST /messages/:messageId/feedback` 补写 feedback span，并更新 trace feedback summary。
- artifact security：未采样不返回 `content`；采样命中时返回脱敏限长内容；raw secret/vendor payload 被拒绝或清理。
- metrics：按 filter 从 repository 聚合，空数据返回 0，不返回 `NaN`。

前端测试：

- API client path 与 query serialization。
- query key 稳定性。
- hook filter、trace detail、artifact fetch。
- Observability 页面展示 metrics、trace list、span timeline、retrieval snapshot、citation/feedback、sampled artifact 状态。
- 页面不展示 raw secret、vendor payload 或未授权 artifact content。

## 文档更新

实现时必须同步更新：

- `docs/contracts/api/knowledge.md`：把 Observability 从 MVP 描述升级为生产第一切片契约。
- `docs/apps/backend/agent-server/knowledge.md`：记录 trace sink、repository、service、Postgres 默认实现。
- `docs/packages/knowledge/README.md` 或对应 RAG rollout 文档：说明 SDK diagnostics 只能输出 JSON-safe projection。
- `docs/apps/frontend/knowledge/README.md`：说明 Observability Workbench 的产品归属和 drilldown 范围。
- `docs/apps/frontend/agent-admin/README.md`：说明 admin 只展示摘要和跳转入口。

如果旧 draft/spec 与本设计冲突，应改写为历史背景或明确标注“过时，以 production slice spec 为准”。

## 完成标准

- Postgres 是生产默认 trace repository；内存只用于测试/本地 fallback。
- JSON、SSE、feedback 三条路径全部写入同一 trace sink。
- Observability API 能从同源 repository 查询 trace list、trace detail、artifacts 和 metrics。
- artifact 采样、脱敏、限长、权限边界有测试保护。
- Knowledge 前端提供可运营 drilldown 工作台。
- agent-admin 只展示摘要和跳转入口。
- 受影响后端、前端、文档验证通过。
