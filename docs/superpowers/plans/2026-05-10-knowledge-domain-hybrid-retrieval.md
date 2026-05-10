# Knowledge Domain Hybrid Retrieval Implementation Plan

状态：completed
文档类型：plan
适用范围：`apps/backend/agent-server/src/domains/knowledge`、`packages/knowledge`
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the unified backend Knowledge chat path use real keyword + vector hybrid retrieval with RRF fusion instead of vector-first fallback.

**Architecture:** Keep `packages/knowledge` as the SDK source of truth for hybrid semantics by reusing `HybridRetrievalEngine`. Split backend domain retrieval into small `KeywordRetriever` and `VectorRetriever` implementations that return SDK-owned `RetrievalHit` values, then keep `KnowledgeDomainSearchServiceAdapter` as a thin `KnowledgeSearchService` facade that assembles retrievers and normalizes diagnostics for current chat consumers.

**Tech Stack:** TypeScript, NestJS domain services, Vitest, `@agent/knowledge` `HybridRetrievalEngine`, existing `KnowledgeMemoryRepository` test fixtures.

## Implementation Status

完成时间：2026-05-10

Phase 1 已完成：backend knowledge domain chat retrieval 现在通过 `KnowledgeDomainKeywordRetriever` + `KnowledgeDomainVectorRetriever` 委托 `HybridRetrievalEngine` 执行真实 RRF fusion。adapter diagnostics 会按过滤后的有效 keyword/vector 命中推导 `retrievalMode`；vector embed/search 失败、vector hit 无法映射或被 request metadata filters 删除时，keyword 命中仍可返回且不会误报 hybrid。实施中同时补齐了 chunk metadata 契约：`DocumentChunkRecordSchema`、memory repository、Postgres save/list mapper、SDK ingestion mapper 与 `RetrievalHit.metadata` 映射都显式保留 `metadata`，并确保 domain 权威字段覆盖 chunk metadata 中的同名旧值。

下面的任务清单保留为本次实现的执行台账。

---

## Scope Check

This plan implements only Phase 1 from [Knowledge RAG Hardening Design](/docs/superpowers/specs/2026-05-10-knowledge-rag-hardening-design.md): real Hybrid Retrieval in `apps/backend/agent-server/src/domains/knowledge`.

It intentionally does not implement structured chunking, embedding quality gates, SDK observability, or eval metrics. Those remain separate plans because they touch different contracts and verification surfaces.

## File Structure

- Modify: `apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts`
  - Responsibility: prove the backend adapter always attempts keyword and vector retrieval when vector is configured, uses RRF fusion, keeps keyword fallback on vector failure, and reports diagnostics accurately.
- Create: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.retrievers.ts`
  - Responsibility: own backend-domain keyword and vector retriever implementations, repository chunk loading, scoring helpers, tenant resolution, HyDE query preparation, and mapping repository chunks to SDK `RetrievalHit`.
- Modify: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts`
  - Responsibility: become a thin facade that creates domain retrievers, delegates fusion to `HybridRetrievalEngine`, and returns compatibility diagnostics fields currently consumed by chat diagnostics/tests.
- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
  - Responsibility: document that the backend knowledge domain chat path now uses real keyword + vector fusion, while provider health/config status remains separate from per-query diagnostics.
- Modify: `docs/integration/knowledge-sdk-rag-rollout.md`
  - Responsibility: update rollout history/current status so it no longer implies the unified backend chat path is vector-first fallback.

## Task 1: Lock Current Bug With Failing Adapter Tests

**Files:**

- Modify: `apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts`
- Read: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts`

- [ ] **Step 1: Replace the vector-first test with a true hybrid test**

Replace the first `it('uses SDK embeddings and vector search before keyword fallback', ...)` block with this test:

```ts
  it('runs keyword and vector retrieval together before RRF fusion', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      embedText: vi.fn(async () => ({ embedding: [0.1, 0.2] })),
      search: vi.fn(async () => ({ hits: [{ id: 'chunk_vector', score: 0.91 }] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_hybrid',
      documentId: 'doc_vector',
      chunkId: 'chunk_vector',
      content: '完全不同的中文内容，不包含英文 planner route token。'
    });
    await seedDocument(repository, {
      baseId: 'kb_hybrid',
      documentId: 'doc_keyword',
      chunkId: 'chunk_keyword',
      content: 'planner route token should still be recovered by keyword retrieval'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'planner route token',
      filters: { knowledgeBaseIds: ['kb_hybrid'] },
      limit: 5
    });

    expect(runtime.runtime.embeddingProvider.embedText).toHaveBeenCalledWith({ text: 'planner route token' });
    expect(runtime.runtime.vectorStore.search).toHaveBeenCalledWith({
      embedding: [0.1, 0.2],
      topK: 5,
      filters: {
        knowledgeBaseId: 'kb_hybrid',
        tenantId: 'default',
        query: 'planner route token'
      }
    });
    expect(result.hits.map(hit => hit.chunkId)).toEqual(
      expect.arrayContaining(['chunk_vector', 'chunk_keyword'])
    );
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'hybrid',
      fallbackApplied: false,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      candidateCount: 2,
      finalHitCount: 2
    });
  });
```

- [ ] **Step 2: Update the no-vector-hits test expectation**

In `falls back to Chinese substring matching when vector search returns no hits`, keep the test name for now but change the diagnostics expectation to show that both retrievers were attempted and keyword produced the final hit:

```ts
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      candidateCount: 1,
      finalHitCount: 1
    });
```

- [ ] **Step 3: Update the embedding-failure expectation**

In `falls back to keyword retrieval when query embedding fails`, change the diagnostics expectation to:

```ts
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: ['vector'],
      finalHitCount: 1
    });
```

- [ ] **Step 4: Update the unmapped-vector-hit expectation**

In `marks fallback when vector hits cannot be mapped to repository chunks`, change the diagnostics expectation to:

```ts
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      preHitCount: 1,
      finalHitCount: 1
    });
```

- [ ] **Step 5: Add a keyword-only test for disabled SDK runtime**

Append this test before the closing `});` of the describe block:

```ts
  it('uses keyword-only retrieval when SDK runtime is disabled', async () => {
    const repository = new KnowledgeMemoryRepository();
    await seedDocument(repository, {
      baseId: 'kb_keyword_only',
      documentId: 'doc_keyword_only',
      chunkId: 'chunk_keyword_only',
      content: 'manual approval policy is searchable without vector runtime'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository).search({
      query: 'manual approval',
      filters: { knowledgeBaseIds: ['kb_keyword_only'] },
      limit: 5
    });

    expect(result.hits).toEqual([expect.objectContaining({ chunkId: 'chunk_keyword_only' })]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: false,
      enabledRetrievers: ['keyword'],
      retrievers: ['keyword'],
      failedRetrievers: [],
      finalHitCount: 1
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-domain-search-service.adapter.spec.ts
```

Expected: FAIL. The first test should fail because the current adapter returns vector hits immediately and does not include `chunk_keyword` or `retrievalMode: 'hybrid'`.

## Task 2: Extract Backend Domain Retrievers

**Files:**

- Create: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.retrievers.ts`
- Modify later: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts`

- [ ] **Step 1: Create the retriever module**

Create `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.retrievers.ts` with this full content:

```ts
import type { KnowledgeRetriever, RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { DocumentChunkRecord, KnowledgeDocumentRecord } from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { HyDeProvider } from './knowledge-hyde.provider';

interface IndexedChunk {
  document: KnowledgeDocumentRecord;
  chunk: DocumentChunkRecord;
}

export interface KnowledgeDomainVectorRetrieverStats {
  rawHitCount: number;
  mappedHitCount: number;
}

export class KnowledgeDomainKeywordRetriever implements KnowledgeRetriever {
  readonly id = 'keyword' as const;

  constructor(private readonly repository: KnowledgeRepository) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const indexedChunks = await loadSearchableChunks(this.repository, request.filters?.knowledgeBaseIds ?? []);
    const hits = indexedChunks
      .map(({ document, chunk }) => toRetrievalHit(document, chunk, request.query))
      .filter(hit => hit.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return {
      hits,
      total: hits.length
    };
  }
}

export class KnowledgeDomainVectorRetriever implements KnowledgeRetriever {
  readonly id = 'vector' as const;

  private lastStats: KnowledgeDomainVectorRetrieverStats = {
    rawHitCount: 0,
    mappedHitCount: 0
  };

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime: Extract<KnowledgeSdkRuntimeProviderValue, { enabled: true }>,
    private readonly hydeProvider?: HyDeProvider
  ) {}

  getLastStats(): KnowledgeDomainVectorRetrieverStats {
    return { ...this.lastStats };
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const knowledgeBaseIds = request.filters?.knowledgeBaseIds ?? [];
    if (knowledgeBaseIds.length === 0) {
      this.lastStats = { rawHitCount: 0, mappedHitCount: 0 };
      return { hits: [], total: 0 };
    }

    const indexedChunks = await loadSearchableChunks(this.repository, knowledgeBaseIds);
    const queryForEmbedding = this.hydeProvider
      ? await this.hydeProvider.generateHypotheticalAnswer(request.query)
      : request.query;
    const embedding = await this.sdkRuntime.runtime.embeddingProvider.embedText({ text: queryForEmbedding });
    const vectorResults = await Promise.all(
      knowledgeBaseIds.map(async knowledgeBaseId =>
        this.sdkRuntime.runtime.vectorStore.search({
          embedding: embedding.embedding,
          topK: limit,
          filters: {
            knowledgeBaseId,
            tenantId: resolveTenantId(indexedChunks, knowledgeBaseId),
            query: request.query
          }
        })
      )
    );
    const rawHits = vectorResults.flatMap(result => result.hits);
    const chunkById = new Map(indexedChunks.map(item => [item.chunk.id, item]));
    const hits = rawHits
      .map(hit => {
        const indexedChunk = chunkById.get(hit.id);
        if (!indexedChunk) {
          return undefined;
        }
        return toRetrievalHit(indexedChunk.document, indexedChunk.chunk, request.query, hit.score);
      })
      .filter(isDefined)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    this.lastStats = {
      rawHitCount: rawHits.length,
      mappedHitCount: hits.length
    };

    return {
      hits,
      total: hits.length
    };
  }
}

export async function loadSearchableChunks(
  repository: KnowledgeRepository,
  knowledgeBaseIds: string[]
): Promise<IndexedChunk[]> {
  const documents = (await Promise.all(knowledgeBaseIds.map(baseId => repository.listDocumentsForBase(baseId)))).flat();

  return (
    await Promise.all(
      documents.filter(isSearchableDocument).map(async document => {
        const chunks = await repository.listChunks(document.id);
        return chunks.filter(isSearchableChunk).map(chunk => ({ document, chunk }));
      })
    )
  ).flat();
}

export function toRetrievalHit(
  document: KnowledgeDocumentRecord,
  chunk: DocumentChunkRecord,
  query: string,
  score = scoreChunk(chunk.content, query)
): RetrievalHit {
  const quote = chunk.content.trim();
  return {
    chunkId: chunk.id,
    documentId: document.id,
    sourceId: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    title: document.title,
    uri: document.objectKey,
    sourceType: document.sourceType,
    trustClass: 'internal',
    content: quote,
    score,
    metadata: {
      knowledgeBaseId: document.knowledgeBaseId,
      workspaceId: document.workspaceId,
      filename: document.filename,
      ordinal: chunk.ordinal
    },
    citation: {
      sourceId: document.id,
      chunkId: chunk.id,
      title: document.title,
      uri: document.objectKey,
      quote,
      sourceType: document.sourceType,
      trustClass: 'internal'
    }
  };
}

export function scoreChunk(content: string, query: string): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return 0;
  }
  const contentTerms = new Set(tokenize(content));
  const matches = queryTerms.filter(term => contentTerms.has(term)).length;
  const tokenScore = matches / queryTerms.length;
  return Math.max(tokenScore, scoreChineseSubstring(content, query));
}

function scoreChineseSubstring(content: string, query: string): number {
  const terms = toChineseSearchTerms(query);
  if (terms.length === 0) {
    return 0;
  }
  const normalizedContent = content.toLowerCase();
  const matches = terms.filter(term => normalizedContent.includes(term)).length;
  const score = matches / terms.length;
  return matches >= 2 && score >= 0.4 ? score : 0;
}

function isSearchableDocument(document: KnowledgeDocumentRecord): boolean {
  return document.status === 'ready';
}

function isSearchableChunk(chunk: DocumentChunkRecord): boolean {
  return (
    chunk.content.trim().length > 0 &&
    (chunk.keywordIndexStatus === 'succeeded' || chunk.vectorIndexStatus === 'succeeded')
  );
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map(term => term.trim())
    .filter(term => term.length > 1);
}

function toChineseSearchTerms(value: string): string[] {
  const compact = value
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5]+/gu, '')
    .trim();
  if (compact.length < 2) {
    return [];
  }
  if (compact.length === 2) {
    return [compact];
  }
  return Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2));
}

function resolveTenantId(indexedChunks: IndexedChunk[], knowledgeBaseId: string): string | undefined {
  return indexedChunks.find(item => item.document.knowledgeBaseId === knowledgeBaseId)?.document.workspaceId;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
```

- [ ] **Step 2: Run backend typecheck to expose unused/private issues**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: FAIL is acceptable at this step if the new file exposes type mismatches. Do not proceed until errors are understood.

## Task 3: Delegate Backend Adapter to HybridRetrievalEngine

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts`
- Read: `packages/knowledge/src/retrieval/hybrid-retrieval-engine.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts`

- [ ] **Step 1: Replace adapter implementation with a thin facade**

Replace `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts` with this full content:

```ts
import { HybridRetrievalEngine, type KnowledgeSearchService, type RetrievalRequest, type RetrievalResult } from '@agent/knowledge';

import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { HyDeProvider } from './knowledge-hyde.provider';
import {
  KnowledgeDomainKeywordRetriever,
  KnowledgeDomainVectorRetriever,
  type KnowledgeDomainVectorRetrieverStats
} from './knowledge-domain-search-service.retrievers';

interface RetrievalDiagnostics {
  retrievalMode: 'hybrid' | 'keyword-only' | 'vector-only' | 'none';
  fallbackApplied: boolean;
  enabledRetrievers: Array<'keyword' | 'vector'>;
  failedRetrievers: Array<'keyword' | 'vector'>;
  fusionStrategy: 'rrf';
  prefilterApplied: boolean;
  candidateCount: number;
  retrievers?: Array<'keyword' | 'vector'>;
  preHitCount?: number;
  finalHitCount?: number;
}

interface KnowledgeDomainSearchResult extends RetrievalResult {
  diagnostics: RetrievalDiagnostics;
}

export class KnowledgeDomainSearchServiceAdapter implements KnowledgeSearchService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime?: KnowledgeSdkRuntimeProviderValue,
    private readonly hydeProvider?: HyDeProvider
  ) {}

  async search(request: RetrievalRequest): Promise<KnowledgeDomainSearchResult> {
    const keywordRetriever = new KnowledgeDomainKeywordRetriever(this.repository);

    if (!this.sdkRuntime?.enabled) {
      const keywordResult = await keywordRetriever.retrieve(request);
      return {
        ...keywordResult,
        diagnostics: {
          retrievalMode: keywordResult.hits.length > 0 ? 'keyword-only' : 'none',
          fallbackApplied: false,
          enabledRetrievers: ['keyword'],
          retrievers: ['keyword'],
          failedRetrievers: [],
          fusionStrategy: 'rrf',
          prefilterApplied: hasPrefilter(request),
          candidateCount: keywordResult.hits.length,
          preHitCount: 0,
          finalHitCount: keywordResult.hits.length
        }
      };
    }

    const vectorRetriever = new KnowledgeDomainVectorRetriever(this.repository, this.sdkRuntime, this.hydeProvider);
    const engine = new HybridRetrievalEngine([keywordRetriever, vectorRetriever]);
    const result = await engine.retrieve(request);
    const vectorStats = vectorRetriever.getLastStats();

    return {
      hits: result.hits,
      total: result.total,
      diagnostics: {
        retrievalMode: result.diagnostics.retrievalMode,
        fallbackApplied: shouldMarkFallbackApplied({
          diagnostics: result.diagnostics,
          vectorStats
        }),
        enabledRetrievers: result.diagnostics.enabledRetrievers,
        retrievers: result.diagnostics.enabledRetrievers,
        failedRetrievers: result.diagnostics.failedRetrievers,
        fusionStrategy: result.diagnostics.fusionStrategy,
        prefilterApplied: result.diagnostics.prefilterApplied,
        candidateCount: result.diagnostics.candidateCount,
        preHitCount: vectorStats.rawHitCount,
        finalHitCount: result.hits.length
      }
    };
  }
}

function shouldMarkFallbackApplied(input: {
  diagnostics: {
    retrievalMode: RetrievalDiagnostics['retrievalMode'];
    failedRetrievers: Array<'keyword' | 'vector'>;
  };
  vectorStats: KnowledgeDomainVectorRetrieverStats;
}): boolean {
  if (input.diagnostics.failedRetrievers.includes('vector')) {
    return true;
  }
  if (input.vectorStats.rawHitCount > input.vectorStats.mappedHitCount) {
    return true;
  }
  return input.diagnostics.retrievalMode === 'keyword-only';
}

function hasPrefilter(request: RetrievalRequest): boolean {
  return Boolean(request.filters || request.allowedSourceTypes?.length || request.minTrustClass);
}
```

- [ ] **Step 2: Run the targeted adapter test**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-domain-search-service.adapter.spec.ts
```

Expected: PASS. If ordering differs because RRF puts a shared or vector hit first, assert with `arrayContaining` only where order is not the behavior under test.

- [ ] **Step 3: Run backend TypeScript check**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 4: Preserve Diagnostics Contract With Focused Assertions

**Files:**

- Modify: `apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts`

- [ ] **Step 1: Add a fusion preference test**

Append this test before the describe block closes:

```ts
  it('boosts chunks returned by both keyword and vector retrievers through RRF', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      search: vi.fn(async () => ({
        hits: [
          { id: 'chunk_shared', score: 0.6 },
          { id: 'chunk_vector_only', score: 0.99 }
        ]
      }))
    });
    await seedDocument(repository, {
      baseId: 'kb_rrf',
      documentId: 'doc_shared',
      chunkId: 'chunk_shared',
      content: 'shared policy appears in keyword retrieval'
    });
    await seedDocument(repository, {
      baseId: 'kb_rrf',
      documentId: 'doc_vector_only',
      chunkId: 'chunk_vector_only',
      content: 'semantic-only content'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'shared policy',
      filters: { knowledgeBaseIds: ['kb_rrf'] },
      limit: 5
    });

    expect(result.hits[0]?.chunkId).toBe('chunk_shared');
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      finalHitCount: 2
    });
  });
```

- [ ] **Step 2: Run the targeted adapter test again**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-domain-search-service.adapter.spec.ts
```

Expected: PASS.

## Task 5: Update Documentation

**Files:**

- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/integration/knowledge-sdk-rag-rollout.md`

- [ ] **Step 1: Update retrieval runtime backend status**

In `docs/packages/knowledge/knowledge-retrieval-runtime.md`, add this paragraph after the opening backend host status paragraph:

```md
Unified backend Knowledge Chat now uses the same hybrid retrieval semantics for the product chat path: the domain adapter builds a repository-backed keyword retriever and an SDK-runtime vector retriever, runs them through `HybridRetrievalEngine`, and reports per-query diagnostics from the fused result. Vector unavailability, embedding failure, or unmapped vector hits degrade to keyword-only diagnostics without skipping keyword retrieval.
```

- [ ] **Step 2: Update rollout current conclusion**

In `docs/integration/knowledge-sdk-rag-rollout.md`, add this bullet under “当前结论” after the paragraph that starts `后端 Chat API`:

```md
- Unified backend Chat uses real hybrid retrieval when SDK runtime is enabled: repository keyword hits and vector hits are fused through the Knowledge SDK hybrid engine. Keyword retrieval is still available when vector runtime is disabled or degraded, and per-query diagnostics report the effective retrieval mode.
```

- [ ] **Step 3: Scan docs for stale vector-first wording**

Run:

```bash
rg -n "vector-first|向量优先|fallback keyword|keyword fallback|vector search returns no hits|向量.*fallback" docs apps/backend/agent-server/src/domains/knowledge apps/backend/agent-server/test/knowledge-domain
```

Expected: remaining hits are either test names that were deliberately kept for compatibility or historical docs marked as history. Update any current docs that still describe vector-first fallback as the real backend behavior.

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 6: Final Verification

**Files:**

- Verify all files changed by this plan.

- [ ] **Step 1: Run focused backend adapter test**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-domain-search-service.adapter.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run SDK hybrid tests to prove reused engine behavior is still stable**

Run:

```bash
pnpm --filter @agent/knowledge test -- hybrid-knowledge-search-service.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run backend TypeScript check**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.adapter.ts apps/backend/agent-server/src/domains/knowledge/rag/knowledge-domain-search-service.retrievers.ts apps/backend/agent-server/test/knowledge-domain/knowledge-domain-search-service.adapter.spec.ts docs/packages/knowledge/knowledge-retrieval-runtime.md docs/integration/knowledge-sdk-rag-rollout.md
```

Expected: diff only contains the hybrid retrieval implementation, focused tests, and documentation updates from this plan.
