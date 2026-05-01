# Knowledge Post-Retrieval Implementation Plan

状态：completed
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-05-01

> 2026-05-01 执行更新：Post-Retrieval stage contracts、默认 filter/ranker/diversifier、pipeline wiring、root exports、文档与受影响验证已完成。提交前 review 已完成；commit 未执行，因为当前 checkout 混有大量其他模块改动，不能安全地把本 feature 单独提交。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic post-retrieval chain in `packages/knowledge` for filtering, ranking, diversification, and diagnostics before context expansion and context assembly.

**Architecture:** The feature extends the existing `runKnowledgeRetrieval()` pipeline after merge and before `contextExpander`. New stage contracts live under `packages/knowledge/src/runtime/stages/`; deterministic defaults live under `packages/knowledge/src/runtime/defaults/`; runtime diagnostics remain project-owned JSON-safe data and do not expose dropped sensitive content.

**Tech Stack:** TypeScript, Vitest, zod-backed contract types already present in `@agent/knowledge`, existing retrieval runtime pipeline.

---

## File Structure

- Create: `packages/knowledge/src/runtime/stages/post-retrieval-filter.ts`
  - Defines `PostRetrievalFilter`, result shape, reason enum, and diagnostics shape for deterministic filtering.
- Create: `packages/knowledge/src/runtime/stages/post-retrieval-ranker.ts`
  - Defines `PostRetrievalRanker`, ranked hit metadata, signal names, and diagnostics shape.
- Create: `packages/knowledge/src/runtime/stages/post-retrieval-diversifier.ts`
  - Defines `PostRetrievalDiversifier`, coverage policy, result shape, and diagnostics shape.
- Create: `packages/knowledge/src/runtime/defaults/default-post-retrieval-filter.ts`
  - Implements low-score filtering, duplicate chunk filtering, duplicate parent limiting, low-value content filtering, and minimal unsafe-content filtering.
- Create: `packages/knowledge/src/runtime/defaults/default-post-retrieval-ranker.ts`
  - Implements deterministic score blending from retrieval score, authority, recency, context fit, and exact constraint match.
- Create: `packages/knowledge/src/runtime/defaults/default-post-retrieval-diversifier.ts`
  - Implements source / parent / section coverage selection without embeddings.
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
  - Adds `PostRetrievalDiagnostics` to `RetrievalDiagnostics`.
- Modify: `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`
  - Adds `postRetrievalFilter`, `postRetrievalRanker`, and `postRetrievalDiversifier` to `RetrievalPipelineConfig`.
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - Wires default post-retrieval stages between merge and legacy `postProcessor`; keeps context expansion after all post-retrieval processing.
- Modify: `packages/knowledge/src/index.ts`
  - Exports new stage types and default implementations.
- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
  - Updates pipeline documentation, config surface, diagnostics, and verification notes.
- Test: `packages/knowledge/test/post-retrieval-filter.test.ts`
- Test: `packages/knowledge/test/post-retrieval-ranker.test.ts`
- Test: `packages/knowledge/test/post-retrieval-diversifier.test.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- Test: `packages/knowledge/test/root-exports.test.ts`

## Task 1: Stage Contracts And Diagnostics Types

**Files:**

- Create: `packages/knowledge/src/runtime/stages/post-retrieval-filter.ts`
- Create: `packages/knowledge/src/runtime/stages/post-retrieval-ranker.ts`
- Create: `packages/knowledge/src/runtime/stages/post-retrieval-diversifier.ts`
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
- Modify: `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`

- [x] **Step 1: Write the failing compile-facing tests through root exports**

Add this case to `packages/knowledge/test/root-exports.test.ts`:

```ts
import { DefaultPostRetrievalFilter, DefaultPostRetrievalRanker, DefaultPostRetrievalDiversifier } from '../src/index';

it('re-exports post-retrieval stage defaults', () => {
  expect(DefaultPostRetrievalFilter).toBe(rootExports.DefaultPostRetrievalFilter);
  expect(DefaultPostRetrievalRanker).toBe(rootExports.DefaultPostRetrievalRanker);
  expect(DefaultPostRetrievalDiversifier).toBe(rootExports.DefaultPostRetrievalDiversifier);
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/root-exports.test.ts
```

Expected: FAIL because the three default classes are not exported yet.

- [x] **Step 3: Add stage contract files**

Create `packages/knowledge/src/runtime/stages/post-retrieval-filter.ts`:

```ts
import type { RetrievalHit } from '@agent/knowledge';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export type PostRetrievalFilterReason =
  | 'low-score'
  | 'duplicate-chunk'
  | 'duplicate-parent'
  | 'low-context-value'
  | 'unsafe-content'
  | 'conflict-risk';

export interface PostRetrievalFilterDiagnostics {
  enabled: boolean;
  beforeCount: number;
  afterCount: number;
  droppedCount: number;
  reasons: Partial<Record<PostRetrievalFilterReason, number>>;
}

export interface PostRetrievalFilterResult {
  hits: RetrievalHit[];
  diagnostics: PostRetrievalFilterDiagnostics;
}

export interface PostRetrievalFilterContext {
  minScore?: number;
}

export interface PostRetrievalFilter {
  filter(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context?: PostRetrievalFilterContext
  ): Promise<PostRetrievalFilterResult>;
}
```

Create `packages/knowledge/src/runtime/stages/post-retrieval-ranker.ts`:

```ts
import type { RetrievalHit } from '@agent/knowledge';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export type PostRetrievalRankingSignal =
  | 'retrieval-score'
  | 'authority'
  | 'recency'
  | 'context-fit'
  | 'exact-constraint';

export interface PostRetrievalRankingDiagnostics {
  enabled: boolean;
  strategy: 'deterministic-signals';
  scoredCount: number;
  signals: PostRetrievalRankingSignal[];
}

export interface PostRetrievalRankResult {
  hits: RetrievalHit[];
  diagnostics: PostRetrievalRankingDiagnostics;
}

export interface PostRetrievalRanker {
  rank(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<PostRetrievalRankResult>;
}
```

Create `packages/knowledge/src/runtime/stages/post-retrieval-diversifier.ts`:

```ts
import type { RetrievalHit } from '@agent/knowledge';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface PostRetrievalDiversificationPolicy {
  maxPerSource?: number;
  maxPerParent?: number;
}

export interface PostRetrievalDiversificationDiagnostics {
  enabled: boolean;
  strategy: 'source-parent-section-coverage';
  beforeCount: number;
  afterCount: number;
  maxPerSource: number;
  maxPerParent: number;
}

export interface PostRetrievalDiversifyResult {
  hits: RetrievalHit[];
  diagnostics: PostRetrievalDiversificationDiagnostics;
}

export interface PostRetrievalDiversificationContext {
  policy?: PostRetrievalDiversificationPolicy;
}

export interface PostRetrievalDiversifier {
  diversify(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context?: PostRetrievalDiversificationContext
  ): Promise<PostRetrievalDiversifyResult>;
}
```

- [x] **Step 4: Extend diagnostics and pipeline config types**

In `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`, import diagnostics types and add the aggregate:

```ts
import type { ContextExpansionDiagnostics } from '../stages/context-expander';
import type { PostRetrievalDiversificationDiagnostics } from '../stages/post-retrieval-diversifier';
import type { PostRetrievalFilterDiagnostics } from '../stages/post-retrieval-filter';
import type { PostRetrievalRankingDiagnostics } from '../stages/post-retrieval-ranker';

export interface PostRetrievalDiagnostics {
  filtering: PostRetrievalFilterDiagnostics;
  ranking: PostRetrievalRankingDiagnostics;
  diversification: PostRetrievalDiversificationDiagnostics;
}
```

Then add this optional field to `RetrievalDiagnostics`:

```ts
  postRetrieval?: PostRetrievalDiagnostics;
```

In `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`, import the three stage interfaces and add fields to `RetrievalPipelineConfig`:

```ts
import type { PostRetrievalDiversifier } from '../runtime/stages/post-retrieval-diversifier';
import type { PostRetrievalFilter } from '../runtime/stages/post-retrieval-filter';
import type { PostRetrievalRanker } from '../runtime/stages/post-retrieval-ranker';

export interface RetrievalPipelineConfig {
  queryNormalizer?: QueryNormalizer | QueryNormalizer[];
  postRetrievalFilter?: PostRetrievalFilter;
  postRetrievalRanker?: PostRetrievalRanker;
  postRetrievalDiversifier?: PostRetrievalDiversifier;
  postProcessor?: RetrievalPostProcessor;
  contextExpander?: ContextExpander;
  contextExpansionPolicy?: ContextExpansionPolicy;
  contextAssembler?: ContextAssembler;
}
```

- [x] **Step 5: Run TypeScript to verify contract-only compile**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: FAIL only because default classes referenced in root export test do not exist yet, or PASS if tests are not part of the tsconfig compile surface.

## Task 2: Default Post-Retrieval Filter

**Files:**

- Create: `packages/knowledge/src/runtime/defaults/default-post-retrieval-filter.ts`
- Test: `packages/knowledge/test/post-retrieval-filter.test.ts`

- [x] **Step 1: Write failing filter tests**

Create `packages/knowledge/test/post-retrieval-filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '../src/contracts/types/knowledge-retrieval.types';
import { DefaultPostRetrievalFilter } from '../src/runtime/defaults/default-post-retrieval-filter';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: '病假超过 3 天需要提供医院诊断证明。',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    },
    ...overrides
  };
}

const request = {
  query: '病假超过 3 天需要什么材料',
  normalizedQuery: '病假超过 3 天需要什么材料',
  topK: 5
};

describe('DefaultPostRetrievalFilter', () => {
  it('drops low score hits and records the reason', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [makeHit({ chunkId: 'strong', score: 0.8 }), makeHit({ chunkId: 'weak', score: 0 })],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['strong']);
    expect(result.diagnostics.reasons['low-score']).toBe(1);
    expect(result.diagnostics.droppedCount).toBe(1);
  });

  it('keeps the highest scoring duplicate chunk', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'same', content: 'older duplicate', score: 0.4 }),
        makeHit({ chunkId: 'same', content: 'better duplicate', score: 0.9 })
      ],
      request
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.content).toBe('better duplicate');
    expect(result.diagnostics.reasons['duplicate-chunk']).toBe(1);
  });

  it('limits duplicate parent hits after preserving the highest score', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'parent-low', score: 0.6, metadata: { parentId: 'parent-1' } }),
        makeHit({ chunkId: 'parent-high', score: 0.9, metadata: { parentId: 'parent-1' } })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['parent-high']);
    expect(result.diagnostics.reasons['duplicate-parent']).toBe(1);
  });

  it('drops low context value and unsafe content without returning the dropped text', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'toc', content: '目录\n第一章 总则\n第二章 请假管理', score: 0.8 }),
        makeHit({ chunkId: 'secret', content: 'password: hunter2', score: 0.8 }),
        makeHit({ chunkId: 'fact', content: '病假超过 3 天需要提供医院诊断证明。', score: 0.8 })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['fact']);
    expect(result.diagnostics.reasons['low-context-value']).toBe(1);
    expect(result.diagnostics.reasons['unsafe-content']).toBe(1);
  });
});
```

- [x] **Step 2: Run filter tests to verify failure**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-filter.test.ts
```

Expected: FAIL because `DefaultPostRetrievalFilter` does not exist.

- [x] **Step 3: Implement the default filter**

Create `packages/knowledge/src/runtime/defaults/default-post-retrieval-filter.ts`:

```ts
import type { RetrievalHit } from '@agent/knowledge';

import type {
  PostRetrievalFilter,
  PostRetrievalFilterDiagnostics,
  PostRetrievalFilterReason,
  PostRetrievalFilterResult
} from '../stages/post-retrieval-filter';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_RETRIEVAL_MIN_SCORE } from './retrieval-runtime-defaults';

const LOW_VALUE_PATTERNS = [/^目录\s*$/m, /版权所有/, /最终解释权/, /第[一二三四五六七八九十]+章/];
const UNSAFE_PATTERNS = [/(api[_-]?key|token|password)\s*[:=]\s*\S+/i, /secret[_-]?key\s*[:=]\s*\S+/i];

function increment(reasons: Partial<Record<PostRetrievalFilterReason, number>>, reason: PostRetrievalFilterReason) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function isLowContextValue(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 12) return true;
  return LOW_VALUE_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isUnsafe(content: string): boolean {
  return UNSAFE_PATTERNS.some(pattern => pattern.test(content));
}

export class DefaultPostRetrievalFilter implements PostRetrievalFilter {
  constructor(private readonly minScore: number = DEFAULT_RETRIEVAL_MIN_SCORE) {}

  async filter(hits: RetrievalHit[], _request: NormalizedRetrievalRequest): Promise<PostRetrievalFilterResult> {
    const reasons: Partial<Record<PostRetrievalFilterReason, number>> = {};
    const bestByChunk = new Map<string, RetrievalHit>();
    const sorted = [...hits].sort((left, right) => right.score - left.score);

    for (const hit of sorted) {
      if (hit.score <= this.minScore) {
        increment(reasons, 'low-score');
        continue;
      }

      if (isUnsafe(hit.content)) {
        increment(reasons, 'unsafe-content');
        continue;
      }

      if (isLowContextValue(hit.content)) {
        increment(reasons, 'low-context-value');
        continue;
      }

      if (bestByChunk.has(hit.chunkId)) {
        increment(reasons, 'duplicate-chunk');
        continue;
      }

      bestByChunk.set(hit.chunkId, hit);
    }

    const parentIds = new Set<string>();
    const filtered: RetrievalHit[] = [];

    for (const hit of bestByChunk.values()) {
      const parentId = typeof hit.metadata?.parentId === 'string' ? hit.metadata.parentId : undefined;
      if (parentId && parentIds.has(parentId)) {
        increment(reasons, 'duplicate-parent');
        continue;
      }

      if (parentId) {
        parentIds.add(parentId);
      }
      filtered.push(hit);
    }

    const diagnostics: PostRetrievalFilterDiagnostics = {
      enabled: true,
      beforeCount: hits.length,
      afterCount: filtered.length,
      droppedCount: hits.length - filtered.length,
      reasons
    };

    return { hits: filtered, diagnostics };
  }
}
```

- [x] **Step 4: Run filter tests to verify pass**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-filter.test.ts
```

Expected: PASS.

## Task 3: Default Post-Retrieval Ranker

**Files:**

- Create: `packages/knowledge/src/runtime/defaults/default-post-retrieval-ranker.ts`
- Test: `packages/knowledge/test/post-retrieval-ranker.test.ts`

- [x] **Step 1: Write failing ranker tests**

Create `packages/knowledge/test/post-retrieval-ranker.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '../src/contracts/types/knowledge-retrieval.types';
import { DefaultPostRetrievalRanker } from '../src/runtime/defaults/default-post-retrieval-ranker';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'curated',
    content: '病假超过 3 天需要提供医院诊断证明。',
    score: 0.6,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'curated'
    },
    ...overrides
  };
}

const request = {
  query: '2026 年病假超过 3 天需要什么材料',
  normalizedQuery: '2026 年病假超过 3 天需要什么材料',
  topK: 5
};

describe('DefaultPostRetrievalRanker', () => {
  it('prioritizes direct answer value over weak topical recency', async () => {
    const ranker = new DefaultPostRetrievalRanker(new Date('2026-05-01T00:00:00.000Z'));

    const result = await ranker.rank(
      [
        makeHit({
          chunkId: 'new-but-weak',
          content: '2026 年病假工资按照公司考勤制度计算。',
          score: 0.62,
          metadata: { updatedAt: '2026-04-20T00:00:00.000Z' }
        }),
        makeHit({
          chunkId: 'direct-answer',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.6,
          metadata: { updatedAt: '2025-12-01T00:00:00.000Z' }
        })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['direct-answer', 'new-but-weak']);
    expect(result.diagnostics.signals).toEqual([
      'retrieval-score',
      'authority',
      'recency',
      'context-fit',
      'exact-constraint'
    ]);
  });

  it('uses authority and recency as tie breakers for similarly useful hits', async () => {
    const ranker = new DefaultPostRetrievalRanker(new Date('2026-05-01T00:00:00.000Z'));

    const result = await ranker.rank(
      [
        makeHit({
          chunkId: 'community-old',
          trustClass: 'community',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.7,
          metadata: { updatedAt: '2024-01-01T00:00:00.000Z' }
        }),
        makeHit({
          chunkId: 'official-new',
          trustClass: 'official',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.7,
          metadata: { updatedAt: '2026-04-01T00:00:00.000Z' }
        })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['official-new', 'community-old']);
  });
});
```

- [x] **Step 2: Run ranker tests to verify failure**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-ranker.test.ts
```

Expected: FAIL because `DefaultPostRetrievalRanker` does not exist.

- [x] **Step 3: Implement deterministic ranker**

Create `packages/knowledge/src/runtime/defaults/default-post-retrieval-ranker.ts`:

```ts
import type { RetrievalHit } from '@agent/knowledge';

import type {
  PostRetrievalRankResult,
  PostRetrievalRanker,
  PostRetrievalRankingSignal
} from '../stages/post-retrieval-ranker';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

const TRUST_SCORE: Record<RetrievalHit['trustClass'], number> = {
  unverified: 0,
  community: 0.25,
  curated: 0.55,
  official: 0.85,
  internal: 1
};

const SIGNALS: PostRetrievalRankingSignal[] = [
  'retrieval-score',
  'authority',
  'recency',
  'context-fit',
  'exact-constraint'
];

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(score, 1));
}

function recencyScore(value: unknown, now: Date): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 0;

  const ageDays = (now.getTime() - time) / 86_400_000;
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.7;
  if (ageDays <= 365) return 0.4;
  return 0.1;
}

function contextFitScore(content: string, query: string): number {
  const normalized = content.trim();
  if (normalized.length < 12) return 0;

  let score = 0.35;
  if (/[。；;:：]/.test(normalized)) score += 0.2;
  if (/需要|材料|证明|步骤|流程|限制|例外|可以|不能/.test(normalized)) score += 0.25;

  const queryTerms = query.split(/\s+/).filter(Boolean);
  if (queryTerms.some(term => normalized.includes(term))) score += 0.2;

  return normalizeScore(score);
}

function exactConstraintScore(content: string, query: string): number {
  const constraints = query.match(/\b\d{4}\b|v\d+(?:\.\d+)*/gi) ?? [];
  if (constraints.length === 0) return 0.5;
  const matched = constraints.filter(item => content.includes(item)).length;
  return matched / constraints.length;
}

function finalScore(hit: RetrievalHit, request: NormalizedRetrievalRequest, now: Date): number {
  const retrieval = normalizeScore(hit.score);
  const authority = TRUST_SCORE[hit.trustClass] ?? 0;
  const recency = recencyScore(hit.metadata?.updatedAt, now);
  const fit = contextFitScore(hit.content, request.normalizedQuery);
  const exact = exactConstraintScore(hit.content, request.normalizedQuery);

  return retrieval * 0.45 + fit * 0.25 + authority * 0.15 + recency * 0.1 + exact * 0.05;
}

export class DefaultPostRetrievalRanker implements PostRetrievalRanker {
  constructor(private readonly now: Date = new Date()) {}

  async rank(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<PostRetrievalRankResult> {
    const ranked = [...hits].sort((left, right) => {
      const diff = finalScore(right, request, this.now) - finalScore(left, request, this.now);
      if (diff !== 0) return diff;
      return right.score - left.score;
    });

    return {
      hits: ranked,
      diagnostics: {
        enabled: true,
        strategy: 'deterministic-signals',
        scoredCount: hits.length,
        signals: SIGNALS
      }
    };
  }
}
```

- [x] **Step 4: Run ranker tests to verify pass**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-ranker.test.ts
```

Expected: PASS.

## Task 4: Default Post-Retrieval Diversifier

**Files:**

- Create: `packages/knowledge/src/runtime/defaults/default-post-retrieval-diversifier.ts`
- Test: `packages/knowledge/test/post-retrieval-diversifier.test.ts`

- [x] **Step 1: Write failing diversifier tests**

Create `packages/knowledge/test/post-retrieval-diversifier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '../src/contracts/types/knowledge-retrieval.types';
import { DefaultPostRetrievalDiversifier } from '../src/runtime/defaults/default-post-retrieval-diversifier';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: '病假超过 3 天需要提供医院诊断证明。',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    },
    ...overrides
  };
}

const request = {
  query: '病假超过 3 天需要注意什么',
  normalizedQuery: '病假超过 3 天需要注意什么',
  topK: 3
};

describe('DefaultPostRetrievalDiversifier', () => {
  it('limits overrepresented sources while filling from other sources', async () => {
    const diversifier = new DefaultPostRetrievalDiversifier({ maxPerSource: 2, maxPerParent: 2 });

    const result = await diversifier.diversify(
      [
        makeHit({ chunkId: 'a1', sourceId: 'source-a', score: 0.95 }),
        makeHit({ chunkId: 'a2', sourceId: 'source-a', score: 0.94 }),
        makeHit({ chunkId: 'a3', sourceId: 'source-a', score: 0.93 }),
        makeHit({ chunkId: 'b1', sourceId: 'source-b', score: 0.8 })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['a1', 'a2', 'b1']);
    expect(result.diagnostics.afterCount).toBe(3);
    expect(result.diagnostics.maxPerSource).toBe(2);
  });

  it('limits duplicate parent hits and preserves order for selected hits', async () => {
    const diversifier = new DefaultPostRetrievalDiversifier({ maxPerSource: 3, maxPerParent: 1 });

    const result = await diversifier.diversify(
      [
        makeHit({ chunkId: 'p1-high', sourceId: 'source-a', score: 0.95, metadata: { parentId: 'parent-1' } }),
        makeHit({ chunkId: 'p1-low', sourceId: 'source-b', score: 0.9, metadata: { parentId: 'parent-1' } }),
        makeHit({ chunkId: 'p2', sourceId: 'source-b', score: 0.85, metadata: { parentId: 'parent-2' } })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['p1-high', 'p2']);
    expect(result.diagnostics.beforeCount).toBe(3);
    expect(result.diagnostics.afterCount).toBe(2);
  });
});
```

- [x] **Step 2: Run diversifier tests to verify failure**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-diversifier.test.ts
```

Expected: FAIL because `DefaultPostRetrievalDiversifier` does not exist.

- [x] **Step 3: Implement coverage diversifier**

Create `packages/knowledge/src/runtime/defaults/default-post-retrieval-diversifier.ts`:

```ts
import type { RetrievalHit } from '@agent/knowledge';

import type {
  PostRetrievalDiversificationPolicy,
  PostRetrievalDiversifier,
  PostRetrievalDiversifyResult
} from '../stages/post-retrieval-diversifier';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

const DEFAULT_POLICY: Required<PostRetrievalDiversificationPolicy> = {
  maxPerSource: 2,
  maxPerParent: 1
};

function resolvePolicy(policy?: PostRetrievalDiversificationPolicy): Required<PostRetrievalDiversificationPolicy> {
  return {
    maxPerSource: policy?.maxPerSource ?? DEFAULT_POLICY.maxPerSource,
    maxPerParent: policy?.maxPerParent ?? DEFAULT_POLICY.maxPerParent
  };
}

export class DefaultPostRetrievalDiversifier implements PostRetrievalDiversifier {
  constructor(private readonly defaultPolicy: PostRetrievalDiversificationPolicy = DEFAULT_POLICY) {}

  async diversify(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context?: { policy?: PostRetrievalDiversificationPolicy }
  ): Promise<PostRetrievalDiversifyResult> {
    const policy = resolvePolicy(context?.policy ?? this.defaultPolicy);
    const sourceCounts = new Map<string, number>();
    const parentCounts = new Map<string, number>();
    const selected: RetrievalHit[] = [];

    for (const hit of hits) {
      if (selected.length >= request.topK) break;

      const sourceCount = sourceCounts.get(hit.sourceId) ?? 0;
      if (sourceCount >= policy.maxPerSource) continue;

      const parentId = typeof hit.metadata?.parentId === 'string' ? hit.metadata.parentId : undefined;
      if (parentId) {
        const parentCount = parentCounts.get(parentId) ?? 0;
        if (parentCount >= policy.maxPerParent) continue;
        parentCounts.set(parentId, parentCount + 1);
      }

      sourceCounts.set(hit.sourceId, sourceCount + 1);
      selected.push(hit);
    }

    return {
      hits: selected,
      diagnostics: {
        enabled: true,
        strategy: 'source-parent-section-coverage',
        beforeCount: hits.length,
        afterCount: selected.length,
        maxPerSource: policy.maxPerSource,
        maxPerParent: policy.maxPerParent
      }
    };
  }
}
```

- [x] **Step 4: Run diversifier tests to verify pass**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-diversifier.test.ts
```

Expected: PASS.

## Task 5: Pipeline Wiring And Root Exports

**Files:**

- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Modify: `packages/knowledge/src/index.ts`
- Modify: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- Modify: `packages/knowledge/test/root-exports.test.ts`

- [x] **Step 1: Add failing pipeline test for stage ordering**

Add this test inside the `describe('runKnowledgeRetrieval', ...)` block in `packages/knowledge/test/run-knowledge-retrieval.test.ts`:

```ts
it('runs post-retrieval stages after merge and before legacy postProcessor and contextExpander', async () => {
  const order: string[] = [];
  const seed = makeHit({ chunkId: 'seed', score: 0.9 });
  const discarded = makeHit({ chunkId: 'discarded', score: 0.8 });
  const searchService = makeSearchService([seed, discarded]);
  const postRetrievalFilter = {
    filter: vi.fn(async (hits: RetrievalHit[]) => {
      order.push('filter');
      return {
        hits: hits.filter(hit => hit.chunkId !== 'discarded'),
        diagnostics: {
          enabled: true,
          beforeCount: hits.length,
          afterCount: 1,
          droppedCount: 1,
          reasons: { 'low-context-value': 1 }
        }
      };
    })
  };
  const postRetrievalRanker = {
    rank: vi.fn(async (hits: RetrievalHit[]) => {
      order.push('rank');
      return {
        hits,
        diagnostics: {
          enabled: true,
          strategy: 'deterministic-signals' as const,
          scoredCount: hits.length,
          signals: ['retrieval-score' as const]
        }
      };
    })
  };
  const postRetrievalDiversifier = {
    diversify: vi.fn(async (hits: RetrievalHit[]) => {
      order.push('diversify');
      return {
        hits,
        diagnostics: {
          enabled: true,
          strategy: 'source-parent-section-coverage' as const,
          beforeCount: hits.length,
          afterCount: hits.length,
          maxPerSource: 2,
          maxPerParent: 1
        }
      };
    })
  };
  const postProcessor = {
    process: vi.fn(async (hits: RetrievalHit[]) => {
      order.push('postProcessor');
      return hits;
    })
  };
  const contextExpander: ContextExpander = {
    expand: vi.fn(async hits => {
      order.push('contextExpander');
      return {
        hits,
        diagnostics: {
          enabled: true,
          seedCount: hits.length,
          candidateCount: 0,
          addedCount: 0,
          dedupedCount: 0,
          droppedByFilterCount: 0
        }
      };
    })
  };

  const result = await runKnowledgeRetrieval({
    request: baseRequest,
    searchService,
    assembleContext: true,
    includeDiagnostics: true,
    pipeline: {
      queryNormalizer: makeSingleVariantNormalizer(),
      postRetrievalFilter,
      postRetrievalRanker,
      postRetrievalDiversifier,
      postProcessor,
      contextExpander,
      contextAssembler: { assemble: async hits => hits.map(hit => hit.chunkId).join('|') }
    }
  });

  expect(order).toEqual(['filter', 'rank', 'diversify', 'postProcessor', 'contextExpander']);
  expect(result.hits.map(hit => hit.chunkId)).toEqual(['seed']);
  expect(result.contextBundle).toBe('seed');
  expect(result.diagnostics?.postRetrieval?.filtering.droppedCount).toBe(1);
});
```

- [x] **Step 2: Run pipeline test to verify failure**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts -t "runs post-retrieval stages"
```

Expected: FAIL because `RetrievalPipelineConfig` does not accept the three stage fields and the pipeline does not call them.

- [x] **Step 3: Wire defaults and custom stages into the pipeline**

Modify `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`:

```ts
import { DefaultPostRetrievalDiversifier } from '../defaults/default-post-retrieval-diversifier';
import { DefaultPostRetrievalFilter } from '../defaults/default-post-retrieval-filter';
import { DefaultPostRetrievalRanker } from '../defaults/default-post-retrieval-ranker';
```

Inside `runKnowledgeRetrieval()`, after resolving `postProcessor`, add:

```ts
const postRetrievalFilter = pipeline.postRetrievalFilter ?? new DefaultPostRetrievalFilter();
const postRetrievalRanker = pipeline.postRetrievalRanker ?? new DefaultPostRetrievalRanker();
const postRetrievalDiversifier = pipeline.postRetrievalDiversifier ?? new DefaultPostRetrievalDiversifier();
```

Replace:

```ts
const processedHits = await postProcessor.process(mergedHits, effectiveNormalized);
const postHitCount = processedHits.length;
let contextHits = processedHits;
```

With:

```ts
const filterResult = await postRetrievalFilter.filter(mergedHits, effectiveNormalized);
const rankResult = await postRetrievalRanker.rank(filterResult.hits, effectiveNormalized);
const diversifyResult = await postRetrievalDiversifier.diversify(rankResult.hits, effectiveNormalized);
const processedHits = await postProcessor.process(diversifyResult.hits, effectiveNormalized);
const postHitCount = processedHits.length;
let contextHits = processedHits;
```

Inside diagnostics object, add:

```ts
        postRetrieval: {
          filtering: filterResult.diagnostics,
          ranking: rankResult.diagnostics,
          diversification: diversifyResult.diagnostics
        },
```

- [x] **Step 4: Export new APIs from root**

Modify `packages/knowledge/src/index.ts`:

```ts
export type {
  PostRetrievalFilter,
  PostRetrievalFilterContext,
  PostRetrievalFilterDiagnostics,
  PostRetrievalFilterReason,
  PostRetrievalFilterResult
} from './runtime/stages/post-retrieval-filter';
export type {
  PostRetrievalRanker,
  PostRetrievalRankingDiagnostics,
  PostRetrievalRankingSignal,
  PostRetrievalRankResult
} from './runtime/stages/post-retrieval-ranker';
export type {
  PostRetrievalDiversificationContext,
  PostRetrievalDiversificationDiagnostics,
  PostRetrievalDiversificationPolicy,
  PostRetrievalDiversifier,
  PostRetrievalDiversifyResult
} from './runtime/stages/post-retrieval-diversifier';
export type { PostRetrievalDiagnostics } from './runtime/types/retrieval-runtime.types';
export { DefaultPostRetrievalFilter } from './runtime/defaults/default-post-retrieval-filter';
export { DefaultPostRetrievalRanker } from './runtime/defaults/default-post-retrieval-ranker';
export { DefaultPostRetrievalDiversifier } from './runtime/defaults/default-post-retrieval-diversifier';
```

- [x] **Step 5: Run focused pipeline and export tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts packages/knowledge/test/root-exports.test.ts
```

Expected: PASS.

## Task 6: Documentation Update

**Files:**

- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/superpowers/specs/2026-05-01-knowledge-post-retrieval-design.md`

- [x] **Step 1: Update runtime pipeline documentation**

In `docs/packages/knowledge/knowledge-retrieval-runtime.md`, update the Pipeline block from:

```text
  ─→ post-process
  ─→ context expansion        （可选，仅扩展 context 组装输入）
```

To:

```text
  ─→ result filtering         （确定性检索后过滤）
  ─→ result ranking           （确定性 signals 排序）
  ─→ result diversification   （source / parent / section coverage）
  ─→ post-process             （兼容最终裁剪层）
  ─→ context expansion        （可选，仅扩展 context 组装输入）
```

- [x] **Step 2: Add a Post-Retrieval section**

Add this section after the Metadata Filtering section:

````md
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
````

第一阶段默认实现只使用确定性信号：

- filter：低分、重复 chunk、重复 parent、低上下文价值与最小 unsafe content 过滤。
- ranker：融合 retrieval score、trustClass authority、updatedAt recency、context fit 与 query 中明确版本/年份约束。
- diversifier：按 sourceId 与 metadata.parentId 控制覆盖度，避免同一来源或父段落占满上下文。

`diagnostics.postRetrieval` 只暴露数量、策略和原因汇总，不暴露被丢弃文本。

````

- [x] **Step 3: Mark implementation status in the design snapshot**

In `docs/superpowers/specs/2026-05-01-knowledge-post-retrieval-design.md`, add this near the top:

```md
> 2026-05-01 执行更新：第一阶段实现完成后，当前生效入口应以 `docs/packages/knowledge/knowledge-retrieval-runtime.md` 为准；本文件保留为设计快照。
````

- [x] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 7: Verification And Review

**Files:**

- All files changed in Tasks 1-6.

- [x] **Step 1: Run affected knowledge tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/post-retrieval-filter.test.ts packages/knowledge/test/post-retrieval-ranker.test.ts packages/knowledge/test/post-retrieval-diversifier.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts packages/knowledge/test/root-exports.test.ts
```

Expected: PASS.

- [x] **Step 2: Run package typecheck**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

- [x] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [x] **Step 4: Review the diff before any commit**

Run:

```bash
git diff -- packages/knowledge/src packages/knowledge/test docs/packages/knowledge/knowledge-retrieval-runtime.md docs/superpowers/specs/2026-05-01-knowledge-post-retrieval-design.md docs/superpowers/plans/2026-05-01-knowledge-post-retrieval.md
```

Expected review focus:

- `runKnowledgeRetrieval()` still resolves metadata filters before retrieval.
- context expansion still receives only post-processed hits.
- diagnostics do not include dropped sensitive content.
- root exports expose stage contracts and defaults from canonical package paths.
- docs describe the current implemented pipeline, not an aspirational future version.

- [ ] **Step 5: Commit only this feature's files after review passes**

Stage only the files in this plan:

```bash
git add packages/knowledge/src/runtime/stages/post-retrieval-filter.ts \
  packages/knowledge/src/runtime/stages/post-retrieval-ranker.ts \
  packages/knowledge/src/runtime/stages/post-retrieval-diversifier.ts \
  packages/knowledge/src/runtime/defaults/default-post-retrieval-filter.ts \
  packages/knowledge/src/runtime/defaults/default-post-retrieval-ranker.ts \
  packages/knowledge/src/runtime/defaults/default-post-retrieval-diversifier.ts \
  packages/knowledge/src/runtime/types/retrieval-runtime.types.ts \
  packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts \
  packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts \
  packages/knowledge/src/index.ts \
  packages/knowledge/test/post-retrieval-filter.test.ts \
  packages/knowledge/test/post-retrieval-ranker.test.ts \
  packages/knowledge/test/post-retrieval-diversifier.test.ts \
  packages/knowledge/test/run-knowledge-retrieval.test.ts \
  packages/knowledge/test/root-exports.test.ts \
  docs/packages/knowledge/knowledge-retrieval-runtime.md \
  docs/superpowers/specs/2026-05-01-knowledge-post-retrieval-design.md \
  docs/superpowers/plans/2026-05-01-knowledge-post-retrieval.md
```

Commit:

```bash
git commit -m "feat: add knowledge post-retrieval pipeline"
```

Expected: commit succeeds without `--no-verify`.

## Self-Review

- Spec coverage: The plan covers stage contracts, filtering, ranking, diversification, pipeline ordering, diagnostics, docs, root exports, and verification. It intentionally excludes cross-encoder, LLM judge, PII provider, and embedding MMR per the design non-goals.
- Placeholder scan: No task uses unresolved placeholder language; each code-changing task includes exact file paths, code, commands, and expected results.
- Type consistency: Stage names use `postRetrievalFilter`, `postRetrievalRanker`, and `postRetrievalDiversifier` consistently in config, tests, pipeline, exports, and diagnostics.
