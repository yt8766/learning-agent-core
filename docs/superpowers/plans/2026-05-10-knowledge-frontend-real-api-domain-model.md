# Knowledge Frontend Real API Domain Model Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/agent-server/src/api/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`packages/core/src/contracts/knowledge-service`、`packages/knowledge`
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `apps/frontend/knowledge` runtime mock data with schema-first real API contracts and unified `agent-server` endpoints.

**Architecture:** `packages/core/src/contracts/knowledge-service` becomes the schema source for Knowledge frontend API projections, while `@agent/knowledge` keeps owning RAG stream and Agent Flow contracts. Backend controllers parse requests and responses against stable schemas, domain services provide real or schema-safe fallback projections, and the frontend only consumes `KnowledgeApiClient` through `KnowledgeApiProvider`.

**Tech Stack:** TypeScript, zod, NestJS, React, TanStack Query, Vitest, pnpm, `@agent/core`, `@agent/knowledge`.

---

## Source Spec

Read first:

- `docs/superpowers/specs/2026-05-10-knowledge-frontend-real-api-domain-model-design.md`
- `docs/contracts/api/knowledge.md`
- `docs/apps/frontend/knowledge/knowledge-frontend.md`

This repository forbids `git worktree`. Run every step in the current checkout.

## File Structure Map

Create:

- `apps/backend/agent-server/src/domains/knowledge/services/knowledge-dashboard.service.ts`  
  Owns dashboard overview projection.
- `apps/backend/agent-server/src/domains/knowledge/services/knowledge-observability.service.ts`  
  Owns observability metrics, trace list, and trace detail projection.
- `apps/backend/agent-server/src/domains/knowledge/services/knowledge-agent-flow.service.ts`  
  Owns Agent Flow list/save/update/run fallback storage.
- `apps/backend/agent-server/test/knowledge-domain/knowledge-dashboard.service.spec.ts`
- `apps/backend/agent-server/test/knowledge-domain/knowledge-observability.service.spec.ts`
- `apps/backend/agent-server/test/knowledge-domain/knowledge-agent-flow.service.spec.ts`
- `packages/core/test/knowledge-frontend-contracts.test.ts`

Modify:

- `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`
- `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`
- `packages/core/src/index.ts`
- `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- `apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts`
- `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts`
- `apps/backend/agent-server/src/domains/knowledge/services/knowledge-document.service.ts`
- `apps/backend/agent-server/src/domains/knowledge/domain/knowledge-document.schemas.ts`
- `apps/backend/agent-server/src/domains/knowledge/domain/knowledge-document.types.ts`
- `apps/frontend/knowledge/src/main.tsx`
- `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- `apps/frontend/knowledge/src/api/knowledge-api-client-normalizers.ts`
- `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- `apps/frontend/knowledge/src/types/*.ts`
- `apps/frontend/knowledge/test/**/*.test.tsx`
- `apps/frontend/knowledge/test/**/*.test.ts`
- `docs/contracts/api/knowledge.md`
- `docs/apps/frontend/knowledge/knowledge-frontend.md`
- `docs/apps/backend/agent-server/knowledge.md`
- `docs/packages/core/README.md`

Delete:

- `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- `apps/frontend/knowledge/src/api/mock-knowledge-api-client.helpers.ts`
- `apps/frontend/knowledge/src/api/mock-data.ts`
- `apps/frontend/knowledge/src/api/mock-knowledge-governance-data.ts`

## Task 1: Core Contract Schemas

**Files:**

- Modify: `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`
- Modify: `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/knowledge-frontend-contracts.test.ts`

- [ ] **Step 1: Write failing schema coverage tests**

Create `packages/core/test/knowledge-frontend-contracts.test.ts` with tests that parse one minimal valid response per frontend page domain:

```ts
import { describe, expect, it } from 'vitest';

import {
  KnowledgeDashboardOverviewSchema,
  KnowledgeDocumentSchema,
  KnowledgeEvalRunSchema,
  KnowledgeObservabilityMetricsSchema,
  KnowledgePageResultSchema,
  KnowledgeRagTraceDetailSchema
} from '../src/contracts/knowledge-service/knowledge-service.schemas';

describe('knowledge frontend contracts', () => {
  it('parses dashboard overview projection', () => {
    expect(
      KnowledgeDashboardOverviewSchema.parse({
        activeAlertCount: 0,
        averageLatencyMs: 120,
        documentCount: 2,
        failedDocumentCount: 0,
        knowledgeBaseCount: 1,
        latestEvalScore: 96,
        negativeFeedbackRate: 0,
        noAnswerRate: 0,
        p95LatencyMs: 200,
        p99LatencyMs: 240,
        readyDocumentCount: 2,
        recentEvalRuns: [],
        recentFailedJobs: [],
        recentLowScoreTraces: [],
        todayQuestionCount: 4,
        topMissingKnowledgeQuestions: []
      })
    ).toMatchObject({ knowledgeBaseCount: 1 });
  });

  it('parses document page result projection', () => {
    const DocumentPageSchema = KnowledgePageResultSchema(KnowledgeDocumentSchema);
    expect(
      DocumentPageSchema.parse({
        items: [
          {
            chunkCount: 1,
            createdAt: '2026-05-10T00:00:00.000Z',
            createdBy: 'user_1',
            embeddedChunkCount: 1,
            filename: 'handbook.md',
            id: 'doc_1',
            knowledgeBaseId: 'kb_1',
            metadata: {},
            objectKey: 'knowledge/kb_1/doc_1/handbook.md',
            sourceType: 'user-upload',
            status: 'ready',
            title: 'Handbook',
            updatedAt: '2026-05-10T00:00:00.000Z',
            uploadId: 'upload_1',
            version: '1'
          }
        ],
        page: 1,
        pageSize: 20,
        total: 1
      })
    ).toMatchObject({ total: 1 });
  });

  it('parses observability metrics and trace detail projections', () => {
    expect(
      KnowledgeObservabilityMetricsSchema.parse({
        averageLatencyMs: 100,
        citationClickRate: 0,
        errorRate: 0,
        negativeFeedbackRate: 0,
        noAnswerRate: 0,
        p95LatencyMs: 150,
        p99LatencyMs: 200,
        questionCount: 1,
        stageLatency: [],
        timeoutRate: 0,
        traceCount: 1
      })
    ).toMatchObject({ traceCount: 1 });

    expect(
      KnowledgeRagTraceDetailSchema.parse({
        answer: 'Answer',
        citations: [],
        createdAt: '2026-05-10T00:00:00.000Z',
        id: 'trace_1',
        knowledgeBaseIds: ['kb_1'],
        question: 'Question?',
        spans: [],
        status: 'succeeded',
        workspaceId: 'workspace_1'
      })
    ).toMatchObject({ id: 'trace_1' });
  });

  it('parses eval run partial status', () => {
    expect(
      KnowledgeEvalRunSchema.parse({
        caseCount: 2,
        completedCaseCount: 1,
        createdAt: '2026-05-10T00:00:00.000Z',
        createdBy: 'user_1',
        datasetId: 'dataset_1',
        failedCaseCount: 1,
        id: 'run_1',
        knowledgeBaseIds: ['kb_1'],
        status: 'partial',
        workspaceId: 'workspace_1'
      })
    ).toMatchObject({ status: 'partial' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @agent/core test -- knowledge-frontend-contracts
```

Expected: FAIL because `KnowledgeDashboardOverviewSchema`, `KnowledgePageResultSchema`, document, observability, and eval schemas are missing or incomplete.

- [ ] **Step 3: Add schemas**

In `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`, add focused zod schemas for:

- `KnowledgePageResultSchema`
- `KnowledgeDashboardOverviewSchema`
- document, upload, job, chunk, embedding model projections
- observability metrics, trace, trace detail projections
- eval dataset, case, run, result, comparison projections

Keep existing workspace/settings schemas and reuse local primitives such as `NonNegativeIntegerSchema` and `PercentScoreSchema`.

- [ ] **Step 4: Export inferred types**

In `packages/core/src/contracts/knowledge-service/knowledge-service.types.ts`, add `z.infer` exports for every new schema. In `packages/core/src/index.ts`, ensure the knowledge-service schemas and types are exported from the package root.

- [ ] **Step 5: Run contract tests**

Run:

```bash
pnpm --filter @agent/core test -- knowledge-frontend-contracts
```

Expected: PASS.

## Task 2: Canonical API Documentation

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/packages/core/README.md`

- [ ] **Step 1: Update canonical paths**

In `docs/contracts/api/knowledge.md`, make canonical frontend paths match the chosen namespace:

```text
GET /api/knowledge/dashboard/overview
GET /api/knowledge/observability/metrics
GET /api/knowledge/observability/traces
GET /api/knowledge/observability/traces/:traceId
GET /api/knowledge/eval/datasets
GET /api/knowledge/eval/runs
POST /api/knowledge/eval/runs/compare
GET /api/knowledge/agent-flows
POST /api/knowledge/agent-flows
PUT /api/knowledge/agent-flows/:flowId
POST /api/knowledge/agent-flows/:flowId/run
```

Remove or rewrite conflicting text that presents `/dashboard/overview`, `/observability/*`, or `/eval/*` as paths outside the knowledge namespace.

- [ ] **Step 2: Document schema ownership**

Add a section stating that Knowledge frontend API page projections are schema-first in `packages/core/src/contracts/knowledge-service`, while RAG stream and Agent Flow contract ownership remains in `@agent/knowledge`.

- [ ] **Step 3: Update core README**

In `docs/packages/core/README.md`, add the new knowledge-service contract group and mention that all long-lived Knowledge frontend DTOs must be derived from zod schemas.

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 3: Backend Dashboard And Observability Services

**Files:**

- Create: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-dashboard.service.ts`
- Create: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-observability.service.ts`
- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts`
- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-dashboard.service.spec.ts`
- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-observability.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create service specs that instantiate the services with empty constructor dependencies and assert their fallback projections parse with core schemas:

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeDashboardOverviewSchema, KnowledgeObservabilityMetricsSchema } from '@agent/core';

import { KnowledgeDashboardService } from '../../src/domains/knowledge/services/knowledge-dashboard.service';
import { KnowledgeObservabilityService } from '../../src/domains/knowledge/services/knowledge-observability.service';

describe('KnowledgeDashboardService', () => {
  it('returns a schema-safe empty dashboard projection', async () => {
    const service = new KnowledgeDashboardService();
    const overview = KnowledgeDashboardOverviewSchema.parse(await service.getOverview());
    expect(overview).toMatchObject({
      activeAlertCount: 0,
      documentCount: 0,
      knowledgeBaseCount: 0
    });
  });
});

describe('KnowledgeObservabilityService', () => {
  it('returns schema-safe empty observability metrics', async () => {
    const service = new KnowledgeObservabilityService();
    const metrics = KnowledgeObservabilityMetricsSchema.parse(await service.getMetrics());
    expect(metrics).toMatchObject({
      questionCount: 0,
      traceCount: 0
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-dashboard knowledge-observability
```

Expected: FAIL because the services do not exist.

- [ ] **Step 3: Implement minimal services**

Implement service classes that return empty schema-safe projections. Keep them dependency-free for the first pass so later repository wiring is additive.

- [ ] **Step 4: Add controller routes**

In `knowledge.controller.ts`, inject `KnowledgeDashboardService` and `KnowledgeObservabilityService`. Add:

```ts
@Get('dashboard/overview')
async getDashboardOverview() {
  return KnowledgeDashboardOverviewSchema.parse(await this.dashboard.getOverview());
}

@Get('observability/metrics')
async getObservabilityMetrics() {
  return KnowledgeObservabilityMetricsSchema.parse(await this.observability.getMetrics());
}

@Get('observability/traces')
async listObservabilityTraces() {
  return KnowledgePageResultSchema(KnowledgeRagTraceSchema).parse(await this.observability.listTraces());
}

@Get('observability/traces/:traceId')
async getObservabilityTrace(@Param('traceId') traceId: string) {
  return KnowledgeRagTraceDetailSchema.parse(await this.observability.getTrace(traceId));
}
```

Import the schemas from `@agent/core`. Register both services in `knowledge-domain.module.ts`.

- [ ] **Step 5: Run backend tests**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-dashboard knowledge-observability
```

Expected: PASS.

## Task 4: Backend Evals And Agent Flow API

**Files:**

- Modify: `apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts`
- Create: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-agent-flow.service.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-eval.service.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts`
- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-agent-flow.service.spec.ts`
- Modify or create: `apps/backend/agent-server/test/knowledge-domain/knowledge-eval.service.spec.ts`

- [ ] **Step 1: Write failing route/service tests**

Add tests that assert:

- `KnowledgeEvalService.listDatasets()` returns `KnowledgePageResult<KnowledgeEvalDataset>`.
- `KnowledgeEvalService.listRuns()` includes `partial` as a valid status when applicable.
- `KnowledgeAgentFlowService.listFlows()` returns `KnowledgeAgentFlowListResponse`.
- `KnowledgeAgentFlowService.saveFlow()` persists a flow in memory for the service lifetime.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-eval knowledge-agent-flow
```

Expected: FAIL where methods or schemas are missing.

- [ ] **Step 3: Implement eval page projections**

Update `KnowledgeEvalService` so list/compare methods return core schema-safe projections. If current service already has run logic, wrap output with the new core schemas instead of changing behavior.

- [ ] **Step 4: Implement Agent Flow service**

Create `KnowledgeAgentFlowService` with an in-memory map fallback. Use `@agent/knowledge` schemas/types for validation. It must support list, save, update, and run with deterministic response:

```ts
{
  runId: `run_${flowId}`,
  flowId,
  status: 'completed',
  output: { answer: `Flow ${flowId} completed.`, knowledgeBaseIds: input.input.knowledgeBaseIds },
  createdAt,
  updatedAt
}
```

- [ ] **Step 5: Wire routes**

Add `/knowledge/eval/*` and `/knowledge/agent-flows*` routes to `knowledge.controller.ts`, parsing responses with core or `@agent/knowledge` schemas.

- [ ] **Step 6: Run backend tests**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-eval knowledge-agent-flow
```

Expected: PASS.

## Task 5: Frontend API Client Contract Parsing

**Files:**

- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client-normalizers.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `apps/frontend/knowledge/src/types/*.ts`
- Modify: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
- Modify: `apps/frontend/knowledge/test/knowledge-api-client.test.ts`

- [ ] **Step 1: Write failing frontend API tests**

Update `knowledge-real-api-paths.test.ts` to expect canonical paths:

```ts
expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/dashboard/overview');
expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/observability/metrics');
expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/knowledge/eval/datasets');
```

Add a test that malformed dashboard response rejects with a contract parse error.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths knowledge-api-client
```

Expected: FAIL because current paths and parse behavior still use older assumptions.

- [ ] **Step 3: Add parse helper**

In `knowledge-api-client.ts`, add:

```ts
import type { ZodType } from 'zod';

function parseResponse<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}
```

Use it in each API method with schemas imported from `@agent/core` or `@agent/knowledge`.

- [ ] **Step 4: Fix canonical client paths**

Change:

- `getDashboardOverview()` -> `/knowledge/dashboard/overview`
- eval methods -> `/knowledge/eval/*`
- observability methods -> `/knowledge/observability/*`

Keep already canonical `/knowledge/bases`, `/knowledge/documents`, `/knowledge/chat`, `/knowledge/settings`, `/knowledge/workspace`, and `/knowledge/agent-flows`.

- [ ] **Step 5: Re-export stable frontend types**

In `apps/frontend/knowledge/src/types/*.ts`, replace long-lived duplicated business interfaces with imports/re-exports from `@agent/core` and `@agent/knowledge`. Keep only UI-specific helper types locally.

- [ ] **Step 6: Run frontend API tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths knowledge-api-client
```

Expected: PASS.

## Task 6: Remove Runtime Mock Mode

**Files:**

- Modify: `apps/frontend/knowledge/src/main.tsx`
- Delete: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Delete: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.helpers.ts`
- Delete: `apps/frontend/knowledge/src/api/mock-data.ts`
- Delete: `apps/frontend/knowledge/src/api/mock-knowledge-governance-data.ts`
- Modify: `apps/frontend/knowledge/test/app-render.test.tsx`
- Modify: `apps/frontend/knowledge/test/knowledge-agent-flow-page.test.tsx`
- Modify: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

- [ ] **Step 1: Write failing no-runtime-mock test**

Add or update a frontend test that scans runtime source imports and fails if any non-test file imports `MockKnowledgeApiClient`, `mock-data`, or reads `VITE_KNOWLEDGE_API_MODE`.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- app-render knowledge-agent-flow-page
```

Expected: FAIL because tests or runtime still import `MockKnowledgeApiClient`.

- [ ] **Step 3: Simplify main runtime wiring**

Change `main.tsx` to always create:

```ts
const knowledgeApiClient: KnowledgeFrontendApi = new KnowledgeApiClient({
  authClient,
  baseUrl: knowledgeServiceBaseUrl
});
```

Remove the mock import and env branch.

- [ ] **Step 4: Replace test dependencies**

In tests that imported `MockKnowledgeApiClient`, create local fake provider objects implementing only the methods used by the test. Do not import deleted runtime mock files.

- [ ] **Step 5: Delete mock runtime files**

Delete the four mock runtime files listed above. After deletion, run:

```bash
rg -n "MockKnowledgeApiClient|mock-data|mock-knowledge-governance-data|VITE_KNOWLEDGE_API_MODE" apps/frontend/knowledge/src apps/frontend/knowledge/test docs/apps/frontend/knowledge docs/contracts/api/knowledge.md
```

Expected: no runtime source hits; docs hits only if explicitly describing removed historical behavior.

- [ ] **Step 6: Run frontend tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
```

Expected: PASS.

## Task 7: Page Hooks And Query Behavior

**Files:**

- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-dashboard.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-documents.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-observability.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-evals.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-agent-flow.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-knowledge-governance.ts`
- Modify: page tests under `apps/frontend/knowledge/test/`

- [ ] **Step 1: Write failing hook tests for real contract shapes**

For each hook, update existing tests so provider fakes return core schema-shaped responses. Use `items/page/pageSize/total` consistently for list responses.

- [ ] **Step 2: Run affected hook tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-api-provider knowledge-observability-hook knowledge-evals-hook knowledge-agent-flow-page knowledge-governance-pages-api
```

Expected: FAIL where hooks still tolerate legacy shapes or rely on mock-only data.

- [ ] **Step 3: Tighten hook response handling**

Remove local `readDocumentItems()` shape guessing where the API client already returns parsed `PageResult`. Keep hook code simple:

```ts
queryFn: () => api.listDocuments();
documents: documentsQuery.data?.items ?? [];
```

Apply the same rule to dashboard, evals, observability, users, settings, and agent flow hooks.

- [ ] **Step 4: Run affected hook tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-api-provider knowledge-observability-hook knowledge-evals-hook knowledge-agent-flow-page knowledge-governance-pages-api
```

Expected: PASS.

## Task 8: Documentation Cleanup

**Files:**

- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-chat-lab.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`
- Modify as needed: `docs/apps/frontend/knowledge/product-design.md`
- Modify as needed: older `docs/superpowers/specs/*knowledge*` and `docs/superpowers/plans/*knowledge*`

- [ ] **Step 1: Scan for stale mock guidance**

Run:

```bash
rg -n "mock mode|VITE_KNOWLEDGE_API_MODE|MockKnowledgeApiClient|mock-data|页面先基于 mock|/dashboard/overview|/observability|/eval/" docs/apps/frontend/knowledge docs/contracts/api/knowledge.md docs/apps/backend/agent-server docs/superpowers/specs docs/superpowers/plans AGENTS.md
```

Expected: hits that need removal, rewrite, or explicit historical marking.

- [ ] **Step 2: Update current docs**

Rewrite current docs so they state:

- runtime frontend always uses `KnowledgeApiClient`;
- tests use local fake providers or fetch stubs;
- backend may use schema-safe service fallback while real repository wiring is incomplete;
- canonical paths live under `/api/knowledge/*`.

- [ ] **Step 3: Mark historical docs**

For older specs/plans that still mention frontend runtime mock-first development, add a short historical note instead of editing them as current instructions:

```md
> Historical note: this document predates the real API domain-model cutover. Current Knowledge frontend runtime data must come from `/api/knowledge/*`; frontend runtime mock mode has been removed.
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 9: Final Verification

**Files:**

- No new files.

- [ ] **Step 1: Run package contract tests**

Run:

```bash
pnpm --filter @agent/core test -- knowledge
```

Expected: PASS.

- [ ] **Step 2: Run backend affected tests**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run frontend affected tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run cross-package build checks if exports changed**

Run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Expected: PASS.

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 6: Run stale runtime mock scan**

Run:

```bash
rg -n "MockKnowledgeApiClient|mock-data|mock-knowledge-governance-data|VITE_KNOWLEDGE_API_MODE" apps/frontend/knowledge/src
```

Expected: no output.

## Self-Review

Spec coverage:

- Full page coverage is represented by Tasks 1, 3, 4, 5, 7, and 8.
- Runtime mock removal is represented by Task 6.
- Documentation cleanup is represented by Task 8.
- Verification is represented by Task 9.

Placeholder scan:

- No `TBD`, `TODO`, `implement later`, or vague standalone steps remain.

Type consistency:

- Core-owned projections use `Knowledge*Schema` and `z.infer`.
- RAG stream and Agent Flow remain owned by `@agent/knowledge`.
- Frontend list responses use `PageResult` consistently.
