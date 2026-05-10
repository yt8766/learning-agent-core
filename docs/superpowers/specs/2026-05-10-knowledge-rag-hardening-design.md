# Knowledge RAG Hardening Design

状态：current
文档类型：spec
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`apps/frontend/knowledge`
最后核对：2026-05-10

## 背景

用户提供了 `/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总` 中的企业知识库 RAG 课程资料，希望对照课程体系评审当前项目 RAG 设计是否合理，并给出下一步设计。

课程材料把 RAG 分成两个视角：

- Pipeline 视角：indexing、pre-retrieval、retrieval、post-retrieval、generation。
- 工程视角：core、indexing、runtime、adapters、observability、eval。

当前仓库的 Knowledge RAG 已经具备较完整的分层：

- `packages/knowledge/src/indexing`：SDK indexing pipeline。
- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`：query normalization、retrieval、post-retrieval、context expansion、context assembly。
- `packages/knowledge/src/rag`：planner、retrieval runtime、answer runtime 与 stream runtime。
- `apps/backend/agent-server/src/domains/knowledge`：unified backend knowledge domain、ingestion、chat、repository、SDK runtime wiring。
- `apps/frontend/knowledge`：Chat Lab、Observability、Evals 等产品界面。

总体方向合理，不需要推倒重来。本设计聚焦把现有 RAG 从“能跑通”收敛到“能解释、能回归、能运营”的企业级闭环。

## 目标

1. 让后端真实 retrieval 链路与 SDK 层 hybrid/RRF 设计一致。
2. 提升 indexing 质量，避免 fixed-window chunking 与静默空 embedding 影响召回。
3. 把 observability 从应用内临时 trace 收敛成 SDK 级结构化事件协议。
4. 建立最小 eval 闭环，用 Recall@K、MRR、grounding 和 citation 指标证明 RAG 改动效果。
5. 保持 `packages/knowledge` 的 SDK 边界，不让 vendor SDK、数据库对象或 backend service 细节穿透公共 contract。

## 非目标

1. 不重写 Knowledge App 或 Chat Lab。
2. 不一次性新增所有向量库 adapter。
3. 不把最终回答生成强行并入 retrieval runtime；generation 仍由 RAG answer runtime 或宿主 provider 承担。
4. 不引入复杂 agent/workflow 编排替代当前 RAG pipeline。
5. 不把 observability 做成完整监控平台；SDK 只负责 trace/event/exporter 协议和最小本地导出。

## 当前合理设计

### 分层合理

当前主链已经接近课程推荐的 pipeline：

```text
indexing
  -> pre-retrieval planner / query normalization
  -> retrieval
  -> post-retrieval filter / rank / diversify
  -> context expansion
  -> context assembly
  -> generation
```

`runKnowledgeRetrieval()` 已经保留 query variants、metadata filters、post-retrieval diagnostics、hybrid diagnostics、context assembly diagnostics。这是正确方向。

`runKnowledgeRag()` 已经把 planner、retrieval、answer 三段分开，也符合“pre-retrieval 决策”和“generation”不要混在 retriever 里的原则。

### Contract 边界基本合理

`packages/knowledge` 已经逐步变成可独立 SDK surface，adapter 和 provider 大多通过项目自定义接口注入。后端 `KnowledgeRagSdkFacade` 负责把 unified backend 的 repository、runtime provider 和 model profile 适配进 SDK RAG，这比让前端或 controller 直接拼 prompt 更合理。

### Context Assembly 已显式化

`DefaultContextAssembler` 已经支持 `contextAssemblyOptions.budget`，并输出 selected、dropped、truncated 和 estimated token diagnostics。这对解释“为什么某条资料没进入模型上下文”很重要，应继续保留并产品化展示。

## 主要问题

### 1. 后端实际 retrieval 不是严格 hybrid

2026-05-10 设计评审时，`KnowledgeDomainSearchServiceAdapter` 仍是先执行 vector search：只要 vector 命中，就直接返回 vector hits；只有 vector 没有结果时才 fallback keyword。

这不是课程推荐的 hybrid retrieval，也没有真正执行：

```text
keyword retrieval + vector retrieval -> fusion -> post-retrieval
```

风险：

- 错误码、产品型号、合同编号、术语类 query 可能被 vector 结果压掉。
- keyword 与 vector 的互补能力没有进入 RRF。
- diagnostics 显示 hybrid 时，真实行为可能更像 vector-first fallback。

### 2. SDK hybrid 能力和后端 domain adapter 分叉

`packages/knowledge/src/retrieval/hybrid-retrieval-engine.ts` 已经有 `HybridRetrievalEngine` 和 RRF fusion；但后端 domain adapter 没有直接复用这个能力，而是在业务 adapter 内手写了 vector-first / keyword fallback。

风险：

- SDK 文档、测试和后端真实行为不一致。
- 后续新增 rerank、diagnostics、provider health 时会出现两套语义。

### 3. Chunking 仍偏 MVP

`FixedWindowChunker` 按字符窗口切分，适合 MVP 和测试，但企业知识库常见文档包括制度、FAQ、合同、操作手册和 markdown 技术文档。仅固定窗口容易破坏标题、条款、步骤和问答结构。

风险：

- 召回片段语义不完整。
- citation quote 难以解释。
- Small-to-Big、parent/section 去重和 context expansion 缺少稳定 metadata。

### 4. Ingestion 缺少硬质量门

当前 ingestion 会容错 embedding result，并可能把空向量或数量不匹配的结果标成成功。

风险：

- 文档显示 `ready`，实际向量不可检索。
- `embeddedChunkCount` 与真实可检索 chunk 数不一致。
- 后续 eval 难以判断是 retrieval 失败还是 indexing 数据坏了。

### 5. Observability 还不是 SDK 级协议

后端已有 `KnowledgeTraceService`，前端已有 Observability 页面，但 `packages/knowledge` 缺少独立 `observability` public surface。课程资料强调 Trace、Events、Metrics、Evaluation 四层，目前项目仍偏 service 内 span。

风险：

- runtime/indexing 的中间事实不能统一导出。
- trace 不能稳定转成 eval sample。
- Chat Lab、Runtime Center、CLI 会各自拼一套 diagnostics。

### 6. Eval 闭环不足

项目已有 eval schema 和页面，但还没有把 trace、检索结果、用户反馈沉淀成可回归样本，也没有固定 Recall@K、MRR、citation grounding 等最小指标。

风险：

- RAG 改动后无法量化“变好还是变坏”。
- rerank、chunking、hybrid fusion 的收益只能靠人工感受。

## 推荐架构

### 总体链路

```text
Indexing
  loader
  -> cleaner / normalizer
  -> semantic or recursive chunker
  -> contextual metadata builder
  -> embedding provider
  -> embedding quality validation
  -> vector store + fulltext store
  -> indexing trace

Runtime
  planner / query rewrite
  -> query variants
  -> parallel keyword retrieval + vector retrieval
  -> RRF fusion
  -> metadata and auth defensive filtering
  -> post-retrieval filter / rerank / dedupe / diversify
  -> optional small-to-big context expansion
  -> context assembly with model budget
  -> retrieval trace

Generation
  contextBundle + citations
  -> answer provider
  -> grounded citation validation
  -> no-answer policy
  -> generation trace

Quality Loop
  trace exporter
  -> eval sample builder
  -> Recall@K / MRR / grounding / citation quality
  -> dashboard and regression tests
```

## 设计细节

### A. Hybrid Retrieval 收敛

后端 `KnowledgeDomainSearchServiceAdapter` 应改为真正并行召回：

```text
keyword retriever
vector retriever
  -> HybridRetrievalEngine
  -> RRF fusion
  -> runKnowledgeRetrieval post-retrieval pipeline
```

设计约束：

- keyword 和 vector 都必须返回 SDK-owned `RetrievalHit`。
- vector provider 失败时记录 `failedRetrievers: ['vector']`，keyword 仍可继续。
- keyword provider 失败时记录 `failedRetrievers: ['keyword']`，vector 仍可继续。
- `retrievalMode` 必须表示真实成功路径，而不是配置期望。
- metadata filters 必须在 retrieval 前尽量下推，进入 fusion 前再防御性过滤。

推荐实现方式：

1. 在 backend domain adapter 中拆出 `KnowledgeDomainKeywordRetriever` 和 `KnowledgeDomainVectorRetriever`。
2. 用 `HybridRetrievalEngine` 组合两个 retriever。
3. 保留 domain adapter 作为 `KnowledgeSearchService` facade，只负责装配和 diagnostics 映射。

当前落地状态：Phase 1 已完成。后端 domain adapter 已改为装配 `KnowledgeDomainKeywordRetriever` 与 `KnowledgeDomainVectorRetriever`，并委托 `HybridRetrievalEngine` 做 RRF fusion；chunk metadata 也已纳入 `DocumentChunkRecordSchema`、memory/Postgres repository mapper 和 retrieval hit 映射，确保 request metadata filters 在 fusion 前后都有稳定字段可用。

### B. Indexing 质量门

Indexing 应按“先质量、再写状态”的方式收敛。

新增硬校验：

- `embedBatch` 返回数量必须等于 chunks 数量。
- 每个 embedding 必须非空。
- embedding 维度必须与配置或 vector store 期望一致。
- upsert 成功数必须能与写入记录数对齐；无法确认时 diagnostics 必须标记 `unknown`，不能冒充全成功。

Chunking 建议分两层：

- SDK 默认继续保留 `FixedWindowChunker` 作为 fallback。
- 新增 `MarkdownRecursiveChunker` 或 `StructuredTextChunker`，优先按 heading、paragraph、list、code block、FAQ block 切分；超长块再 fallback fixed window。

Chunk metadata 至少补齐：

- `parentId`
- `sectionPath`
- `heading`
- `chunkHash`
- `contentType`
- `ordinal`

这些字段服务于去重、Small-to-Big、citation 展示和 eval 归因。

### C. Post-Retrieval 强化

现有 filter/rank/diversify 方向正确，下一步不是拆掉四阶段 runtime，而是在 `RetrievalPostprocessor` 内继续强化策略件。

建议顺序：

1. 先增强 deterministic filtering：低分、空内容、重复 chunk、重复 parent、权限/metadata 不一致。
2. 再接入可选 rerank provider：只返回 `chunkId + alignmentScore`，不得泄漏 vendor response。
3. 再做 context ordering：把“检索相关性排序”和“prompt 位置编排”拆开。

Context assembly 的下一步：

- 接入 model profile token estimator，替代 `4 chars ~= 1 token` 的粗估。
- 支持 `systemTokens`、`historyTokens`、`queryTokens`、`reservedOutputTokens` 的上层预算注入。
- diagnostics 投影到 Chat Lab 和 Runtime Center。

### D. Observability SDK Facade

新增 `packages/knowledge/src/observability`，首版只做协议和本地 exporter：

```text
observability/
  schemas/
  exporters/
  observer.ts
  trace.ts
  index.ts
```

稳定模型：

- `RAGTrace`
- `RAGEvent`
- `RAGErrorRecord`
- `RAGObserver`
- `TraceExporter`

首批事件：

```text
runtime.query.receive
runtime.query.preprocess
runtime.retrieval.start
runtime.retrieval.complete
runtime.post_retrieval.select
runtime.context_assembly.complete
runtime.generation.complete
runtime.run.fail

indexing.run.start
indexing.load.complete
indexing.chunk.complete
indexing.embed.complete
indexing.store.complete
indexing.run.fail
```

Exporter：

- `createMemoryTraceExporter()`：测试和本地页面。
- `createJSONLTraceExporter()`：CLI、本地复盘、eval sample。

约束：

- observer/exporter 失败不得中断 RAG 主流程。
- trace attributes 不能包含原始 secret、vendor error object、脱敏前敏感正文。
- runtime diagnostics 仍是单次结果的调试摘要；observability trace 是跨阶段、可导出的结构化事实。

### E. Eval 最小闭环

Eval 首版不做大平台，先做可回归指标。

输入：

- golden query
- expected source/chunk/citation
- optional expected answer facts
- runtime trace 或 retrieval result

指标：

- `Recall@K`
- `MRR`
- `emptyRetrievalRate`
- `groundedCitationRate`
- `noAnswerAccuracy`

数据来源：

- 手写 golden set。
- 从 JSONL trace 中抽样。
- 用户 negative feedback 对应 trace。

落点：

- 稳定 schema 放 `packages/knowledge/src/core` 或 `packages/knowledge/src/eval`，取决于实现 slice 是否同步建立 public subpath。
- 运行器可先放 `packages/knowledge/test` 或 CLI，不要一开始耦合前端页面。

## 迁移阶段

### Phase 1：真实 Hybrid Retrieval

完成条件：

- backend domain adapter 不再 vector-first fallback。
- keyword 和 vector 并行召回。
- RRF fusion 进入后端真实 chat path。
- diagnostics 准确表达 enabled、failed、candidateCount、effective retrievalMode。
- 补单测覆盖 vector+keyword 同时命中、vector 失败 fallback keyword、keyword 专有词补召回。

### Phase 2：Indexing 质量门与结构化 chunk

完成条件：

- embedding 数量、维度、空向量全部校验。
- markdown/structured chunker 可选接入。
- metadata 支持 parent/section/chunkHash。
- ingestion job 能区分 chunk、embed、store 阶段失败。

### Phase 3：Observability SDK Facade

完成条件：

- `@agent/knowledge` 导出 observability 协议或明确 subpath。
- runtime/indexing 能接 observer。
- memory/jsonl exporter 可用于测试和 CLI。
- 后端 trace 可由 SDK trace 投影，减少 service 内手写 span 分叉。

### Phase 4：Eval 闭环

完成条件：

- 最小 golden dataset 能跑 Recall@K 和 MRR。
- trace 能转 eval sample。
- Chat Lab feedback 能关联 traceId，后续进入 eval 队列。
- 文档说明如何用 eval 判断 chunking/hybrid/rerank 改动收益。

## Contract 影响

涉及稳定接口时必须先更新 schema 和文档：

- retrieval diagnostics：新增或修正 `retrievalMode`、`enabledRetrievers`、`failedRetrievers`、`fusionStrategy`、`candidateCount`。
- chunk metadata：新增字段必须兼容旧数据，旧 chunk 缺字段时 runtime 应降级。
- observability：新增 schema-first `RAGTrace` / `RAGEvent` 后才能接入 runtime/indexing。
- eval：新增指标输出 schema 后才能被 CLI 或前端消费。

兼容策略：

- 现有 `RetrievalHit.metadata` 保持开放 JSON，但新增字段必须在文档中固定语义。
- 旧 fixed-window chunk 继续可检索；新 chunker 只影响新 ingestion 或 reprocess。
- Observability 首版作为可选注入，不改变默认 RAG 返回值。

## Verification

设计阶段只要求：

```bash
pnpm check:docs
```

进入实现阶段后按影响面追加：

```bash
pnpm --filter @agent/knowledge test
pnpm --filter @agent/knowledge typecheck
pnpm --dir apps/backend/agent-server test -- knowledge-rag
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

如果触达 `packages/knowledge` 构建输出或 public exports，还需执行：

```bash
pnpm build:lib
```

## Documentation Impact

实现阶段需要同步更新：

- `docs/packages/knowledge/sdk-architecture.md`
- `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- `docs/packages/knowledge/context-assembly-and-generation.md`
- `docs/integration/knowledge-sdk-rag-rollout.md`
- `docs/sdk/knowledge.md`
- `docs/apps/frontend/knowledge/knowledge-chat-lab.md`

如果新增 observability public surface，还需要新增：

- `docs/packages/knowledge/observability.md`

## Success Criteria

1. 后端 Chat Lab 的真实 chat path 使用 keyword + vector fusion，而不是 vector-first fallback。
2. indexing 不再把空 embedding 或维度错误标记为成功。
3. 每次 RAG run 至少能解释 query rewrite、retrieval candidate、post-retrieval selection、context assembly、generation grounding。
4. 至少有一组 eval 能证明 hybrid/chunking/rerank 改动的 Recall@K 或 MRR 变化。
5. 文档中不再把 target-only observability/eval 描述成已完整实现。

## Design Decisions

1. Phase 1 先继续使用 repository 内 deterministic keyword scoring 作为 keyword retriever，目标是尽快修正真实 chat path 的 vector-first fallback；OpenSearch-like provider 作为后续 provider hardening slice，不阻塞 hybrid 语义收敛。
2. Structured chunker 首版只支持 Markdown 和通用纯文本标题模式；PDF/docx 的版面结构识别留给后续 loader/transformer slice。
3. Eval golden set 首批从项目 docs 和用户上传知识库样本中抽取，避免课程材料变成产品内默认测试语料；课程材料只作为设计参考。
4. Observability 首版优先新增 `@agent/knowledge/observability` subpath；只有在 package exports、tests 和 docs 同步落地后，才允许从 root re-export 最小协议。
