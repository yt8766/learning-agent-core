# Trustworthy RAG Workbench Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-03

> Historical note: this document predates the real API domain-model cutover. Current Knowledge frontend runtime data must come from `/api/knowledge/*`; frontend runtime mock mode has been removed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Knowledge upload + deterministic Chat Lab MVP into a trustworthy RAG workbench with health projections, ingestion state, grounded answers, traceability, and a minimal eval loop.

**Architecture:** Keep stable DTOs and provider boundaries in `packages/knowledge`, product orchestration in `apps/backend/knowledge-server`, and UI consumption behind `KnowledgeApiProvider` in `apps/frontend/knowledge`. Implement this as small vertical slices: contracts first, backend projections and runtime behavior second, frontend display third, then docs and verification.

**Tech Stack:** TypeScript, Zod, NestJS, React, Ant Design, Vitest, pnpm workspace, existing `@agent/knowledge` package exports.

---

## Scope Check

The design touches contracts, backend orchestration, frontend UI, evals, and observability. This plan keeps them in one roadmap because each task is ordered as an independently testable vertical slice, but implementation should commit after every task and stop if a task exposes a larger boundary problem.

This repository forbids `git worktree`; execute in the current checkout only.

## File Structure

- `packages/knowledge/src/core/schemas/index.ts`  
  Add or extend schema-first contracts for health, ingestion jobs, RAG route/diagnostics, trace operations/spans, eval cases/results, and stable error envelopes.
- `packages/knowledge/src/core/types/index.ts`  
  Export inferred types from the schemas above.
- `packages/knowledge/test/core-trustworthy-rag-contracts.test.ts`  
  Contract regression tests for the new stable DTOs and JSON-safe trace attributes.
- `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`  
  Align backend document/job DTO schemas with the stable ingestion projection.
- `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`  
  Keep backend document/job types inferred from backend schemas or imported stable DTOs.
- `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`  
  Move worker progress to explicit parsing/chunking/embedding/indexing stages and produce retryable errors.
- `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`  
  Create new retry/reprocess attempts instead of mutating failed jobs back to running.
- `apps/backend/knowledge-server/src/knowledge/knowledge-trace.service.ts`  
  New service for in-process MVP trace/span recording and projection.
- `apps/backend/knowledge-server/src/knowledge/knowledge-provider-health.service.ts`  
  New service for embedding/vector/keyword/generation health projection.
- `apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts`  
  New service to own route -> retrieval -> context assembly -> generation -> citation grounding. If current deterministic logic lives in `knowledge-frontend-mvp.controller.ts`, move it here behind this service.
- `apps/backend/knowledge-server/src/knowledge/knowledge-eval.service.ts`  
  New minimal eval dataset/run/compare service.
- `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`  
  Keep as HTTP facade for root-level frontend MVP endpoints, delegating Chat Lab, evals, and observability to services.
- `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`  
  Register new services.
- `apps/backend/knowledge-server/test/knowledge/*`  
  Add targeted backend tests for ingestion stages, retry, health, RAG grounding, traces, and eval partial runs.
- `apps/frontend/knowledge/src/types/*.ts`  
  Add frontend projections matching stable API contracts.
- `apps/frontend/knowledge/src/api/knowledge-api-client.ts`  
  Add real API methods for health, trace detail, eval datasets/runs, and richer Chat Lab responses.
- `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts` and `apps/frontend/knowledge/src/api/mock-data.ts`  
  Keep mock mode explicit and update mock projections to match stable DTOs.
- `apps/frontend/knowledge/src/hooks/*`  
  Consume provider methods; do not import mock data directly.
- `apps/frontend/knowledge/src/pages/knowledge-bases/*`  
  Show health status and warnings.
- `apps/frontend/knowledge/src/pages/documents/*`  
  Show ingestion stage/progress/error/retry.
- `apps/frontend/knowledge/src/pages/chat-lab/*`  
  Show route, diagnostics, citations, trace link, feedback.
- `apps/frontend/knowledge/src/pages/evals/evals-page.tsx`  
  Show dataset/run metrics and compare delta.
- `apps/frontend/knowledge/src/pages/observability/observability-page.tsx`  
  Show trace spans for route/retrieval/generation.
- `docs/contracts/api/knowledge.md`  
  Document stable request/response envelopes.
- `docs/apps/backend/knowledge-server/knowledge-server.md`  
  Document service boundaries and state machine.
- `docs/apps/frontend/knowledge/knowledge-frontend.md`  
  Document page workflows and provider-only consumption.

## Task 1: Stabilize Trustworthy RAG Core Contracts

**Files:**

- Modify: `packages/knowledge/src/core/schemas/index.ts`
- Modify: `packages/knowledge/src/core/types/index.ts`
- Test: `packages/knowledge/test/core-trustworthy-rag-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `packages/knowledge/test/core-trustworthy-rag-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  KnowledgeBaseHealthSchema,
  KnowledgeErrorResponseSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalRunResultSchema,
  KnowledgeIngestionJobProjectionSchema,
  KnowledgeRagAnswerSchema,
  KnowledgeTraceSchema
} from '../src/core';

describe('trustworthy RAG workbench contracts', () => {
  it('parses a degraded knowledge base health projection', () => {
    expect(
      KnowledgeBaseHealthSchema.parse({
        knowledgeBaseId: 'kb_1',
        status: 'degraded',
        documentCount: 3,
        searchableDocumentCount: 2,
        chunkCount: 42,
        failedJobCount: 1,
        lastIndexedAt: '2026-05-03T08:00:00.000Z',
        lastQueriedAt: '2026-05-03T08:10:00.000Z',
        providerHealth: {
          embedding: 'ok',
          vector: 'degraded',
          keyword: 'ok',
          generation: 'unconfigured'
        },
        warnings: [{ code: 'knowledge.vector.degraded', message: 'Vector provider is degraded.' }]
      })
    ).toMatchObject({ status: 'degraded', failedJobCount: 1 });
  });

  it('parses a failed retryable ingestion job projection', () => {
    expect(
      KnowledgeIngestionJobProjectionSchema.parse({
        id: 'job_1',
        documentId: 'doc_1',
        stage: 'embedding',
        status: 'failed',
        progress: { percent: 60, processedChunks: 3, totalChunks: 5 },
        error: {
          code: 'knowledge_ingestion_embedding_failed',
          message: 'Embedding provider failed.',
          retryable: true,
          stage: 'embedding'
        },
        attempts: 2,
        createdAt: '2026-05-03T08:00:00.000Z',
        updatedAt: '2026-05-03T08:01:00.000Z'
      })
    ).toMatchObject({ status: 'failed', error: { retryable: true } });
  });

  it('parses a grounded RAG answer with route and diagnostics', () => {
    expect(
      KnowledgeRagAnswerSchema.parse({
        id: 'answer_1',
        conversationId: 'conv_1',
        messageId: 'msg_1',
        answer: '知识库需要先稳定 ingestion job，再补 RAG trace。',
        citations: [
          {
            chunkId: 'chunk_1',
            documentId: 'doc_1',
            title: 'Trustworthy RAG Workbench',
            quote: 'ingestion 有明确 job 状态机',
            score: 0.92
          }
        ],
        route: {
          requestedMentions: ['工程知识库'],
          selectedKnowledgeBaseIds: ['kb_1'],
          reason: 'mentions'
        },
        diagnostics: {
          normalizedQuery: '知识库还差什么',
          queryVariants: ['知识库还差什么', '可信 RAG 工作台缺口'],
          retrievalMode: 'hybrid',
          hitCount: 5,
          contextChunkCount: 3
        },
        traceId: 'trace_1',
        usage: { inputTokens: 1200, outputTokens: 180, totalTokens: 1380 }
      })
    ).toMatchObject({ route: { reason: 'mentions' }, citations: [{ chunkId: 'chunk_1' }] });
  });

  it('rejects non JSON-safe trace attributes', () => {
    expect(() =>
      KnowledgeTraceSchema.parse({
        traceId: 'trace_1',
        operation: 'rag.chat',
        status: 'ok',
        startedAt: '2026-05-03T08:00:00.000Z',
        spans: [
          {
            spanId: 'span_1',
            name: 'retrieve',
            startedAt: '2026-05-03T08:00:00.100Z',
            status: 'ok',
            attributes: { vendorResponse: new Map([['raw', 'blocked']]) }
          }
        ]
      })
    ).toThrow();
  });

  it('parses eval case, run result, and stable error envelope', () => {
    expect(
      KnowledgeEvalCaseSchema.parse({
        id: 'case_1',
        datasetId: 'dataset_1',
        question: '如何定位 RAG 失败？',
        expectedChunkIds: ['chunk_1'],
        expectedDocumentIds: ['doc_1'],
        expectedAnswerNote: '应该说明 route、retrieval、generation 三段。'
      })
    ).toMatchObject({ expectedChunkIds: ['chunk_1'] });

    expect(
      KnowledgeEvalRunResultSchema.parse({
        runId: 'run_1',
        caseId: 'case_1',
        answerId: 'answer_1',
        metrics: { recallAtK: 1, citationAccuracy: 0.8, answerRelevance: 0.9 },
        traceId: 'trace_1'
      })
    ).toMatchObject({ metrics: { recallAtK: 1 } });

    expect(
      KnowledgeErrorResponseSchema.parse({
        code: 'knowledge_rag_generation_failed',
        message: 'Generation provider failed.',
        retryable: true,
        traceId: 'trace_1',
        details: { providerId: 'minimax', stage: 'generate' }
      })
    ).toMatchObject({ retryable: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-trustworthy-rag-contracts.test.ts
```

Expected: FAIL because `KnowledgeBaseHealthSchema`, `KnowledgeIngestionJobProjectionSchema`, `KnowledgeEvalCaseSchema`, `KnowledgeEvalRunResultSchema`, and the expanded `KnowledgeRagAnswerSchema` are not fully exported yet.

- [ ] **Step 3: Add the core schemas**

In `packages/knowledge/src/core/schemas/index.ts`, add these schemas after `ProviderHealthSchema` and update existing `KnowledgeCitationSchema`, `KnowledgeRagAnswerSchema`, `KnowledgeTraceSchema` compatibly:

```ts
export const KnowledgeProviderHealthStatusSchema = z.enum(['ok', 'degraded', 'unconfigured']);

export const KnowledgeBaseHealthStatusSchema = z.enum(['ready', 'indexing', 'degraded', 'empty', 'error']);

export const KnowledgeBaseHealthSchema = z
  .object({
    knowledgeBaseId: z.string().min(1),
    status: KnowledgeBaseHealthStatusSchema,
    documentCount: z.number().int().nonnegative(),
    searchableDocumentCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    failedJobCount: z.number().int().nonnegative(),
    lastIndexedAt: z.string().datetime().optional(),
    lastQueriedAt: z.string().datetime().optional(),
    providerHealth: z.object({
      embedding: KnowledgeProviderHealthStatusSchema,
      vector: KnowledgeProviderHealthStatusSchema,
      keyword: KnowledgeProviderHealthStatusSchema,
      generation: KnowledgeProviderHealthStatusSchema
    }),
    warnings: z.array(z.object({ code: z.string().min(1), message: z.string().min(1) })).default([])
  })
  .strict();

export const KnowledgeIngestionStageSchema = z.enum([
  'uploaded',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
  'succeeded',
  'failed',
  'cancelled'
]);

export const KnowledgeIngestionJobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export const KnowledgeIngestionJobProjectionSchema = z
  .object({
    id: z.string().min(1),
    documentId: z.string().min(1),
    stage: KnowledgeIngestionStageSchema,
    status: KnowledgeIngestionJobStatusSchema,
    progress: z
      .object({
        percent: z.number().min(0).max(100),
        processedChunks: z.number().int().nonnegative().optional(),
        totalChunks: z.number().int().nonnegative().optional()
      })
      .strict(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean(),
        stage: KnowledgeIngestionStageSchema
      })
      .strict()
      .optional(),
    attempts: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional()
  })
  .strict();

export const KnowledgeRagRouteReasonSchema = z.enum(['mentions', 'metadata-match', 'fallback-all', 'legacy-ids']);
export const KnowledgeRetrievalModeSchema = z.enum(['keyword-only', 'vector-only', 'hybrid', 'none']);

export const KnowledgeRagRouteSchema = z
  .object({
    requestedMentions: z.array(z.string().min(1)).default([]),
    selectedKnowledgeBaseIds: z.array(z.string().min(1)).default([]),
    reason: KnowledgeRagRouteReasonSchema
  })
  .strict();

export const KnowledgeRagDiagnosticsSchema = z
  .object({
    normalizedQuery: z.string().min(1),
    queryVariants: z.array(z.string().min(1)).default([]),
    retrievalMode: KnowledgeRetrievalModeSchema,
    hitCount: z.number().int().nonnegative(),
    contextChunkCount: z.number().int().nonnegative()
  })
  .strict();

export const KnowledgeErrorResponseSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    traceId: z.string().min(1).optional(),
    details: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeTraceOperationSchema = z.enum(['ingestion.document', 'rag.chat', 'eval.run', 'provider.health']);

export const KnowledgeWorkbenchTraceStatusSchema = z.enum(['ok', 'error', 'cancelled']);
export const KnowledgeWorkbenchSpanNameSchema = z.enum([
  'route',
  'parse',
  'chunk',
  'embed',
  'index',
  'retrieve',
  'rerank',
  'assemble-context',
  'generate',
  'evaluate'
]);

export const KnowledgeEvalCaseSchema = z
  .object({
    id: z.string().min(1),
    datasetId: z.string().min(1),
    question: z.string().min(1),
    expectedChunkIds: z.array(z.string().min(1)).optional(),
    expectedDocumentIds: z.array(z.string().min(1)).optional(),
    expectedAnswerNote: z.string().min(1).optional()
  })
  .strict();

export const KnowledgeEvalRunResultSchema = z
  .object({
    runId: z.string().min(1),
    caseId: z.string().min(1),
    answerId: z.string().min(1),
    metrics: z
      .object({
        recallAtK: z.number().min(0).max(1).optional(),
        citationAccuracy: z.number().min(0).max(1).optional(),
        answerRelevance: z.number().min(0).max(1).optional()
      })
      .strict(),
    traceId: z.string().min(1)
  })
  .strict();
```

Then update `KnowledgeCitationSchema` so it keeps the existing optional `text` field but also accepts `quote`:

```ts
export const KnowledgeCitationSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1).optional(),
  score: z.number().min(0).max(1).optional(),
  text: z.string().min(1).optional(),
  quote: z.string().min(1).optional()
});
```

Then update `KnowledgeRagAnswerSchema` to include route, diagnostics, and traceId while keeping existing fields:

```ts
export const KnowledgeRagAnswerSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  answer: z.string().min(1),
  citations: z.array(KnowledgeCitationSchema).default([]),
  route: KnowledgeRagRouteSchema.optional(),
  diagnostics: KnowledgeRagDiagnosticsSchema.optional(),
  traceId: z.string().min(1).optional(),
  usage: KnowledgeTokenUsageSchema.optional()
});
```

Replace the trace schema with a backward-compatible workbench trace shape by allowing `operation` to be the workbench enum or a non-empty string, and by using JSON-safe attributes:

```ts
export const KnowledgeTraceSpanSchema = z.object({
  spanId: z.string().min(1),
  name: z.union([KnowledgeWorkbenchSpanNameSchema, z.string().min(1)]),
  stage: KnowledgeTraceSpanStageSchema.optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  status: z.union([KnowledgeWorkbenchTraceStatusSchema, KnowledgeTraceStatusSchema]).optional(),
  attributes: JsonObjectSchema.optional(),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).optional()
});

export const KnowledgeTraceSchema = z.object({
  traceId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  knowledgeBaseId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  operation: z.union([KnowledgeTraceOperationSchema, z.string().min(1)]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  status: z.union([KnowledgeWorkbenchTraceStatusSchema, KnowledgeTraceStatusSchema]),
  spans: z.array(KnowledgeTraceSpanSchema).default([])
});
```

- [ ] **Step 4: Export inferred types**

In `packages/knowledge/src/core/types/index.ts`, add the new schema imports and exports:

```ts
export type KnowledgeProviderHealthStatus = z.infer<typeof KnowledgeProviderHealthStatusSchema>;
export type KnowledgeBaseHealthStatus = z.infer<typeof KnowledgeBaseHealthStatusSchema>;
export type KnowledgeBaseHealth = z.infer<typeof KnowledgeBaseHealthSchema>;
export type KnowledgeIngestionStage = z.infer<typeof KnowledgeIngestionStageSchema>;
export type KnowledgeIngestionJobStatus = z.infer<typeof KnowledgeIngestionJobStatusSchema>;
export type KnowledgeIngestionJobProjection = z.infer<typeof KnowledgeIngestionJobProjectionSchema>;
export type KnowledgeRagRouteReason = z.infer<typeof KnowledgeRagRouteReasonSchema>;
export type KnowledgeRetrievalMode = z.infer<typeof KnowledgeRetrievalModeSchema>;
export type KnowledgeRagRoute = z.infer<typeof KnowledgeRagRouteSchema>;
export type KnowledgeRagDiagnostics = z.infer<typeof KnowledgeRagDiagnosticsSchema>;
export type KnowledgeErrorResponse = z.infer<typeof KnowledgeErrorResponseSchema>;
export type KnowledgeTraceOperation = z.infer<typeof KnowledgeTraceOperationSchema>;
export type KnowledgeWorkbenchTraceStatus = z.infer<typeof KnowledgeWorkbenchTraceStatusSchema>;
export type KnowledgeWorkbenchSpanName = z.infer<typeof KnowledgeWorkbenchSpanNameSchema>;
export type KnowledgeEvalCase = z.infer<typeof KnowledgeEvalCaseSchema>;
export type KnowledgeEvalRunResult = z.infer<typeof KnowledgeEvalRunResultSchema>;
```

- [ ] **Step 5: Verify the contract test passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-trustworthy-rag-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run package type check**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/knowledge/src/core/schemas/index.ts packages/knowledge/src/core/types/index.ts packages/knowledge/test/core-trustworthy-rag-contracts.test.ts
git commit -m "feat: stabilize trustworthy rag contracts"
```

## Task 2: Add Backend Trace And Provider Health Projections

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-trace.service.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-provider-health.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-trustworthy-observability.spec.ts`

- [ ] **Step 1: Write the failing backend observability test**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-trustworthy-observability.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeProviderHealthService } from '../../src/knowledge/knowledge-provider-health.service';
import { KnowledgeTraceService } from '../../src/knowledge/knowledge-trace.service';

describe('trustworthy knowledge observability services', () => {
  it('records route and retrieve spans with JSON-safe attributes', () => {
    const traces = new KnowledgeTraceService();
    const traceId = traces.startTrace({ operation: 'rag.chat', knowledgeBaseId: 'kb_1' });

    traces.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: { reason: 'mentions', selectedCount: 1 }
    });
    traces.addSpan(traceId, {
      name: 'retrieve',
      status: 'ok',
      attributes: { retrievalMode: 'hybrid', hitCount: 3 }
    });
    traces.finishTrace(traceId, 'ok');

    expect(traces.getTrace(traceId)).toMatchObject({
      traceId,
      operation: 'rag.chat',
      status: 'ok',
      spans: [{ name: 'route' }, { name: 'retrieve' }]
    });
  });

  it('projects provider health for the four RAG providers', async () => {
    const health = new KnowledgeProviderHealthService({
      embedding: async () => ({ status: 'ok' }),
      vector: async () => ({ status: 'degraded', message: 'Vector timeout' }),
      keyword: async () => ({ status: 'ok' }),
      generation: async () => ({ status: 'unconfigured', message: 'No generation model configured' })
    });

    await expect(health.getProviderHealth()).resolves.toEqual({
      embedding: 'ok',
      vector: 'degraded',
      keyword: 'ok',
      generation: 'unconfigured'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-trustworthy-observability.spec.ts
```

Expected: FAIL because the two services do not exist yet.

- [ ] **Step 3: Implement `KnowledgeTraceService`**

Create `apps/backend/knowledge-server/src/knowledge/knowledge-trace.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { KnowledgeTrace, KnowledgeTraceOperation, KnowledgeWorkbenchSpanName } from '@agent/knowledge';

type JsonAttributeValue = string | number | boolean | null;

export interface StartKnowledgeTraceInput {
  operation: KnowledgeTraceOperation;
  knowledgeBaseId?: string;
  documentId?: string;
}

export interface AddKnowledgeSpanInput {
  name: KnowledgeWorkbenchSpanName;
  status: 'ok' | 'error';
  attributes?: Record<string, JsonAttributeValue>;
  error?: { code: string; message: string };
}

@Injectable()
export class KnowledgeTraceService {
  private readonly traces = new Map<string, KnowledgeTrace>();

  startTrace(input: StartKnowledgeTraceInput): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.traces.set(traceId, {
      traceId,
      operation: input.operation,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId,
      status: 'ok',
      startedAt: new Date().toISOString(),
      spans: []
    });
    return traceId;
  }

  addSpan(traceId: string, input: AddKnowledgeSpanInput): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return;
    }
    trace.spans.push({
      spanId: `span_${trace.spans.length + 1}`,
      name: input.name,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: input.status,
      attributes: input.attributes ?? {},
      error: input.error
    });
  }

  finishTrace(traceId: string, status: 'ok' | 'error' | 'cancelled'): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return;
    }
    trace.status = status;
    trace.endedAt = new Date().toISOString();
  }

  getTrace(traceId: string): KnowledgeTrace | undefined {
    return this.traces.get(traceId);
  }

  listTraces(): KnowledgeTrace[] {
    return [...this.traces.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}
```

- [ ] **Step 4: Implement `KnowledgeProviderHealthService`**

Create `apps/backend/knowledge-server/src/knowledge/knowledge-provider-health.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { KnowledgeProviderHealthStatus } from '@agent/knowledge';

export interface KnowledgeProviderHealthProbeResult {
  status: KnowledgeProviderHealthStatus;
  message?: string;
}

export interface KnowledgeProviderHealthProbes {
  embedding?: () => Promise<KnowledgeProviderHealthProbeResult>;
  vector?: () => Promise<KnowledgeProviderHealthProbeResult>;
  keyword?: () => Promise<KnowledgeProviderHealthProbeResult>;
  generation?: () => Promise<KnowledgeProviderHealthProbeResult>;
}

@Injectable()
export class KnowledgeProviderHealthService {
  constructor(private readonly probes: KnowledgeProviderHealthProbes = {}) {}

  async getProviderHealth(): Promise<{
    embedding: KnowledgeProviderHealthStatus;
    vector: KnowledgeProviderHealthStatus;
    keyword: KnowledgeProviderHealthStatus;
    generation: KnowledgeProviderHealthStatus;
  }> {
    const [embedding, vector, keyword, generation] = await Promise.all([
      this.runProbe(this.probes.embedding),
      this.runProbe(this.probes.vector),
      this.runProbe(this.probes.keyword),
      this.runProbe(this.probes.generation)
    ]);

    return { embedding, vector, keyword, generation };
  }

  private async runProbe(
    probe: (() => Promise<KnowledgeProviderHealthProbeResult>) | undefined
  ): Promise<KnowledgeProviderHealthStatus> {
    if (!probe) {
      return 'unconfigured';
    }
    try {
      return (await probe()).status;
    } catch {
      return 'degraded';
    }
  }
}
```

- [ ] **Step 5: Register services**

Modify `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts` and add both services to providers:

```ts
import { KnowledgeProviderHealthService } from './knowledge-provider-health.service';
import { KnowledgeTraceService } from './knowledge-trace.service';

// inside @Module providers:
(KnowledgeTraceService, KnowledgeProviderHealthService);
```

- [ ] **Step 6: Verify the observability service test passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-trustworthy-observability.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/knowledge-trace.service.ts apps/backend/knowledge-server/src/knowledge/knowledge-provider-health.service.ts apps/backend/knowledge-server/src/knowledge/knowledge.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-trustworthy-observability.spec.ts
git commit -m "feat: add knowledge trace and provider health services"
```

## Task 3: Make Ingestion Jobs Stageful And Retry-Safe

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`

- [ ] **Step 1: Add failing tests for stageful job progress and retry attempts**

Append tests to `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`:

```ts
it('records a retryable embedding failure without marking the document searchable', async () => {
  const { documentService, repository, worker } = createDocumentIngestionHarness({
    embeddingProvider: {
      embedChunks: async () => {
        throw new Error('embedding unavailable');
      }
    }
  });

  const document = await documentService.createDocumentFromUpload({
    knowledgeBaseId: 'kb_1',
    uploadId: 'upload_1',
    title: 'RAG Notes',
    filename: 'rag.md',
    objectKey: 'knowledge/kb_1/upload_1/rag.md',
    metadata: { embeddingModelId: 'embedding-default' }
  });

  await worker.processDocument(document.id);

  const job = await repository.getLatestDocumentJob(document.id);
  expect(job).toMatchObject({
    stage: 'embedding',
    status: 'failed',
    error: {
      code: 'knowledge_ingestion_embedding_failed',
      retryable: true,
      stage: 'embedding'
    }
  });
});

it('creates a new job attempt when reprocessing a failed document', async () => {
  const { documentService, repository } = createDocumentIngestionHarness();
  const failedJob = await repository.createDocumentJob({
    documentId: 'doc_1',
    stage: 'embedding',
    status: 'failed',
    progress: { percent: 60 },
    attempts: 1,
    error: {
      code: 'knowledge_ingestion_embedding_failed',
      message: 'Embedding failed.',
      retryable: true,
      stage: 'embedding'
    }
  });

  const retryJob = await documentService.reprocessDocument('doc_1', { userId: 'user_1' });

  expect(retryJob.id).not.toBe(failedJob.id);
  expect(retryJob).toMatchObject({
    documentId: 'doc_1',
    stage: 'uploaded',
    status: 'queued',
    attempts: 2
  });
});
```

If the existing harness names differ, keep the assertions and adapt only the setup to the existing test helpers in this file.

- [ ] **Step 2: Run the ingestion test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
```

Expected: FAIL because ingestion stages and retry attempts are not fully modeled.

- [ ] **Step 3: Align backend job schemas**

In `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`, define job stage/status/progress/error schemas using the same literals as Task 1:

```ts
export const DocumentProcessingStageSchema = z.enum([
  'uploaded',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
  'succeeded',
  'failed',
  'cancelled'
]);

export const DocumentProcessingStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export const DocumentProcessingJobProgressSchema = z
  .object({
    percent: z.number().min(0).max(100),
    processedChunks: z.number().int().nonnegative().optional(),
    totalChunks: z.number().int().nonnegative().optional()
  })
  .strict();

export const DocumentProcessingJobErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    stage: DocumentProcessingStageSchema
  })
  .strict();
```

Then update the existing job record schema to include `stage`, `status`, `progress`, `error`, and `attempts` with these schemas.

- [ ] **Step 4: Keep job types inferred**

In `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`, export types inferred from the schemas:

```ts
export type DocumentProcessingStage = z.infer<typeof DocumentProcessingStageSchema>;
export type DocumentProcessingStatus = z.infer<typeof DocumentProcessingStatusSchema>;
export type DocumentProcessingJobProgress = z.infer<typeof DocumentProcessingJobProgressSchema>;
export type DocumentProcessingJobError = z.infer<typeof DocumentProcessingJobErrorSchema>;
```

- [ ] **Step 5: Update worker stage transitions**

In `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`, ensure the worker updates the job before each stage:

```ts
await this.repository.updateDocumentJob(job.id, {
  stage: 'parsing',
  status: 'running',
  progress: { percent: 15 }
});

const parsed = await this.parseDocument(document);

await this.repository.updateDocumentJob(job.id, {
  stage: 'chunking',
  status: 'running',
  progress: { percent: 35 }
});

const chunks = this.chunkDocument(parsed);

await this.repository.updateDocumentJob(job.id, {
  stage: 'embedding',
  status: 'running',
  progress: { percent: 60, processedChunks: 0, totalChunks: chunks.length }
});

await this.embeddingProvider.embedChunks(chunks, document.metadata.embeddingModelId);

await this.repository.updateDocumentJob(job.id, {
  stage: 'indexing',
  status: 'running',
  progress: { percent: 85, processedChunks: chunks.length, totalChunks: chunks.length }
});

await this.indexChunks(document, chunks);

await this.repository.updateDocumentJob(job.id, {
  stage: 'succeeded',
  status: 'succeeded',
  progress: { percent: 100, processedChunks: chunks.length, totalChunks: chunks.length },
  completedAt: new Date().toISOString()
});
```

Wrap each stage with explicit error mapping:

```ts
private toJobError(stage: DocumentProcessingStage, error: unknown): DocumentProcessingJobError {
  const codeByStage: Record<DocumentProcessingStage, string> = {
    uploaded: 'knowledge_ingestion_parse_failed',
    parsing: 'knowledge_ingestion_parse_failed',
    chunking: 'knowledge_ingestion_parse_failed',
    embedding: 'knowledge_ingestion_embedding_failed',
    indexing: 'knowledge_ingestion_index_failed',
    succeeded: 'knowledge_ingestion_index_failed',
    failed: 'knowledge_ingestion_index_failed',
    cancelled: 'knowledge_ingestion_index_failed'
  };

  return {
    code: codeByStage[stage],
    message: error instanceof Error ? error.message : 'Knowledge ingestion failed.',
    retryable: stage === 'embedding' || stage === 'indexing',
    stage
  };
}
```

- [ ] **Step 6: Update reprocess to create a new attempt**

In `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`, make `reprocessDocument()` create a fresh queued job:

```ts
const latestJob = await this.repository.getLatestDocumentJob(documentId);
const nextAttempt = (latestJob?.attempts ?? 0) + 1;

return this.repository.createDocumentJob({
  documentId,
  stage: 'uploaded',
  status: 'queued',
  progress: { percent: 0 },
  attempts: nextAttempt
});
```

Do not mutate the failed job back to `running`.

- [ ] **Step 7: Verify ingestion tests pass**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
git commit -m "feat: make knowledge ingestion jobs retry safe"
```

## Task 4: Move Chat Lab To Grounded RAG Service

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts`

- [ ] **Step 1: Write failing RAG grounding tests**

Create or update `apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts`:

```ts
it('returns route diagnostics and citations grounded in retrieved chunks', async () => {
  const app = await createKnowledgeServerTestingApp({
    chunks: [
      {
        id: 'chunk_1',
        documentId: 'doc_1',
        knowledgeBaseId: 'kb_1',
        title: 'Trustworthy RAG',
        content: 'citation 必须来自 retrieval hits',
        score: 0.93
      }
    ],
    generationProvider: {
      generate: async () => ({
        answer: '答案必须基于检索命中。',
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 }
      })
    }
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: authHeadersFor('user_1'),
    payload: {
      model: 'knowledge-default',
      messages: [{ role: 'user', content: '@工程知识库 知识库引用怎么保证可信？' }],
      metadata: { conversationId: 'conv_1', mentions: ['工程知识库'] },
      stream: false
    }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    route: { selectedKnowledgeBaseIds: ['kb_1'], reason: 'mentions' },
    diagnostics: { retrievalMode: 'hybrid', hitCount: 1 },
    citations: [{ chunkId: 'chunk_1', documentId: 'doc_1', quote: 'citation 必须来自 retrieval hits' }]
  });
});

it('does not return model-invented citations', async () => {
  const app = await createKnowledgeServerTestingApp({
    chunks: [],
    generationProvider: {
      generate: async () => ({
        answer: '模型声称引用了不存在的文档。',
        citations: [{ chunkId: 'invented', documentId: 'invented' }]
      })
    }
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: authHeadersFor('user_1'),
    payload: {
      model: 'knowledge-default',
      messages: [{ role: 'user', content: '没有命中时怎么办？' }],
      metadata: { conversationId: 'conv_1', mentions: [] },
      stream: false
    }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    citations: [],
    diagnostics: { hitCount: 0 }
  });
});
```

Adapt helper names to the existing controller test utilities while keeping these assertions.

- [ ] **Step 2: Run the Chat Lab test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts
```

Expected: FAIL because the route/diagnostics/grounding response is not fully returned by a dedicated RAG service.

- [ ] **Step 3: Implement `KnowledgeRagService`**

Create `apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { KnowledgeRagAnswer } from '@agent/knowledge';
import { resolveKnowledgeChatRoute } from '@agent/knowledge';

import { KnowledgeTraceService } from './knowledge-trace.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';

export interface KnowledgeGenerationProvider {
  generate(input: { question: string; context: string }): Promise<{
    answer: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }>;
}

@Injectable()
export class KnowledgeRagService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly traces: KnowledgeTraceService,
    private readonly generationProvider?: KnowledgeGenerationProvider
  ) {}

  async answer(input: {
    userId: string;
    conversationId: string;
    messageId: string;
    question: string;
    mentions: string[];
  }): Promise<KnowledgeRagAnswer> {
    const traceId = this.traces.startTrace({ operation: 'rag.chat' });
    const bases = await this.repository.listKnowledgeBasesForUser(input.userId);
    const route = resolveKnowledgeChatRoute({
      knowledgeBases: bases,
      question: input.question,
      metadata: { mentions: input.mentions }
    });

    this.traces.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: { reason: route.reason, selectedCount: route.selectedKnowledgeBaseIds.length }
    });

    const hits = await this.repository.searchDocumentChunks({
      userId: input.userId,
      knowledgeBaseIds: route.selectedKnowledgeBaseIds,
      query: input.question,
      limit: 8
    });

    this.traces.addSpan(traceId, {
      name: 'retrieve',
      status: 'ok',
      attributes: { retrievalMode: 'hybrid', hitCount: hits.length }
    });

    const context = hits.map((hit, index) => `[${index + 1}] ${hit.title}\n${hit.content}`).join('\n\n');
    const generated =
      hits.length > 0 && this.generationProvider
        ? await this.generationProvider.generate({ question: input.question, context })
        : { answer: hits.length > 0 ? context : '未找到足够的知识库依据。' };

    this.traces.addSpan(traceId, {
      name: 'generate',
      status: 'ok',
      attributes: { contextChunkCount: hits.length }
    });
    this.traces.finishTrace(traceId, 'ok');

    return {
      id: `answer_${input.messageId}`,
      conversationId: input.conversationId,
      messageId: input.messageId,
      answer: generated.answer,
      citations: hits.map(hit => ({
        chunkId: hit.id,
        documentId: hit.documentId,
        title: hit.title,
        quote: hit.content,
        score: hit.score
      })),
      route: {
        requestedMentions: input.mentions,
        selectedKnowledgeBaseIds: route.selectedKnowledgeBaseIds,
        reason: route.reason
      },
      diagnostics: {
        normalizedQuery: input.question.trim(),
        queryVariants: [input.question.trim()],
        retrievalMode: hits.length > 0 ? 'hybrid' : 'none',
        hitCount: hits.length,
        contextChunkCount: hits.length
      },
      traceId,
      usage: generated.usage
    };
  }
}
```

If the repository uses different method names, add narrow repository methods instead of querying storage directly from the service.

- [ ] **Step 4: Delegate controller Chat Lab endpoint to service**

In `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`, replace inline deterministic chat construction with:

```ts
const userMessage = request.messages.filter(message => message.role === 'user').at(-1);
if (!userMessage) {
  throw new KnowledgeServiceError('knowledge_chat_message_required', 'Chat request requires a user message.');
}

return this.knowledgeRagService.answer({
  userId: authUser.userId,
  conversationId: request.metadata?.conversationId ?? `conversation_${Date.now()}`,
  messageId: `msg_${Date.now()}`,
  question: userMessage.content,
  mentions: request.metadata?.mentions ?? []
});
```

- [ ] **Step 5: Register `KnowledgeRagService`**

In `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`, add `KnowledgeRagService` to providers.

- [ ] **Step 6: Verify Chat Lab tests pass**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/knowledge-rag.service.ts apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts apps/backend/knowledge-server/src/knowledge/knowledge.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts
git commit -m "feat: ground knowledge chat lab answers"
```

## Task 5: Add Minimal Eval Dataset, Run, And Compare Loop

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-eval.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-eval.service.spec.ts`

- [ ] **Step 1: Write the failing eval service test**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-eval.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeEvalService } from '../../src/knowledge/knowledge-eval.service';

describe('KnowledgeEvalService', () => {
  it('runs cases and marks a failed case as partial instead of dropping successful results', async () => {
    const service = new KnowledgeEvalService({
      answer: async ({ question }) => {
        if (question.includes('失败')) {
          throw new Error('generation failed');
        }
        return {
          id: 'answer_1',
          citations: [{ chunkId: 'chunk_1', documentId: 'doc_1' }],
          traceId: 'trace_1'
        };
      }
    });

    const run = await service.runDataset({
      datasetId: 'dataset_1',
      cases: [
        { id: 'case_1', datasetId: 'dataset_1', question: '如何定位？', expectedChunkIds: ['chunk_1'] },
        { id: 'case_2', datasetId: 'dataset_1', question: '失败案例', expectedChunkIds: ['chunk_2'] }
      ]
    });

    expect(run.status).toBe('partial');
    expect(run.results).toHaveLength(1);
    expect(run.failedCases).toMatchObject([{ caseId: 'case_2', code: 'knowledge_eval_run_failed' }]);
  });
});
```

- [ ] **Step 2: Run the eval test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-eval.service.spec.ts
```

Expected: FAIL because `KnowledgeEvalService` does not exist.

- [ ] **Step 3: Implement minimal eval service**

Create `apps/backend/knowledge-server/src/knowledge/knowledge-eval.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { KnowledgeEvalCase, KnowledgeEvalRunResult } from '@agent/knowledge';

export interface KnowledgeEvalAnswerer {
  answer(input: { question: string }): Promise<{
    id: string;
    citations: Array<{ chunkId: string; documentId: string }>;
    traceId: string;
  }>;
}

export interface KnowledgeEvalRunProjection {
  id: string;
  datasetId: string;
  status: 'completed' | 'failed' | 'partial';
  results: KnowledgeEvalRunResult[];
  failedCases: Array<{ caseId: string; code: string; message: string }>;
}

@Injectable()
export class KnowledgeEvalService {
  constructor(private readonly answerer: KnowledgeEvalAnswerer) {}

  async runDataset(input: { datasetId: string; cases: KnowledgeEvalCase[] }): Promise<KnowledgeEvalRunProjection> {
    const runId = `eval_run_${Date.now()}`;
    const results: KnowledgeEvalRunResult[] = [];
    const failedCases: KnowledgeEvalRunProjection['failedCases'] = [];

    for (const evalCase of input.cases) {
      try {
        const answer = await this.answerer.answer({ question: evalCase.question });
        const expectedChunkIds = new Set(evalCase.expectedChunkIds ?? []);
        const citedChunkIds = new Set(answer.citations.map(citation => citation.chunkId));
        const matched = [...expectedChunkIds].filter(chunkId => citedChunkIds.has(chunkId)).length;
        const recallAtK = expectedChunkIds.size > 0 ? matched / expectedChunkIds.size : undefined;

        results.push({
          runId,
          caseId: evalCase.id,
          answerId: answer.id,
          metrics: {
            recallAtK,
            citationAccuracy: answer.citations.length > 0 ? matched / answer.citations.length : 0,
            answerRelevance: recallAtK
          },
          traceId: answer.traceId
        });
      } catch (error) {
        failedCases.push({
          caseId: evalCase.id,
          code: 'knowledge_eval_run_failed',
          message: error instanceof Error ? error.message : 'Eval case failed.'
        });
      }
    }

    return {
      id: runId,
      datasetId: input.datasetId,
      status: failedCases.length === 0 ? 'completed' : results.length > 0 ? 'partial' : 'failed',
      results,
      failedCases
    };
  }
}
```

- [ ] **Step 4: Register service and delegate MVP eval endpoints**

In `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`, add `KnowledgeEvalService` to providers. If constructor injection needs `KnowledgeRagService`, provide an adapter object:

```ts
{
  provide: KnowledgeEvalService,
  useFactory: (rag: KnowledgeRagService) =>
    new KnowledgeEvalService({
      answer: ({ question }) =>
        rag.answer({
          userId: 'eval-system',
          conversationId: `eval_${Date.now()}`,
          messageId: `eval_msg_${Date.now()}`,
          question,
          mentions: []
        })
    }),
  inject: [KnowledgeRagService]
}
```

In `knowledge-frontend-mvp.controller.ts`, keep existing root eval endpoints but delegate run/compare behavior to `KnowledgeEvalService` when real cases are provided.

- [ ] **Step 5: Verify eval test passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-eval.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/knowledge-eval.service.ts apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts apps/backend/knowledge-server/src/knowledge/knowledge.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-eval.service.spec.ts
git commit -m "feat: add minimal knowledge eval loop"
```

## Task 6: Wire Frontend Health, Ingestion, RAG, Eval, And Trace Projections

**Files:**

- Modify: `apps/frontend/knowledge/src/types/knowledge-base.ts`
- Modify: `apps/frontend/knowledge/src/types/documents.ts`
- Modify: `apps/frontend/knowledge/src/types/chat.ts`
- Modify: `apps/frontend/knowledge/src/types/evals.ts`
- Modify: `apps/frontend/knowledge/src/types/observability.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-data.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-dashboard.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-document-detail.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-evals.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-observability.ts`
- Modify: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/documents/document-detail-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/evals/evals-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/observability/observability-page.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-trustworthy-workbench.test.tsx`

- [ ] **Step 1: Write the failing frontend behavior test**

Create `apps/frontend/knowledge/test/knowledge-trustworthy-workbench.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider } from '../src/api/knowledge-api-provider';
import { ChatLabPage } from '../src/pages/chat-lab/chat-lab-page';
import { DocumentDetailPage } from '../src/pages/documents/document-detail-page';
import { KnowledgeBasesPage } from '../src/pages/knowledge-bases/knowledge-bases-page';
import { ObservabilityPage } from '../src/pages/observability/observability-page';

describe('trustworthy knowledge workbench UI', () => {
  it('shows knowledge base health warnings from the API projection', async () => {
    render(
      <KnowledgeApiProvider api={createTrustworthyWorkbenchApi()}>
        <KnowledgeBasesPage />
      </KnowledgeApiProvider>
    );

    expect(await screen.findByText('工程知识库')).toBeInTheDocument();
    expect(screen.getByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('Vector provider is degraded.')).toBeInTheDocument();
  });

  it('shows ingestion stage, progress, error, and retry action', async () => {
    render(
      <KnowledgeApiProvider api={createTrustworthyWorkbenchApi()}>
        <DocumentDetailPage documentId="doc_1" />
      </KnowledgeApiProvider>
    );

    expect(await screen.findByText('embedding')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Embedding provider failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry|重试/i })).toBeInTheDocument();
  });

  it('shows route diagnostics, citation cards, and trace link in Chat Lab', async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeApiProvider api={createTrustworthyWorkbenchApi()}>
        <ChatLabPage />
      </KnowledgeApiProvider>
    );

    await user.type(await screen.findByRole('textbox'), '@工程知识库 知识库如何可信？');
    await user.click(screen.getByRole('button', { name: /send|发送/i }));

    expect(await screen.findByText('mentions')).toBeInTheDocument();
    expect(screen.getByText('Trustworthy RAG')).toBeInTheDocument();
    expect(screen.getByText('citation 必须来自 retrieval hits')).toBeInTheDocument();
    expect(screen.getByText('trace_1')).toBeInTheDocument();
  });

  it('opens trace detail with route and retrieve spans', async () => {
    render(
      <KnowledgeApiProvider api={createTrustworthyWorkbenchApi()}>
        <ObservabilityPage />
      </KnowledgeApiProvider>
    );

    expect(await screen.findByText('rag.chat')).toBeInTheDocument();
    expect(screen.getByText('route')).toBeInTheDocument();
    expect(screen.getByText('retrieve')).toBeInTheDocument();
  });
});

function createTrustworthyWorkbenchApi() {
  return {
    listKnowledgeBases: vi.fn(async () => [
      {
        id: 'kb_1',
        name: '工程知识库',
        description: 'Engineering knowledge',
        health: {
          status: 'degraded',
          warnings: [{ code: 'knowledge.vector.degraded', message: 'Vector provider is degraded.' }]
        }
      }
    ]),
    getDocument: vi.fn(async () => ({ id: 'doc_1', title: 'Trustworthy RAG' })),
    getLatestDocumentJob: vi.fn(async () => ({
      id: 'job_1',
      documentId: 'doc_1',
      stage: 'embedding',
      status: 'failed',
      progress: { percent: 60 },
      error: {
        code: 'knowledge_ingestion_embedding_failed',
        message: 'Embedding provider failed.',
        retryable: true,
        stage: 'embedding'
      },
      attempts: 1
    })),
    listDocumentChunks: vi.fn(async () => []),
    reprocessDocument: vi.fn(async () => undefined),
    sendChatMessage: vi.fn(async () => ({
      answer: '答案必须基于检索命中。',
      route: { reason: 'mentions', selectedKnowledgeBaseIds: ['kb_1'], requestedMentions: ['工程知识库'] },
      diagnostics: { retrievalMode: 'hybrid', hitCount: 1, contextChunkCount: 1 },
      citations: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          title: 'Trustworthy RAG',
          quote: 'citation 必须来自 retrieval hits',
          score: 0.93
        }
      ],
      traceId: 'trace_1'
    })),
    sendMessageFeedback: vi.fn(async () => undefined),
    getObservabilityMetrics: vi.fn(async () => ({})),
    listObservabilityTraces: vi.fn(async () => [
      {
        traceId: 'trace_1',
        operation: 'rag.chat',
        status: 'ok',
        startedAt: '2026-05-03T08:00:00.000Z',
        spans: [
          { spanId: 'span_1', name: 'route', status: 'ok', startedAt: '2026-05-03T08:00:00.000Z' },
          { spanId: 'span_2', name: 'retrieve', status: 'ok', startedAt: '2026-05-03T08:00:00.100Z' }
        ]
      }
    ]),
    getObservabilityTrace: vi.fn(async (traceId: string) => ({
      traceId,
      operation: 'rag.chat',
      status: 'ok',
      startedAt: '2026-05-03T08:00:00.000Z',
      spans: [
        { spanId: 'span_1', name: 'route', status: 'ok', startedAt: '2026-05-03T08:00:00.000Z' },
        { spanId: 'span_2', name: 'retrieve', status: 'ok', startedAt: '2026-05-03T08:00:00.100Z' }
      ]
    }))
  };
}
```

Adjust component props to match existing route wrappers if these pages currently read params from React Router.

- [ ] **Step 2: Run the frontend test to verify it fails**

Run:

```bash
pnpm exec vitest run --config apps/frontend/knowledge/vitest.config.ts apps/frontend/knowledge/test/knowledge-trustworthy-workbench.test.tsx
```

Expected: FAIL because the UI does not yet render all health/job/route/trace fields.

- [ ] **Step 3: Add frontend types**

Update `apps/frontend/knowledge/src/types/knowledge-base.ts`, `documents.ts`, `chat.ts`, `evals.ts`, and `observability.ts` with projections matching Task 1. Prefer importing stable types from `@agent/knowledge` when available:

```ts
import type {
  KnowledgeBaseHealth,
  KnowledgeEvalCase,
  KnowledgeEvalRunResult,
  KnowledgeIngestionJobProjection,
  KnowledgeRagAnswer,
  KnowledgeTrace
} from '@agent/knowledge';

export type KnowledgeBaseHealthProjection = KnowledgeBaseHealth;
export type DocumentJobProjection = KnowledgeIngestionJobProjection;
export type ChatAnswerProjection = KnowledgeRagAnswer;
export type EvalCaseProjection = KnowledgeEvalCase;
export type EvalRunResultProjection = KnowledgeEvalRunResult;
export type TraceProjection = KnowledgeTrace;
```

- [ ] **Step 4: Extend API client/provider methods**

In `apps/frontend/knowledge/src/api/knowledge-api-client.ts`, add methods or update existing methods so:

```ts
async listKnowledgeBases() {
  return this.request('/knowledge/bases');
}

async getLatestDocumentJob(documentId: string) {
  return this.request(`/knowledge/documents/${documentId}/jobs/latest`);
}

async sendChatMessage(request: ChatCompletionLikeRequest) {
  return this.request('/chat', { method: 'POST', body: JSON.stringify(request) });
}

async listObservabilityTraces() {
  return this.request('/observability/traces');
}

async getObservabilityTrace(traceId: string) {
  return this.request(`/observability/traces/${traceId}`);
}
```

Keep the existing token refresh behavior and do not import mock data.

- [ ] **Step 5: Update mock API data to stable projections**

In `apps/frontend/knowledge/src/api/mock-data.ts`, add one degraded health sample, one failed embedding job, one grounded answer, and one trace:

```ts
export const mockKnowledgeBaseHealth = {
  status: 'degraded',
  warnings: [{ code: 'knowledge.vector.degraded', message: 'Vector provider is degraded.' }]
};

export const mockFailedIngestionJob = {
  id: 'job_1',
  documentId: 'doc_1',
  stage: 'embedding',
  status: 'failed',
  progress: { percent: 60 },
  error: {
    code: 'knowledge_ingestion_embedding_failed',
    message: 'Embedding provider failed.',
    retryable: true,
    stage: 'embedding'
  },
  attempts: 1
};
```

Return these from `MockKnowledgeApiClient` methods.

- [ ] **Step 6: Render health on knowledge base pages**

In `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`, render backend health projection:

```tsx
<Tag color={base.health?.status === 'ready' ? 'green' : base.health?.status === 'degraded' ? 'gold' : 'default'}>
  {base.health?.status ?? 'unknown'}
</Tag>;
{
  base.health?.warnings?.map(warning => <Alert key={warning.code} type="warning" message={warning.message} showIcon />);
}
```

- [ ] **Step 7: Render ingestion job state and retry**

In `apps/frontend/knowledge/src/pages/documents/document-detail-page.tsx`, render:

```tsx
<Tag>{latestJob.stage}</Tag>
<Progress percent={latestJob.progress.percent} />
{latestJob.error ? (
  <Alert
    type="error"
    message={latestJob.error.message}
    action={
      latestJob.error.retryable ? (
        <Button onClick={() => reprocessDocument(document.id)}>重试</Button>
      ) : undefined
    }
  />
) : null}
```

- [ ] **Step 8: Render Chat Lab route, citations, and trace**

In `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`, render assistant response footer:

```tsx
<Space direction="vertical" size={8}>
  {answer.route ? <Tag>{answer.route.reason}</Tag> : null}
  {answer.diagnostics ? <Text type="secondary">{answer.diagnostics.retrievalMode}</Text> : null}
  {answer.citations.map(citation => (
    <Card key={citation.chunkId} size="small" title={citation.title ?? citation.documentId}>
      <Paragraph>{citation.quote ?? citation.text}</Paragraph>
      <Text type="secondary">{citation.score}</Text>
    </Card>
  ))}
  {answer.traceId ? <Button type="link">trace {answer.traceId}</Button> : null}
</Space>
```

- [ ] **Step 9: Render trace spans**

In `apps/frontend/knowledge/src/pages/observability/observability-page.tsx`, show trace span names and status:

```tsx
{
  selectedTrace?.spans.map(span => (
    <Timeline.Item key={span.spanId} color={span.status === 'error' ? 'red' : 'green'}>
      <Space>
        <Text>{span.name}</Text>
        <Tag>{span.status}</Tag>
      </Space>
    </Timeline.Item>
  ));
}
```

- [ ] **Step 10: Verify frontend test passes**

Run:

```bash
pnpm exec vitest run --config apps/frontend/knowledge/vitest.config.ts apps/frontend/knowledge/test/knowledge-trustworthy-workbench.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Run frontend type check**

Run:

```bash
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 12: Commit**

Run:

```bash
git add apps/frontend/knowledge/src apps/frontend/knowledge/test/knowledge-trustworthy-workbench.test.tsx
git commit -m "feat: surface trustworthy rag workbench state"
```

## Task 7: Document API, Backend, And Frontend Contracts

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Update API contract**

In `docs/contracts/api/knowledge.md`, add sections for:

```md
## Knowledge Base Health

`GET /api/knowledge/bases` returns each base with optional `health`.

Fields:

- `status`: `ready | indexing | degraded | empty | error`
- `providerHealth.embedding/vector/keyword/generation`: `ok | degraded | unconfigured`
- `warnings[]`: stable code/message pairs

## Ingestion Job Projection

`GET /api/knowledge/documents/:documentId/jobs/latest` returns stageful job progress.

Stages: `uploaded`, `parsing`, `chunking`, `embedding`, `indexing`, `succeeded`, `failed`, `cancelled`.

Failed jobs include `error.code`, `error.message`, `error.retryable`, and `error.stage`.

## Chat Lab RAG Answer

`POST /api/chat` returns `answer`, grounded `citations`, `route`, `diagnostics`, `traceId`, and optional `usage`.

Citations are service-generated from retrieval hits. Clients must not trust model-invented citation IDs.
```

- [ ] **Step 2: Update backend docs**

In `docs/apps/backend/knowledge-server/knowledge-server.md`, add:

```md
## Trustworthy RAG Workbench Boundaries

`KnowledgeIngestionService` owns job creation and retry semantics. `KnowledgeIngestionWorker` advances stages and records retryable failures. `KnowledgeRagService` owns route -> retrieval -> context assembly -> generation -> citation grounding. `KnowledgeTraceService` records JSON-safe trace/span projections. `KnowledgeProviderHealthService` aggregates embedding, vector, keyword, and generation provider health.

Failed jobs are immutable for recovery purposes: retry/reprocess creates a new attempt and trace instead of mutating the failed job back to running.
```

- [ ] **Step 3: Update frontend docs**

In `docs/apps/frontend/knowledge/knowledge-frontend.md`, add:

```md
## Trustworthy Workbench UI

Knowledge pages display backend health projections and warnings; they do not infer readiness locally. Document pages render ingestion stage, progress, error, and retry actions from `getLatestDocumentJob()`. Chat Lab displays route reason, retrieval diagnostics, grounded citations, feedback, and trace links from `/chat`. Observability displays trace spans for route, retrieval, generation, and eval stages.
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/contracts/api/knowledge.md docs/apps/backend/knowledge-server/knowledge-server.md docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "docs: document trustworthy rag workbench contracts"
```

## Task 8: Final Verification And Cleanup

**Files:**

- Review: `packages/knowledge/src/core/schemas/index.ts`
- Review: `apps/backend/knowledge-server/src/knowledge`
- Review: `apps/frontend/knowledge/src`
- Review: `docs/packages/knowledge/README.md`
- Review: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Review: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Run contract and backend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-trustworthy-rag-contracts.test.ts
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-trustworthy-observability.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts apps/backend/knowledge-server/test/knowledge/knowledge-eval.service.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
pnpm exec vitest run --config apps/frontend/knowledge/vitest.config.ts apps/frontend/knowledge/test/knowledge-trustworthy-workbench.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run type checks**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Cleanup stale compat and mock paths introduced by this work**

Search:

```bash
rg -n "knowledgeBaseIds|deterministic RAG|mock projection|temporary workbench compat" apps/backend/knowledge-server/src apps/frontend/knowledge/src docs/apps/backend/knowledge-server docs/apps/frontend/knowledge docs/contracts/api/knowledge.md
```

Expected: no stale old Chat Lab path remains except explicitly documented backward compatibility in `knowledge-server`.

- [ ] **Step 6: Commit cleanup if needed**

If Step 5 required edits, run:

```bash
git add apps/backend/knowledge-server apps/frontend/knowledge docs/contracts/api/knowledge.md docs/apps/backend/knowledge-server/knowledge-server.md docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "chore: clean up trustworthy rag workbench leftovers"
```

If Step 5 found no edits, do not create an empty commit.

## Implementation Notes

- Do not introduce a real web crawler. Keep `web-curated` as already-cleaned external content.
- Do not add `agent-skill` as a first-class source type.
- Do not let frontend infer health from document counts; use backend projection.
- Do not let model output define citations. Citations come from retrieval hits.
- Do not leak third-party SDK objects or raw vendor errors into schemas, traces, or frontend DTOs.
- Do not use `git commit --no-verify`.
