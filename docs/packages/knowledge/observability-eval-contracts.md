# Knowledge Observability And Eval Contracts

状态：current
文档类型：reference
适用范围：`packages/knowledge/src/contracts`
最后核对：2026-05-11

本文记录 Knowledge RAG Phase 4/5 的最小 SDK 稳定边界。当前包含 schema-first contract、`packages/knowledge/src/observability` 稳定 observer/exporter 边界、`runKnowledgeRetrieval()` / `runKnowledgeRag()` 真实 runtime trace 接入、纯函数 eval 计算器、trace-to-sample builder 与最小 golden eval runner，不接入 UI、backend service、CLI runner、第三方 observability vendor 或完整评测平台。

## 入口

源码入口：

- `packages/knowledge/src/contracts/schemas/knowledge-observability-eval.schema.ts`
- `packages/knowledge/src/contracts/types/knowledge-observability-eval.types.ts`
- `packages/knowledge/src/contracts/index.ts`
- `packages/knowledge/src/observability/knowledge-rag-observer.ts`
- `packages/knowledge/src/eval/knowledge-observability-evaluator.ts`
- `packages/knowledge/src/eval/knowledge-trace-sample-builder.ts`
- `packages/knowledge/src/eval/knowledge-golden-eval.ts`
- `packages/knowledge/src/eval/knowledge-golden-eval-fixture.ts`

公开导入：

- `@agent/knowledge`
- `@agent/knowledge/contracts`

当前没有新增 `@agent/knowledge/observability` 或 `@agent/knowledge/eval` package subpath；如后续需要独立 subpath，必须同步更新 `package.json` exports、测试和本文档。

## Runtime Observer / Exporter

当前 runtime 只提供不依赖 backend、UI 和第三方 vendor 的 in-memory observer/exporter：

- `createInMemoryKnowledgeRagObserver()`
- `startKnowledgeRagTrace(observer, input)`
- `recordKnowledgeRagEvent(observer, input)`
- `finishKnowledgeRagTrace(observer, traceId, input)`
- `tryStartKnowledgeRagTrace(observer, input)`
- `tryRecordKnowledgeRagEvent(observer, input)`
- `tryFinishKnowledgeRagTrace(observer, traceId, input)`
- `exportKnowledgeRagTrace(observer, traceId)`
- `listKnowledgeRagTraces(observer)`

行为边界：

- `startTrace` 会用 `KnowledgeRagTraceSchema.parse` 生成 `running` trace，并初始化空 `events`。
- `recordEvent` 接收外部 payload 后先用 `KnowledgeRagEventSchema.parse` 校验，只把 parse 后的事件 append 到对应 trace。
- `finishTrace` 会保持原 `traceId`、`operation`、`startedAt` 与已有 events，只允许通过 schema-safe snapshot 补充 `status`、`endedAt`、retrieval/generation/indexing/diagnostics/feedback/metrics/attributes 等 trace 汇总字段。
- `exportTrace` 与 `listTraces` 返回再次经过 `KnowledgeRagTraceSchema.parse` 的快照，不暴露内部 Map 引用。
- 直接调用 `startKnowledgeRagTrace` / `recordKnowledgeRagEvent` / `finishKnowledgeRagTrace` 时仍保留 schema 错误；`try*` safe wrapper 会捕获 observer/schema/exporter 错误并返回 `undefined`，供 runtime 主链后续集成时避免 observability 失败中断成功 RAG。
- `packages/knowledge/src/runtime/observability` 已删除；新代码必须从稳定 `packages/knowledge/src/observability` 目录或根入口导入。

## Runtime Trace 接入

`runKnowledgeRetrieval(options)` 新增可选 `observer` / `traceId` 支持；未传 observer 时默认行为不变，不创建 trace，不记录事件。传入 observer 时：

- 默认以 `traceId ?? knowledge-retrieval-<timestamp>` 创建 `operation: retrieval.run` trace。
- 标准成功事件顺序为 `runtime.query.receive`、`runtime.query.preprocess`、`runtime.retrieval.start`、`runtime.retrieval.complete`、`runtime.post_retrieval.select`，当 `assembleContext: true` 时追加 `runtime.context_assembly.complete`。
- `runtime.retrieval.complete` / `runtime.post_retrieval.select` 会写入轻量 retrieval hit snapshot、citations 与 diagnostics；diagnostics 使用 observability contract 的 `keyword-only` / `vector-only` / `hybrid` / `none` 语义，不暴露 runtime 内部枚举差异。
- 主流程失败时记录 `runtime.run.fail`，trace `status` 标记为 `failed`，并继续抛出原始 retrieval 错误。

`runKnowledgeRag(input)` 新增可选 `observer` / `traceId` 支持；未传 observer 时默认行为不变。传入 observer 时：

- 以 `traceId ?? runId` 创建 `operation: rag.run` trace，并把 planner、retrieval、generation 汇总到同一个 trace。
- planner 输出通过 `runtime.query.preprocess` 表达，事件 attributes 只记录 planner 类型、选中知识库数量和置信度等 JSON-safe 摘要。
- retrieval 阶段记录 `runtime.retrieval.start`、`runtime.retrieval.complete`、`runtime.post_retrieval.select`、`runtime.context_assembly.complete`。
- answer 阶段记录 `runtime.generation.complete`，trace 汇总字段写入 `generation.answerId`、`answerText`、`citedChunkIds` 与 grounded citation rate；grounded rate 必须基于 answer citations 与 retrieval citations 的 `(sourceId, chunkId)` 重叠计算并封顶到 `0..1`，避免重复或额外 citation 让 observer 反向中断成功 RAG。
- 主流程失败时记录 `runtime.run.fail`，trace `status` 标记为 `failed`，并继续抛出原始 RAG runtime 错误。

`runKnowledgeIndexing(options)` 新增可选 `observer` / `traceId` 支持；未传 observer 时默认行为不变。传入 observer 时：

- 以 `traceId ?? runId` 创建 `operation: indexing.run` trace。
- 标准成功事件顺序为 `indexing.run.start`、`indexing.load.complete`、`indexing.chunk.complete`、`indexing.embed.complete`、`indexing.store.complete`。
- trace 汇总字段写入 `indexing.sourceId`、`loadedDocumentCount`、`chunkCount`、`embeddedChunkCount` 与 `storedChunkCount`。
- trace metrics 写入 `indexing.loaded_document_count`、`indexing.chunk_count`、`indexing.embedded_chunk_count`、`indexing.stored_chunk_count`。
- quality gate 只以 JSON-safe 摘要写入 trace attributes，供后续 trace-to-eval sample builder 识别失败信号；不暴露 writer 实例、source loader 原始对象或第三方返回。
- 主流程失败时记录 `indexing.run.fail`，trace `status` 标记为 `failed`，并继续抛出原始 indexing 错误。

runtime / indexing 主链均使用 `tryStartKnowledgeRagTrace`、`tryRecordKnowledgeRagEvent`、`tryFinishKnowledgeRagTrace`。observer/schema/exporter 抛错只会让该次观测丢弃，不会中断成功的 RAG、retrieval 或 indexing 主流程。

安全边界：

- 所有 event / trace 输入必须通过已有 schema parse；不允许 raw vendor error、SDK response、Request/Response、连接对象或非 JSON-safe 值进入 trace。
- `attributes` 继续复用 contract 层的敏感 key 拦截，runtime observer 还会递归拒绝嵌套的 `secret`、`token`、`password`、`authorization`、`apiKey` 等 key。
- 失败信息应写入 `KnowledgeRagErrorRecordSchema` 的 `code/message/retryable/stage`，不要把第三方 error object 放进 `attributes`。

## Observability Contract

核心 schema：

- `KnowledgeRagEventSchema`
- `KnowledgeRagTraceSchema`
- `KnowledgeRagMetricSchema`
- `KnowledgeRagErrorRecordSchema`
- `KnowledgeRagFeedbackSchema`
- `KnowledgeRagTraceRetrievalDiagnosticsSchema`

首版事件名固定为：

- runtime：`runtime.query.receive`、`runtime.query.preprocess`、`runtime.retrieval.start`、`runtime.retrieval.complete`、`runtime.post_retrieval.select`、`runtime.context_assembly.complete`、`runtime.generation.complete`、`runtime.run.fail`
- indexing：`indexing.run.start`、`indexing.load.complete`、`indexing.chunk.complete`、`indexing.embed.complete`、`indexing.store.complete`、`indexing.run.fail`

事件可表达以下事实：

- query：原始 query、normalized query、query variants
- retrieval：requested topK、命中 chunk/document/source、rank、score、citation
- diagnostics：`retrievalMode`、`enabledRetrievers`、`failedRetrievers`、`fusionStrategy`、`candidateCount`、`selectedCount`、`latencyMs`、warnings、`dropReasons`、`selectionTrace`

Backend `KnowledgeTraceService` may project selection trace into aggregate counts such as `selectedCount`, `droppedCount` and `dropReasons`. Product-facing trace payloads should prefer these redacted aggregates unless the caller is an internal debugging tool with explicit permission to inspect chunk-level metadata.

- indexing：knowledge base、source/document、load/chunk/embed/store 计数
- generation：answer id、answer text、引用 chunk、grounded citation rate
- feedback：用户、评测器或系统给出的 label 与 comment
- metrics：runtime 拥有的轻量数值事实，固定字段为 `traceId`、`name`、`value`、可选 `unit`、`stage` 与 JSON-safe `attributes`。当前允许的 `unit` 为 `ms`、`count`、`tokens`、`ratio`、`bytes`；metric 只表达 runtime 计数、耗时、token、比例和字节等聚合事实，不承载 raw vendor payload。

`attributes` 只允许 JSON-safe object，并拒绝 `secret`、`token`、`password`、`authorization`、`apiKey` 等明显携带密钥语义的 key。第三方原始 error object、SDK response、未脱敏正文和凭据不能穿透到 trace attributes；需要记录失败时使用 `KnowledgeRagErrorRecordSchema` 的 `code/message/retryable/stage`。

## Eval Contract

核心 schema：

- `KnowledgeEvalSampleSchema`
- `KnowledgeEvalExpectedAnswerSchema`
- `KnowledgeEvalObservedAnswerSchema`
- `KnowledgeEvalMetricSummarySchema`

`KnowledgeEvalSampleSchema` 用于把 golden query、expected chunk/document/citation、answer facts、observed retrieval/generation、feedback 和 `traceId` 绑定到同一个最小样本。它可以来自手写 golden set、JSONL trace 抽样或用户 negative feedback。

`KnowledgeEvalMetricSummarySchema` 固定后续 runner / CLI / UI 需要共享的指标字段：

- `recallAtK`
- `mrr`
- `emptyRetrievalRate`
- `groundedCitationRate`
- `noAnswerAccuracy`

最小计算器入口：

- `evaluateKnowledgeEvalSamples(samples, { topK })`
- `buildKnowledgeEvalSampleFromTrace(trace, input)`
- `buildKnowledgeEvalSamplesFromTraces(traces, options?)`
- `runKnowledgeGoldenEval(dataset, observeCase, { topK? })`
- `createKnowledgeGoldenEvalFixture()`
- `DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET`

计算器是无副作用纯函数，输入为 `KnowledgeEvalSample[]`，输出必须通过 `KnowledgeEvalMetricSummarySchema.parse`。当前指标口径：

- `recallAtK`：只统计 `expected.noAnswer !== true` 的 answerable sample；优先用 `expected.chunkIds` 匹配 `observed.retrievalHits[].chunkId`，当 `chunkIds` 为空时退回 `expected.documentIds` / `documentId`；每个 sample 计算命中比例后取平均。
- `mrr`：同样只统计 answerable sample，使用 topK 内第一个 relevant hit 的 reciprocal rank 后取平均。
- `emptyRetrievalRate`：`observed.retrievalHits` 为空或缺失的样本占总样本比例。
- `groundedCitationRate`：所有 observed citation 中，`chunkId` 命中 `expected.citations[].chunkId` 的比例；当 expected citation 为空时退回 `expected.chunkIds`。
- `noAnswerAccuracy`：只统计显式设置 `expected.noAnswer` 的样本；默认以空 answer text 且空 retrieval hit 作为 observed no-answer，`feedback.label` 为 `no-answer-correct` / `no-answer-incorrect` 时作为显式覆盖。

`buildKnowledgeEvalSampleFromTrace(trace, input)` 从 `KnowledgeRagTrace` 投影最小 observed 字段：

- `traceId`
- `query`
- `retrieval.hits`
- `retrieval.citations`
- `retrieval.diagnostics`
- `generation.answerText`
- `feedback`

它不生成 expected truth，也不访问外部数据源；调用方必须传入 `sampleId`、`createdAt` 与 `expected`。当前仍不实现数据集管理、采样队列、judge provider 或指标持久化；这些能力后续必须消费上述 schema 和纯函数入口，而不是重新发明 payload。

`buildKnowledgeEvalSamplesFromTraces(traces, options?)` 用于把 runtime / indexing trace 中已经沉淀的质量信号转换为待补标注或待回放的 `KnowledgeEvalSample[]`。它同样是无副作用纯函数，不访问检索服务、外部 eval store、LLM judge 或 observability vendor。当前会为以下 signal 生成样本：

- `runtime_run_failed`：trace `status: failed` 或存在 `runtime.run.fail` 事件。
- `empty_retrieval`：非失败 trace 的 `retrieval.hit_count` metric 或 `retrieval.hits.length` 为 `0`。
- `high_retrieval_drop_ratio`：`retrieval.selected_count / retrieval.candidate_count` 低于 `selectedCandidateRatioThreshold`，默认 `0.25`。
- `low_grounded_citation_rate`：`generation.grounded_citation_rate` metric 或 `generation.groundedCitationRate` 低于 `lowGroundedCitationRateThreshold`，默认 `0.5`。
- `indexing_quality_gate_failed`：`indexing.quality_gate.*` metric 的 attributes 标记 `status: failed`，或 indexing trace 记录 `indexing.run.fail`。

生成的 sample `attributes` 至少包含 `signal`、`sourceOperation` 与 `sourceStatus`；必要时补充 `groundedCitationRate`、`candidateCount`、`selectedCount`、`qualityGate`、`qualityGateStatus` 等 JSON-safe 摘要字段。builder 只投影 trace 中的轻量 retrieval hit、citation、diagnostics 与 feedback；不会把 `generation.answerText`、provider 原始响应、vendor error object、请求头、凭据或未脱敏正文写入 sample。对于没有 query 的 indexing trace，builder 使用 `${operation} ${traceId}` 作为最小可解析 query 文本，真实回放 query 仍应由后续标注或 dataset 管理流程补齐。

最小 golden eval runner 用于把手写 golden dataset 与确定性 observed answer 投影成 `KnowledgeEvalSample[]`，再复用同一套指标计算器：

- `KnowledgeGoldenEvalDataset` 只包含 `datasetId`、`createdAt`、可选 `topK` 与 `cases`，不绑定检索服务、后端 DTO、vendor SDK 或 UI 状态。
- `KnowledgeGoldenEvalCase` 承载 query、expected truth、可选 feedback/attributes；样本应至少覆盖精确编号、政策条款/FAQ、无答案、中文同义问法与多文档综合。
- `observeCase(caseItem)` 由调用方传入，返回 `KnowledgeEvalObservedAnswer`；最小闭环里它可以是 fixture map 或纯函数，不访问外部服务。
- runner 生成的 sample id 固定为 `${datasetId}:${caseId}`，输出 `datasetId`、`samples` 与 `summary`，其中 `summary` 包含 `Recall@K`、`MRR`、`groundedCitationRate`、`noAnswerAccuracy` 与 `emptyRetrievalRate`。
- 如果调用方同时传入 `options.topK` 与 `dataset.topK`，以 `options.topK` 为准；否则使用 dataset 默认值。
- `DEFAULT_KNOWLEDGE_GOLDEN_EVAL_DATASET` 当前是 9 条离线最小 fixture，覆盖 2 条精确编号、2 条政策/FAQ、2 条 no-answer、2 条中文同义问法与 1 条多文档综合；它只服务本地 regression 和 contract rehearsal，不是产品默认知识库、课程资料或 ingestion seed。
- `createKnowledgeGoldenEvalFixture()` 返回 `{ dataset, observeCase, observedByCaseId }`，其中 observed answer 是确定性内存映射，可直接调用 `runKnowledgeGoldenEval(fixture.dataset, fixture.observeCase)`，不接 LLM judge、外部检索服务、backend、UI 或 vendor SDK。
- `packages/knowledge/demo/golden-eval.ts` 是本地 demo 入口，用于打印最小 fixture 的指标摘要；它不负责文件加载、JSONL 管理或平台化调度。

当前 golden eval 仍不是平台化 runner：不负责文件加载、JSONL 管理、异步任务、judge provider、指标持久化或报表 UI。后续扩展必须继续消费 `KnowledgeEvalSampleSchema` 与 `KnowledgeEvalMetricSummarySchema`，避免让第三方类型穿透 eval contract。

## 兼容策略

- 新字段默认走 optional additive 演进，避免破坏已有 trace / eval sample。
- retrieval hit snapshot 是 eval/trace 的轻量投影，不替代 `RetrievalHitSchema`。
- `CitationSchema` 继续复用既有 retrieval citation contract。
- runtime diagnostics 仍是单次 retrieval 的调试摘要；observability trace 是跨 indexing / retrieval / generation 阶段可导出的结构化事实。
- 后续接入 observer/exporter 时，runtime 主链应使用 `tryStartKnowledgeRagTrace` / `tryRecordKnowledgeRagEvent` / `tryFinishKnowledgeRagTrace`，确保 exporter 失败不得中断 RAG 主流程。

## 验证入口

最小 contract 回归：

```bash
pnpm --dir packages/knowledge test -- knowledge-observability-eval-contracts.test.ts
```

最小 evaluator 回归：

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-observability-evaluator.test.ts
```

最小 golden eval 回归：

```bash
pnpm --dir ../.. exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-golden-eval.test.ts
```

类型检查：

```bash
pnpm --dir packages/knowledge typecheck
```

涉及文档改动时还需执行：

```bash
pnpm check:docs
```
