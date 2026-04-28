# Knowledge Hybrid Search Implementation Plan

状态：completed
文档类型：plan
适用范围：`packages/knowledge/src/retrieval/`
最后核对：2026-04-28

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `packages/knowledge` 中实现 Hybrid Search（Keyword + Vector + RRF），通过 `HybridKnowledgeSearchService` 替换 `searchService` 注入点，无需改动 pipeline 主链。

**Architecture:** `HybridKnowledgeSearchService` 并行调用 `DefaultKnowledgeSearchService`（关键词路）和 `VectorKnowledgeSearchService`（向量路），通过 RRF 融合两路 `RetrievalHit[]` 排序后截断至 `limit`。向量层通过 `VectorSearchProvider` 接口注入，`InMemoryVectorSearchProvider` 提供可离线测试的 bigram 余弦相似度实现。降级策略：任一路失败时只用另一路，两路都失败返回空结果不 throw。

**Tech Stack:** TypeScript, Vitest, Zod（已有），无新外部依赖

---

## 文件映射

| 文件                                                                   | 操作 | 说明                                                             |
| ---------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `packages/knowledge/src/retrieval/vector-search-provider.ts`           | 新建 | `VectorSearchProvider` 接口 + `VectorSearchHit` 类型             |
| `packages/knowledge/src/retrieval/rrf-fusion.ts`                       | 新建 | 纯函数 `rrfFusion(rankLists, k?)`                                |
| `packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts` | 新建 | bigram 余弦相似度内存实现                                        |
| `packages/knowledge/src/retrieval/vector-knowledge-search-service.ts`  | 新建 | `VectorKnowledgeSearchService implements KnowledgeSearchService` |
| `packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts`  | 新建 | `HybridKnowledgeSearchService implements KnowledgeSearchService` |
| `packages/knowledge/src/index.ts`                                      | 修改 | 追加新增类型和类的导出                                           |
| `packages/knowledge/test/rrf-fusion.test.ts`                           | 新建 | RRF 纯函数单元测试                                               |
| `packages/knowledge/test/in-memory-vector-search-provider.test.ts`     | 新建 | 内存 provider 测试                                               |
| `packages/knowledge/test/vector-knowledge-search-service.test.ts`      | 新建 | Vector service 测试                                              |
| `packages/knowledge/test/hybrid-knowledge-search-service.test.ts`      | 新建 | Hybrid service 测试（含降级）                                    |
| `packages/knowledge/test/run-knowledge-retrieval.test.ts`              | 修改 | 追加 Hybrid pipeline 集成测试                                    |

---

## Task 1：VectorSearchProvider 接口

**Files:**

- Create: `packages/knowledge/src/retrieval/vector-search-provider.ts`

- [ ] **Step 1：创建接口文件**

```ts
// packages/knowledge/src/retrieval/vector-search-provider.ts

/** 单个向量搜索命中结果 */
export interface VectorSearchHit {
  chunkId: string;
  /** 余弦相似度，范围 [0, 1] */
  score: number;
}

/**
 * 向量检索注入点。
 * 实现此接口：embed query + 计算相似度 + 返回 topK 结果。
 * 失败时 throw，由 VectorKnowledgeSearchService 捕获处理降级。
 */
export interface VectorSearchProvider {
  searchSimilar(query: string, topK: number): Promise<VectorSearchHit[]>;
}
```

- [ ] **Step 2：确认文件可以被 TypeScript 识别**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误输出，退出码 0

- [ ] **Step 3：Commit**

```bash
git add packages/knowledge/src/retrieval/vector-search-provider.ts
git commit -m "feat(knowledge): add VectorSearchProvider interface"
```

---

## Task 2：RRF 融合纯函数（TDD）

**Files:**

- Create: `packages/knowledge/src/retrieval/rrf-fusion.ts`
- Create: `packages/knowledge/test/rrf-fusion.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// packages/knowledge/test/rrf-fusion.test.ts
import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';

import { rrfFusion } from '../src/retrieval/rrf-fusion';

function makeHit(chunkId: string, score: number): RetrievalHit {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    sourceId: 'source-1',
    title: 'Test',
    uri: '/test.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: `content for ${chunkId}`,
    score,
    citation: {
      sourceId: 'source-1',
      chunkId,
      title: 'Test',
      uri: '/test.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    }
  };
}

describe('rrfFusion', () => {
  it('returns empty array when given empty input', () => {
    expect(rrfFusion([])).toEqual([]);
  });

  it('returns empty array when all rank lists are empty', () => {
    expect(rrfFusion([[], []])).toEqual([]);
  });

  it('returns single list unchanged in order (scores replaced by RRF)', () => {
    const hits = [makeHit('a', 0.9), makeHit('b', 0.5), makeHit('c', 0.1)];
    const result = rrfFusion([hits]);
    expect(result.map(h => h.chunkId)).toEqual(['a', 'b', 'c']);
  });

  it('assigns higher RRF score to chunk appearing in both lists', () => {
    // chunk-shared 出现在两路，chunk-only-keyword/chunk-only-vector 各出现一路
    const keywordHits = [makeHit('chunk-shared', 0.9), makeHit('chunk-only-keyword', 0.8)];
    const vectorHits = [makeHit('chunk-shared', 0.85), makeHit('chunk-only-vector', 0.7)];
    const result = rrfFusion([keywordHits, vectorHits]);
    const sharedScore = result.find(h => h.chunkId === 'chunk-shared')!.score;
    const keywordOnlyScore = result.find(h => h.chunkId === 'chunk-only-keyword')!.score;
    const vectorOnlyScore = result.find(h => h.chunkId === 'chunk-only-vector')!.score;
    // 两路命中的 RRF 分数必须高于任一单路命中
    expect(sharedScore).toBeGreaterThan(keywordOnlyScore);
    expect(sharedScore).toBeGreaterThan(vectorOnlyScore);
  });

  it('de-duplicates chunks appearing in multiple lists', () => {
    const list1 = [makeHit('dup', 0.9), makeHit('unique1', 0.5)];
    const list2 = [makeHit('dup', 0.8), makeHit('unique2', 0.4)];
    const result = rrfFusion([list1, list2]);
    const dupHits = result.filter(h => h.chunkId === 'dup');
    expect(dupHits).toHaveLength(1);
    expect(result).toHaveLength(3);
  });

  it('higher k value reduces score differences between ranks', () => {
    const hits = [makeHit('a', 0.9), makeHit('b', 0.5)];
    const resultLowK = rrfFusion([[...hits]], 1);
    const resultHighK = rrfFusion([[...hits]], 1000);
    const diffLowK = resultLowK[0].score - resultLowK[1].score;
    const diffHighK = resultHighK[0].score - resultHighK[1].score;
    expect(diffLowK).toBeGreaterThan(diffHighK);
  });

  it('preserves hit metadata (content, citation, etc.) from first occurrence', () => {
    const hit = makeHit('chunk-1', 0.9);
    const result = rrfFusion([[hit]]);
    expect(result[0].content).toBe(hit.content);
    expect(result[0].citation).toEqual(hit.citation);
    expect(result[0].chunkId).toBe('chunk-1');
  });

  it('uses default k=60', () => {
    // 验证默认 k 行为：rank=1 时 RRF score = 1/(60+1) ≈ 0.0164
    const hits = [makeHit('only', 0.9)];
    const result = rrfFusion([hits]);
    expect(result[0].score).toBeCloseTo(1 / 61, 5);
  });
});
```

- [ ] **Step 2：运行测试确认全部失败**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/rrf-fusion.test.ts
```

Expected: 全部 FAIL（模块不存在）

- [ ] **Step 3：实现 rrfFusion**

```ts
// packages/knowledge/src/retrieval/rrf-fusion.ts
import type { RetrievalHit } from '@agent/knowledge';

/**
 * Reciprocal Rank Fusion。
 * 输入多路按 score 降序排列的 RetrievalHit[][] 数组。
 * 公式：rrfScore(chunk) = Σ(路) 1 / (k + rank)，rank 从 1 开始。
 * 同一 chunkId 在多路出现时自动去重，保留第一次出现的元数据。
 * 默认 k=60（文献标准值）。
 */
export function rrfFusion(rankLists: RetrievalHit[][], k = 60): RetrievalHit[] {
  const scoreMap = new Map<string, number>();
  const hitMap = new Map<string, RetrievalHit>();

  for (const list of rankLists) {
    list.forEach((hit, index) => {
      const rank = index + 1;
      const prev = scoreMap.get(hit.chunkId) ?? 0;
      scoreMap.set(hit.chunkId, prev + 1 / (k + rank));
      if (!hitMap.has(hit.chunkId)) {
        hitMap.set(hit.chunkId, hit);
      }
    });
  }

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chunkId, score]) => ({
      ...hitMap.get(chunkId)!,
      score
    }));
}
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/rrf-fusion.test.ts
```

Expected: 7 tests passed

- [ ] **Step 5：TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误

- [ ] **Step 6：Commit**

```bash
git add packages/knowledge/src/retrieval/rrf-fusion.ts packages/knowledge/test/rrf-fusion.test.ts
git commit -m "feat(knowledge): add rrfFusion pure function with tests"
```

---

## Task 3：InMemoryVectorSearchProvider（TDD）

**Files:**

- Create: `packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts`
- Create: `packages/knowledge/test/in-memory-vector-search-provider.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// packages/knowledge/test/in-memory-vector-search-provider.test.ts
import { describe, expect, it } from 'vitest';

import { InMemoryVectorSearchProvider } from '../src/retrieval/in-memory-vector-search-provider';

describe('InMemoryVectorSearchProvider', () => {
  it('returns empty array when no chunks registered', async () => {
    const provider = new InMemoryVectorSearchProvider();
    const result = await provider.searchSimilar('anything', 5);
    expect(result).toEqual([]);
  });

  it('returns results in descending score order', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('chunk-a', 'retrieval augmented generation RAG pipeline');
    provider.register('chunk-b', 'typescript javascript programming language');
    provider.register('chunk-c', 'retrieval search query ranking relevance');

    const result = await provider.searchSimilar('retrieval pipeline', 5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('respects topK limit', async () => {
    const provider = new InMemoryVectorSearchProvider();
    for (let i = 0; i < 10; i++) {
      provider.register(`chunk-${i}`, `content about retrieval for item ${i}`);
    }
    const result = await provider.searchSimilar('retrieval', 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('places semantically similar chunk before unrelated chunk', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('relevant', 'knowledge retrieval search pipeline query');
    provider.register('unrelated', 'banana apple fruit orange mango');

    const result = await provider.searchSimilar('retrieval knowledge search', 5);
    const relevantIdx = result.findIndex(h => h.chunkId === 'relevant');
    const unrelatedIdx = result.findIndex(h => h.chunkId === 'unrelated');
    // relevant 必须排在 unrelated 前面（或 unrelated 因相似度为 0 不出现）
    expect(relevantIdx).not.toBe(-1);
    if (unrelatedIdx !== -1) {
      expect(relevantIdx).toBeLessThan(unrelatedIdx);
    }
  });

  it('scores are in range [0, 1]', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('chunk-1', 'some content for testing score range');
    const result = await provider.searchSimilar('some content', 5);
    for (const hit of result) {
      expect(hit.score).toBeGreaterThanOrEqual(0);
      expect(hit.score).toBeLessThanOrEqual(1);
    }
  });

  it('filters out zero-score results', async () => {
    const provider = new InMemoryVectorSearchProvider();
    provider.register('matching', 'knowledge base retrieval');
    provider.register('no-match', 'xyzabc123 completely different tokens');

    const result = await provider.searchSimilar('knowledge retrieval', 5);
    for (const hit of result) {
      expect(hit.score).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2：运行测试确认全部失败**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/in-memory-vector-search-provider.test.ts
```

Expected: 全部 FAIL（模块不存在）

- [ ] **Step 3：实现 InMemoryVectorSearchProvider**

```ts
// packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts
import type { VectorSearchHit, VectorSearchProvider } from './vector-search-provider';

/**
 * 基于 bigram（字符二元组）频率向量 + 余弦相似度的内存 VectorSearchProvider。
 * 不依赖任何 LLM 或外部服务，用于测试和 demo。
 * 生产环境换成真实 embedding provider 无需改动上游代码。
 */
export class InMemoryVectorSearchProvider implements VectorSearchProvider {
  private readonly store = new Map<string, number[]>();
  private vocabulary: string[] = [];

  register(chunkId: string, content: string): void {
    const bigrams = toBigrams(content);
    // 重新计算共同词汇表后重建所有向量
    for (const bigram of bigrams) {
      if (!this.vocabulary.includes(bigram)) {
        this.vocabulary.push(bigram);
      }
    }
    this.rebuildVectors(chunkId, content);
  }

  async searchSimilar(query: string, topK: number): Promise<VectorSearchHit[]> {
    if (this.store.size === 0) {
      return [];
    }

    const queryVec = this.toVector(query);
    const results: VectorSearchHit[] = [];

    for (const [chunkId, chunkVec] of this.store) {
      const score = cosineSimilarity(queryVec, chunkVec);
      if (score > 0) {
        results.push({ chunkId, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private rebuildVectors(newChunkId: string, newContent: string): void {
    // 将新 chunk 加入 store（使用当前词汇表）
    this.store.set(newChunkId, this.toVector(newContent));
  }

  private toVector(text: string): number[] {
    const bigrams = toBigrams(text);
    return this.vocabulary.map(bigram => bigrams.filter(b => b === bigram).length);
  }
}

function toBigrams(text: string): string[] {
  const normalized = text.toLowerCase();
  const bigrams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.push(normalized.slice(i, i + 2));
  }
  return bigrams;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/in-memory-vector-search-provider.test.ts
```

Expected: 6 tests passed

- [ ] **Step 5：TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误

- [ ] **Step 6：Commit**

```bash
git add packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts \
        packages/knowledge/test/in-memory-vector-search-provider.test.ts
git commit -m "feat(knowledge): add InMemoryVectorSearchProvider with bigram cosine similarity"
```

---

## Task 4：VectorKnowledgeSearchService（TDD）

**Files:**

- Create: `packages/knowledge/src/retrieval/vector-knowledge-search-service.ts`
- Create: `packages/knowledge/test/vector-knowledge-search-service.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// packages/knowledge/test/vector-knowledge-search-service.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeChunk, KnowledgeSource } from '@agent/knowledge';

import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../src/repositories/knowledge-source.repository';
import { InMemoryVectorSearchProvider } from '../src/retrieval/in-memory-vector-search-provider';
import { VectorKnowledgeSearchService } from '../src/retrieval/vector-knowledge-search-service';

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    id: 'source-1',
    sourceType: 'repo-docs',
    uri: '/test.md',
    title: 'Test Source',
    trustClass: 'internal',
    updatedAt: '2026-04-28T00:00:00.000Z',
    ...overrides
  };
}

function makeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    id: 'chunk-1',
    sourceId: 'source-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'retrieval augmented generation pipeline',
    searchable: true,
    updatedAt: '2026-04-28T00:00:00.000Z',
    ...overrides
  };
}

describe('VectorKnowledgeSearchService', () => {
  it('maps provider hits to RetrievalHit with full metadata', async () => {
    const source = makeSource();
    const chunk = makeChunk();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register(chunk.id, chunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval pipeline', limit: 5 });

    expect(result.hits).toHaveLength(1);
    const hit = result.hits[0];
    expect(hit.chunkId).toBe('chunk-1');
    expect(hit.sourceId).toBe('source-1');
    expect(hit.title).toBe('Test Source');
    expect(hit.uri).toBe('/test.md');
    expect(hit.content).toBe(chunk.content);
    expect(hit.score).toBeGreaterThan(0);
    expect(hit.citation.sourceId).toBe('source-1');
    expect(hit.citation.chunkId).toBe('chunk-1');
  });

  it('skips hits where chunk is not found in repository', async () => {
    const source = makeSource();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    // chunkRepo 里没有对应的 chunk
    const chunkRepo = new InMemoryKnowledgeChunkRepository([]);
    const provider: { searchSimilar: ReturnType<typeof vi.fn> } = {
      searchSimilar: vi.fn(async () => [{ chunkId: 'missing-chunk', score: 0.9 }])
    };

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'anything', limit: 5 });
    expect(result.hits).toHaveLength(0);
  });

  it('skips hits where source is not found for chunk', async () => {
    const chunk = makeChunk({ sourceId: 'orphan-source' });
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    // sourceRepo 没有 orphan-source
    const sourceRepo = new InMemoryKnowledgeSourceRepository([]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register(chunk.id, chunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval', limit: 5 });
    expect(result.hits).toHaveLength(0);
  });

  it('filters by allowedSourceTypes', async () => {
    const repoSource = makeSource({ id: 'src-repo', sourceType: 'repo-docs' });
    const uploadSource = makeSource({ id: 'src-upload', sourceType: 'user-upload', uri: '/upload.md' });
    const repoChunk = makeChunk({ id: 'c1', sourceId: 'src-repo', content: 'retrieval knowledge base search' });
    const uploadChunk = makeChunk({ id: 'c2', sourceId: 'src-upload', content: 'retrieval knowledge user file' });

    const sourceRepo = new InMemoryKnowledgeSourceRepository([repoSource, uploadSource]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([repoChunk, uploadChunk]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register('c1', repoChunk.content);
    provider.register('c2', uploadChunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({
      query: 'retrieval knowledge',
      limit: 5,
      allowedSourceTypes: ['repo-docs']
    });

    expect(result.hits.every(h => h.sourceType === 'repo-docs')).toBe(true);
  });

  it('returns hits sorted by provider score descending', async () => {
    const source = makeSource();
    const chunks = [
      makeChunk({ id: 'c1', content: 'retrieval augmented generation knowledge pipeline' }),
      makeChunk({ id: 'c2', content: 'retrieval search result ranking system' }),
      makeChunk({ id: 'c3', content: 'retrieval query preprocessing steps' })
    ];
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository(chunks);
    const provider = new InMemoryVectorSearchProvider();
    for (const c of chunks) {
      provider.register(c.id, c.content);
    }

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval knowledge generation', limit: 5 });

    for (let i = 1; i < result.hits.length; i++) {
      expect(result.hits[i - 1].score).toBeGreaterThanOrEqual(result.hits[i].score);
    }
  });

  it('total reflects actual number of hits returned', async () => {
    const source = makeSource();
    const chunk = makeChunk();
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);
    const provider = new InMemoryVectorSearchProvider();
    provider.register(chunk.id, chunk.content);

    const service = new VectorKnowledgeSearchService(provider, chunkRepo, sourceRepo);
    const result = await service.search({ query: 'retrieval', limit: 5 });
    expect(result.total).toBe(result.hits.length);
  });
});
```

- [ ] **Step 2：运行测试确认全部失败**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/vector-knowledge-search-service.test.ts
```

Expected: 全部 FAIL（模块不存在）

- [ ] **Step 3：实现 VectorKnowledgeSearchService**

```ts
// packages/knowledge/src/retrieval/vector-knowledge-search-service.ts
import type { KnowledgeSource, RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type {
  KnowledgeChunkRepository,
  KnowledgeSearchService,
  KnowledgeSourceRepository
} from '../contracts/knowledge-facade';
import type { VectorSearchProvider } from './vector-search-provider';

export class VectorKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly provider: VectorSearchProvider,
    private readonly chunkRepository: KnowledgeChunkRepository,
    private readonly sourceRepository: KnowledgeSourceRepository
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const topK = request.limit ?? 5;
    const providerHits = await this.provider.searchSimilar(request.query, topK);

    if (providerHits.length === 0) {
      return { hits: [], total: 0 };
    }

    const [chunks, sources] = await Promise.all([this.chunkRepository.list(), this.sourceRepository.list()]);
    const chunkMap = new Map(chunks.map(c => [c.id, c]));
    const sourceMap = new Map(sources.map(s => [s.id, s]));

    const hits: RetrievalHit[] = [];
    for (const providerHit of providerHits) {
      const chunk = chunkMap.get(providerHit.chunkId);
      if (!chunk) {
        continue;
      }
      const source = sourceMap.get(chunk.sourceId);
      if (!source) {
        continue;
      }
      if (request.allowedSourceTypes && !request.allowedSourceTypes.includes(source.sourceType)) {
        continue;
      }
      hits.push(toRetrievalHit(chunk, source, providerHit.score));
    }

    return { hits, total: hits.length };
  }
}

function toRetrievalHit(
  chunk: Awaited<ReturnType<KnowledgeChunkRepository['list']>>[number],
  source: KnowledgeSource,
  score: number
): RetrievalHit {
  return {
    chunkId: chunk.id,
    documentId: chunk.documentId,
    sourceId: source.id,
    title: source.title,
    uri: source.uri,
    sourceType: source.sourceType,
    trustClass: source.trustClass,
    content: chunk.content,
    score,
    citation: {
      sourceId: source.id,
      chunkId: chunk.id,
      title: source.title,
      uri: source.uri,
      quote: chunk.content,
      sourceType: source.sourceType,
      trustClass: source.trustClass
    }
  };
}
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/vector-knowledge-search-service.test.ts
```

Expected: 6 tests passed

- [ ] **Step 5：TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误

- [ ] **Step 6：Commit**

```bash
git add packages/knowledge/src/retrieval/vector-knowledge-search-service.ts \
        packages/knowledge/test/vector-knowledge-search-service.test.ts
git commit -m "feat(knowledge): add VectorKnowledgeSearchService with provider injection"
```

---

## Task 5：HybridKnowledgeSearchService（TDD）

**Files:**

- Create: `packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts`
- Create: `packages/knowledge/test/hybrid-knowledge-search-service.test.ts`

- [ ] **Step 1：写失败测试**

```ts
// packages/knowledge/test/hybrid-knowledge-search-service.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import { HybridKnowledgeSearchService } from '../src/retrieval/hybrid-knowledge-search-service';

function makeHit(chunkId: string, score: number): RetrievalHit {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    sourceId: 'source-1',
    title: 'Test',
    uri: '/test.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: `content ${chunkId}`,
    score,
    citation: {
      sourceId: 'source-1',
      chunkId,
      title: 'Test',
      uri: '/test.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    }
  };
}

function makeService(hits: RetrievalHit[], failWith?: Error): KnowledgeSearchService {
  return {
    search: vi.fn(async () => {
      if (failWith) {
        throw failWith;
      }
      return { hits, total: hits.length };
    })
  };
}

describe('HybridKnowledgeSearchService', () => {
  it('calls both keyword and vector services in parallel', async () => {
    const keywordHits = [makeHit('k1', 0.9)];
    const vectorHits = [makeHit('v1', 0.8)];
    const keywordService = makeService(keywordHits);
    const vectorService = makeService(vectorHits);

    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);
    await hybrid.search({ query: 'test', limit: 5 });

    expect(keywordService.search).toHaveBeenCalledOnce();
    expect(vectorService.search).toHaveBeenCalledOnce();
  });

  it('passes same request to both services', async () => {
    const keywordService = makeService([makeHit('k1', 0.9)]);
    const vectorService = makeService([makeHit('v1', 0.8)]);
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    await hybrid.search({ query: 'my query', limit: 3, allowedSourceTypes: ['repo-docs'] });

    expect(keywordService.search).toHaveBeenCalledWith({
      query: 'my query',
      limit: 3,
      allowedSourceTypes: ['repo-docs']
    });
    expect(vectorService.search).toHaveBeenCalledWith({
      query: 'my query',
      limit: 3,
      allowedSourceTypes: ['repo-docs']
    });
  });

  it('merges results with RRF and assigns new scores', async () => {
    const keywordHits = [makeHit('shared', 0.9), makeHit('k-only', 0.7)];
    const vectorHits = [makeHit('shared', 0.85), makeHit('v-only', 0.6)];
    const hybrid = new HybridKnowledgeSearchService(makeService(keywordHits), makeService(vectorHits));

    const result = await hybrid.search({ query: 'test', limit: 10 });

    expect(result.hits).toHaveLength(3); // shared, k-only, v-only
    const shared = result.hits.find(h => h.chunkId === 'shared')!;
    const kOnly = result.hits.find(h => h.chunkId === 'k-only')!;
    const vOnly = result.hits.find(h => h.chunkId === 'v-only')!;
    // shared 出现在两路，RRF 分数应高于单路
    expect(shared.score).toBeGreaterThan(kOnly.score);
    expect(shared.score).toBeGreaterThan(vOnly.score);
  });

  it('truncates to limit after RRF fusion', async () => {
    const keywordHits = [makeHit('k1', 0.9), makeHit('k2', 0.8), makeHit('k3', 0.7)];
    const vectorHits = [makeHit('v1', 0.9), makeHit('v2', 0.8), makeHit('v3', 0.7)];
    const hybrid = new HybridKnowledgeSearchService(makeService(keywordHits), makeService(vectorHits));

    const result = await hybrid.search({ query: 'test', limit: 2 });
    expect(result.hits).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('falls back to vector-only when keyword service fails', async () => {
    const vectorHits = [makeHit('v1', 0.9), makeHit('v2', 0.8)];
    const keywordService = makeService([], new Error('keyword failed'));
    const vectorService = makeService(vectorHits);
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(2);
    expect(result.hits[0].chunkId).toBe('v1');
    expect(result.hits[1].chunkId).toBe('v2');
  });

  it('falls back to keyword-only when vector service fails', async () => {
    const keywordHits = [makeHit('k1', 0.9), makeHit('k2', 0.8)];
    const keywordService = makeService(keywordHits);
    const vectorService = makeService([], new Error('vector failed'));
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(2);
    expect(result.hits.map(h => h.chunkId)).toEqual(['k1', 'k2']);
  });

  it('returns empty result when both services fail', async () => {
    const keywordService = makeService([], new Error('keyword failed'));
    const vectorService = makeService([], new Error('vector failed'));
    const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

    const result = await hybrid.search({ query: 'test', limit: 5 });
    expect(result.hits).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects custom rrfK config', async () => {
    // 当 k=1 时，rank=1 的 RRF score = 1/(1+1) = 0.5；k=60 时 ≈ 0.0164
    const keywordHits = [makeHit('chunk', 0.9)];
    const hybridLowK = new HybridKnowledgeSearchService(makeService(keywordHits), makeService([]), { rrfK: 1 });
    const hybridHighK = new HybridKnowledgeSearchService(makeService(keywordHits), makeService([]), { rrfK: 1000 });

    const resultLowK = await hybridLowK.search({ query: 'test', limit: 5 });
    const resultHighK = await hybridHighK.search({ query: 'test', limit: 5 });

    expect(resultLowK.hits[0].score).toBeGreaterThan(resultHighK.hits[0].score);
  });
});
```

- [ ] **Step 2：运行测试确认全部失败**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/hybrid-knowledge-search-service.test.ts
```

Expected: 全部 FAIL（模块不存在）

- [ ] **Step 3：实现 HybridKnowledgeSearchService**

```ts
// packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts
import type { RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../contracts/knowledge-facade';
import { rrfFusion } from './rrf-fusion';

export interface HybridSearchConfig {
  /** RRF 平滑系数，默认 60 */
  rrfK?: number;
}

export class HybridKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly keywordService: KnowledgeSearchService,
    private readonly vectorService: KnowledgeSearchService,
    private readonly config: HybridSearchConfig = {}
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const [keywordResult, vectorResult] = await Promise.allSettled([
      this.keywordService.search(request),
      this.vectorService.search(request)
    ]);

    const keywordHits = keywordResult.status === 'fulfilled' ? keywordResult.value.hits : [];
    const vectorHits = vectorResult.status === 'fulfilled' ? vectorResult.value.hits : [];

    const rankLists = [keywordHits, vectorHits].filter(list => list.length > 0);
    if (rankLists.length === 0) {
      return { hits: [], total: 0 };
    }

    const merged = rrfFusion(rankLists, this.config.rrfK).slice(0, limit);
    return { hits: merged, total: merged.length };
  }
}
```

- [ ] **Step 4：运行测试确认全部通过**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/hybrid-knowledge-search-service.test.ts
```

Expected: 8 tests passed

- [ ] **Step 5：TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误

- [ ] **Step 6：Commit**

```bash
git add packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts \
        packages/knowledge/test/hybrid-knowledge-search-service.test.ts
git commit -m "feat(knowledge): add HybridKnowledgeSearchService with RRF fusion and fallback"
```

---

## Task 6：更新 index.ts 导出

**Files:**

- Modify: `packages/knowledge/src/index.ts`

- [ ] **Step 1：追加导出（在已有 `knowledge-search-service` 导出之后）**

找到文件中的这一行：

```ts
export * from './retrieval/knowledge-search-service';
```

在其后追加：

```ts
export type { VectorSearchHit, VectorSearchProvider } from './retrieval/vector-search-provider';
export { InMemoryVectorSearchProvider } from './retrieval/in-memory-vector-search-provider';
export { VectorKnowledgeSearchService } from './retrieval/vector-knowledge-search-service';
export { rrfFusion } from './retrieval/rrf-fusion';
export type { HybridSearchConfig } from './retrieval/hybrid-knowledge-search-service';
export { HybridKnowledgeSearchService } from './retrieval/hybrid-knowledge-search-service';
```

- [ ] **Step 2：验证 root-exports 测试通过（检测公开 API 是否完整）**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/root-exports.test.ts
```

Expected: passed

- [ ] **Step 3：TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误

- [ ] **Step 4：Commit**

```bash
git add packages/knowledge/src/index.ts
git commit -m "feat(knowledge): export Hybrid Search public API from index.ts"
```

---

## Task 7：扩充 run-knowledge-retrieval 集成测试

**Files:**

- Modify: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [ ] **Step 1：在文件顶部已有 import 区域末尾追加新 import**

打开 `packages/knowledge/test/run-knowledge-retrieval.test.ts`，在已有 import 语句（`import { runKnowledgeRetrieval } ...` 那一行）之后追加：

```ts
import { InMemoryKnowledgeChunkRepository } from '../src/repositories/knowledge-chunk.repository';
import { InMemoryKnowledgeSourceRepository } from '../src/repositories/knowledge-source.repository';
import { DefaultKnowledgeSearchService } from '../src/retrieval/knowledge-search-service';
import { HybridKnowledgeSearchService } from '../src/retrieval/hybrid-knowledge-search-service';
import { InMemoryVectorSearchProvider } from '../src/retrieval/in-memory-vector-search-provider';
import { VectorKnowledgeSearchService } from '../src/retrieval/vector-knowledge-search-service';
```

- [ ] **Step 2：在文件末尾追加集成测试 describe 块**

```ts
describe('runKnowledgeRetrieval with HybridKnowledgeSearchService', () => {
  function buildHybridRuntime() {
    const source = {
      id: 'src-1',
      sourceType: 'repo-docs' as const,
      uri: '/guide.md',
      title: 'Guide',
      trustClass: 'internal' as const,
      updatedAt: '2026-04-28T00:00:00.000Z'
    };
    const chunk = {
      id: 'chunk-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'retrieval augmented generation pipeline knowledge base',
      searchable: true,
      updatedAt: '2026-04-28T00:00:00.000Z'
    };
    const sourceRepo = new InMemoryKnowledgeSourceRepository([source]);
    const chunkRepo = new InMemoryKnowledgeChunkRepository([chunk]);

    const vectorProvider = new InMemoryVectorSearchProvider();
    vectorProvider.register(chunk.id, chunk.content);

    const keywordService = new DefaultKnowledgeSearchService(sourceRepo, chunkRepo);
    const vectorService = new VectorKnowledgeSearchService(vectorProvider, chunkRepo, sourceRepo);
    const hybridService = new HybridKnowledgeSearchService(keywordService, vectorService);

    return { hybridService };
  }

  it('runs full pipeline with hybrid search and returns hits', async () => {
    const { hybridService } = buildHybridRuntime();

    const result = await runKnowledgeRetrieval({
      request: { query: 'retrieval pipeline', limit: 5 },
      searchService: hybridService
    });

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0].chunkId).toBe('chunk-1');
  });

  it('pipeline diagnostics are populated when hybrid search is used', async () => {
    const { hybridService } = buildHybridRuntime();

    const result = await runKnowledgeRetrieval({
      request: { query: 'knowledge base', limit: 3 },
      searchService: hybridService
    });

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics?.originalQuery).toBe('knowledge base');
    expect(result.diagnostics?.executedQueries).toEqual(expect.arrayContaining(['knowledge base']));
  });
});
```

- [ ] **Step 3：运行集成测试**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Expected: 所有原有测试 + 新增 2 个测试全部通过

- [ ] **Step 4：TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: 无错误

- [ ] **Step 5：Commit**

```bash
git add packages/knowledge/test/run-knowledge-retrieval.test.ts
git commit -m "test(knowledge): add pipeline integration test with HybridKnowledgeSearchService"
```

---

## Task 8：全量验证与文档更新

- [ ] **Step 1：运行全部 knowledge 测试**

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/
```

Expected: 所有测试通过（含 rrf-fusion、in-memory-vector、vector-service、hybrid-service、run-knowledge-retrieval）

- [ ] **Step 2：全量 TypeScript 检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: 两个检查均无错误

- [ ] **Step 3：更新 knowledge-retrieval-runtime.md**

在 `docs/packages/knowledge/knowledge-retrieval-runtime.md` 中的"已实现"列表里追加：

```markdown
- `VectorSearchProvider` 接口（`src/retrieval/vector-search-provider.ts`）
- `InMemoryVectorSearchProvider`（bigram 余弦相似度，`src/retrieval/in-memory-vector-search-provider.ts`）
- `VectorKnowledgeSearchService`（Provider + Repo 映射，`src/retrieval/vector-knowledge-search-service.ts`）
- `rrfFusion`（RRF 纯函数，`src/retrieval/rrf-fusion.ts`）
- `HybridKnowledgeSearchService`（双路并行 + RRF + 降级，`src/retrieval/hybrid-knowledge-search-service.ts`）
```

将 spec 文件状态从 `draft` 改为 `implemented`：

```bash
sed -i '' 's/状态：draft/状态：implemented/' docs/superpowers/specs/2026-04-28-knowledge-hybrid-search-design.md
```

- [ ] **Step 4：最终 Commit**

```bash
git add packages/knowledge/ docs/packages/knowledge/ docs/superpowers/specs/2026-04-28-knowledge-hybrid-search-design.md
git commit -m "feat(knowledge): implement Hybrid Search with Vector + Keyword + RRF fusion

- Add VectorSearchProvider interface
- Add InMemoryVectorSearchProvider (bigram cosine similarity, no external deps)
- Add VectorKnowledgeSearchService (maps provider hits to RetrievalHit)
- Add rrfFusion pure function (Reciprocal Rank Fusion, default k=60)
- Add HybridKnowledgeSearchService (parallel dual-path + fallback + limit truncation)
- Export all new APIs from packages/knowledge/src/index.ts
- Add integration test in run-knowledge-retrieval.test.ts
- Update docs to reflect implemented status"
```
