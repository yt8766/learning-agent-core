# Knowledge RAG SDK Runtime Architecture Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-03

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Knowledge RAG SDK runtime with LLM-first planning, retrieval execution, grounded answer generation, and streaming events.

**Architecture:** `packages/knowledge` becomes the owner of the RAG main chain: `PreRetrievalPlanner -> RetrievalRuntime -> RagAnswerRuntime`. `apps/backend/knowledge-server` injects auth-scoped knowledge base candidates, search/provider adapters, and transports SDK JSON or stream events; `apps/frontend/knowledge` consumes the SDK event projection through `/api/chat`.

**Tech Stack:** TypeScript, zod, Vitest, NestJS, React, Ant Design X, SSE, pnpm.

---

## File Structure

Create SDK RAG modules under `packages/knowledge/src/rag/`:

- `schemas/knowledge-rag-policy.schema.ts`: schema-first policy and no-answer policy contracts.
- `schemas/knowledge-rag-planning.schema.ts`: routing candidates, routing decisions, plan, planning diagnostics.
- `schemas/knowledge-rag-result.schema.ts`: retrieval result, answer result, final RAG result, diagnostics, errors.
- `schemas/knowledge-rag-stream.schema.ts`: stream event discriminated union.
- `providers/structured-planner-provider.ts`: `KnowledgeStructuredPlannerProvider` interface.
- `providers/answer-provider.ts`: `KnowledgeAnswerProvider` interface.
- `planning/pre-retrieval-planner.ts`: LLM-first planner with schema parse, validation, and fallback.
- `retrieval/rag-retrieval-runtime.ts`: wrapper around existing `runKnowledgeRetrieval()`.
- `answer/rag-answer-runtime.ts`: grounded answer generation and no-answer handling.
- `runtime/run-knowledge-rag.ts`: non-stream high-level entry.
- `runtime/stream-knowledge-rag.ts`: stream high-level entry.
- `index.ts`: rag module barrel.

Modify existing SDK files:

- `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`: add `filters.knowledgeBaseIds` and optional `RetrievalHit.knowledgeBaseId`.
- `packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts`: resolve and enforce `knowledgeBaseIds`.
- `packages/knowledge/src/index.ts`: export new RAG contracts and runtime entrypoints.

Backend adapter files:

- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-server-search-service.adapter.ts`: maps knowledge-server documents/chunks or vector hits to SDK `RetrievalHit`.
- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.providers.ts`: wraps configured providers into SDK planner/answer provider interfaces.
- `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`: composes SDK runtime input from auth user, request, repository, and providers.
- `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`: maps `stream: true` to SSE and `stream: false` to JSON.
- `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`: delegates chat to SDK facade.

Frontend files:

- `apps/frontend/knowledge/src/api/knowledge-chat-stream.ts`: parses SSE events into `KnowledgeRagStreamEvent`.
- `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`: supports stream mode and updates run state.
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`: displays planner/retrieval/answer phases, citations, and final diagnostics.

Docs:

- `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- `docs/apps/backend/knowledge-server/knowledge-server.md`
- `docs/apps/frontend/knowledge/knowledge-chat-lab.md`

## Task 1: SDK RAG Contract Schemas

**Files:**

- Create: `packages/knowledge/src/rag/schemas/knowledge-rag-policy.schema.ts`
- Create: `packages/knowledge/src/rag/schemas/knowledge-rag-planning.schema.ts`
- Create: `packages/knowledge/src/rag/schemas/knowledge-rag-result.schema.ts`
- Create: `packages/knowledge/src/rag/schemas/knowledge-rag-stream.schema.ts`
- Create: `packages/knowledge/src/rag/schemas/index.ts`
- Create: `packages/knowledge/test/knowledge-rag-contracts.test.ts`
- Modify: `packages/knowledge/src/index.ts`

- [x] **Step 1: Write failing schema export tests**

Create `packages/knowledge/test/knowledge-rag-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  KnowledgeBaseRoutingCandidateSchema,
  KnowledgePreRetrievalPlanSchema,
  KnowledgeRagPolicySchema,
  KnowledgeRagResultSchema,
  KnowledgeRagStreamEventSchema
} from '../src';

describe('Knowledge RAG SDK contracts', () => {
  it('parses a planner policy and routing candidate', () => {
    expect(
      KnowledgeRagPolicySchema.parse({
        maxSelectedKnowledgeBases: 3,
        minPlannerConfidence: 0.65,
        defaultSearchMode: 'hybrid',
        fallbackWhenPlannerFails: 'search-all-accessible',
        fallbackWhenLowConfidence: 'expand-to-top-n',
        maxQueryVariants: 4,
        retrievalTopK: 8,
        contextBudgetTokens: 6000,
        requireGroundedCitations: true,
        noAnswer: {
          minHitCount: 1,
          allowAnswerWithoutCitation: false,
          responseStyle: 'explicit-insufficient-evidence'
        }
      })
    ).toMatchObject({ defaultSearchMode: 'hybrid' });

    expect(
      KnowledgeBaseRoutingCandidateSchema.parse({
        id: 'kb_rag',
        name: 'RAG Runtime',
        description: 'query rewrite and pre-retrieval routing',
        tags: ['rag'],
        documentCount: 2,
        recentDocumentTitles: ['Knowledge RAG SDK Runtime Architecture'],
        domainSummary: 'RAG planner, retrieval runtime, answer runtime',
        updatedAt: '2026-05-03T00:00:00.000Z'
      })
    ).toMatchObject({ id: 'kb_rag' });
  });

  it('parses a final result and stream completion event', () => {
    const plan = KnowledgePreRetrievalPlanSchema.parse({
      id: 'plan_1',
      originalQuery: '检索前有什么',
      rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
      queryVariants: ['RAG 检索前阶段', 'pre-retrieval planner'],
      selectedKnowledgeBaseIds: ['kb_rag'],
      searchMode: 'hybrid',
      selectionReason: '用户询问检索前阶段',
      confidence: 0.86,
      fallbackPolicy: 'expand-to-top-n',
      routingDecisions: [
        {
          knowledgeBaseId: 'kb_rag',
          selected: true,
          source: 'llm',
          reason: 'contains pre-retrieval planning'
        }
      ],
      diagnostics: {
        planner: 'llm',
        consideredKnowledgeBaseCount: 1,
        rewriteApplied: true,
        fallbackApplied: false
      }
    });

    const result = KnowledgeRagResultSchema.parse({
      runId: 'rag_1',
      plan,
      retrieval: {
        hits: [],
        total: 0,
        citations: [],
        diagnostics: {
          runId: 'retrieval_1',
          startedAt: '2026-05-03T00:00:00.000Z',
          durationMs: 1,
          originalQuery: '检索前有什么',
          normalizedQuery: 'RAG 检索前阶段包括哪些能力',
          rewriteApplied: true,
          queryVariants: ['RAG 检索前阶段'],
          executedQueries: ['RAG 检索前阶段'],
          preHitCount: 0,
          postHitCount: 0,
          contextAssembled: false
        }
      },
      answer: {
        text: '未在当前知识库中找到足够依据。',
        noAnswer: true,
        citations: [],
        diagnostics: {
          durationMs: 1,
          groundedCitationCount: 0,
          noAnswerReason: 'no_hits'
        }
      },
      diagnostics: {
        durationMs: 3,
        plannerDurationMs: 1,
        retrievalDurationMs: 1,
        answerDurationMs: 1
      }
    });

    expect(KnowledgeRagStreamEventSchema.parse({ type: 'rag.completed', runId: 'rag_1', result })).toEqual({
      type: 'rag.completed',
      runId: 'rag_1',
      result
    });
  });
});
```

- [x] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-rag-contracts.test.ts
```

Expected: FAIL because the RAG schemas are not exported.

- [x] **Step 3: Add policy schema**

Create `packages/knowledge/src/rag/schemas/knowledge-rag-policy.schema.ts`:

```ts
import { z } from 'zod';

export const KnowledgeRagSearchModeSchema = z.enum(['hybrid', 'vector-only', 'keyword-only']);
export const KnowledgeRagFallbackPolicySchema = z.enum(['selected-only', 'expand-to-top-n', 'search-all-accessible']);

export const KnowledgeNoAnswerPolicySchema = z.object({
  minHitCount: z.number().int().nonnegative(),
  minTopScore: z.number().min(0).max(1).optional(),
  allowAnswerWithoutCitation: z.boolean(),
  responseStyle: z.enum(['explicit-insufficient-evidence', 'ask-clarifying-question'])
});

export const KnowledgeRagPolicySchema = z.object({
  maxSelectedKnowledgeBases: z.number().int().positive(),
  minPlannerConfidence: z.number().min(0).max(1),
  defaultSearchMode: KnowledgeRagSearchModeSchema,
  fallbackWhenPlannerFails: z.enum(['deterministic', 'embedding', 'search-all-accessible']),
  fallbackWhenLowConfidence: z.enum(['expand-to-top-n', 'search-all-accessible', 'ask-clarifying-question']),
  maxQueryVariants: z.number().int().positive(),
  retrievalTopK: z.number().int().positive(),
  contextBudgetTokens: z.number().int().positive(),
  requireGroundedCitations: z.boolean(),
  noAnswer: KnowledgeNoAnswerPolicySchema
});

export type KnowledgeRagSearchMode = z.infer<typeof KnowledgeRagSearchModeSchema>;
export type KnowledgeRagFallbackPolicy = z.infer<typeof KnowledgeRagFallbackPolicySchema>;
export type KnowledgeNoAnswerPolicy = z.infer<typeof KnowledgeNoAnswerPolicySchema>;
export type KnowledgeRagPolicy = z.infer<typeof KnowledgeRagPolicySchema>;
```

- [x] **Step 4: Add planning schema**

Create `packages/knowledge/src/rag/schemas/knowledge-rag-planning.schema.ts`:

```ts
import { z } from 'zod';

import { KnowledgeRagFallbackPolicySchema, KnowledgeRagSearchModeSchema } from './knowledge-rag-policy.schema';

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema)
  ])
);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const KnowledgeBaseRoutingCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  documentCount: z.number().int().nonnegative().optional(),
  recentDocumentTitles: z.array(z.string()).optional(),
  domainSummary: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional()
});

export const KnowledgeBaseRoutingDecisionSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  selected: z.boolean(),
  score: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  source: z.enum(['llm', 'embedding', 'deterministic', 'fallback'])
});

export const KnowledgeRetrievalStrategyHintsSchema = z.object({
  searchMode: KnowledgeRagSearchModeSchema.optional(),
  maxKnowledgeBases: z.number().int().positive().optional(),
  topK: z.number().int().positive().optional(),
  rerankRequired: z.boolean().optional(),
  contextBudgetTokens: z.number().int().positive().optional(),
  expectedEvidenceTypes: z.array(z.string()).optional()
});

export const KnowledgePlanningDiagnosticsSchema = z.object({
  planner: z.enum(['llm', 'embedding', 'deterministic', 'hybrid', 'fallback']),
  consideredKnowledgeBaseCount: z.number().int().nonnegative(),
  rewriteApplied: z.boolean(),
  fallbackApplied: z.boolean(),
  fallbackReason: z.string().optional(),
  invalidSelectedKnowledgeBaseIds: z.array(z.string()).optional()
});

export const KnowledgePreRetrievalPlanSchema = z.object({
  id: z.string().min(1),
  originalQuery: z.string().min(1),
  rewrittenQuery: z.string().min(1),
  queryVariants: z.array(z.string().min(1)).min(1),
  selectedKnowledgeBaseIds: z.array(z.string().min(1)),
  searchMode: KnowledgeRagSearchModeSchema.optional(),
  selectionReason: z.string(),
  confidence: z.number().min(0).max(1),
  fallbackPolicy: KnowledgeRagFallbackPolicySchema,
  expectedEvidenceTypes: z.array(z.string()).optional(),
  strategyHints: KnowledgeRetrievalStrategyHintsSchema.optional(),
  routingDecisions: z.array(KnowledgeBaseRoutingDecisionSchema),
  diagnostics: KnowledgePlanningDiagnosticsSchema
});

export type KnowledgeBaseRoutingCandidate = z.infer<typeof KnowledgeBaseRoutingCandidateSchema>;
export type KnowledgeBaseRoutingDecision = z.infer<typeof KnowledgeBaseRoutingDecisionSchema>;
export type KnowledgeRetrievalStrategyHints = z.infer<typeof KnowledgeRetrievalStrategyHintsSchema>;
export type KnowledgePlanningDiagnostics = z.infer<typeof KnowledgePlanningDiagnosticsSchema>;
export type KnowledgePreRetrievalPlan = z.infer<typeof KnowledgePreRetrievalPlanSchema>;
```

- [x] **Step 5: Add result and stream schemas**

Create `packages/knowledge/src/rag/schemas/knowledge-rag-result.schema.ts`:

```ts
import { z } from 'zod';

import { CitationSchema, RetrievalHitSchema } from '../../contracts/schemas/knowledge-retrieval.schema';
import { RetrievalDiagnosticsSchema } from '../../runtime/types/retrieval-runtime.types';
import { KnowledgePreRetrievalPlanSchema } from './knowledge-rag-planning.schema';
import { KnowledgeRagSearchModeSchema } from './knowledge-rag-policy.schema';

export const KnowledgeRagErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  recoverable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const KnowledgeRagRetrievalResultSchema = z.object({
  hits: z.array(RetrievalHitSchema),
  total: z.number().int().nonnegative(),
  citations: z.array(CitationSchema),
  contextBundle: z.string().optional(),
  diagnostics: RetrievalDiagnosticsSchema.extend({
    requestedSearchMode: KnowledgeRagSearchModeSchema.optional(),
    effectiveSearchMode: KnowledgeRagSearchModeSchema.optional(),
    searchModeFallbackReason: z.string().optional()
  })
});

export const KnowledgeRagAnswerDiagnosticsSchema = z.object({
  durationMs: z.number().int().nonnegative(),
  providerId: z.string().optional(),
  model: z.string().optional(),
  streamingFallback: z.enum(['non-stream-provider']).optional(),
  noAnswerReason: z.enum(['no_hits', 'low_score', 'no_grounded_citations']).optional(),
  groundedCitationCount: z.number().int().nonnegative()
});

export const KnowledgeRagAnswerSchema = z.object({
  text: z.string(),
  noAnswer: z.boolean(),
  citations: z.array(CitationSchema),
  confidence: z.number().min(0).max(1).optional(),
  diagnostics: KnowledgeRagAnswerDiagnosticsSchema
});

export const KnowledgeRagDiagnosticsSchema = z.object({
  durationMs: z.number().int().nonnegative(),
  plannerDurationMs: z.number().int().nonnegative(),
  retrievalDurationMs: z.number().int().nonnegative(),
  answerDurationMs: z.number().int().nonnegative()
});

export const KnowledgeRagResultSchema = z.object({
  runId: z.string().min(1),
  traceId: z.string().optional(),
  plan: KnowledgePreRetrievalPlanSchema,
  retrieval: KnowledgeRagRetrievalResultSchema,
  answer: KnowledgeRagAnswerSchema,
  diagnostics: KnowledgeRagDiagnosticsSchema
});

export type KnowledgeRagError = z.infer<typeof KnowledgeRagErrorSchema>;
export type KnowledgeRagRetrievalResult = z.infer<typeof KnowledgeRagRetrievalResultSchema>;
export type KnowledgeRagAnswerDiagnostics = z.infer<typeof KnowledgeRagAnswerDiagnosticsSchema>;
export type KnowledgeRagAnswer = z.infer<typeof KnowledgeRagAnswerSchema>;
export type KnowledgeRagDiagnostics = z.infer<typeof KnowledgeRagDiagnosticsSchema>;
export type KnowledgeRagResult = z.infer<typeof KnowledgeRagResultSchema>;
```

Create `packages/knowledge/src/rag/schemas/knowledge-rag-stream.schema.ts`:

```ts
import { z } from 'zod';

import { KnowledgePreRetrievalPlanSchema } from './knowledge-rag-planning.schema';
import {
  KnowledgeRagAnswerSchema,
  KnowledgeRagErrorSchema,
  KnowledgeRagResultSchema,
  KnowledgeRagRetrievalResultSchema
} from './knowledge-rag-result.schema';

export const KnowledgeRagStageSchema = z.enum(['planner', 'retrieval', 'answer', 'cancelled']);

export const KnowledgeRagStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rag.started'),
    runId: z.string(),
    traceId: z.string().optional(),
    createdAt: z.string()
  }),
  z.object({ type: z.literal('planner.started'), runId: z.string() }),
  z.object({ type: z.literal('planner.completed'), runId: z.string(), plan: KnowledgePreRetrievalPlanSchema }),
  z.object({ type: z.literal('retrieval.started'), runId: z.string(), planId: z.string() }),
  z.object({ type: z.literal('retrieval.completed'), runId: z.string(), retrieval: KnowledgeRagRetrievalResultSchema }),
  z.object({ type: z.literal('answer.started'), runId: z.string() }),
  z.object({ type: z.literal('answer.delta'), runId: z.string(), delta: z.string() }),
  z.object({ type: z.literal('answer.completed'), runId: z.string(), answer: KnowledgeRagAnswerSchema }),
  z.object({ type: z.literal('rag.completed'), runId: z.string(), result: KnowledgeRagResultSchema }),
  z.object({
    type: z.literal('rag.error'),
    runId: z.string(),
    stage: KnowledgeRagStageSchema,
    error: KnowledgeRagErrorSchema
  })
]);

export type KnowledgeRagStage = z.infer<typeof KnowledgeRagStageSchema>;
export type KnowledgeRagStreamEvent = z.infer<typeof KnowledgeRagStreamEventSchema>;
```

- [x] **Step 6: Export schemas**

Create `packages/knowledge/src/rag/schemas/index.ts`:

```ts
export * from './knowledge-rag-policy.schema';
export * from './knowledge-rag-planning.schema';
export * from './knowledge-rag-result.schema';
export * from './knowledge-rag-stream.schema';
```

Append to `packages/knowledge/src/index.ts`:

```ts
export * from './rag/schemas';
```

- [x] **Step 7: Run contract tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-rag-contracts.test.ts
```

Expected: PASS.

## Task 2: Retrieval Contract Supports Knowledge Base Filters

**Files:**

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
- Modify: `packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts`
- Test: `packages/knowledge/test/knowledge-retrieval-filters.test.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [x] **Step 1: Write failing filter tests**

Add to `packages/knowledge/test/knowledge-retrieval-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  matchesKnowledgeHitFilters,
  resolveKnowledgeRetrievalFilters
} from '../src/retrieval/knowledge-retrieval-filters';

describe('knowledgeBaseIds retrieval filters', () => {
  it('resolves knowledgeBaseIds and filters hits defensively', () => {
    const filters = resolveKnowledgeRetrievalFilters({
      query: 'pre retrieval',
      filters: { knowledgeBaseIds: ['kb_rag'] }
    });

    expect(filters.knowledgeBaseIds).toEqual(['kb_rag']);
    expect(
      matchesKnowledgeHitFilters(
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          sourceId: 'source_1',
          knowledgeBaseId: 'kb_rag',
          title: 'RAG',
          uri: 'doc://rag',
          sourceType: 'user-upload',
          trustClass: 'internal',
          content: 'pre retrieval planner',
          score: 1,
          citation: {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            title: 'RAG',
            uri: 'doc://rag',
            sourceType: 'user-upload',
            trustClass: 'internal'
          }
        },
        filters
      )
    ).toBe(true);
    expect(
      matchesKnowledgeHitFilters(
        {
          chunkId: 'chunk_2',
          documentId: 'doc_2',
          sourceId: 'source_2',
          knowledgeBaseId: 'kb_other',
          title: 'Other',
          uri: 'doc://other',
          sourceType: 'user-upload',
          trustClass: 'internal',
          content: 'other content',
          score: 1,
          citation: {
            sourceId: 'source_2',
            chunkId: 'chunk_2',
            title: 'Other',
            uri: 'doc://other',
            sourceType: 'user-upload',
            trustClass: 'internal'
          }
        },
        filters
      )
    ).toBe(false);
  });
});
```

- [x] **Step 2: Run failing filter test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-retrieval-filters.test.ts
```

Expected: FAIL because `knowledgeBaseIds` is not resolved or enforced.

- [x] **Step 3: Extend retrieval schemas**

In `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`, add:

```ts
export const KnowledgeRetrievalFiltersSchema = z.object({
  knowledgeBaseIds: z.array(z.string()).optional(),
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

Also extend `RetrievalHitSchema`:

```ts
knowledgeBaseId: z.string().optional(),
```

- [x] **Step 4: Extend filter helpers**

In `packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts`, extend the resolved filter type:

```ts
knowledgeBaseIds?: string[];
```

In `resolveKnowledgeRetrievalFilters()`, preserve `request.filters?.knowledgeBaseIds`.

In `matchesKnowledgeHitFilters()`, add:

```ts
if (isEnabledFilter(filters.knowledgeBaseIds) && !filters.knowledgeBaseIds.includes(hit.knowledgeBaseId ?? '')) {
  return false;
}
```

- [x] **Step 5: Run retrieval tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-retrieval-filters.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Expected: PASS.

## Task 3: Provider Interfaces And LLM-First Planner

**Files:**

- Create: `packages/knowledge/src/rag/providers/structured-planner-provider.ts`
- Create: `packages/knowledge/src/rag/providers/index.ts`
- Create: `packages/knowledge/src/rag/planning/pre-retrieval-planner.ts`
- Create: `packages/knowledge/src/rag/planning/index.ts`
- Test: `packages/knowledge/test/pre-retrieval-planner.test.ts`
- Modify: `packages/knowledge/src/rag/index.ts`
- Modify: `packages/knowledge/src/index.ts`

- [x] **Step 1: Write failing planner tests**

Create `packages/knowledge/test/pre-retrieval-planner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { DefaultPreRetrievalPlanner } from '../src/rag/planning/pre-retrieval-planner';

const policy = {
  maxSelectedKnowledgeBases: 2,
  minPlannerConfidence: 0.65,
  defaultSearchMode: 'hybrid' as const,
  fallbackWhenPlannerFails: 'search-all-accessible' as const,
  fallbackWhenLowConfidence: 'expand-to-top-n' as const,
  maxQueryVariants: 4,
  retrievalTopK: 8,
  contextBudgetTokens: 6000,
  requireGroundedCitations: true,
  noAnswer: {
    minHitCount: 1,
    allowAnswerWithoutCitation: false,
    responseStyle: 'explicit-insufficient-evidence' as const
  }
};

const accessibleKnowledgeBases = [
  { id: 'kb_rag', name: 'RAG Runtime', description: 'pre-retrieval planner and query rewrite' },
  { id: 'kb_ui', name: 'Frontend UI', description: 'React visual layout' }
];

describe('DefaultPreRetrievalPlanner', () => {
  it('uses the LLM planner result after validation', async () => {
    const provider = {
      plan: vi.fn(async () => ({
        rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
        queryVariants: ['RAG 检索前阶段', 'pre-retrieval planner'],
        selectedKnowledgeBaseIds: ['kb_rag'],
        searchMode: 'hybrid',
        selectionReason: '用户询问检索前阶段',
        confidence: 0.86,
        fallbackPolicy: 'expand-to-top-n',
        expectedEvidenceTypes: ['architecture-doc'],
        routingDecisions: [
          { knowledgeBaseId: 'kb_rag', selected: true, source: 'llm', reason: 'matches planner topic' }
        ]
      }))
    };

    const plan = await new DefaultPreRetrievalPlanner(provider, policy).plan({
      query: '检索前有什么',
      accessibleKnowledgeBases
    });

    expect(provider.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '检索前有什么',
        knowledgeBases: accessibleKnowledgeBases,
        policy
      })
    );
    expect(plan).toMatchObject({
      originalQuery: '检索前有什么',
      rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
      selectedKnowledgeBaseIds: ['kb_rag'],
      confidence: 0.86,
      diagnostics: { planner: 'llm', fallbackApplied: false }
    });
  });

  it('drops inaccessible ids and falls back when selection becomes empty', async () => {
    const provider = {
      plan: vi.fn(async () => ({
        rewrittenQuery: 'RAG 检索前阶段',
        queryVariants: [],
        selectedKnowledgeBaseIds: ['kb_private'],
        selectionReason: 'bad id',
        confidence: 0.9,
        fallbackPolicy: 'selected-only',
        routingDecisions: []
      }))
    };

    const plan = await new DefaultPreRetrievalPlanner(provider, policy).plan({
      query: '检索前有什么',
      accessibleKnowledgeBases
    });

    expect(plan.selectedKnowledgeBaseIds).toEqual(['kb_rag', 'kb_ui']);
    expect(plan.queryVariants).toEqual(['RAG 检索前阶段']);
    expect(plan.diagnostics).toMatchObject({
      fallbackApplied: true,
      invalidSelectedKnowledgeBaseIds: ['kb_private']
    });
  });
});
```

- [x] **Step 2: Run failing planner tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/pre-retrieval-planner.test.ts
```

Expected: FAIL because planner files do not exist.

- [x] **Step 3: Add structured planner provider interface**

Create `packages/knowledge/src/rag/providers/structured-planner-provider.ts`:

```ts
import type {
  KnowledgeBaseRoutingCandidate,
  KnowledgeBaseRoutingDecision,
  KnowledgeRagFallbackPolicy,
  KnowledgeRagPolicy,
  KnowledgeRagSearchMode
} from '../schemas';

export interface KnowledgePlannerProviderInput {
  query: string;
  conversation?: {
    summary?: string;
    recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  knowledgeBases: KnowledgeBaseRoutingCandidate[];
  policy: KnowledgeRagPolicy;
}

export interface KnowledgePlannerProviderResult {
  rewrittenQuery: string;
  queryVariants: string[];
  selectedKnowledgeBaseIds: string[];
  searchMode?: KnowledgeRagSearchMode;
  selectionReason: string;
  confidence: number;
  fallbackPolicy: KnowledgeRagFallbackPolicy;
  expectedEvidenceTypes?: string[];
  routingDecisions: KnowledgeBaseRoutingDecision[];
}

export interface KnowledgeStructuredPlannerProvider {
  plan(input: KnowledgePlannerProviderInput): Promise<KnowledgePlannerProviderResult>;
}
```

Create `packages/knowledge/src/rag/providers/index.ts`:

```ts
export * from './structured-planner-provider';
```

- [x] **Step 4: Implement planner**

Create `packages/knowledge/src/rag/planning/pre-retrieval-planner.ts`:

```ts
import { randomUUID } from 'node:crypto';

import type { KnowledgeStructuredPlannerProvider } from '../providers';
import {
  KnowledgePreRetrievalPlanSchema,
  type KnowledgeBaseRoutingCandidate,
  type KnowledgePreRetrievalPlan,
  type KnowledgeRagPolicy
} from '../schemas';

export interface PreRetrievalPlannerInput {
  query: string;
  conversation?: {
    summary?: string;
    recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
}

export class DefaultPreRetrievalPlanner {
  constructor(
    private readonly provider: KnowledgeStructuredPlannerProvider,
    private readonly policy: KnowledgeRagPolicy
  ) {}

  async plan(input: PreRetrievalPlannerInput): Promise<KnowledgePreRetrievalPlan> {
    const accessibleIds = new Set(input.accessibleKnowledgeBases.map(base => base.id));
    try {
      const providerResult = await this.provider.plan({
        query: input.query,
        conversation: input.conversation,
        knowledgeBases: input.accessibleKnowledgeBases,
        policy: this.policy
      });
      const invalidSelectedKnowledgeBaseIds = providerResult.selectedKnowledgeBaseIds.filter(
        id => !accessibleIds.has(id)
      );
      const selectedKnowledgeBaseIds = providerResult.selectedKnowledgeBaseIds.filter(id => accessibleIds.has(id));
      const fallbackApplied =
        selectedKnowledgeBaseIds.length === 0 || providerResult.confidence < this.policy.minPlannerConfidence;
      const finalSelectedIds = fallbackApplied
        ? input.accessibleKnowledgeBases.slice(0, this.policy.maxSelectedKnowledgeBases).map(base => base.id)
        : selectedKnowledgeBaseIds.slice(0, this.policy.maxSelectedKnowledgeBases);
      const rewrittenQuery = providerResult.rewrittenQuery.trim() || input.query.trim();
      const queryVariants = dedupeQueries(
        providerResult.queryVariants.length ? providerResult.queryVariants : [rewrittenQuery]
      );

      return KnowledgePreRetrievalPlanSchema.parse({
        id: `plan_${randomUUID()}`,
        originalQuery: input.query,
        rewrittenQuery,
        queryVariants,
        selectedKnowledgeBaseIds: finalSelectedIds,
        searchMode: providerResult.searchMode ?? this.policy.defaultSearchMode,
        selectionReason: providerResult.selectionReason,
        confidence: clamp(providerResult.confidence),
        fallbackPolicy: fallbackApplied ? this.policy.fallbackWhenLowConfidence : providerResult.fallbackPolicy,
        expectedEvidenceTypes: providerResult.expectedEvidenceTypes,
        routingDecisions: providerResult.routingDecisions,
        diagnostics: {
          planner: 'llm',
          consideredKnowledgeBaseCount: input.accessibleKnowledgeBases.length,
          rewriteApplied: rewrittenQuery !== input.query.trim(),
          fallbackApplied,
          fallbackReason: fallbackApplied ? 'planner selection was invalid or below confidence threshold' : undefined,
          invalidSelectedKnowledgeBaseIds:
            invalidSelectedKnowledgeBaseIds.length > 0 ? invalidSelectedKnowledgeBaseIds : undefined
        }
      });
    } catch {
      return this.fallbackPlan(input);
    }
  }

  private fallbackPlan(input: PreRetrievalPlannerInput): KnowledgePreRetrievalPlan {
    const selectedKnowledgeBaseIds = input.accessibleKnowledgeBases
      .slice(0, this.policy.maxSelectedKnowledgeBases)
      .map(base => base.id);
    return KnowledgePreRetrievalPlanSchema.parse({
      id: `plan_${randomUUID()}`,
      originalQuery: input.query,
      rewrittenQuery: input.query.trim(),
      queryVariants: [input.query.trim()],
      selectedKnowledgeBaseIds,
      searchMode: this.policy.defaultSearchMode,
      selectionReason: 'Planner provider failed; selected accessible knowledge bases by fallback policy.',
      confidence: 0,
      fallbackPolicy: 'search-all-accessible',
      routingDecisions: selectedKnowledgeBaseIds.map(id => ({
        knowledgeBaseId: id,
        selected: true,
        source: 'fallback',
        reason: 'planner provider failed'
      })),
      diagnostics: {
        planner: 'fallback',
        consideredKnowledgeBaseCount: input.accessibleKnowledgeBases.length,
        rewriteApplied: false,
        fallbackApplied: true,
        fallbackReason: 'planner provider failed'
      }
    });
  }
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  return queries
    .map(query => query.trim())
    .filter(Boolean)
    .filter(query => {
      const key = query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
```

Create `packages/knowledge/src/rag/planning/index.ts`:

```ts
export * from './pre-retrieval-planner';
```

- [x] **Step 5: Export rag module**

Create `packages/knowledge/src/rag/index.ts`:

```ts
export * from './schemas';
export * from './providers';
export * from './planning';
```

Update `packages/knowledge/src/index.ts`:

```ts
export * from './rag';
```

- [x] **Step 6: Run planner tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/pre-retrieval-planner.test.ts packages/knowledge/test/knowledge-rag-contracts.test.ts
```

Expected: PASS.

## Task 4: Retrieval Runtime Wrapper

**Files:**

- Create: `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`
- Create: `packages/knowledge/src/rag/retrieval/index.ts`
- Test: `packages/knowledge/test/rag-retrieval-runtime.test.ts`
- Modify: `packages/knowledge/src/rag/index.ts`

- [x] **Step 1: Write failing retrieval runtime test**

Create `packages/knowledge/test/rag-retrieval-runtime.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { RagRetrievalRuntime } from '../src/rag/retrieval/rag-retrieval-runtime';

describe('RagRetrievalRuntime', () => {
  it('executes retrieval with planner knowledgeBaseIds and query variants', async () => {
    const search = vi.fn(async request => ({
      hits:
        request.query === 'pre-retrieval planner'
          ? [
              {
                chunkId: 'chunk_1',
                documentId: 'doc_1',
                sourceId: 'source_1',
                knowledgeBaseId: 'kb_rag',
                title: 'RAG SDK',
                uri: 'doc://rag',
                sourceType: 'user-upload',
                trustClass: 'internal',
                content: 'pre-retrieval planner selects knowledge bases before search',
                score: 0.9,
                citation: {
                  sourceId: 'source_1',
                  chunkId: 'chunk_1',
                  title: 'RAG SDK',
                  uri: 'doc://rag',
                  quote: 'pre-retrieval planner selects knowledge bases before search',
                  sourceType: 'user-upload',
                  trustClass: 'internal'
                }
              }
            ]
          : [],
      total: request.query === 'pre-retrieval planner' ? 1 : 0
    }));

    const runtime = new RagRetrievalRuntime({ searchService: { search } });
    const result = await runtime.retrieve({
      plan: {
        id: 'plan_1',
        originalQuery: '检索前有什么',
        rewrittenQuery: 'RAG 检索前阶段',
        queryVariants: ['RAG 检索前阶段', 'pre-retrieval planner'],
        selectedKnowledgeBaseIds: ['kb_rag'],
        searchMode: 'hybrid',
        selectionReason: 'selected rag',
        confidence: 0.8,
        fallbackPolicy: 'selected-only',
        routingDecisions: [],
        diagnostics: {
          planner: 'llm',
          consideredKnowledgeBaseCount: 1,
          rewriteApplied: true,
          fallbackApplied: false
        }
      }
    });

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ filters: { knowledgeBaseIds: ['kb_rag'] } }));
    expect(result.citations).toEqual([expect.objectContaining({ chunkId: 'chunk_1', title: 'RAG SDK' })]);
    expect(result.diagnostics.executedQueries).toEqual(['RAG 检索前阶段', 'pre-retrieval planner']);
  });
});
```

- [x] **Step 2: Run failing retrieval runtime test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/rag-retrieval-runtime.test.ts
```

Expected: FAIL because `RagRetrievalRuntime` does not exist.

- [x] **Step 3: Implement retrieval runtime**

Create `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`:

```ts
import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import { runKnowledgeRetrieval } from '../../runtime/pipeline/run-knowledge-retrieval';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import type { KnowledgePreRetrievalPlan, KnowledgeRagRetrievalResult } from '../schemas';

export interface RagRetrievalRuntimeOptions {
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
}

export interface RagRetrievalRuntimeInput {
  plan: KnowledgePreRetrievalPlan;
}

export class RagRetrievalRuntime {
  constructor(private readonly options: RagRetrievalRuntimeOptions) {}

  async retrieve(input: RagRetrievalRuntimeInput): Promise<KnowledgeRagRetrievalResult> {
    const result = await runKnowledgeRetrieval({
      request: {
        query: input.plan.rewrittenQuery,
        limit: input.plan.strategyHints?.topK,
        filters: {
          knowledgeBaseIds: input.plan.selectedKnowledgeBaseIds
        }
      },
      searchService: this.options.searchService,
      pipeline: {
        ...this.options.pipeline,
        queryNormalizer: {
          normalize: async request => ({
            ...request,
            originalQuery: input.plan.originalQuery,
            normalizedQuery: input.plan.rewrittenQuery,
            topK: request.limit ?? input.plan.strategyHints?.topK ?? 5,
            rewriteApplied: input.plan.originalQuery.trim() !== input.plan.rewrittenQuery.trim(),
            rewriteReason: 'pre-retrieval-plan',
            queryVariants: input.plan.queryVariants
          })
        }
      },
      assembleContext: true,
      includeDiagnostics: true
    });

    return {
      hits: result.hits,
      total: result.total,
      contextBundle: result.contextBundle,
      citations: result.hits.map(hit => hit.citation),
      diagnostics: {
        ...result.diagnostics!,
        requestedSearchMode: input.plan.searchMode,
        effectiveSearchMode: input.plan.searchMode
      }
    };
  }
}
```

Create `packages/knowledge/src/rag/retrieval/index.ts`:

```ts
export * from './rag-retrieval-runtime';
```

Update `packages/knowledge/src/rag/index.ts`:

```ts
export * from './retrieval';
```

- [x] **Step 4: Run retrieval runtime tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/rag-retrieval-runtime.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Expected: PASS.

## Task 5: Grounded Answer Runtime

**Files:**

- Create: `packages/knowledge/src/rag/providers/answer-provider.ts`
- Create: `packages/knowledge/src/rag/answer/rag-answer-runtime.ts`
- Create: `packages/knowledge/src/rag/answer/index.ts`
- Test: `packages/knowledge/test/rag-answer-runtime.test.ts`
- Modify: `packages/knowledge/src/rag/providers/index.ts`
- Modify: `packages/knowledge/src/rag/index.ts`

- [x] **Step 1: Write failing answer runtime tests**

Create `packages/knowledge/test/rag-answer-runtime.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { RagAnswerRuntime } from '../src/rag/answer/rag-answer-runtime';

const plan = {
  id: 'plan_1',
  originalQuery: '检索前有什么',
  rewrittenQuery: 'RAG 检索前阶段包括哪些能力',
  queryVariants: ['RAG 检索前阶段'],
  selectedKnowledgeBaseIds: ['kb_rag'],
  selectionReason: 'rag',
  confidence: 0.8,
  fallbackPolicy: 'selected-only' as const,
  routingDecisions: [],
  diagnostics: {
    planner: 'llm' as const,
    consideredKnowledgeBaseCount: 1,
    rewriteApplied: true,
    fallbackApplied: false
  }
};

describe('RagAnswerRuntime', () => {
  it('generates an answer grounded only in retrieval citations', async () => {
    const provider = {
      generate: vi.fn(async () => ({ text: '检索前包括 query rewrite 和知识库路由。', model: 'fake' }))
    };
    const runtime = new RagAnswerRuntime(provider, {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence'
    });

    const answer = await runtime.answer({
      plan,
      retrieval: {
        hits: [],
        total: 1,
        citations: [
          {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            title: 'RAG SDK',
            uri: 'doc://rag',
            quote: 'query rewrite and knowledge base routing',
            sourceType: 'user-upload',
            trustClass: 'internal'
          }
        ],
        diagnostics: {
          runId: 'retrieval_1',
          startedAt: '2026-05-03T00:00:00.000Z',
          durationMs: 1,
          originalQuery: '检索前有什么',
          normalizedQuery: 'RAG 检索前阶段包括哪些能力',
          rewriteApplied: true,
          queryVariants: ['RAG 检索前阶段'],
          executedQueries: ['RAG 检索前阶段'],
          preHitCount: 1,
          postHitCount: 1,
          contextAssembled: true
        },
        contextBundle: '[1] RAG SDK\nquery rewrite and knowledge base routing'
      }
    });

    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '检索前有什么',
        contextBundle: expect.stringContaining('query rewrite')
      })
    );
    expect(answer).toMatchObject({
      text: '检索前包括 query rewrite 和知识库路由。',
      noAnswer: false,
      citations: [expect.objectContaining({ chunkId: 'chunk_1' })],
      diagnostics: { groundedCitationCount: 1 }
    });
  });

  it('returns no-answer without calling the provider when no citations exist', async () => {
    const provider = { generate: vi.fn() };
    const runtime = new RagAnswerRuntime(provider, {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence'
    });

    const answer = await runtime.answer({
      plan,
      retrieval: {
        hits: [],
        total: 0,
        citations: [],
        diagnostics: {
          runId: 'retrieval_1',
          startedAt: '2026-05-03T00:00:00.000Z',
          durationMs: 1,
          originalQuery: '检索前有什么',
          normalizedQuery: 'RAG 检索前阶段包括哪些能力',
          rewriteApplied: true,
          queryVariants: ['RAG 检索前阶段'],
          executedQueries: ['RAG 检索前阶段'],
          preHitCount: 0,
          postHitCount: 0,
          contextAssembled: false
        }
      }
    });

    expect(provider.generate).not.toHaveBeenCalled();
    expect(answer).toMatchObject({
      noAnswer: true,
      citations: [],
      diagnostics: { noAnswerReason: 'no_hits' }
    });
  });
});
```

- [x] **Step 2: Run failing answer runtime tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/rag-answer-runtime.test.ts
```

Expected: FAIL because answer runtime files do not exist.

- [x] **Step 3: Add answer provider interface**

Create `packages/knowledge/src/rag/providers/answer-provider.ts`:

```ts
import type { Citation } from '@agent/knowledge';

export interface KnowledgeAnswerProviderInput {
  query: string;
  rewrittenQuery: string;
  contextBundle?: string;
  citations: Citation[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeAnswerProviderResult {
  text: string;
  model?: string;
  providerId?: string;
}

export interface KnowledgeAnswerProviderStreamEvent {
  type: 'delta' | 'completed';
  delta?: string;
  result?: KnowledgeAnswerProviderResult;
}

export interface KnowledgeAnswerProvider {
  generate(input: KnowledgeAnswerProviderInput): Promise<KnowledgeAnswerProviderResult>;
  stream?(input: KnowledgeAnswerProviderInput): AsyncIterable<KnowledgeAnswerProviderStreamEvent>;
}
```

Update `packages/knowledge/src/rag/providers/index.ts`:

```ts
export * from './answer-provider';
export * from './structured-planner-provider';
```

- [x] **Step 4: Implement answer runtime**

Create `packages/knowledge/src/rag/answer/rag-answer-runtime.ts`:

```ts
import type { KnowledgeAnswerProvider } from '../providers';
import {
  KnowledgeRagAnswerSchema,
  type KnowledgeNoAnswerPolicy,
  type KnowledgePreRetrievalPlan,
  type KnowledgeRagAnswer,
  type KnowledgeRagRetrievalResult
} from '../schemas';

export interface RagAnswerRuntimeInput {
  plan: KnowledgePreRetrievalPlan;
  retrieval: KnowledgeRagRetrievalResult;
}

export class RagAnswerRuntime {
  constructor(
    private readonly provider: KnowledgeAnswerProvider,
    private readonly noAnswerPolicy: KnowledgeNoAnswerPolicy
  ) {}

  async answer(input: RagAnswerRuntimeInput): Promise<KnowledgeRagAnswer> {
    const started = Date.now();
    if (input.retrieval.citations.length < this.noAnswerPolicy.minHitCount) {
      return KnowledgeRagAnswerSchema.parse({
        text: '未在当前知识库中找到足够依据。',
        noAnswer: true,
        citations: [],
        diagnostics: {
          durationMs: Date.now() - started,
          noAnswerReason: 'no_hits',
          groundedCitationCount: 0
        }
      });
    }

    const generated = await this.provider.generate({
      query: input.plan.originalQuery,
      rewrittenQuery: input.plan.rewrittenQuery,
      contextBundle: input.retrieval.contextBundle,
      citations: input.retrieval.citations,
      metadata: {
        selectedKnowledgeBaseIds: input.plan.selectedKnowledgeBaseIds
      }
    });

    return KnowledgeRagAnswerSchema.parse({
      text: generated.text,
      noAnswer: false,
      citations: input.retrieval.citations,
      diagnostics: {
        durationMs: Date.now() - started,
        providerId: generated.providerId,
        model: generated.model,
        groundedCitationCount: input.retrieval.citations.length
      }
    });
  }
}
```

Create `packages/knowledge/src/rag/answer/index.ts`:

```ts
export * from './rag-answer-runtime';
```

Update `packages/knowledge/src/rag/index.ts`:

```ts
export * from './answer';
```

- [x] **Step 5: Run answer runtime tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/rag-answer-runtime.test.ts
```

Expected: PASS.

## Task 6: High-Level runKnowledgeRag And streamKnowledgeRag

**Files:**

- Create: `packages/knowledge/src/rag/runtime/run-knowledge-rag.ts`
- Create: `packages/knowledge/src/rag/runtime/stream-knowledge-rag.ts`
- Create: `packages/knowledge/src/rag/runtime/index.ts`
- Test: `packages/knowledge/test/run-knowledge-rag.test.ts`
- Test: `packages/knowledge/test/stream-knowledge-rag.test.ts`
- Modify: `packages/knowledge/src/rag/index.ts`

- [x] **Step 1: Write failing high-level runtime tests**

Create `packages/knowledge/test/run-knowledge-rag.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { runKnowledgeRag } from '../src/rag/runtime/run-knowledge-rag';

describe('runKnowledgeRag', () => {
  it('runs planner, retrieval, and answer in order', async () => {
    const result = await runKnowledgeRag({
      query: '检索前有什么',
      accessibleKnowledgeBases: [{ id: 'kb_rag', name: 'RAG Runtime' }],
      policy: defaultPolicy(),
      plannerProvider: {
        plan: vi.fn(async () => ({
          rewrittenQuery: 'RAG 检索前阶段',
          queryVariants: ['RAG 检索前阶段'],
          selectedKnowledgeBaseIds: ['kb_rag'],
          selectionReason: 'rag',
          confidence: 0.9,
          fallbackPolicy: 'selected-only',
          routingDecisions: [{ knowledgeBaseId: 'kb_rag', selected: true, source: 'llm' }]
        }))
      },
      searchService: {
        search: vi.fn(async () => ({ hits: [], total: 0 }))
      },
      answerProvider: {
        generate: vi.fn(async () => ({ text: 'should not be called' }))
      }
    });

    expect(result).toMatchObject({
      runId: expect.any(String),
      plan: { selectedKnowledgeBaseIds: ['kb_rag'] },
      retrieval: { total: 0 },
      answer: { noAnswer: true }
    });
  });
});

function defaultPolicy() {
  return {
    maxSelectedKnowledgeBases: 3,
    minPlannerConfidence: 0.65,
    defaultSearchMode: 'hybrid' as const,
    fallbackWhenPlannerFails: 'search-all-accessible' as const,
    fallbackWhenLowConfidence: 'expand-to-top-n' as const,
    maxQueryVariants: 4,
    retrievalTopK: 8,
    contextBudgetTokens: 6000,
    requireGroundedCitations: true,
    noAnswer: {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence' as const
    }
  };
}
```

Create `packages/knowledge/test/stream-knowledge-rag.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { runKnowledgeRag, streamKnowledgeRag } from '../src/rag/runtime';

describe('streamKnowledgeRag', () => {
  it('emits stable events and final result equals runKnowledgeRag result shape', async () => {
    const input = {
      query: '检索前有什么',
      accessibleKnowledgeBases: [{ id: 'kb_rag', name: 'RAG Runtime' }],
      policy: defaultPolicy(),
      plannerProvider: {
        plan: vi.fn(async () => ({
          rewrittenQuery: 'RAG 检索前阶段',
          queryVariants: ['RAG 检索前阶段'],
          selectedKnowledgeBaseIds: ['kb_rag'],
          selectionReason: 'rag',
          confidence: 0.9,
          fallbackPolicy: 'selected-only',
          routingDecisions: [{ knowledgeBaseId: 'kb_rag', selected: true, source: 'llm' }]
        }))
      },
      searchService: { search: vi.fn(async () => ({ hits: [], total: 0 })) },
      answerProvider: { generate: vi.fn(async () => ({ text: 'should not be called' })) }
    };

    const events = [];
    for await (const event of streamKnowledgeRag(input)) {
      events.push(event);
    }

    expect(events.map(event => event.type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'retrieval.completed',
      'answer.started',
      'answer.completed',
      'rag.completed'
    ]);
    const completed = events.at(-1);
    expect(completed).toMatchObject({ type: 'rag.completed' });
    expect((completed as { result: unknown }).result).toMatchObject({
      plan: { selectedKnowledgeBaseIds: ['kb_rag'] },
      answer: { noAnswer: true }
    });
  });
});

function defaultPolicy() {
  return {
    maxSelectedKnowledgeBases: 3,
    minPlannerConfidence: 0.65,
    defaultSearchMode: 'hybrid' as const,
    fallbackWhenPlannerFails: 'search-all-accessible' as const,
    fallbackWhenLowConfidence: 'expand-to-top-n' as const,
    maxQueryVariants: 4,
    retrievalTopK: 8,
    contextBudgetTokens: 6000,
    requireGroundedCitations: true,
    noAnswer: {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence' as const
    }
  };
}
```

- [x] **Step 2: Run failing high-level tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/stream-knowledge-rag.test.ts
```

Expected: FAIL because high-level runtime files do not exist.

- [x] **Step 3: Implement runKnowledgeRag**

Create `packages/knowledge/src/rag/runtime/run-knowledge-rag.ts`:

```ts
import { randomUUID } from 'node:crypto';

import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import { RagAnswerRuntime } from '../answer';
import { DefaultPreRetrievalPlanner } from '../planning';
import type { KnowledgeAnswerProvider, KnowledgeStructuredPlannerProvider } from '../providers';
import { RagRetrievalRuntime } from '../retrieval';
import {
  KnowledgeRagResultSchema,
  type KnowledgeBaseRoutingCandidate,
  type KnowledgeRagPolicy,
  type KnowledgeRagResult
} from '../schemas';

export interface RunKnowledgeRagInput {
  query: string;
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
  policy: KnowledgeRagPolicy;
  plannerProvider: KnowledgeStructuredPlannerProvider;
  searchService: KnowledgeSearchService;
  answerProvider: KnowledgeAnswerProvider;
}

export async function runKnowledgeRag(input: RunKnowledgeRagInput): Promise<KnowledgeRagResult> {
  const runId = `rag_${randomUUID()}`;
  const started = Date.now();
  const plannerStarted = Date.now();
  const plan = await new DefaultPreRetrievalPlanner(input.plannerProvider, input.policy).plan({
    query: input.query,
    accessibleKnowledgeBases: input.accessibleKnowledgeBases
  });
  const plannerDurationMs = Date.now() - plannerStarted;
  const retrievalStarted = Date.now();
  const retrieval = await new RagRetrievalRuntime({ searchService: input.searchService }).retrieve({ plan });
  const retrievalDurationMs = Date.now() - retrievalStarted;
  const answerStarted = Date.now();
  const answer = await new RagAnswerRuntime(input.answerProvider, input.policy.noAnswer).answer({ plan, retrieval });
  const answerDurationMs = Date.now() - answerStarted;

  return KnowledgeRagResultSchema.parse({
    runId,
    plan,
    retrieval,
    answer,
    diagnostics: {
      durationMs: Date.now() - started,
      plannerDurationMs,
      retrievalDurationMs,
      answerDurationMs
    }
  });
}
```

- [x] **Step 4: Implement streamKnowledgeRag**

Create `packages/knowledge/src/rag/runtime/stream-knowledge-rag.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { RagAnswerRuntime } from '../answer';
import { DefaultPreRetrievalPlanner } from '../planning';
import { RagRetrievalRuntime } from '../retrieval';
import { KnowledgeRagResultSchema, type KnowledgeRagStreamEvent } from '../schemas';
import type { RunKnowledgeRagInput } from './run-knowledge-rag';

export async function* streamKnowledgeRag(input: RunKnowledgeRagInput): AsyncIterable<KnowledgeRagStreamEvent> {
  const runId = `rag_${randomUUID()}`;
  const started = Date.now();
  yield { type: 'rag.started', runId, createdAt: new Date().toISOString() };

  yield { type: 'planner.started', runId };
  const plannerStarted = Date.now();
  const plan = await new DefaultPreRetrievalPlanner(input.plannerProvider, input.policy).plan({
    query: input.query,
    accessibleKnowledgeBases: input.accessibleKnowledgeBases
  });
  const plannerDurationMs = Date.now() - plannerStarted;
  yield { type: 'planner.completed', runId, plan };

  yield { type: 'retrieval.started', runId, planId: plan.id };
  const retrievalStarted = Date.now();
  const retrieval = await new RagRetrievalRuntime({ searchService: input.searchService }).retrieve({ plan });
  const retrievalDurationMs = Date.now() - retrievalStarted;
  yield { type: 'retrieval.completed', runId, retrieval };

  yield { type: 'answer.started', runId };
  const answerStarted = Date.now();
  const answer = await new RagAnswerRuntime(input.answerProvider, input.policy.noAnswer).answer({ plan, retrieval });
  const answerDurationMs = Date.now() - answerStarted;
  yield { type: 'answer.completed', runId, answer };

  const result = KnowledgeRagResultSchema.parse({
    runId,
    plan,
    retrieval,
    answer,
    diagnostics: {
      durationMs: Date.now() - started,
      plannerDurationMs,
      retrievalDurationMs,
      answerDurationMs
    }
  });
  yield { type: 'rag.completed', runId, result };
}
```

Create `packages/knowledge/src/rag/runtime/index.ts`:

```ts
export * from './run-knowledge-rag';
export * from './stream-knowledge-rag';
```

Update `packages/knowledge/src/rag/index.ts`:

```ts
export * from './runtime';
```

- [x] **Step 5: Run high-level tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/stream-knowledge-rag.test.ts
```

Expected: PASS.

## Task 7: Knowledge Server SDK Adapter And Non-Stream `/api/chat`

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-server-search-service.adapter.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.providers.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts`

- [x] **Step 1: Write failing backend facade test**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeRagSdkFacade } from '../../src/knowledge/rag/knowledge-rag-sdk.facade';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeRagSdkFacade', () => {
  it('answers without metadata by letting SDK planner select accessible knowledge bases', async () => {
    const repository = new InMemoryKnowledgeRepository();
    const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };
    const base = await repository.createBase({
      id: 'kb_rag',
      name: 'RAG Runtime',
      description: 'pre-retrieval planner',
      createdByUserId: actor.userId
    });
    await repository.createDocument({
      id: 'doc_1',
      workspaceId: 'default',
      knowledgeBaseId: base.id,
      uploadId: 'upload_1',
      objectKey: 'knowledge/kb_rag/upload_1/rag.md',
      filename: 'rag.md',
      title: 'RAG Runtime',
      sourceType: 'user-upload',
      status: 'ready',
      version: 'v1',
      chunkCount: 1,
      embeddedChunkCount: 1,
      createdBy: actor.userId,
      metadata: {},
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z'
    });
    await repository.saveChunks('doc_1', [
      {
        id: 'chunk_1',
        documentId: 'doc_1',
        ordinal: 0,
        content: 'pre-retrieval planner chooses knowledge bases before retrieval',
        tokenCount: 6,
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'succeeded',
        keywordIndexStatus: 'succeeded',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z'
      }
    ]);

    const facade = new KnowledgeRagSdkFacade({
      repository,
      plannerProvider: {
        plan: vi.fn(async () => ({
          rewrittenQuery: 'pre-retrieval planner',
          queryVariants: ['pre-retrieval planner'],
          selectedKnowledgeBaseIds: ['kb_rag'],
          selectionReason: 'rag',
          confidence: 0.9,
          fallbackPolicy: 'selected-only',
          routingDecisions: [{ knowledgeBaseId: 'kb_rag', selected: true, source: 'llm' }]
        }))
      },
      answerProvider: {
        generate: vi.fn(async () => ({ text: 'Planner chooses knowledge bases before retrieval.' }))
      }
    });

    const response = await facade.chat(actor, {
      messages: [{ role: 'user', content: '检索前有什么' }],
      model: 'knowledge-rag',
      stream: false
    });

    expect(response.answer).toContain('Planner chooses knowledge bases');
    expect(response.citations).toEqual([expect.objectContaining({ chunkId: 'chunk_1' })]);
    expect(response.route).toMatchObject({ selectedKnowledgeBaseIds: ['kb_rag'] });
  });
});
```

- [x] **Step 2: Run failing backend facade test**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts
```

Expected: FAIL because facade and adapter do not exist.

- [x] **Step 3: Implement search service adapter**

Create `apps/backend/knowledge-server/src/knowledge/rag/knowledge-server-search-service.adapter.ts`:

```ts
import type { KnowledgeSearchService, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { KnowledgeRepository } from '../repositories/knowledge.repository';

export class KnowledgeServerSearchServiceAdapter implements KnowledgeSearchService {
  constructor(private readonly repository: KnowledgeRepository) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const knowledgeBaseIds = request.filters?.knowledgeBaseIds ?? [];
    const documents = (
      await Promise.all(knowledgeBaseIds.map(baseId => this.repository.listDocumentsForBase(baseId)))
    ).flat();
    const hits = (
      await Promise.all(
        documents.map(async document => {
          const chunks = await this.repository.listChunks(document.id);
          return chunks
            .map(chunk => ({
              chunk,
              document,
              score: scoreChunk(request.query, chunk.content)
            }))
            .filter(item => item.score > 0);
        })
      )
    )
      .flat()
      .sort((left, right) => right.score - left.score)
      .slice(0, request.limit ?? 5)
      .map(({ document, chunk, score }) => ({
        chunkId: chunk.id,
        documentId: document.id,
        sourceId: document.id,
        knowledgeBaseId: document.knowledgeBaseId,
        title: document.title,
        uri: document.objectKey,
        sourceType: document.sourceType,
        trustClass: 'internal' as const,
        content: chunk.content,
        score,
        metadata: {},
        citation: {
          sourceId: document.id,
          chunkId: chunk.id,
          title: document.title,
          uri: document.objectKey,
          quote: chunk.content,
          sourceType: document.sourceType,
          trustClass: 'internal' as const
        }
      }));

    return { hits, total: hits.length };
  }
}

function scoreChunk(query: string, content: string): number {
  const queryTerms = tokenize(query);
  const contentTerms = new Set(tokenize(content));
  if (queryTerms.length === 0 || contentTerms.size === 0) return 0;
  return queryTerms.filter(term => contentTerms.has(term)).length / queryTerms.length;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5-]+/u)
    .map(term => term.trim())
    .filter(term => term.length > 1);
}
```

- [x] **Step 4: Implement SDK facade**

Create `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`:

```ts
import {
  runKnowledgeRag,
  type KnowledgeAnswerProvider,
  type KnowledgeStructuredPlannerProvider
} from '@agent/knowledge';

import { normalizeChatRequest } from '../knowledge-document-chat.helpers';
import type { KnowledgeActor } from '../knowledge.service';
import type { KnowledgeChatRequest, KnowledgeChatResponse } from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { KnowledgeServerSearchServiceAdapter } from './knowledge-server-search-service.adapter';

export interface KnowledgeRagSdkFacadeOptions {
  repository: KnowledgeRepository;
  plannerProvider: KnowledgeStructuredPlannerProvider;
  answerProvider: KnowledgeAnswerProvider;
}

export class KnowledgeRagSdkFacade {
  constructor(private readonly options: KnowledgeRagSdkFacadeOptions) {}

  async chat(actor: KnowledgeActor, input: KnowledgeChatRequest): Promise<KnowledgeChatResponse> {
    const request = normalizeChatRequest(input);
    const accessibleKnowledgeBases = await this.options.repository.listBasesForUser(actor.userId);
    const result = await runKnowledgeRag({
      query: request.message,
      accessibleKnowledgeBases: accessibleKnowledgeBases.map(base => ({
        id: base.id,
        name: base.name,
        description: base.description
      })),
      policy: defaultPolicy(),
      plannerProvider: this.options.plannerProvider,
      searchService: new KnowledgeServerSearchServiceAdapter(this.options.repository),
      answerProvider: this.options.answerProvider
    });

    const now = new Date().toISOString();
    const conversationId = request.conversationId ?? `conv_${result.runId}`;
    const assistantMessage = {
      id: `msg_${result.runId}`,
      conversationId,
      role: 'assistant' as const,
      content: result.answer.text,
      citations: result.answer.citations.map(citation => ({
        id: `cit_${citation.sourceId}_${citation.chunkId}`,
        documentId: citation.sourceId,
        chunkId: citation.chunkId,
        title: citation.title,
        quote: citation.quote ?? '',
        uri: citation.uri,
        score: undefined
      })),
      traceId: result.traceId ?? result.runId,
      createdAt: now
    };

    return {
      conversationId,
      userMessage: {
        id: `user_${result.runId}`,
        conversationId,
        role: 'user',
        content: request.message,
        createdAt: now
      },
      assistantMessage,
      answer: result.answer.text,
      citations: assistantMessage.citations,
      traceId: result.traceId ?? result.runId,
      route: {
        requestedMentions: request.mentions?.map(mention => mention.label ?? mention.id ?? '').filter(Boolean) ?? [],
        selectedKnowledgeBaseIds: result.plan.selectedKnowledgeBaseIds,
        reason: 'llm-planner'
      },
      diagnostics: {
        normalizedQuery: result.plan.rewrittenQuery,
        queryVariants: result.plan.queryVariants,
        retrievalMode: result.retrieval.citations.length > 0 ? 'hybrid' : 'none',
        hitCount: result.retrieval.citations.length,
        contextChunkCount: result.retrieval.citations.length
      }
    };
  }
}

function defaultPolicy() {
  return {
    maxSelectedKnowledgeBases: 3,
    minPlannerConfidence: 0.65,
    defaultSearchMode: 'hybrid' as const,
    fallbackWhenPlannerFails: 'search-all-accessible' as const,
    fallbackWhenLowConfidence: 'expand-to-top-n' as const,
    maxQueryVariants: 4,
    retrievalTopK: 8,
    contextBudgetTokens: 6000,
    requireGroundedCitations: true,
    noAnswer: {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence' as const
    }
  };
}
```

- [x] **Step 5: Add temporary deterministic providers for local fallback**

Create `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.providers.ts`:

```ts
import type { KnowledgeAnswerProvider, KnowledgeStructuredPlannerProvider } from '@agent/knowledge';

export function createFallbackPlannerProvider(): KnowledgeStructuredPlannerProvider {
  return {
    async plan(input) {
      const selected = input.knowledgeBases.slice(0, input.policy.maxSelectedKnowledgeBases);
      return {
        rewrittenQuery: input.query,
        queryVariants: [input.query],
        selectedKnowledgeBaseIds: selected.map(base => base.id),
        searchMode: input.policy.defaultSearchMode,
        selectionReason: 'Fallback planner selected accessible knowledge bases.',
        confidence: selected.length > 0 ? 0.5 : 0,
        fallbackPolicy: 'search-all-accessible',
        routingDecisions: selected.map(base => ({
          knowledgeBaseId: base.id,
          selected: true,
          source: 'fallback',
          reason: 'fallback planner'
        }))
      };
    }
  };
}

export function createFallbackAnswerProvider(): KnowledgeAnswerProvider {
  return {
    async generate(input) {
      return {
        text:
          input.citations
            .map(citation => citation.quote)
            .filter(Boolean)
            .join('\n\n') || '未在当前知识库中找到足够依据。'
      };
    }
  };
}
```

- [x] **Step 6: Run backend facade test**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts
```

Expected: PASS.

## Task 8: Streaming `/api/chat` SSE

**Files:**

- Modify: `packages/knowledge/src/rag/runtime/stream-knowledge-rag.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/rag/knowledge-rag-sdk.facade.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
- Test: `packages/knowledge/test/stream-knowledge-rag.test.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts`

- [x] **Step 1: Write failing stream delta test**

Add to `packages/knowledge/test/stream-knowledge-rag.test.ts`:

```ts
it('emits answer.delta events when answer provider supports stream', async () => {
  async function* stream() {
    yield { type: 'delta' as const, delta: '检索前包括' };
    yield { type: 'delta' as const, delta: ' query rewrite' };
    yield { type: 'completed' as const, result: { text: '检索前包括 query rewrite' } };
  }

  const events = [];
  for await (const event of streamKnowledgeRag({
    query: '检索前有什么',
    accessibleKnowledgeBases: [{ id: 'kb_rag', name: 'RAG Runtime' }],
    policy: defaultPolicy(),
    plannerProvider: {
      plan: async () => ({
        rewrittenQuery: 'pre-retrieval planner',
        queryVariants: ['pre-retrieval planner'],
        selectedKnowledgeBaseIds: ['kb_rag'],
        selectionReason: 'rag',
        confidence: 0.9,
        fallbackPolicy: 'selected-only',
        routingDecisions: [{ knowledgeBaseId: 'kb_rag', selected: true, source: 'llm' }]
      })
    },
    searchService: {
      search: async () => ({
        hits: [
          {
            chunkId: 'chunk_1',
            documentId: 'doc_1',
            sourceId: 'source_1',
            knowledgeBaseId: 'kb_rag',
            title: 'RAG SDK',
            uri: 'doc://rag',
            sourceType: 'user-upload',
            trustClass: 'internal',
            content: 'pre-retrieval planner',
            score: 1,
            citation: {
              sourceId: 'source_1',
              chunkId: 'chunk_1',
              title: 'RAG SDK',
              uri: 'doc://rag',
              quote: 'pre-retrieval planner',
              sourceType: 'user-upload',
              trustClass: 'internal'
            }
          }
        ],
        total: 1
      })
    },
    answerProvider: { generate: async () => ({ text: 'unused' }), stream }
  })) {
    events.push(event);
  }

  expect(events.filter(event => event.type === 'answer.delta')).toEqual([
    { type: 'answer.delta', runId: expect.any(String), delta: '检索前包括' },
    { type: 'answer.delta', runId: expect.any(String), delta: ' query rewrite' }
  ]);
});
```

- [x] **Step 2: Run failing stream delta test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/stream-knowledge-rag.test.ts
```

Expected: FAIL because `streamKnowledgeRag()` does not use provider stream.

- [x] **Step 3: Update streamKnowledgeRag to emit deltas**

In `packages/knowledge/src/rag/runtime/stream-knowledge-rag.ts`, replace the answer block with:

```ts
yield { type: 'answer.started', runId };
const answerStarted = Date.now();
let answer;
if (input.answerProvider.stream && retrieval.citations.length > 0) {
  let text = '';
  for await (const providerEvent of input.answerProvider.stream({
    query: plan.originalQuery,
    rewrittenQuery: plan.rewrittenQuery,
    contextBundle: retrieval.contextBundle,
    citations: retrieval.citations
  })) {
    if (providerEvent.type === 'delta' && providerEvent.delta) {
      text += providerEvent.delta;
      yield { type: 'answer.delta', runId, delta: providerEvent.delta };
    }
    if (providerEvent.type === 'completed' && providerEvent.result) {
      text = providerEvent.result.text || text;
    }
  }
  answer = KnowledgeRagAnswerSchema.parse({
    text,
    noAnswer: false,
    citations: retrieval.citations,
    diagnostics: {
      durationMs: Date.now() - answerStarted,
      groundedCitationCount: retrieval.citations.length
    }
  });
} else {
  answer = await new RagAnswerRuntime(input.answerProvider, input.policy.noAnswer).answer({ plan, retrieval });
}
yield { type: 'answer.completed', runId, answer };
```

- [x] **Step 4: Write backend SSE projection test**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { toSseFrame } from '../../src/knowledge/knowledge-frontend-mvp.controller';

describe('knowledge chat SSE projection', () => {
  it('serializes SDK stream events as named SSE frames', () => {
    expect(toSseFrame({ type: 'answer.delta', runId: 'rag_1', delta: 'hello' })).toBe(
      'event: answer.delta\ndata: {"type":"answer.delta","runId":"rag_1","delta":"hello"}\n\n'
    );
  });
});
```

- [x] **Step 5: Implement SSE frame helper**

Export from `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`:

```ts
export function toSseFrame(event: { type: string } & Record<string, unknown>): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
```

Wire `@Post('chat')` so `stream: true` returns an SSE stream. In Nest, use `@Res()` only for the stream branch, set:

```ts
response.setHeader('Content-Type', 'text/event-stream');
response.setHeader('Cache-Control', 'no-cache');
response.setHeader('Connection', 'keep-alive');
for await (const event of this.requireDocuments().chatStream(user, parsedBody)) {
  response.write(toSseFrame(event));
}
response.end();
```

Keep `stream: false` on the existing JSON path.

- [x] **Step 6: Run stream tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/stream-knowledge-rag.test.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts
```

Expected: PASS.

## Task 9: Frontend Chat Lab Stream Consumption

**Files:**

- Create: `apps/frontend/knowledge/src/api/knowledge-chat-stream.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-chat-stream.test.ts`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

- [x] **Step 1: Write failing SSE parser test**

Create `apps/frontend/knowledge/test/knowledge-chat-stream.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseKnowledgeRagSseFrames } from '../src/api/knowledge-chat-stream';

describe('parseKnowledgeRagSseFrames', () => {
  it('parses named SDK stream events', () => {
    expect(
      parseKnowledgeRagSseFrames(
        'event: answer.delta\n' +
          'data: {"type":"answer.delta","runId":"rag_1","delta":"hello"}\n\n' +
          'event: rag.completed\n' +
          'data: {"type":"rag.completed","runId":"rag_1","result":{"runId":"rag_1"}}\n\n'
      )
    ).toEqual([
      { type: 'answer.delta', runId: 'rag_1', delta: 'hello' },
      { type: 'rag.completed', runId: 'rag_1', result: { runId: 'rag_1' } }
    ]);
  });
});
```

- [x] **Step 2: Run failing frontend parser test**

Run:

```bash
pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-stream.test.ts
```

Expected: FAIL because parser does not exist.

- [x] **Step 3: Implement SSE parser**

Create `apps/frontend/knowledge/src/api/knowledge-chat-stream.ts`:

```ts
export interface KnowledgeRagClientStreamEvent {
  type: string;
  runId?: string;
  [key: string]: unknown;
}

export function parseKnowledgeRagSseFrames(input: string): KnowledgeRagClientStreamEvent[] {
  return input
    .split('\n\n')
    .map(frame => frame.trim())
    .filter(Boolean)
    .map(frame => {
      const dataLine = frame
        .split('\n')
        .map(line => line.trim())
        .find(line => line.startsWith('data: '));
      if (!dataLine) {
        return undefined;
      }
      return JSON.parse(dataLine.slice('data: '.length)) as KnowledgeRagClientStreamEvent;
    })
    .filter((event): event is KnowledgeRagClientStreamEvent => Boolean(event));
}
```

- [x] **Step 4: Add streaming API method**

Extend `KnowledgeFrontendApi` with:

```ts
chatStream(input: ChatRequest, onEvent: (event: KnowledgeRagClientStreamEvent) => void): Promise<void>;
```

In `KnowledgeApiClient`, implement `chatStream()` with `fetch('/chat', { method: 'POST', body: JSON.stringify({ ...input, stream: true }) })`, read `response.body.getReader()`, decode chunks with `TextDecoder`, pass complete frames to `parseKnowledgeRagSseFrames()`, and call `onEvent(event)` for each parsed event.

- [x] **Step 5: Update hook state machine**

In `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`, add:

```ts
streamingPhase: 'idle' | 'planning' | 'retrieving' | 'answering' | 'completed' | 'error';
streamingAnswer: string;
streamingEvents: KnowledgeRagClientStreamEvent[];
sendMessageStream(input: ChatRequest): Promise<void>;
```

Update events:

```ts
if (event.type === 'planner.started') setStreamingPhase('planning');
if (event.type === 'retrieval.started') setStreamingPhase('retrieving');
if (event.type === 'answer.started') setStreamingPhase('answering');
if (event.type === 'answer.delta') setStreamingAnswer(current => current + String(event.delta ?? ''));
if (event.type === 'rag.completed') setStreamingPhase('completed');
if (event.type === 'rag.error') setStreamingPhase('error');
```

- [x] **Step 6: Run frontend stream tests**

Run:

```bash
pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-stream.test.ts apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx
```

Expected: PASS.

## Task 10: Documentation And Verification

**Files:**

- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Create: `docs/apps/frontend/knowledge/knowledge-chat-lab.md`

- [x] **Step 1: Update SDK runtime documentation**

In `docs/packages/knowledge/knowledge-retrieval-runtime.md`, add a section:

```md
## RAG Runtime Layer

`runKnowledgeRetrieval()` remains the retrieval-only pipeline. Full chat RAG uses `runKnowledgeRag()` / `streamKnowledgeRag()`, which wrap:

1. `PreRetrievalPlanner`
2. `RagRetrievalRuntime`
3. `RagAnswerRuntime`

The planner owns LLM-first query rewrite and knowledge-base routing. Retrieval owns hybrid search and context assembly. Answer runtime owns grounded generation and no-answer handling.
```

- [x] **Step 2: Update backend documentation**

In `docs/apps/backend/knowledge-server/knowledge-server.md`, update `/api/chat` description:

```md
`POST /api/chat` is driven by `@agent/knowledge` RAG runtime. `stream:false` returns a JSON `KnowledgeRagResult` projection; `stream:true` returns SSE frames whose event names match `KnowledgeRagStreamEvent.type`.
```

- [x] **Step 3: Add frontend Chat Lab stream documentation**

Create `docs/apps/frontend/knowledge/knowledge-chat-lab.md`:

```md
# Knowledge Chat Lab

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-03

Chat Lab consumes `/api/chat` through the Knowledge RAG SDK event contract. The frontend does not decide knowledge-base routing and does not infer citations from answer text.

For `stream:true`, the UI handles these phases:

- `planner.started` / `planner.completed`
- `retrieval.started` / `retrieval.completed`
- `answer.started` / `answer.delta` / `answer.completed`
- `rag.completed`
- `rag.error`

The final state is taken from `rag.completed.result`.
```

- [x] **Step 4: Run affected SDK tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/knowledge-rag-contracts.test.ts packages/knowledge/test/pre-retrieval-planner.test.ts packages/knowledge/test/rag-retrieval-runtime.test.ts packages/knowledge/test/rag-answer-runtime.test.ts packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/stream-knowledge-rag.test.ts
```

Expected: PASS.

- [x] **Step 5: Run backend and frontend tests**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-rag-sdk.facade.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-stream.spec.ts apps/frontend/knowledge/test/knowledge-chat-stream.test.ts apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx
```

Expected: PASS.

- [x] **Step 6: Run type checks**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: all commands exit 0.

- [x] **Step 7: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS after fixing any unrelated invalid doc metadata that blocks the checker.

## Self-Review Checklist

- Spec coverage: this plan covers SDK schemas, LLM-first planner, knowledge base filters, retrieval wrapper, grounded answer runtime, streaming events, backend `/api/chat`, frontend stream consumption, docs, and verification.
- Placeholder scan: this plan contains no unfinished marker phrases or unnamed implementation steps.
- Type consistency: the plan consistently uses `KnowledgeStructuredPlannerProvider`, `KnowledgeAnswerProvider`, `KnowledgePreRetrievalPlan`, `KnowledgeRagResult`, `KnowledgeRagStreamEvent`, and `knowledgeBaseIds`.
- Scope control: the plan avoids agentic multi-hop and keeps first implementation to one deterministic SDK main chain plus stream support.
