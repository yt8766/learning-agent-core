# Knowledge Metadata Filtering 第一阶段执行记录

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-30

> 本文档最初是执行计划，当前已更新为第一阶段执行记录。下方保留 TDD 步骤、测试片段和实现说明，用于说明当时的 red/green 推进路径；checkbox 表示对应步骤已经执行或由后续等价验证覆盖。

**Goal:** Add first-class metadata filtering to `packages/knowledge` so filters are resolved before retrieval, applied consistently across keyword/vector/hybrid search, and observable in diagnostics.

**Architecture:** Add schema-first `KnowledgeRetrievalFilters` to the stable retrieval contract, normalize legacy fields into resolved filters, and centralize matching in one retrieval helper. Keyword search filters before scoring; vector search accepts filter pushdown options and still applies local defensive filtering; hybrid search filters before RRF fusion; runtime diagnostics reports filter drops.

**Tech Stack:** TypeScript, Zod, Vitest, `@agent/knowledge`, pnpm workspace scripts.

---

## 执行结果

- 已完成统一 `RetrievalRequest.filters` contract、chunk / hit metadata、legacy `allowedSourceTypes` / `minTrustClass` 合并，以及 `resolveKnowledgeRetrievalFilters()`。
- 已完成 keyword pre-filter、vector filter pushdown + defensive filter、hybrid pre-fusion defensive filter、runtime `pre-merge-defensive` diagnostics。
- 已完成 Chroma vector search adapter 对 resolved filters 的 `where` pushdown 映射。
- 已完成 Small-to-Big 第一阶段的后续接线，context expansion 复用同一份 resolved filters，不扩大检索范围。
- 最新聚焦验证通过：`packages/knowledge` 9 个检索相关测试文件 74 条测试通过；`packages/adapters` Chroma/root export 2 个测试文件 10 条测试通过；`packages/knowledge` 与 `packages/adapters` TypeScript 检查通过；`pnpm check:docs` 通过。
- 最新仓库级 `pnpm verify` 仍被本轮范围外 Prettier 红灯阻断，阻断文件见本轮交付记录；metadata filtering / Small-to-Big 相关文件已不在 Prettier 红灯列表中。

## File Map

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts` — add filter schemas, chunk metadata, and request `filters`.
- Modify: `packages/knowledge/src/contracts/types/knowledge-retrieval.types.ts` — export inferred filter types.
- Create: `packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts` — resolver, trust ranking, source/chunk/hit matchers, diagnostics helpers.
- Modify: `packages/knowledge/src/retrieval/knowledge-search-service.ts` — keyword pre-filter before scoring.
- Modify: `packages/knowledge/src/retrieval/vector-search-provider.ts` — add provider options with filters.
- Modify: `packages/knowledge/src/retrieval/vector-knowledge-search-service.ts` — pass filters to provider and defensively filter returned hits.
- Modify: `packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts` — accept the new optional provider options without changing scoring.
- Modify: `packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts` — defensive filter before RRF.
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts` — resolve filters once and expose filtering diagnostics.
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts` — add filtering diagnostics type.
- Modify: `packages/knowledge/src/index.ts` — export filter helper types/functions needed by tests and downstream adapters.
- Tests: `packages/knowledge/test/knowledge-retrieval-filters.test.ts`
- Tests: `packages/knowledge/test/knowledge-search-service.test.ts`
- Tests: `packages/knowledge/test/vector-knowledge-search-service.test.ts`
- Tests: `packages/knowledge/test/hybrid-knowledge-search-service.test.ts`
- Tests: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- Docs: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Docs: `docs/packages/knowledge/indexing-contract-guidelines.md`

## Task 1: Contract And Filter Resolver

**Files:**

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
- Modify: `packages/knowledge/src/contracts/types/knowledge-retrieval.types.ts`
- Create: `packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts`
- Modify: `packages/knowledge/src/index.ts`
- Test: `packages/knowledge/test/knowledge-retrieval-filters.test.ts`

- [x] **Step 1: Write failing contract/helper tests**

Create `packages/knowledge/test/knowledge-retrieval-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  KnowledgeChunkSchema,
  RetrievalRequestSchema,
  matchesKnowledgeChunkFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters
} from '../src';

describe('knowledge retrieval filters', () => {
  it('parses filters on RetrievalRequest and chunk metadata', () => {
    const request = RetrievalRequestSchema.parse({
      query: '报销流程',
      filters: {
        sourceTypes: ['repo-docs'],
        sourceIds: ['src-sales'],
        documentIds: ['doc-sales-policy'],
        minTrustClass: 'curated',
        trustClasses: ['official', 'internal'],
        searchableOnly: true,
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['sales']
      }
    });

    const chunk = KnowledgeChunkSchema.parse({
      id: 'chunk-1',
      sourceId: 'src-sales',
      documentId: 'doc-sales-policy',
      chunkIndex: 0,
      content: '销售部报销流程',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: {
        docType: 'policy',
        status: 'active',
        allowedRoles: ['sales', 'finance']
      }
    });

    expect(request.filters?.docTypes).toEqual(['policy']);
    expect(chunk.metadata?.allowedRoles).toEqual(['sales', 'finance']);
  });

  it('resolves legacy allowedSourceTypes and minTrustClass into filters', () => {
    const filters = resolveKnowledgeRetrievalFilters({
      query: 'retrieval',
      allowedSourceTypes: ['repo-docs'],
      minTrustClass: 'curated'
    });

    expect(filters).toMatchObject({
      sourceTypes: ['repo-docs'],
      minTrustClass: 'curated',
      searchableOnly: true
    });
  });

  it('matches source and chunk filters with stable trust ranking', () => {
    const filters = resolveKnowledgeRetrievalFilters({
      query: '报销流程',
      filters: {
        sourceTypes: ['repo-docs'],
        sourceIds: ['src-sales'],
        documentIds: ['doc-sales-policy'],
        minTrustClass: 'curated',
        docTypes: ['policy'],
        statuses: ['active'],
        allowedRoles: ['sales']
      }
    });

    const source = {
      id: 'src-sales',
      sourceType: 'repo-docs' as const,
      uri: '/docs/sales.md',
      title: '销售制度',
      trustClass: 'official' as const,
      updatedAt: '2026-04-30T00:00:00.000Z'
    };
    const chunk = {
      id: 'chunk-1',
      sourceId: 'src-sales',
      documentId: 'doc-sales-policy',
      chunkIndex: 0,
      content: '销售部报销流程',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: {
        docType: 'policy',
        status: 'active',
        allowedRoles: ['sales']
      }
    };

    expect(matchesKnowledgeSourceFilters(source, filters)).toBe(true);
    expect(matchesKnowledgeChunkFilters(chunk, filters)).toBe(true);
    expect(
      matchesKnowledgeChunkFilters({ ...chunk, metadata: { ...chunk.metadata, status: 'inactive' } }, filters)
    ).toBe(false);
  });
});
```

- [x] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-retrieval-filters.test.ts
```

Red verified before implementation: initially failed because `KnowledgeRetrievalFiltersSchema`, metadata fields, and filter helpers do not exist.

- [x] **Step 3: Add schema-first filters and metadata**

In `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`, add:

```ts
export const KnowledgeChunkMetadataSchema = z
  .object({
    docType: z.string().optional(),
    status: z.string().optional(),
    allowedRoles: z.array(z.string()).optional()
  })
  .passthrough();

export const KnowledgeRetrievalFiltersSchema = z.object({
  sourceTypes: z.array(KnowledgeSourceTypeSchema).optional(),
  sourceIds: z.array(z.string()).optional(),
  documentIds: z.array(z.string()).optional(),
  minTrustClass: KnowledgeTrustClassSchema.optional(),
  trustClasses: z.array(KnowledgeTrustClassSchema).optional(),
  searchableOnly: z.boolean().optional(),
  docTypes: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  allowedRoles: z.array(z.string()).optional()
});
```

Update `KnowledgeChunkSchema`:

```ts
export const KnowledgeChunkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  documentId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  searchable: z.boolean(),
  tokenCount: z.number().int().nonnegative().optional(),
  metadata: KnowledgeChunkMetadataSchema.optional(),
  updatedAt: z.string()
});
```

Update `RetrievalRequestSchema`:

```ts
export const RetrievalRequestSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
  filters: KnowledgeRetrievalFiltersSchema.optional(),
  allowedSourceTypes: z.array(KnowledgeSourceTypeSchema).optional(),
  minTrustClass: KnowledgeTrustClassSchema.optional(),
  includeContextWindow: z.boolean().optional()
});
```

- [x] **Step 4: Export inferred filter types**

In `packages/knowledge/src/contracts/types/knowledge-retrieval.types.ts`, add:

```ts
import {
  CitationSchema,
  KnowledgeChunkMetadataSchema,
  KnowledgeChunkSchema,
  KnowledgeRetrievalFiltersSchema,
  KnowledgeSourceSchema,
  KnowledgeSourceTypeSchema,
  KnowledgeTrustClassSchema,
  RetrievalHitSchema,
  RetrievalRequestSchema,
  RetrievalResultSchema
} from '../schemas/knowledge-retrieval.schema';

export type KnowledgeChunkMetadata = z.infer<typeof KnowledgeChunkMetadataSchema>;
export type KnowledgeRetrievalFilters = z.infer<typeof KnowledgeRetrievalFiltersSchema>;
```

Keep the existing exports for source, chunk, citation, request, hit, and result.

- [x] **Step 5: Implement resolver and matchers**

Create `packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts`:

```ts
import type {
  KnowledgeChunk,
  KnowledgeRetrievalFilters,
  KnowledgeSource,
  KnowledgeTrustClass,
  RetrievalHit,
  RetrievalRequest
} from '@agent/knowledge';

export type ResolvedKnowledgeRetrievalFilters = KnowledgeRetrievalFilters & {
  searchableOnly: boolean;
};

const TRUST_RANK: Record<KnowledgeTrustClass, number> = {
  unverified: 0,
  community: 1,
  curated: 2,
  official: 3,
  internal: 4
};

function includesAny<T>(allowed: T[] | undefined, values: T[]): boolean {
  if (!allowed?.length) return true;
  return values.some(value => allowed.includes(value));
}

function meetsMinTrustClass(actual: KnowledgeTrustClass, minimum: KnowledgeTrustClass | undefined): boolean {
  if (!minimum) return true;
  return TRUST_RANK[actual] >= TRUST_RANK[minimum];
}

export function resolveKnowledgeRetrievalFilters(request: RetrievalRequest): ResolvedKnowledgeRetrievalFilters {
  return {
    ...request.filters,
    sourceTypes: request.filters?.sourceTypes ?? request.allowedSourceTypes,
    minTrustClass: request.filters?.minTrustClass ?? request.minTrustClass,
    searchableOnly: request.filters?.searchableOnly ?? true
  };
}

export function matchesKnowledgeSourceFilters(
  source: Pick<KnowledgeSource, 'id' | 'sourceType' | 'trustClass'>,
  filters: ResolvedKnowledgeRetrievalFilters
): boolean {
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes(source.sourceType)) return false;
  if (filters.sourceIds?.length && !filters.sourceIds.includes(source.id)) return false;
  if (filters.trustClasses?.length && !filters.trustClasses.includes(source.trustClass)) return false;
  if (!meetsMinTrustClass(source.trustClass, filters.minTrustClass)) return false;
  return true;
}

export function matchesKnowledgeChunkFilters(
  chunk: Pick<KnowledgeChunk, 'documentId' | 'searchable' | 'metadata'>,
  filters: ResolvedKnowledgeRetrievalFilters
): boolean {
  if (filters.searchableOnly && !chunk.searchable) return false;
  if (filters.documentIds?.length && !filters.documentIds.includes(chunk.documentId)) return false;
  if (filters.docTypes?.length && !chunk.metadata?.docType) return false;
  if (filters.docTypes?.length && !filters.docTypes.includes(chunk.metadata!.docType!)) return false;
  if (filters.statuses?.length && !chunk.metadata?.status) return false;
  if (filters.statuses?.length && !filters.statuses.includes(chunk.metadata!.status!)) return false;
  if (filters.allowedRoles?.length && !includesAny(filters.allowedRoles, chunk.metadata?.allowedRoles ?? []))
    return false;
  return true;
}

export function matchesKnowledgeHitFilters(
  hit: Pick<RetrievalHit, 'documentId' | 'sourceId' | 'sourceType' | 'trustClass'> & {
    metadata?: KnowledgeChunk['metadata'];
  },
  filters: ResolvedKnowledgeRetrievalFilters
): boolean {
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes(hit.sourceType)) return false;
  if (filters.sourceIds?.length && !filters.sourceIds.includes(hit.sourceId)) return false;
  if (filters.documentIds?.length && !filters.documentIds.includes(hit.documentId)) return false;
  if (filters.trustClasses?.length && !filters.trustClasses.includes(hit.trustClass)) return false;
  if (!meetsMinTrustClass(hit.trustClass, filters.minTrustClass)) return false;
  if (filters.docTypes?.length && !filters.docTypes.includes(hit.metadata?.docType ?? '')) return false;
  if (filters.statuses?.length && !filters.statuses.includes(hit.metadata?.status ?? '')) return false;
  if (filters.allowedRoles?.length && !includesAny(filters.allowedRoles, hit.metadata?.allowedRoles ?? []))
    return false;
  return true;
}
```

- [x] **Step 6: Export helpers from package root**

In `packages/knowledge/src/index.ts`, add:

```ts
export type { ResolvedKnowledgeRetrievalFilters } from './retrieval/knowledge-retrieval-filters';
export {
  matchesKnowledgeChunkFilters,
  matchesKnowledgeHitFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters
} from './retrieval/knowledge-retrieval-filters';
```

- [x] **Step 7: Run contract/helper tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-retrieval-filters.test.ts
```

Observed after implementation: PASS where listed in verification record.

## Task 2: Keyword Search Pre-Filter

**Files:**

- Modify: `packages/knowledge/src/retrieval/knowledge-search-service.ts`
- Modify: `packages/knowledge/test/knowledge-search-service.test.ts`

- [x] **Step 1: Add failing keyword filter tests**

Append to `packages/knowledge/test/knowledge-search-service.test.ts`:

```ts
it('applies metadata filters before keyword scoring', async () => {
  const sourceRepository = new InMemoryKnowledgeSourceRepository([
    {
      id: 'source-1',
      sourceType: 'repo-docs',
      uri: '/docs/sales.md',
      title: 'Sales Policy',
      trustClass: 'official',
      updatedAt: '2026-04-30T00:00:00.000Z'
    }
  ]);
  const chunkRepository = new InMemoryKnowledgeChunkRepository([
    {
      id: 'chunk-active-policy',
      sourceId: 'source-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: '报销 流程 财务 审批',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: { docType: 'policy', status: 'active', allowedRoles: ['sales'] }
    },
    {
      id: 'chunk-inactive-policy',
      sourceId: 'source-1',
      documentId: 'doc-2',
      chunkIndex: 1,
      content: '报销 流程 财务 审批',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: { docType: 'policy', status: 'inactive', allowedRoles: ['sales'] }
    }
  ]);

  const service = new DefaultKnowledgeSearchService(sourceRepository, chunkRepository);
  const result = await service.search({
    query: '报销 流程',
    filters: { docTypes: ['policy'], statuses: ['active'], allowedRoles: ['sales'] }
  });

  expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk-active-policy']);
});
```

- [x] **Step 2: Run keyword service tests and verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-search-service.test.ts
```

Red verified before implementation: initially failed because `DefaultKnowledgeSearchService` does not use `filters.docTypes/statuses/allowedRoles`.

- [x] **Step 3: Apply resolved filters before scoring**

In `packages/knowledge/src/retrieval/knowledge-search-service.ts`, import helpers:

```ts
import {
  matchesKnowledgeChunkFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters
} from './knowledge-retrieval-filters';
```

In `search()`, add:

```ts
const filters = resolveKnowledgeRetrievalFilters(request);
```

Update the hit pipeline:

```ts
const hits = chunks
  .map(chunk => this.toHit(chunk, request, sourceMap, filters))
  .filter((hit): hit is RetrievalHit => Boolean(hit))
  .sort((left, right) => right.score - left.score)
  .slice(0, limit);
```

Update `toHit()` signature and filtering:

```ts
private toHit(
  chunk: Awaited<ReturnType<KnowledgeChunkRepository['list']>>[number],
  request: RetrievalRequest,
  sourceMap: Map<string, KnowledgeSource>,
  filters: ReturnType<typeof resolveKnowledgeRetrievalFilters>
): RetrievalHit | null {
  const source = sourceMap.get(chunk.sourceId);
  if (!source) return null;
  if (!matchesKnowledgeSourceFilters(source, filters)) return null;
  if (!matchesKnowledgeChunkFilters(chunk, filters)) return null;
  const score = scoreKnowledgeChunk(request.query, chunk.content);
  if (score <= 0) return null;
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
    metadata: chunk.metadata,
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

If `RetrievalHitSchema` does not yet include `metadata`, add `metadata: KnowledgeChunkMetadataSchema.optional()` in Task 1 while preserving compatibility.

- [x] **Step 4: Run keyword tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-search-service.test.ts
```

Observed after implementation: PASS where listed in verification record.

## Task 3: Vector Filter Pushdown And Defensive Filtering

**Files:**

- Modify: `packages/knowledge/src/retrieval/vector-search-provider.ts`
- Modify: `packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts`
- Modify: `packages/knowledge/src/retrieval/vector-knowledge-search-service.ts`
- Modify: `packages/knowledge/test/vector-knowledge-search-service.test.ts`

- [x] **Step 1: Add failing vector tests**

Append to `packages/knowledge/test/vector-knowledge-search-service.test.ts`:

```ts
it('passes resolved filters to the vector provider and defensively filters returned hits', async () => {
  const provider = {
    calls: [] as unknown[],
    async searchSimilar(_query: string, _topK: number, options?: unknown) {
      this.calls.push(options);
      return [
        { chunkId: 'allowed', score: 0.9 },
        { chunkId: 'blocked', score: 0.8 }
      ];
    }
  };
  const sourceRepository = new InMemoryKnowledgeSourceRepository([
    {
      id: 'src-1',
      sourceType: 'repo-docs',
      uri: '/docs/policy.md',
      title: 'Policy',
      trustClass: 'official',
      updatedAt: '2026-04-30T00:00:00.000Z'
    }
  ]);
  const chunkRepository = new InMemoryKnowledgeChunkRepository([
    {
      id: 'allowed',
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: '报销 流程',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: { status: 'active' }
    },
    {
      id: 'blocked',
      sourceId: 'src-1',
      documentId: 'doc-2',
      chunkIndex: 1,
      content: '旧 报销 流程',
      searchable: true,
      updatedAt: '2026-04-30T00:00:00.000Z',
      metadata: { status: 'inactive' }
    }
  ]);

  const service = new VectorKnowledgeSearchService(provider, chunkRepository, sourceRepository);
  const result = await service.search({ query: '报销', limit: 1, filters: { statuses: ['active'] } });

  expect(provider.calls[0]).toMatchObject({ filters: { statuses: ['active'], searchableOnly: true } });
  expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed']);
});
```

- [x] **Step 2: Run vector tests and verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/vector-knowledge-search-service.test.ts
```

Red verified before implementation: initially failed because provider options and defensive metadata filtering are not implemented.

- [x] **Step 3: Extend VectorSearchProvider**

In `packages/knowledge/src/retrieval/vector-search-provider.ts`, add:

```ts
import type { ResolvedKnowledgeRetrievalFilters } from './knowledge-retrieval-filters';

export interface VectorSearchOptions {
  filters?: ResolvedKnowledgeRetrievalFilters;
}
```

Update provider signature:

```ts
export interface VectorSearchProvider {
  searchSimilar(query: string, topK: number, options?: VectorSearchOptions): Promise<VectorSearchHit[]>;
}
```

- [x] **Step 4: Keep in-memory provider compatible**

In `packages/knowledge/src/retrieval/in-memory-vector-search-provider.ts`, update the method signature:

```ts
async searchSimilar(query: string, topK: number, _options?: VectorSearchOptions): Promise<VectorSearchHit[]> {
```

Add the `VectorSearchOptions` type import from `./vector-search-provider`.

- [x] **Step 5: Pass filters and defensively filter vector hits**

In `packages/knowledge/src/retrieval/vector-knowledge-search-service.ts`, import:

```ts
import {
  matchesKnowledgeChunkFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters
} from './knowledge-retrieval-filters';
```

In `search()`:

```ts
const filters = resolveKnowledgeRetrievalFilters(request);
const topK = request.limit ?? 5;
const providerTopK = topK * 3;
providerHits = await this.provider.searchSimilar(request.query, providerTopK, { filters });
```

Inside the provider hit loop:

```ts
if (!matchesKnowledgeSourceFilters(source, filters)) continue;
if (!matchesKnowledgeChunkFilters(chunk, filters)) continue;
hits.push(toRetrievalHit(chunk, source, providerHit.score));
```

Return sliced hits:

```ts
const limitedHits = hits.slice(0, topK);
return { hits: limitedHits, total: limitedHits.length };
```

Update `toRetrievalHit()` to include `metadata: chunk.metadata`.

- [x] **Step 6: Run vector tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/vector-knowledge-search-service.test.ts
```

Observed after implementation: PASS where listed in verification record.

## Task 4: Hybrid Defensive Filtering

**Files:**

- Modify: `packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts`
- Modify: `packages/knowledge/test/hybrid-knowledge-search-service.test.ts`

- [x] **Step 1: Add failing hybrid test**

Append to `packages/knowledge/test/hybrid-knowledge-search-service.test.ts`:

```ts
it('defensively filters hits before RRF fusion', async () => {
  const allowedHit = makeHit('allowed', 0.9, { status: 'active' });
  const blockedHit = makeHit('blocked', 0.95, { status: 'inactive' });
  const keywordService = makeService([allowedHit, blockedHit]);
  const vectorService = makeService([blockedHit]);
  const hybrid = new HybridKnowledgeSearchService(keywordService, vectorService);

  const result = await hybrid.search({ query: '报销', filters: { statuses: ['active'] }, limit: 10 });

  expect(result.hits.map(hit => hit.chunkId)).toEqual(['allowed']);
});
```

If `makeHit` does not currently accept metadata, update the helper in the same test file:

```ts
function makeHit(
  chunkId: string,
  score: number,
  metadata?: { status?: string; docType?: string; allowedRoles?: string[] }
) {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    sourceId: 'source-1',
    title: `Title ${chunkId}`,
    uri: `/docs/${chunkId}.md`,
    sourceType: 'repo-docs' as const,
    trustClass: 'official' as const,
    content: `content ${chunkId}`,
    score,
    metadata,
    citation: {
      sourceId: 'source-1',
      chunkId,
      title: `Title ${chunkId}`,
      uri: `/docs/${chunkId}.md`,
      sourceType: 'repo-docs' as const,
      trustClass: 'official' as const
    }
  };
}
```

- [x] **Step 2: Run hybrid tests and verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/hybrid-knowledge-search-service.test.ts
```

Red verified before implementation: initially failed because hybrid does not defensive-filter before RRF.

- [x] **Step 3: Filter hits before RRF**

In `packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts`, import:

```ts
import { matchesKnowledgeHitFilters, resolveKnowledgeRetrievalFilters } from './knowledge-retrieval-filters';
```

In `search()`:

```ts
const filters = resolveKnowledgeRetrievalFilters(request);
const keywordHits =
  keywordResult.status === 'fulfilled'
    ? keywordResult.value.hits.filter(hit => matchesKnowledgeHitFilters(hit, filters))
    : [];
const vectorHits =
  vectorResult.status === 'fulfilled'
    ? vectorResult.value.hits.filter(hit => matchesKnowledgeHitFilters(hit, filters))
    : [];
```

Keep the existing RRF behavior after filtering.

- [x] **Step 4: Run hybrid tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/hybrid-knowledge-search-service.test.ts
```

Observed after implementation: PASS where listed in verification record.

## Task 5: Runtime Filtering Diagnostics

**Files:**

- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Modify: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [x] **Step 1: Add failing diagnostics test**

Append to `packages/knowledge/test/run-knowledge-retrieval.test.ts`:

```ts
it('includes filtering diagnostics when filters are resolved', async () => {
  const searchService = {
    async search() {
      return {
        hits: [makeHit('active', 0.9, { status: 'active' }), makeHit('inactive', 0.8, { status: 'inactive' })],
        total: 2
      };
    }
  };

  const result = await runKnowledgeRetrieval({
    request: { query: '报销', filters: { statuses: ['active'] } },
    searchService,
    includeDiagnostics: true
  });

  expect(result.hits.map(hit => hit.chunkId)).toEqual(['active']);
  expect(result.diagnostics?.filtering).toMatchObject({
    enabled: true,
    stages: [
      {
        stage: 'pre-merge-defensive',
        beforeCount: 2,
        afterCount: 1,
        droppedCount: 1
      }
    ]
  });
});
```

If the local `makeHit` helper lacks metadata, update it to accept optional metadata and include it in returned hits.

- [x] **Step 2: Run pipeline test and verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Red verified before implementation: initially failed because diagnostics do not include filtering and pipeline does not defensive-filter search results.

- [x] **Step 3: Add diagnostics types**

In `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`, add:

```ts
export interface RetrievalFilteringStageDiagnostics {
  stage: 'pre-merge-defensive';
  beforeCount: number;
  afterCount: number;
  droppedCount: number;
}

export interface RetrievalFilteringDiagnostics {
  enabled: boolean;
  stages: RetrievalFilteringStageDiagnostics[];
}
```

Add to `RetrievalDiagnostics`:

```ts
filtering?: RetrievalFilteringDiagnostics;
```

- [x] **Step 4: Defensive-filter pipeline search results**

In `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`, import:

```ts
import {
  matchesKnowledgeHitFilters,
  resolveKnowledgeRetrievalFilters
} from '../../retrieval/knowledge-retrieval-filters';
```

After normalizing the request:

```ts
const resolvedFilters = resolveKnowledgeRetrievalFilters(request);
const filteringStages: NonNullable<RetrievalDiagnostics['filtering']>['stages'] = [];
```

Inside the query variant loop after `searchService.search()`:

```ts
const beforeFilterCount = result.hits.length;
const filteredHits = result.hits.filter(hit => matchesKnowledgeHitFilters(hit, resolvedFilters));
filteringStages.push({
  stage: 'pre-merge-defensive',
  beforeCount: beforeFilterCount,
  afterCount: filteredHits.length,
  droppedCount: beforeFilterCount - filteredHits.length
});
searchResults.push(filteredHits);
```

Replace existing `searchResults.push(result.hits);`.

In diagnostics:

```ts
filtering: {
  enabled: Boolean(request.filters || request.allowedSourceTypes || request.minTrustClass),
  stages: filteringStages
}
```

- [x] **Step 5: Run pipeline tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Observed after implementation: PASS where listed in verification record.

## Task 6: Docs

**Files:**

- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/packages/knowledge/indexing-contract-guidelines.md`
- Existing design: `docs/superpowers/specs/2026-04-30-knowledge-metadata-filtering-design.md`

- [x] **Step 1: Update retrieval runtime docs**

In `docs/packages/knowledge/knowledge-retrieval-runtime.md`, update the pipeline block to include:

```text
RetrievalRequest
  ─→ query normalization
  ─→ filter resolution       （合并 filters 与 legacy allowedSourceTypes/minTrustClass）
  ─→ retrieval               （keyword 前置过滤；vector 尽量下推 filters）
  ─→ defensive filtering     （进入 merge/fusion 前兜底过滤）
  ─→ merge
  ─→ post-process
  ─→ KnowledgeRetrievalResult
```

Add a short section:

```markdown
### Metadata Filtering

`filters` 是检索范围约束，不是 query rewrite。`allowedSourceTypes` 与 `minTrustClass` 作为兼容入口会被映射到 resolved filters。Keyword search 必须先过滤再打分；vector provider 应尽量支持 filter pushdown，同时 runtime 保留 defensive filter，防止第三方 provider 或 adapter 绕过过滤。
```

- [x] **Step 2: Update indexing contract docs**

In `docs/packages/knowledge/indexing-contract-guidelines.md`, add under metadata rules:

```markdown
Runtime metadata filtering 第一阶段依赖 chunk metadata 中的 `docType`、`status`、`allowedRoles`。新增这些字段时必须保持 JSON-safe，不允许把第三方对象、权限 SDK 类型或 vendor response 直接写进 metadata。后续扩展 `departments`、`productLines`、`knowledgeBases`、`tags`、`timeRange` 前，必须先确认 indexing pipeline 能稳定产出对应字段。
```

- [x] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Observed after implementation: PASS where listed in verification record.

## Task 7: Full Verification

**Files:** no new code files; this is verification only.

- [x] **Step 1: Run focused knowledge tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-retrieval-filters.test.ts packages/knowledge/test/knowledge-search-service.test.ts packages/knowledge/test/vector-knowledge-search-service.test.ts packages/knowledge/test/hybrid-knowledge-search-service.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Observed after implementation: PASS where listed in verification record.

- [x] **Step 2: Run knowledge package type check**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Observed after implementation: PASS where listed in verification record.

- [x] **Step 3: Run package exports test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/root-exports.test.ts packages/knowledge/test/contracts-boundary.test.ts
```

Observed after implementation: PASS where listed in verification record.

- [x] **Step 4: Run repository verification gate if time permits**

Run:

```bash
pnpm verify
```

Observed after implementation: PASS where listed in verification record. If unrelated existing failures block this command, record the failing command, error summary, and whether it is unrelated to metadata filtering.

- [x] **Step 5: Final cleanup check**

Run:

```bash
git diff -- packages/knowledge docs/packages/knowledge docs/superpowers/specs/2026-04-30-knowledge-metadata-filtering-design.md docs/superpowers/plans/2026-04-30-knowledge-metadata-filtering.md
```

Expected: Diff only contains metadata filtering contract, helper, tests, docs, and this plan.
