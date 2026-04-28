# Hybrid Search 设计文档

状态：completed  
文档类型：reference  
适用范围：`packages/knowledge/src/retrieval/`  
最后核对：2026-04-28

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
  hybrid-knowledge-search-service.ts       ← 新增：组合两路 service + 调用 RRF
```

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
 * 失败时 throw，由 VectorKnowledgeSearchService 捕获并处理降级。
 */
export interface VectorSearchProvider {
  searchSimilar(query: string, topK: number): Promise<VectorSearchHit[]>;
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

1. 调用 `provider.searchSimilar(request.query, request.limit ?? 5)`
2. 用 `chunkId` 从 `chunkRepository` 取完整 chunk 数据
3. 过滤无法找到对应 chunk 或 source 的命中（数据不一致时容错）
4. 应用 `allowedSourceTypes` 过滤（与 `DefaultKnowledgeSearchService` 保持一致）
5. 按 provider 返回的 score 降序排列，返回 `RetrievalResult`

**`limit` 语义**：`VectorKnowledgeSearchService` 将 `request.limit` 作为 provider topK 传入，即单路最多返回 `limit` 个结果。`HybridKnowledgeSearchService` 在 RRF 融合后再次按 `request.limit` 截断最终结果（双路各返回 `limit` 个，融合后最多 `2×limit` 个候选，再取前 `limit` 个）。

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

### 3-5. InMemoryVectorSearchProvider

```ts
// packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts

class InMemoryVectorSearchProvider implements VectorSearchProvider {
  /**
   * 注册 chunk 的文本内容，内部自动计算 n-gram 向量。
   * 测试/demo 中替代真实 embedding。
   */
  register(chunkId: string, content: string): void;

  searchSimilar(query: string, topK: number): Promise<VectorSearchHit[]>;
}
```

内部向量化方案：bigram（字符二元组）频率向量 + 余弦相似度。

- 不依赖任何 LLM 或外部服务
- 对语义接近的中英文内容有一定区分度（足够用于测试断言）
- 生产环境换成真实 embedding provider 无需改动上游代码

---

## 4. 测试覆盖

| 测试文件                                        | 覆盖内容                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rrf-fusion.test.ts`                            | 单路传入、双路融合；同 chunkId 在两路均出现时分数高于只出现一路；k 参数影响；空输入                                                              |
| `in-memory-vector-search-provider.test.ts`      | register + searchSimilar；结果按 score 降序；topK 限制；语义相近的 chunk 排在不相关之前                                                          |
| `vector-knowledge-search-service.test.ts`       | Provider hits 正确映射为 RetrievalHit；找不到 chunkId 时容错跳过；`allowedSourceTypes` 过滤生效                                                  |
| `hybrid-knowledge-search-service.test.ts`       | 双路并行调用；RRF 融合正确；keyword 路失败时降级只返回 vector 结果；vector 路失败时降级只返回 keyword 结果；两路都失败时返回空结果；`limit` 截断 |
| `run-knowledge-retrieval.test.ts`（已有，扩充） | 用 HybridKnowledgeSearchService 替换默认 searchService 走完整 pipeline                                                                           |

所有测试遵循 TDD，先写失败测试，再写最小实现。

---

## 5. 文件导出

所有新增类和接口通过 `packages/knowledge/src/index.ts` 导出：

```ts
export type { VectorSearchHit, VectorSearchProvider } from './retrieval/vector-search-provider';
export { InMemoryVectorSearchProvider } from './retrieval/in-memory-vector-search-provider';
export { VectorKnowledgeSearchService } from './retrieval/vector-knowledge-search-service';
export { rrfFusion } from './retrieval/rrf-fusion';
export type { HybridSearchConfig } from './retrieval/hybrid-knowledge-search-service';
export { HybridKnowledgeSearchService } from './retrieval/hybrid-knowledge-search-service';
```

---

## 6. 不在本次范围

- Metadata Filtering 扩展（留到后续，`RetrievalRequest` 字段不变）
- Rerank（已有 `RetrievalPostProcessor` hook，调用方按需注入）
- Chroma / OpenAI embedding 的真实接入（在 `packages/adapters` 中实现 `VectorSearchProvider`）
- BM25 实现（当前 `DefaultKnowledgeSearchService` 的 TF 打分充当 Keyword Search）

---

## 7. 扩展点

| 场景                    | 方式                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------- |
| 接入 Chroma + embedding | 在 `packages/adapters` 实现 `VectorSearchProvider`，注入 `VectorKnowledgeSearchService` |
| 接入 Rerank             | 实现 `RetrievalPostProcessor`，注入 `pipeline.postProcessor`                            |
| 扩展为三路融合          | `HybridKnowledgeSearchService` 可改为接受 `KnowledgeSearchService[]` 数组               |
| BM25 全文检索           | 实现新的 `KnowledgeSearchService`，替换 `keywordService` 参数传入 Hybrid                |
