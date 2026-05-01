# Hybrid Search 设计文档

状态：current  
状态说明：MVP completed；engine / diagnostics / retriever 接口 / Chroma adapter / OpenSearch-like adapter / backend host 主链注入已收敛，全来源 ingestion 与生产凭据接线仍需后续核对  
文档类型：reference  
适用范围：`packages/knowledge/src/retrieval/`  
最后核对：2026-04-30

---

## 1. 背景与目标

当前 `DefaultKnowledgeSearchService` 使用基于字面关键词匹配的简单 TF 打分（`scoreKnowledgeChunk`）。这种方式在以下场景会失效：

- 用户问法口语化（"苹果15续航咋样"），文档用规范表达（"iPhone 15 电池续航测试"）
- 同义词、近义词、换一种说法的表达

Hybrid Search 通过组合关键词检索（Keyword Search）和向量检索（Vector Search），再用 RRF（Reciprocal Rank Fusion）合并两路结果，使两种方式互相补充：

| 方式           | 擅长                                       |
| -------------- | ------------------------------------------ |
| Keyword Search | 精确词命中：型号、错误码、专有术语、产品名 |
| Vector Search  | 语义相近：同义词、口语化表达、换一种说法   |

> 2026-04-30 核对结论：本设计第一阶段 MVP 已落地为 `HybridKnowledgeSearchService` + `VectorKnowledgeSearchService` + `VectorSearchProvider` + `rrfFusion`。本轮已继续补齐 `HybridRetrievalEngine`、`KnowledgeRetriever` / `KeywordRetriever` / `VectorRetriever`、`RetrievalFusionStrategy` / `RrfFusionStrategy`、`diagnostics.hybrid`、`packages/adapters` 的 Chroma 向量检索桥接与 OpenSearch-like 全文检索桥接，以及 backend `RuntimeHost` 到 `AgentRuntime.knowledgeSearchService` 的显式 keyword/vector 主链接入；仍需核对全来源 ingestion 和生产级 SDK / 凭据 / 索引配置。

---

## 2. 架构设计

### 2-1. 整体结构

```
packages/knowledge/src/retrieval/
  knowledge-search-service.ts              ← 已有：DefaultKnowledgeSearchService
  vector-search-provider.ts                ← 新增：VectorSearchProvider 接口 + VectorSearchHit 类型
  in-memory-vector-search-provider.ts      ← 新增：可测试的内存实现（n-gram 余弦相似度）
  vector-knowledge-search-service.ts       ← 新增：实现 KnowledgeSearchService，wraps Provider + Repos
  rrf-fusion.ts                            ← 新增：纯函数 rrfFusion(rankLists, k?)
  fusion-strategy.ts                       ← 新增：RetrievalFusionStrategy + RrfFusionStrategy
  hybrid-retrieval-engine.ts               ← 新增：组合两路 service + RRF + diagnostics
  hybrid-knowledge-search-service.ts       ← 新增：兼容 KnowledgeSearchService facade，委托 engine
```

当前尚未完全按更理想的 runtime 分层落到这些目录：

```text
packages/knowledge/src/runtime/retrievers/
packages/knowledge/src/runtime/fusion/
packages/knowledge/src/runtime/engine/
```

因此，调用方仍应以 `@agent/knowledge` 根入口导出的稳定 API 为准，不要假定内部目录已经完成 engine / retriever / fusion 策略化收敛。

### 2-2. 调用路径

```
runKnowledgeRetrieval({
  request,
  searchService: new HybridKnowledgeSearchService(keywordService, vectorService),
  ...
})
  ↓
hybridService.search(request)
  ├─ keywordService.search(request)  → keyword hits（按 score 降序）
  └─ vectorService.search(request)   → vector hits（按 score 降序）
  ↓ 并行，等待两路完成（任一失败时降级返回另一路结果）
rrfFusion([keywordHits, vectorHits], k=60)
  ↓
RetrievalResult（merged hits，RRF score 作为新 score，按 limit 截断）
```

**与现有 pipeline 的关系：**`HybridKnowledgeSearchService` 只是一个更聪明的 `KnowledgeSearchService`。调用方只需在 `runKnowledgeRetrieval` 的 `searchService` 参数传入 `HybridKnowledgeSearchService` 实例，pipeline 主链（`runKnowledgeRetrieval`、normalizer、post-processor）**完全不需要改动**。

当前 MVP 与目标形态的差异：

| 项目           | 当前事实                                                                                                             | 收敛目标                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 主入口         | `HybridKnowledgeSearchService implements KnowledgeSearchService`，内部委托 `HybridRetrievalEngine`                   | 保持 facade 兼容，同时避免调用方依赖内部目录                                                |
| retriever 接口 | `HybridRetrievalEngine` 已支持直接接收 `KnowledgeRetriever[]`，并保留 `KnowledgeSearchService` 兼容构造              | 后续新增召回路优先实现 retriever，不再把 service 与召回策略混在一起                         |
| fusion         | `rrfFusion()` 纯函数 + `RetrievalFusionStrategy` / `RrfFusionStrategy` 策略对象                                      | 保持策略对象为扩展点，后续可接更多融合策略                                                  |
| diagnostics    | `RetrievalDiagnostics.hybrid` 已记录 mode、enabled/failed retrievers、fusion strategy、prefilter 与候选数量          | 后续随更多 retriever/adapter 扩展 schema                                                    |
| adapter        | `VectorSearchProvider` 是轻量注入接口；`packages/adapters` 已提供 Chroma 向量检索桥接和 OpenSearch-like 全文检索桥接 | 生产 SDK client、凭据和索引配置继续留在 adapter/backend 装配层，不穿透 `packages/knowledge` |

---

## 3. 关键接口

### 3-1. VectorSearchProvider

```ts
// packages/knowledge/src/retrieval/vector-search-provider.ts

/** 单个向量搜索命中结果 */
export interface VectorSearchHit {
  chunkId: string;
  score: number; // 余弦相似度，范围 [0, 1]
}

/**
 * 向量检索注入点。
 * 调用方实现此接口，provider 负责 embed query + 计算相似度并返回 topK。
 * 失败时 throw，由 HybridRetrievalEngine 这类上层编排负责降级与 diagnostics。
 */
export interface VectorSearchProvider {
  searchSimilar(query: string, topK: number, options?: VectorSearchOptions): Promise<VectorSearchHit[]>;
}
```

`VectorSearchProvider` 与 `QueryRewriteProvider` 设计一致：都是轻量注入接口，只暴露项目需要的能力，不绑定具体 SDK（OpenAI / Chroma / 内部 router 均可实现）。

### 3-2. VectorKnowledgeSearchService

```ts
// packages/knowledge/src/retrieval/vector-knowledge-search-service.ts

class VectorKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    provider: VectorSearchProvider,
    chunkRepository: KnowledgeChunkRepository,
    sourceRepository: KnowledgeSourceRepository
  );
  search(request: RetrievalRequest): Promise<RetrievalResult>;
}
```

内部流程：

1. 调用 `provider.searchSimilar(request.query, providerTopK, { filters })`，其中 `providerTopK` 会适度放大以便本地 defensive filter 后仍有足够候选
2. 用 `chunkId` 从 `chunkRepository` 取完整 chunk 数据
3. 过滤无法找到对应 chunk 或 source 的命中（数据不一致时容错）
4. 应用 `allowedSourceTypes` 过滤（与 `DefaultKnowledgeSearchService` 保持一致）
5. 按 provider 返回的 score 降序排列，返回 `RetrievalResult`

**`limit` 语义**：`VectorKnowledgeSearchService` 将 `request.limit` 作为最终返回上限；provider topK 会适度放大，以便第三方 pushdown 不完整或本地 defensive filter 丢弃候选后仍可保留足够命中。`HybridKnowledgeSearchService` 在 RRF 融合后再次按 `request.limit` 截断最终结果。

### 3-3. RRF 融合

```ts
// packages/knowledge/src/retrieval/rrf-fusion.ts

/**
 * Reciprocal Rank Fusion。
 * 输入多路 RetrievalHit[] 数组，每路按 score 已降序排列。
 * 输出：按 RRF 分数融合排序后的 RetrievalHit[]。
 * 同一 chunkId 在多路出现时自动去重，保留最高信息量版本（取原始 content 等字段，更新 score）。
 *
 * 公式：rrfScore(chunk) = Σ(路) 1 / (k + rank)
 * 默认 k=60（文献标准值）。
 */
function rrfFusion(rankLists: RetrievalHit[][], k?: number): RetrievalHit[];
```

### 3-4. HybridKnowledgeSearchService

```ts
// packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts

export interface HybridSearchConfig {
  rrfK?: number; // RRF 平滑系数，默认 60
}

class HybridKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    keywordService: KnowledgeSearchService,
    vectorService: KnowledgeSearchService,
    config?: HybridSearchConfig
  );
  search(request: RetrievalRequest): Promise<RetrievalResult>;
}
```

降级策略：

- 两路并行（`Promise.allSettled`）
- 任一路 `rejected`：只用另一路结果（不 throw）
- 两路都失败：返回空 `RetrievalResult`（不 throw）

已实现的 hybrid diagnostics 字段位于 `RetrievalDiagnostics.hybrid`：

| 字段                       | 语义                                                                       | 文档状态 |
| -------------------------- | -------------------------------------------------------------------------- | -------- |
| `hybrid.retrievalMode`     | 实际检索模式，例如 `hybrid`、`keyword-only`、`vector-only`、`none`         | 已实现   |
| `hybrid.enabledRetrievers` | 配置启用的召回路，例如 `keyword`、`vector`                                 | 已实现   |
| `hybrid.failedRetrievers`  | 执行失败并被降级的召回路                                                   | 已实现   |
| `hybrid.fusionStrategy`    | 当前融合策略，当前为 `rrf`                                                 | 已实现   |
| `hybrid.prefilterApplied`  | hybrid engine 是否收到 filters / legacy source type / min trust 过滤条件   | 已实现   |
| `hybrid.candidateCount`    | fusion / post-process 前候选命中数量；多 query variants 时由 pipeline 汇总 | 已实现   |

### 3-5. InMemoryVectorSearchProvider

```ts
// packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts

class InMemoryVectorSearchProvider implements VectorSearchProvider {
  /**
   * 注册 chunk 的文本内容，内部自动计算 n-gram 向量。
   * 测试/demo 中替代真实 embedding。
   */
  register(chunkId: string, content: string): void;

  searchSimilar(query: string, topK: number, options?: VectorSearchOptions): Promise<VectorSearchHit[]>;
}
```

内部向量化方案：bigram（字符二元组）频率向量 + 余弦相似度。

- 不依赖任何 LLM 或外部服务
- 对语义接近的中英文内容有一定区分度（足够用于测试断言）
- 生产环境换成真实 embedding provider 无需改动上游代码

---

## 4. 测试覆盖

| 测试文件                                        | 覆盖内容                                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rrf-fusion.test.ts`                            | 单路传入、双路融合；同 chunkId 在两路均出现时分数高于只出现一路；k 参数影响；空输入                                                                                                                              |
| `in-memory-vector-search-provider.test.ts`      | register + searchSimilar；结果按 score 降序；topK 限制；语义相近的 chunk 排在不相关之前                                                                                                                          |
| `vector-knowledge-search-service.test.ts`       | Provider hits 正确映射为 RetrievalHit；找不到 chunkId 时容错跳过；`allowedSourceTypes` 过滤生效；provider 故障向上抛出以便上层 hybrid 记录降级                                                                   |
| `hybrid-knowledge-search-service.test.ts`       | 双路并行调用；RRF 融合正确；keyword 路失败时降级只返回 vector 结果；vector 路失败时降级只返回 keyword 结果；真实 vector provider 故障会记录 `failedRetrievers: ['vector']`；两路都失败时返回空结果；`limit` 截断 |
| `run-knowledge-retrieval.test.ts`（已有，扩充） | 用 HybridKnowledgeSearchService 替换默认 searchService 走完整 pipeline                                                                                                                                           |

所有测试遵循 TDD，先写失败测试，再写最小实现。

---

## 5. 文件导出

所有新增类和接口通过 `packages/knowledge/src/index.ts` 导出：

```ts
export type { VectorSearchHit, VectorSearchProvider } from './retrieval/vector-search-provider';
export { InMemoryVectorSearchProvider } from './retrieval/in-memory-vector-search-provider';
export { VectorKnowledgeSearchService } from './retrieval/vector-knowledge-search-service';
export { rrfFusion } from './retrieval/rrf-fusion';
export type { RetrievalFusionStrategy } from './retrieval/fusion-strategy';
export { RrfFusionStrategy } from './retrieval/fusion-strategy';
export type { HybridRetrievalEngineConfig, HybridRetrievalResult } from './retrieval/hybrid-retrieval-engine';
export { HybridRetrievalEngine } from './retrieval/hybrid-retrieval-engine';
export type { HybridSearchConfig } from './retrieval/hybrid-knowledge-search-service';
export { HybridKnowledgeSearchService } from './retrieval/hybrid-knowledge-search-service';
```

---

## 6. 不在本次范围

- Metadata Filtering 已在后续计划中补齐第一阶段：`RetrievalRequest.filters`、legacy `allowedSourceTypes` / `minTrustClass` 映射、keyword 前置过滤、vector filter pushdown 入口与 defensive filtering 已成为当前 runtime 边界；Hybrid Search 必须继续复用这些 filters，不能单独绕开权限和可信度约束。
- Rerank（已有 `RetrievalPostProcessor` hook，调用方按需注入）
- 生产级 OpenSearch / Chroma SDK client 创建、凭据读取、索引名配置和部署环境接线；Chroma 向量检索桥接已在 `packages/adapters` 中实现为 `ChromaVectorSearchProvider`，OpenSearch-like 全文检索桥接已实现为 `OpenSearchKeywordSearchProvider`
- BM25 实现（当前 `DefaultKnowledgeSearchService` 的 TF 打分充当 Keyword Search）

## 7. 全来源统一入口差距

统一知识入口当前依赖 `RetrievalRequest` / `RetrievalHit` / `KnowledgeSource` / `KnowledgeChunk` 这些 contract，以及 `sourceType`、`trustClass`、metadata filters 做范围约束。现状不是“所有来源都已经接入”，而是“统一 contract 已具备承载能力，部分来源仍需 ingestion 接线核对”。

详细接线状态以 [source-ingestion-status.md](/docs/packages/knowledge/source-ingestion-status.md) 为准；Hybrid Search 设计文档只记录检索侧边界。

| 来源           | 当前状态                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| repo docs      | `repo-docs` 已在 retrieval/runtime schema、测试和本地 ingestion 中使用，是当前最明确的来源类型                                                                                                                                                                   |
| workspace docs | `workspace-docs` 已在 retrieval/runtime schema 中声明，本地 ingestion 已覆盖 README 与项目规范；不代表所有 workspace docs 已接入                                                                                                                                 |
| agent skills   | 不新增独立 `agent-skill` sourceType；`.agents/skills/*/SKILL.md` 进入 Hybrid Search 时复用 `workspace-docs` / `repo-docs` + `metadata.docType=agent-skill`，运行时 skill manifest 复用 `connector-manifest` 或 `catalog-sync` + `metadata.docType=runtime-skill` |
| user-upload    | `user-upload` 已在 retrieval/runtime schema 和测试数据中出现；仍需核对上传文档 ingestion、权限 metadata、searchable 状态是否进入统一 pipeline                                                                                                                    |
| connector 内容 | `connector-manifest`、`catalog-sync` 已在 schema 中声明；本地只覆盖部分 manifest，connector 同步内容是否进入 knowledge indexing 仍需逐源核对                                                                                                                     |
| web curated    | `web-curated` 已在 retrieval/runtime schema 中声明；外部资料接入、trustClass 和过滤 metadata 仍需按来源补测试                                                                                                                                                    |

新增来源进入 Hybrid Search 的最低条件：先定义或复用 `sourceType`，写入 `KnowledgeSource` / `KnowledgeChunk`，补齐 `trustClass` 和 filter metadata，证明 keyword/vector/hybrid 三条路径不会绕过过滤。

---

## 8. 扩展点

| 场景                       | 方式                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 接入 Chroma + embedding    | 使用 `packages/adapters` 的 `ChromaVectorSearchProvider`，注入 `VectorKnowledgeSearchService`                                      |
| 接入 Rerank                | 实现 `RetrievalPostProcessor`，注入 `pipeline.postProcessor`                                                                       |
| 扩展为三路融合             | `HybridKnowledgeSearchService` 可改为接受 `KnowledgeSearchService[]` 数组                                                          |
| BM25 / OpenSearch 全文检索 | 使用 `packages/adapters` 的 `OpenSearchKeywordSearchProvider` 或实现新的 keyword retriever / `KnowledgeSearchService`，注入 Hybrid |
