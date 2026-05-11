# packages/knowledge 知识检索运行时设计文档

状态：current
文档类型：architecture
适用范围：`packages/knowledge/src/runtime/`
最后核对：2026-05-10（确认 backend knowledge domain 已接入真实 hybrid retrieval）

## 背景与定位

`packages/knowledge/src/runtime/` 是知识检索的**在线链路编排层**，负责把查询请求通过 pipeline 转化为可供 agent runtime 消费的检索结果与上下文材料。Hybrid Search 属于 `packages/knowledge` 的检索编排能力：当前已实现 `HybridKnowledgeSearchService` facade、`HybridRetrievalEngine`、通用 retriever 接口、RRF fusion strategy、hybrid diagnostics 和最小生产配置 contract；`packages/knowledge/src/adapters/*` 已提供 Chroma 向量检索桥接和 OpenSearch-like 全文检索桥接；backend `RuntimeHost` 已有显式 keyword/vector 注入入口、factory diagnostics 与 `knowledgeSearchStatus` 状态出口，并会通过 bridge 进入 `AgentRuntime.knowledgeSearchService` 主链入口。`knowledgeSearchStatus` 已进入 `/health` 与 Runtime Center projection，agent-admin 的知识总览卡片会展示 configured/effective mode、vector/provider 与 warning 数；runtime bridge 也会保留最近一次主链 query 的 diagnostics snapshot，供后续调试台读取。剩余工作集中在生产级 SDK client / 凭据注入、实时 provider health ping 和全来源 ingestion 边界核对。

统一后端 `apps/backend/agent-server/src/domains/knowledge` 的 chat retrieval path 也已收敛到同一套 hybrid 语义：`KnowledgeDomainSearchServiceAdapter` 只负责装配 backend-domain keyword/vector retriever，真正的融合交给 `HybridRetrievalEngine` 与 RRF strategy。SDK runtime enabled 时，keyword 与 vector 都会进入 fusion；vector embed/search 失败、vector hit 无法映射回 repository chunk，或 request metadata filters 过滤掉 vector hit 时，keyword 结果仍可返回，`diagnostics.retrievalMode` 只表达过滤后的真实有效命中路径。SDK runtime disabled 时，adapter 退回 keyword-only retrieval，不冒充 hybrid。

backend domain chunk metadata 是过滤契约的一部分。`DocumentChunkRecordSchema` 显式承载 `metadata?: Record<string, unknown>`，ingestion mapper、memory repository、Postgres `knowledge_document_chunks.metadata` save/list mapper 都必须保留该字段。`RetrievalHit.metadata` 会先展开 chunk metadata，再用 domain 权威字段覆盖 `knowledgeBaseId`、`workspaceId`、`filename`、`ordinal`，避免旧 metadata 或外部 SDK chunk 字段覆盖当前知识库边界。

> **重要边界**：`packages/runtime` 是多 Agent Runtime Kernel，负责 graph、session、approval、orchestration。知识检索 runtime 属于 `packages/knowledge`，不属于 `packages/runtime`。

## Pipeline

```text
RetrievalRequest
  ─→ query normalization
  ─→ filter resolution       （合并 filters 与 legacy allowedSourceTypes/minTrustClass）
  ─→ retrieval               （keyword 前置过滤；vector 尽量下推 filters）
  ─→ defensive filtering     （进入 merge/fusion 前兜底过滤）
  ─→ merge
  ─→ result filtering         （确定性检索后过滤）
  ─→ result ranking           （确定性 signals 排序）
  ─→ result diversification   （source / parent / section coverage）
  ─→ post-process             （兼容最终裁剪层）
  ─→ context expansion        （可选，仅扩展 context 组装输入）
  ─→ context assembly         （可选）
  ─→ KnowledgeRetrievalResult
```

`runKnowledgeRetrieval()` 本身**不含 generation 阶段**。当前 `packages/knowledge/src/rag/*` 已提供 knowledge RAG 专用的 planner / retrieval / answer runtime，用于 Knowledge Chat Lab 和统一 `agent-server` knowledge domain；retrieval runtime 的 `contextAssembler` 只负责产出 prompt-ready context，不在该阶段调用大模型生成最终回答。`ContextAssembler` 支持 `contextAssemblyOptions.budget`，默认 assembler 会按近似 token 预算截断或丢弃 context，并通过 `RetrievalDiagnostics.contextAssembly` 暴露 selected / dropped / truncated / estimated tokens / ordering strategy。上下文组装与生成的职责边界、当前剩余风险和后续收敛建议见 [context-assembly-and-generation.md](/docs/packages/knowledge/context-assembly-and-generation.md)。

## 核心文件结构

```
packages/knowledge/src/
  contracts/
    knowledge-retrieval-runtime.ts    ← KnowledgeRetrievalRuntime 接口，RetrievalPipelineConfig
  runtime/
    pipeline/
      run-knowledge-retrieval.ts      ← 函数式主入口 runKnowledgeRetrieval()
    stages/
      query-normalizer.ts             ← QueryNormalizer 接口 + QueryRewriteProvider 接口
      post-retrieval-filter.ts        ← PostRetrievalFilter / RetrievalSafetyScanner 接口 + diagnostics
      post-retrieval-ranker.ts        ← PostRetrievalRanker / RetrievalRerankProvider 接口 + diagnostics
      post-retrieval-diversifier.ts   ← PostRetrievalDiversifier 接口 + diagnostics
      post-processor.ts               ← RetrievalPostProcessor 接口
      context-expander.ts             ← ContextExpander 接口 + ContextExpansionPolicy / diagnostics
      context-assembler.ts            ← ContextAssembler 接口；支持 budget options 与结构化 diagnostics，兼容旧 string 返回
    defaults/
      default-query-normalizer.ts     ← deterministic rewrite + query variant generation
      default-query-normalizer.helpers.ts
      default-post-retrieval-filter.ts      ← 低分、重复、低价值、可注入安全扫描与最小 unsafe content fallback
      default-post-retrieval-ranker.ts      ← retrieval / authority / recency / context-fit signals 排序，可注入 reranker provider
      default-post-retrieval-diversifier.ts ← source / parent coverage 多样化
      default-post-processor.ts       ← score > 0 过滤 + topK trim
      default-context-assembler.ts    ← 拼接 [N] title\ncontent，并按近似 token budget 截断 / 丢弃
      retrieval-runtime-defaults.ts   ← DEFAULT_RETRIEVAL_LIMIT = 5 等常量
      llm-query-normalizer.ts         ← LlmQueryNormalizer：LLM 改写 + 失败降级
    types/
      retrieval-runtime.types.ts      ← KnowledgeRetrievalResult / Diagnostics / NormalizedRetrievalRequest
    local-knowledge-facade.ts         ← 实现 KnowledgeRetrievalRuntime，默认内存存储
  retrieval/
    knowledge-search-service.ts       ← DefaultKnowledgeSearchService，当前 keyword 召回实现
    vector-search-provider.ts         ← VectorSearchProvider 注入接口
    vector-knowledge-search-service.ts
    rrf-fusion.ts
    hybrid-knowledge-search-service.ts ← Hybrid Search 兼容 facade
    hybrid-retrieval-engine.ts         ← HybridRetrievalEngine + KnowledgeRetriever / KeywordRetriever / VectorRetriever
    fusion-strategy.ts                 ← RetrievalFusionStrategy / RrfFusionStrategy
    small-to-big-context-expander.ts   ← SmallToBigContextExpander，按 parent / neighbor metadata 扩展上下文
```

## 关键接口

### KnowledgeRetrievalRuntime

```ts
interface KnowledgeRetrievalRuntime extends KnowledgeFacade {
  retrieve(request: RetrievalRequest, pipeline?: RetrievalPipelineConfig): Promise<KnowledgeRetrievalResult>;
}
```

`KnowledgeFacade` 的所有属性（sourceRepository / chunkRepository / searchService）仍然可用，`retrieve()` 是新增的 pipeline 入口。

### 函数式入口 runKnowledgeRetrieval

```ts
interface KnowledgeRetrievalRunOptions {
  request: RetrievalRequest;
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  assembleContext?: boolean; // 是否组装 contextBundle，默认 false
  includeDiagnostics?: boolean; // 是否返回诊断信息，默认 false
}

function runKnowledgeRetrieval(options: KnowledgeRetrievalRunOptions): Promise<KnowledgeRetrievalResult>;
```

### QueryRewriteProvider（LLM 改写注入点）

```ts
/** 调用方注入的 LLM 改写能力。失败时 normalizer 会静默降级，不中断检索。 */
interface QueryRewriteProvider {
  rewrite(query: string): Promise<string>;
}
```

`QueryRewriteProvider` 是轻量 adapter 接口，目的是让调用方注入任意 LLM（OpenAI / Anthropic / 内部 model router 均可），而不把具体 SDK 绑定进 `packages/knowledge`。

### RetrievalRerankProvider（Post-Retrieval 语义重排注入点）

```ts
interface RetrievalRerankProvider {
  rerank(input: { query: string; hits: RetrievalHit[] }): Promise<Array<{ chunkId: string; alignmentScore: number }>>;
}
```

`RetrievalRerankProvider` 是 post-retrieval ranking 的稳定扩展点。它只接收当前 normalized query 与 `RetrievalHit[]`，只返回项目自定义的 `chunkId` / `alignmentScore`，不得把第三方 SDK 对象、vendor response、错误对象或模型私有结构穿透进 runtime contract。

默认 `DefaultPostRetrievalRanker` 会先计算 deterministic signals，再在 provider 成功时把 `alignmentScore` 作为语义重排信号参与排序。此时 diagnostics 为：

- `ranking.strategy = "deterministic-signals+semantic-rerank"`
- `ranking.signals` 包含 `semantic-rerank` 与 `alignment`

如果 provider 抛错、超时包装为 reject，或返回无法参与排序的分数，ranker 必须降级到 deterministic 排序，不中断检索流程；降级时 diagnostics 保持 `deterministic-signals`，避免把失败的语义重排误报为已参与排序。

### LlmQueryNormalizer

```ts
class LlmQueryNormalizer implements QueryNormalizer {
  constructor(provider: QueryRewriteProvider, fallbackNormalizer?: QueryNormalizer);
  normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest>;
}
```

- 先调用 `provider.rewrite(query)` 进行语义改写
- 失败时（任何错误/reject）静默降级到 `fallbackNormalizer`（默认 `DefaultQueryNormalizer`）
- 降级路径不会 throw，不影响主检索流程
- 可通过 `pipeline.queryNormalizer` 单个注入，也可组合进串联数组

### RetrievalSafetyScanner（Post-Retrieval 安全扫描注入点）

```ts
interface RetrievalSafetyScanner {
  scan(hit: RetrievalHit): Promise<RetrievalSafetyScanResult>;
}

interface RetrievalSafetyScanResult {
  action: 'keep' | 'mask' | 'drop';
  maskedContent?: string;
  reason?: string;
}
```

`RetrievalSafetyScanner` 是 post-retrieval filtering 阶段的项目自定义安全扫描/provider 边界。调用方可以把内部规则引擎、模型安全分类器或第三方 SDK 封装到 scanner 内部，但不得把第三方 response、error、SDK client 或 vendor-specific 类型穿透到 `packages/knowledge` 的 contract、diagnostics 或持久化结构中。

可通过 `RetrievalPipelineConfig.safetyScanner` 注入默认 `DefaultPostRetrievalFilter`：

- `keep`：保留命中；scanner 成功返回时以 scanner 判定为准。
- `mask`：保留命中，但用 `maskedContent` 替换 `hit.content`；如果 `citation.quote` 存在，同步替换为同一脱敏文本。未提供 `maskedContent` 时默认使用 `[REDACTED]`。
- `drop`：丢弃命中，并在 `diagnostics.postRetrieval.filtering.reasons['unsafe-content']` 中计数。
- scanner 抛错或 reject：不中断检索，降级到内置最小 unsafe 正则 fallback。

`diagnostics.postRetrieval.filtering` 仍只暴露数量和原因汇总，不暴露原始命中正文、被丢弃文本、脱敏前 quote、scanner vendor reason 或第三方错误对象。

### Post-Retrieval Diagnostics Schema-first Contract

`PostRetrievalDiagnosticsSchema` 位于 `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`，是 `diagnostics.postRetrieval` 的稳定 schema-first contract；runtime 侧长期公共类型由该 schema 通过 `z.infer` 推导，字段只包含 filtering、ranking、diversification 的项目自定义数量、策略和原因汇总。第三方 scanner / reranker 的原始错误对象、vendor response 或 provider 私有结构不得进入该 contract，也不会成为消费者必须处理的结构。

```ts
interface KnowledgeRetrievalResult {
  hits: RetrievalHit[];
  total: number;
  contextBundle?: string; // 仅当 assembleContext: true 时返回
  diagnostics?: RetrievalDiagnostics;
}
```

当前 diagnostics 至少包含：

- `originalQuery`
- `normalizedQuery`
- `rewriteApplied`
- `rewriteReason`
- `queryVariants`
- `executedQueries`
- `filtering`（resolved filters、legacy 映射、defensive filtering stages）
- `postRetrieval`（result filtering、ranking、diversification 的数量和策略诊断）
- `hybrid`（仅当 searchService 返回 hybrid diagnostics 时出现）
- `contextExpansion`（仅当执行 context expansion 且 includeDiagnostics 为 true 时出现）
- `preHitCount`
- `postHitCount`

Hybrid Search diagnostics 已落在 `RetrievalDiagnostics.hybrid`，schema 位于 `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`。`HybridRetrievalEngine` 每次返回单次 hybrid diagnostics；`runKnowledgeRetrieval()` 在多 query variants 场景会合并多次 hybrid diagnostics。

| 字段                       | 语义                                                                                                       | 当前状态 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| `hybrid.retrievalMode`     | 本次检索实际运行模式：`hybrid`、`keyword-only`、`vector-only`、`none`，用于说明降级后的真实路径            | 已实现   |
| `hybrid.enabledRetrievers` | 配置启用的 retriever 列表，当前为 `keyword`、`vector`                                                      | 已实现   |
| `hybrid.failedRetrievers`  | 本次执行失败并被降级吞掉的 retriever 列表                                                                  | 已实现   |
| `hybrid.fusionStrategy`    | 命中融合策略标识，当前 schema 为 `rrf`                                                                     | 已实现   |
| `hybrid.prefilterApplied`  | hybrid engine 是否收到 filters、legacy `allowedSourceTypes` 或 `minTrustClass`；不替代 defensive filtering | 已实现   |
| `hybrid.candidateCount`    | fusion / post-process 前参与排序的候选命中数量；多 query variants 时由 pipeline 汇总                       | 已实现   |

### Hybrid Search 生产配置 Contract

`HybridKnowledgeSearchProductionConfigSchema` 位于 `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`，从 `@agent/knowledge` 根入口导出。它只描述生产装配所需的稳定配置语义，不创建 OpenSearch / Chroma client，不读取凭据，也不发起网络请求。

| 字段                        | 语义                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                      | 稳定枚举：`keyword-only`、`vector-only`、`hybrid`。`keyword-only` 必须提供 keyword 配置；`vector-only` 必须提供 vector 配置；`hybrid` 必须同时提供两者。 |
| `keyword.opensearch.index`  | OpenSearch 全文索引占位配置，当前包含 index name、chunk id 字段、正文 text 字段和可选 metadata 字段。                                                    |
| `keyword.opensearch.client` | OpenSearch client 占位配置，允许记录 `clientRef`、endpoint、region 和请求超时；真实 SDK、凭据和连接生命周期由 adapter / host 装配层负责。                |
| `vector.chroma.collection`  | Chroma collection 占位配置，当前包含 collection name、可选 embedding 维度、chunk id、document 和 metadata 字段。                                         |
| `vector.chroma.client`      | Chroma client 占位配置，允许记录 `clientRef`、endpoint、tenant、database 和请求超时；真实 client 仍由 adapter / host 装配层注入。                        |
| `diagnostics`               | 控制配置层 diagnostics 是否启用、是否包含 provider timing、provider health，以及是否在输出中脱敏 client endpoint。                                       |
| `health`                    | 控制配置层健康检查语义：是否启用、是否启动时检查、单次超时和连续失败多少次后视为 degraded。                                                              |

该 contract 是生产装配边界的输入形状，不替代运行时 `RetrievalDiagnostics.hybrid`。运行时 diagnostics 记录每次检索真实执行路径；生产配置 diagnostics / health 字段记录 host 是否应该暴露 provider 观测与健康检查，以及暴露时的脱敏和降级语义。

### Backend Host 状态观测

`apps/backend/agent-server/src/runtime/core/runtime-knowledge-search-factory.ts` 是 backend 的装配边界。它根据显式 keyword service、vector provider/client 与 retrieval mode 生成最终 `KnowledgeSearchService`，并返回 `RuntimeKnowledgeProviderFactoryResult`：

| 字段               | 语义                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `configuredMode`   | host 配置期望的模式：`keyword-only`、`vector-only` 或 `hybrid`                         |
| `effectiveMode`    | 实际生效模式；vector 缺失时会从 `hybrid` 降级为 `keyword-only`                         |
| `vectorProviderId` | 配置或显式注入的 provider 标识；仅用于观测，不代表 SDK client 已由 knowledge 创建      |
| `vectorConfigured` | 当前 host 是否配置了 vector 路径                                                       |
| `diagnostics`      | 装配期 diagnostics，例如 vector client 缺失导致 keyword-only fallback 或 provider 就绪 |

`RuntimeHost.knowledgeSearchStatus` 通过 `createRuntimeKnowledgeSearchStatus()` 暴露轻量装配态，字段包含 configured/effective mode、vector 是否配置、hybrid 是否实际启用、diagnostics 与检查时间。`RuntimeHost.getKnowledgeSearchStatus()` 会在 async 查询路径额外执行 provider health check，并把 `vectorProviderHealth` 写入结果。health check 由 backend core 的短 TTL cache 包裹，默认 TTL 为 5s、默认超时为 2s；可通过 `KNOWLEDGE_PROVIDER_HEALTH_TTL_MS`、`KNOWLEDGE_PROVIDER_HEALTH_TIMEOUT_MS` 调整。health payload 会带 `consecutiveFailures`，成功后归零，超时或异常会递增；达到 `KNOWLEDGE_PROVIDER_HEALTH_DEGRADED_AFTER_FAILURES` 阈值后才标记 degraded 并追加 `knowledge.vector_provider.health_degraded` diagnostic。这个状态已写入 `/health` 的 `knowledgeSearchStatus` 字段，并通过 Runtime Center projection 暴露给 `agent-admin` 的 “Wenyuan & Cangjing” 卡片。装配态只说明 backend host 当前组合结果；health check 只说明 provider 当前连通性；单次 query 的 retriever 成败、RRF candidate count、metadata filter 等仍以 `RetrievalDiagnostics.hybrid` 为准。

backend `RuntimeHost` 现在会在默认构造时读取生产环境变量并创建 Chroma vector provider，随后注入 `runtime-knowledge-search-factory.ts` 与主链 `AgentRuntime.knowledgeSearchService`：

| 环境变量                                      | 语义                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `KNOWLEDGE_RETRIEVAL_MODE`                    | 可选：`keyword-only`、`vector-only`、`hybrid`；配置 Chroma provider 时默认 `hybrid`          |
| `KNOWLEDGE_VECTOR_PROVIDER`                   | 当前 backend core 识别 `chroma`；其他值只记录配置，不创建 provider                           |
| `KNOWLEDGE_VECTOR_ENABLED`                    | 可选布尔开关；未设置时按是否存在 `KNOWLEDGE_VECTOR_PROVIDER` 推导                            |
| `KNOWLEDGE_CHROMA_COLLECTION`                 | Chroma collection 名称；缺失时保持 vector configured 但不创建 provider，factory 降级 keyword |
| `KNOWLEDGE_CHROMA_ENDPOINT` / `API_KEY`       | 传给 adapter client-like 边界；API key 仅进入 fetch header，不进入 diagnostics               |
| `KNOWLEDGE_EMBEDDINGS_ENDPOINT` / `MODEL`     | 创建 query embedding provider 的必填项                                                       |
| `KNOWLEDGE_EMBEDDINGS_API_KEY` / `DIMENSIONS` | embedding secret 与可选维度；也会按 adapter 既有逻辑兼容 `ZHIPU_API_KEY` / MCP key fallback  |
| `KNOWLEDGE_PROVIDER_HEALTH_*`                 | 支持 `TTL_MS`、`TIMEOUT_MS`、`DEGRADED_AFTER_FAILURES`，控制 provider health 观测            |

这里的真实 knowledge adapter 生命周期位于 `@agent/knowledge/adapters/*`。backend 只负责从 env/secret 创建项目内 adapter 的 client-like 配置与 provider 实例；如果 Chroma SDK、服务端 collection 或 embedding endpoint 不可用，会在 health/query 阶段由 adapter 报错并由 runtime health/retrieval diagnostics 观测，不在 service/controller 内直连第三方 SDK。

backend 到 `AgentRuntime.knowledgeSearchService` 的 bridge 会额外实现可选 `RuntimeKnowledgeSearchService.getLastDiagnostics()`。该方法返回最近一次主链知识检索的稳定快照：`query`、`limit`、`hitCount`、`total`、`searchedAt`，以及从 knowledge search result 透传的 JSON-like diagnostics。这个快照不替代 `/health` 装配态，也不主动混入 health payload；Runtime Center projection 会以 `knowledgeSearchLastDiagnostics` 可选字段透出，agent-admin 当前只展示最近一次 hit/total 摘要，更深的 query diagnostics drilldown 仍应继续基于该字段扩展。

### Metadata Filtering

`RetrievalRequest.filters` 是检索范围约束，不是 query rewrite。Query normalizer 可以改写 query、生成 query variants、决定 topK，但不能把 metadata 范围约束隐式揉进 query 文本里；filters 必须在独立的 filter resolution 阶段解析，并贯穿后续召回与兜底过滤。

`allowedSourceTypes` 与 `minTrustClass` 是 legacy 兼容入口。运行时会把这些旧字段映射进 resolved filters，并与新 `filters` 入口合并；后续新增调用方应优先使用 `filters`，旧字段仅用于兼容历史请求。

召回阶段必须遵守同一份 resolved filters：

- keyword search 必须先过滤再打分，避免不符合 metadata 约束的 chunk 参与相关性排序。
- vector provider 应尽量支持 filter pushdown，把 docType、status、allowedRoles 等约束下推到向量检索 provider / adapter。
- runtime / hybrid 链路仍保留 defensive filter，在进入 merge / fusion 前再次过滤候选命中，防止第三方 provider、adapter 或降级路径绕过过滤。
- 后续 Small-to-Big 回补 parent / neighbor chunk 时，也必须复用同一份 resolved filters；回补不能扩大用户原始检索范围。

`diagnostics.filtering` 当前字段口径如下：

| 字段           | 语义                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `enabled`      | 本次请求是否解析出有效 filters；legacy `allowedSourceTypes` / `minTrustClass` 也会计入            |
| `stages`       | runtime 层兜底过滤观测数组                                                                        |
| `stage`        | 当前稳定值为 `pre-merge-defensive`；`context-expansion-defensive` 作为 context expansion 语义保留 |
| `beforeCount`  | 进入该兜底阶段前的候选数量                                                                        |
| `afterCount`   | 兜底过滤后的候选数量                                                                              |
| `droppedCount` | 因 filters 不匹配而丢弃的候选数量                                                                 |

当前 diagnostics 不直接暴露 `resolvedFilters` 或被丢弃候选 id；如需面向调试台扩展这些字段，必须先更新 runtime 类型和测试。

### Post-Retrieval Filtering / Ranking / Diversification

Post-Retrieval 属于 `packages/knowledge` retrieval runtime 的在线编排阶段，执行位置在 merge / fusion 之后、context expansion 之前。

默认链路为：

```text
merged hits
  -> DefaultPostRetrievalFilter
  -> DefaultPostRetrievalRanker
  -> DefaultPostRetrievalDiversifier
  -> RetrievalPostProcessor
  -> ContextExpander
  -> ContextAssembler
```

默认实现使用确定性信号，并支持安全扫描扩展点：

- filter：低分、重复 chunk、低上下文价值、可注入 `RetrievalSafetyScanner` 的 `keep` / `mask` / `drop` 判定，以及 scanner 不可用时的最小 unsafe content fallback。默认 filter 不再按 `metadata.parentId` 去重，同一 parent 的互补 chunk 会继续进入 rank / diversify，由 diversifier 的 `maxPerParent` 决定最终覆盖度。
- ranker：融合 retrieval score、trustClass authority、updatedAt recency、context fit 与 query 中明确版本/年份约束。
- reranker provider：可选注入语义 alignment score；成功时与 deterministic signals 融合排序，失败时自动回退 deterministic signals。
- diversifier：优先按 sourceId 与 metadata.parentId 控制覆盖度，避免同一来源或父段落占满上下文；如果只有单一来源且未填满 topK，会回填同源候选以保持既有召回容量。

`diagnostics.postRetrieval` 只暴露数量、策略和原因汇总，不暴露被丢弃文本。

| 字段                           | 语义                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `filtering.beforeCount`        | 进入 post-retrieval filter 前的候选数量                                                 |
| `filtering.afterCount`         | filter 后的候选数量                                                                     |
| `filtering.droppedCount`       | filter 丢弃数量                                                                         |
| `filtering.reasons`            | 按 `low-score`、`duplicate-*`、`unsafe-content` 等原因汇总                              |
| `ranking.strategy`             | 默认 `deterministic-signals`；provider 成功时为 `deterministic-signals+semantic-rerank` |
| `ranking.signals`              | 本次排序使用的信号名                                                                    |
| `diversification.strategy`     | 当前稳定值为 `source-parent-section-coverage`                                           |
| `diversification.maxPerSource` | source coverage 的默认或注入上限                                                        |
| `diversification.maxPerParent` | parent coverage 的默认或注入上限                                                        |

### Small-to-Big / Context Expansion

Small-to-Big 第一阶段落在 retrieval runtime 的 `ContextExpander` stage，而不是 search service、post-processor 或 context assembler 内部。pipeline 顺序是：

```text
post-retrieval -> post-process -> context expansion -> context assembly
```

当前第一阶段实现为 `SmallToBigContextExpander`：

- 入口：`packages/knowledge/src/retrieval/small-to-big-context-expander.ts`
- stage contract：`packages/knowledge/src/runtime/stages/context-expander.ts`
- pipeline 接线：`packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- repository 支撑：`KnowledgeChunkRepository.getByIds(ids)`

`SmallToBigContextExpander` 从 seed hit 的 `hit.metadata.parentId`、`hit.metadata.prevChunkId`、`hit.metadata.nextChunkId` 读取候选 chunk id，并通过 `chunkRepository.getByIds()` 批量回补 parent / neighbor chunk。metadata 字段必须是 JSON-safe 字符串，不承载第三方对象。

扩展结果必须复用本次检索已经解析出的 resolved filters。即使底层 repository 返回了候选 chunk，expander 也要再次按同一份 filters 做防御过滤，避免 parent / neighbor 回补扩大用户原始检索范围。

扩展后的 hits 只作为 `contextAssembler` 的输入，用于生成 `contextBundle`。`KnowledgeRetrievalResult.hits` 仍保持 post-process 后的原始检索命中，不写入 expanded hits，也不改变 `total` 对应语义。

当 `includeDiagnostics: true` 时，`diagnostics.contextExpansion` 记录本次扩展观测值：

| 字段                   | 语义                                                    |
| ---------------------- | ------------------------------------------------------- |
| `enabled`              | 本次是否执行 context expansion                          |
| `seedCount`            | 输入 expander 的 seed hit 数量                          |
| `candidateCount`       | 从 parent / neighbor metadata 收集到的候选 id 数量      |
| `addedCount`           | 最终加入 context assembly 输入的扩展 hit 数量           |
| `dedupedCount`         | 因 seed hit 或候选重复被去重的数量                      |
| `missingCount`         | metadata 指向但 repository 未返回的候选数量             |
| `droppedByFilterCount` | repository 返回后被 resolved filters 防御过滤丢弃的数量 |
| `maxExpandedHits`      | 本次扩展策略允许加入 context assembly 输入的最大 hit 数 |

## Post-Retrieval Selection Trace

`runKnowledgeRetrieval({ includeDiagnostics: true })` exposes `diagnostics.postRetrieval.selectionTrace`.

Each entry explains one candidate decision:

```ts
{
  chunkId: string;
  sourceId: string;
  selected: boolean;
  stage: 'filtering' | 'ranking' | 'diversification' | 'post-processor';
  reason:
    | 'selected'
    | 'low-score'
    | 'duplicate-chunk'
    | 'duplicate-parent'
    | 'low-context-value'
    | 'unsafe-content'
    | 'conflict-risk'
    | 'source-limit'
    | 'parent-limit'
    | 'max-chunks'
    | 'max-prompt-chars'
    | 'post-processor-min-score';
  score?: number;
  order?: number;
}
```

This trace is intended for debugging, admin UI explanations, eval sampling, and observability projection. Runtime events keep only aggregate counts by default to avoid large trace payloads.

The trace is inspired by the course RAG project under `/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/rag`, but the current implementation is owned by `@agent/knowledge` schemas and does not copy the course project's package layout or `@rag-sdk/*` public contracts.

## Schema 复用策略

所有知识检索稳定 contract（`RetrievalRequest` / `RetrievalResult` / `RetrievalHit` / `Citation`）全部来自 `@agent/knowledge` 的本包 `contracts/`，不再从 `@agent/core` 消费。运行时专属类型（`KnowledgeRetrievalResult` / `RetrievalDiagnostics` / `NormalizedRetrievalRequest`）放在 `runtime/types/`，不放进 core。

## 命名约定

| 用途       | 命名                                                              | 说明                                                |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 函数式入口 | `runKnowledgeRetrieval()`                                         | 不用 `createRuntime()` 避免与 `@agent/runtime` 混淆 |
| 对象接口   | `KnowledgeRetrievalRuntime`                                       | 区分 `AgentRuntime`                                 |
| 阶段接口   | `QueryNormalizer` / `RetrievalPostProcessor` / `ContextAssembler` | 不使用 `Generator`（属于 agent runtime 职责）       |

## 使用示例

```ts
import { LocalKnowledgeFacade, LlmQueryNormalizer, runKnowledgeRetrieval } from '@agent/knowledge';

// 方式一：facade.retrieve（走默认 pipeline，不含 LLM 改写）
const facade = new LocalKnowledgeFacade();
const result = await facade.retrieve({ query: 'retrieval pipeline' });

// 方式二：注入 LLM 改写（实现 QueryRewriteProvider 接口）
class MyLlmProvider {
  async rewrite(query: string): Promise<string> {
    // 调用自己的 LLM router / OpenAI / Anthropic，返回改写后 query
    return callMyLlm(query);
  }
}

const llmNormalizer = new LlmQueryNormalizer(new MyLlmProvider());

const llmResult = await runKnowledgeRetrieval({
  request: { query: 'How do I improve retrieval quality?' },
  searchService: facade.searchService,
  assembleContext: true,
  includeDiagnostics: true,
  pipeline: {
    queryNormalizer: llmNormalizer
  }
});

// 方式三：注入语义 reranker provider（实现 RetrievalRerankProvider 接口）
const semanticRerankResult = await runKnowledgeRetrieval({
  request: { query: 'search quality' },
  searchService: facade.searchService,
  includeDiagnostics: true,
  pipeline: {
    rerankProvider: {
      rerank: async ({ hits }) =>
        hits.map(hit => ({
          chunkId: hit.chunkId,
          alignmentScore: scoreWithMyModel(hit)
        }))
    }
  }
});

// 方式四：串联多个 normalizer（数组顺序执行，前一个输出作为后一个输入）
const chainedResult = await runKnowledgeRetrieval({
  request: { query: 'search quality' },
  searchService: facade.searchService,
  pipeline: {
    queryNormalizer: [llmNormalizer, anotherNormalizer]
  }
});
// chainedResult.contextBundle → prompt-ready 字符串
// chainedResult.diagnostics  → 运行时诊断信息（含 rewriteApplied / rewriteReason）
```

## 当前已实现

默认 runtime 现在已经包含：

- deterministic query cleanup
- 轻量 query rewrite
- metadata filter resolution：合并 `filters` 与 legacy `allowedSourceTypes` / `minTrustClass`
- keyword search 前置过滤：先按 resolved filters 过滤候选 chunk，再进行打分
- vector filter pushdown 入口：provider / adapter 尽量接收并下推 resolved filters
- defensive filtering：runtime / hybrid 在 merge / fusion 前兜底过滤候选命中
- post-retrieval filtering / ranking / diversification：merge 后、context expansion 前执行确定性检索后操作
- context expansion stage：post-process 后、context assembly 前可注入 `ContextExpander`
- **Small-to-Big 第一阶段**：`SmallToBigContextExpander` 按 `parentId` / `prevChunkId` / `nextChunkId` 回补 context 输入，并保留 `result.hits` 不变
- bounded multi-query retrieval
- 按 `chunkId` 的命中合并
- richer retrieval diagnostics（包含 filtering stages、postRetrieval 与 hybrid diagnostics）
- **LLM-based query rewrite**：通过 `LlmQueryNormalizer` + `QueryRewriteProvider` 接口，失败时自动降级
- **Semantic post-retrieval rerank**：通过 `RetrievalRerankProvider` 注入 alignment score，成功时进入 ranking diagnostics，失败时自动降级
- `VectorSearchProvider` 接口（`src/retrieval/vector-search-provider.ts`）
- `InMemoryVectorSearchProvider`（bigram 余弦相似度，`src/retrieval/in-memory-vector-search-provider.ts`）
- `VectorKnowledgeSearchService`（Provider + Repo 映射，`src/retrieval/vector-knowledge-search-service.ts`）
- `rrfFusion`（RRF 纯函数，`src/retrieval/rrf-fusion.ts`）
- `RetrievalFusionStrategy` / `RrfFusionStrategy`（策略对象层，`src/retrieval/fusion-strategy.ts`）
- `KnowledgeRetriever` / `KeywordRetriever` / `VectorRetriever`（不泄漏第三方 SDK，输入输出基于 `RetrievalRequest` / `RetrievalResult` / `RetrievalHit`，`src/retrieval/hybrid-retrieval-engine.ts`）
- `HybridRetrievalEngine`（多路 retriever 并行 + RRF 融合 + 降级 + diagnostics，`src/retrieval/hybrid-retrieval-engine.ts`）
- **`HybridKnowledgeSearchService`**（兼容 facade，内部委托 `HybridRetrievalEngine`，`src/retrieval/hybrid-knowledge-search-service.ts`）

Hybrid Search 当前真实边界：

- `HybridKnowledgeSearchService` 仍是对外 `KnowledgeSearchService` facade，通过 `runKnowledgeRetrieval({ searchService })` 注入；旧构造函数保持 `keywordService` / `vectorService` + `rrfK` 兼容，内部会适配为 retriever。
- keyword 路当前由 `DefaultKnowledgeSearchService` 承担；vector 路通过 `VectorKnowledgeSearchService` + `VectorSearchProvider` 接口注入；`HybridRetrievalEngine` 也可直接接收 `KnowledgeRetriever[]`，作为后续扩展更多召回路的收敛入口。
- `rrfFusion()` 仍保留纯函数，`RrfFusionStrategy` 在其上提供策略对象封装。
- 真实 Chroma / OpenSearch / Supabase pgvector / LangChain indexing adapter 已迁入 `packages/knowledge/src/adapters/*`；当前已存在 `ChromaVectorSearchProvider`、`OpenSearchKeywordSearchProvider` 和 OpenSearch 显式配置工厂，backend `RuntimeHost` 可显式注入 keyword service / vector provider 并接入主链；具体 SDK client、凭据、索引名、环境化模式选择和健康检查仍由 backend / host 装配层继续补齐。
- metadata filter 已有 `RetrievalRequest.filters`、legacy `allowedSourceTypes` / `minTrustClass` 映射、keyword 前置过滤、vector filter pushdown 入口和 defensive filtering；Hybrid Search 不应绕过这条过滤链。

## 统一知识入口边界

`RetrievalRequest` / `RetrievalHit` 已经通过 `sourceType`、`trustClass`、`metadata` 和 `filters` 提供统一检索 contract，但“所有来源都已完成 ingestion 接线”还不是当前事实。当前边界如下：

来源接线的详细核对入口见 [source-ingestion-status.md](/docs/packages/knowledge/source-ingestion-status.md)。下表只概括 retrieval runtime 视角，不能替代 ingestion 状态判断。

`sourceType` schema 只定义 retrieval / runtime artifact 可以接受的稳定来源枚举；它不隐含对应来源已经具备 loader、权限 metadata、receipt、embedding 写入或 backend host 生产接线。

| 来源               | Retrieval contract | Runtime artifact schema | 当前接线状态 / 风险                                                                                                                                                                                                                            |
| ------------------ | ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repo docs          | 已有               | 已有                    | 本地 `ingestLocalKnowledge()` 已枚举 `docs/**/*.md`；snapshot 可通过 repository 注入，未注入时使用 profile storage knowledge snapshot；仍需按实际部署确认 embedding 凭据与 searchable 状态                                                     |
| workspace docs     | 已有               | 已有                    | 本地 `ingestLocalKnowledge()` 已枚举 README 与项目规范；snapshot 可通过 repository 注入，未注入时使用 profile storage knowledge snapshot；不等于所有 workspace 文档都完整接入                                                                  |
| connector manifest | 已有               | 已有                    | 本地最小枚举部分 `package.json` manifest；backend 已有 connector sync entries adapter 并复用 `connector-manifest` + `metadata.docType=connector-sync`，真实 connector API 同步 job 仍待接线                                                    |
| catalog sync       | 已有               | 已有                    | backend 已有上游 entries adapter，可写入 receipt 与 chunk；外部 catalog 拉取 / 鉴权 job 仍待接线                                                                                                                                               |
| user upload        | 已有               | 已有                    | backend 已有 workspace 内已落盘文件 adapter，可写入权限 metadata、receipt 与 chunk；multipart / 对象存储 / 鉴权上游 job 仍待接线                                                                                                               |
| web curated        | 已有               | 已有                    | backend 已有上游 curated URL entries adapter，可写入 receipt 与 chunk；当前只接收人工策展或外部系统已整理内容，真实网页抓取 / robots / 抓取调度暂不做                                                                                          |
| agent skills       | 未新增             | 未新增                  | 决策为不新增 `agent-skill` sourceType；代理技能进入 Hybrid Search 时先复用 `workspace-docs` / `repo-docs` + `metadata.docType=agent-skill`，运行时技能 manifest 复用 `connector-manifest` 或 `catalog-sync` + `metadata.docType=runtime-skill` |

后续新增来源时，必须先补 schema/contract、ingestion 产物、metadata filter 语义和最小检索回归，再宣称其进入统一知识入口。

## 仍未实现

当前默认 runtime 还没有实现这些更重的检索前增强：

- 生产级 OpenSearch / Chroma client 创建、凭据读取、索引名配置与部署环境接线
- backend / host 层按环境选择 keyword-only / vector-only / hybrid 的真实配置加载、provider ping 与健康状态刷新
- query decomposition（把一个复合问题拆成多个子查询）
- HyDE（Hypothetical Document Embeddings：先让 LLM 生成假想文档，再检索最近邻）
- semantic rerank beyond the current deterministic post-retrieval ranker（交叉编码器重排）

这些能力仍然建议通过 `QueryNormalizer`、`PostRetrievalRanker`、`RetrievalPostProcessor` 等扩展点按需注入。

## 扩展点

| 场景                     | 注入方式                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| 接入向量检索             | 替换 `KnowledgeSearchService`                                                            |
| 接入 LLM query rewrite   | 实现 `QueryRewriteProvider` 并构造 `LlmQueryNormalizer`，注入 `pipeline.queryNormalizer` |
| 串联多个 normalizer      | `pipeline.queryNormalizer` 支持数组，顺序执行                                            |
| 自定义检索后过滤         | 实现 `PostRetrievalFilter` 注入 `pipeline.postRetrievalFilter`                           |
| 接入语义 reranker        | 实现 `PostRetrievalRanker` 注入 `pipeline.postRetrievalRanker`                           |
| 自定义上下文多样化       | 实现 `PostRetrievalDiversifier` 注入 `pipeline.postRetrievalDiversifier`                 |
| 接入 query decomposition | 在 `QueryNormalizer` 中生成结构化 `queryVariants`                                        |
| 自定义 context 格式      | 实现 `ContextAssembler` 注入 `pipeline.contextAssembler`                                 |

## 上下文组装与生成边界

当前默认 `DefaultContextAssembler` 会按 `[N] title\ncontent` 拼接命中，并在 `contextAssemblyOptions.budget` 存在时按近似 token 预算截断或丢弃 context。`RagRetrievalRuntime` 会把 planner `strategyHints.contextBudgetTokens` 传入 context assembly；`RetrievalDiagnostics.contextAssembly` 会记录 selected / dropped / truncated hit ids、估算 token 和 ordering strategy。

`RagAnswerRuntime` 会把 `retrieval.contextBundle` 传给 answer provider；统一 backend knowledge domain 的 `buildSdkChatMessages()` 会优先消费 `input.contextBundle`，仅在 bundle 为空时 fallback 到 citations。citations 仍只作为 grounding、引用校验和 UI 展示 contract。详细审计见 [context-assembly-and-generation.md](/docs/packages/knowledge/context-assembly-and-generation.md)。

## 测试

- `packages/knowledge/test/default-query-normalizer.test.ts` — 默认 rewrite / query variants 单元测试
- `packages/knowledge/test/run-knowledge-retrieval.test.ts` — pipeline runner 单元测试（含 multi-query merge 与 diagnostics）
- `packages/knowledge/test/post-retrieval-filter.test.ts` — 默认 post-retrieval filtering 单元测试
- `packages/knowledge/test/post-retrieval-ranker.test.ts` — 默认 deterministic signals ranking 单元测试
- `packages/knowledge/test/post-retrieval-diversifier.test.ts` — 默认 source / parent coverage 单元测试
- `packages/knowledge/test/local-knowledge-facade-retrieve.test.ts` — facade retrieve 集成测试
- `packages/knowledge/test/llm-query-normalizer.test.ts` — LLM 改写 + 降级路径单元测试
- `packages/knowledge/test/query-normalizer-chain.test.ts` — resolveNormalizerChain 串联行为测试
- `packages/knowledge/test/knowledge-retrieval-filters.test.ts` — filter schema、legacy 映射与 hit/source/chunk 匹配测试
- `packages/knowledge/test/rrf-fusion.test.ts` — RRF 融合单元测试
- `packages/knowledge/test/vector-knowledge-search-service.test.ts` — vector provider 到 RetrievalHit 映射与过滤测试
- `packages/knowledge/test/hybrid-knowledge-search-service.test.ts` — Hybrid engine/facade、RRF、降级和 diagnostics 测试
- `packages/knowledge/demo/retrieval-runtime.ts` — 最小可运行 demo

## 不属于此包的能力

| 能力                       | 正确位置                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| 通用多 Agent 最终回答生成  | `packages/runtime` 主链 + `agents/*`                                                                   |
| Knowledge RAG 专用回答生成 | `packages/knowledge/src/rag/answer/*` 与宿主注入的 answer provider；不得放进 `runKnowledgeRetrieval()` |
| 向量检索实现               | `packages/adapters`                                                                                    |
| 离线索引构建               | `packages/knowledge/src/indexing/`                                                                     |
| 知识 store 管理            | `apps/backend`                                                                                         |
