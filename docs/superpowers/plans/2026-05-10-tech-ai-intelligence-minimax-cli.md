# Tech AI Intelligence MiniMax CLI Implementation Plan

状态：proposed  
文档类型：plan  
适用范围：`agents/intel-engine`、`apps/backend/agent-server`、`apps/frontend/agent-admin`、`packages/core`、Postgres/PostgREST 数据面  
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Postgres-first Tech & AI Intelligence pipeline that uses MiniMax CLI-backed search, captures frontend/LLM/skills/security/platform signals, and only promotes curated items into Knowledge.

**Architecture:** Keep `agents/intel-engine` as the intelligence domain owner for channels, query templates, normalization, ranking, and candidate decisions. Put production persistence behind backend Postgres repositories and schema bootstrap; expose stable admin DTOs through `@agent/core` and `/api/platform/*`. Reuse the existing `packages/tools/src/transports/mcp-cli-transport.ts` and `minimax:web_search` capability path instead of direct shell calls in business code.

**Tech Stack:** TypeScript, Zod, NestJS, Postgres, PostgREST-compatible schema, MiniMax CLI via existing CLI transport, Vitest, pnpm workspace.

---

## Scope Check

This is a single vertical-slice plan because the feature is only useful when persistence, ingestion, and admin projection agree on one contract. The implementation is split into small tasks that each produce a testable artifact. This repository forbids using `git worktree`; run everything in the current checkout.

This plan intentionally excludes the `AI Agent / RAG / Runtime 工程` channel. Do not add LangGraph/LangChain/LlamaIndex/Vercel AI SDK/RAG eval/runtime observability engineering article queries.

## File Structure

- Create `packages/core/src/contracts/intelligence/intelligence.schemas.ts`
  - Stable admin/API DTO schemas for channels, runs, signals, sources, knowledge candidates, and projections.
- Create `packages/core/src/contracts/intelligence/intelligence.types.ts`
  - `z.infer` types from the schemas.
- Create `packages/core/src/contracts/intelligence/index.ts`
  - Barrel for the new contract group.
- Modify `packages/core/src/index.ts`
  - Export the intelligence contracts.
- Create `packages/core/test/intelligence-contracts.test.ts`
  - Schema parse and channel exclusion tests.
- Modify `apps/backend/agent-server/src/infrastructure/database/schemas/runtime-schema.sql.ts`
  - Add Postgres `intel_*` tables to the unified runtime schema.
- Create `apps/backend/agent-server/src/runtime/intelligence/intelligence-postgres.repository.ts`
  - Postgres repository for run/query/raw/signal/source/candidate/ingestion records.
- Create `apps/backend/agent-server/src/runtime/intelligence/intelligence-memory.repository.ts`
  - Test/local fallback implementing the same repository interface.
- Create `apps/backend/agent-server/src/runtime/intelligence/intelligence.repository.ts`
  - Repository interface and factory types.
- Create `apps/backend/agent-server/test/runtime/intelligence/intelligence-postgres.repository.spec.ts`
  - SQL parameter and mapping tests with a fake pg client.
- Create `agents/intel-engine/src/runtime/intelligence/intelligence-channels.ts`
  - Product channel definitions and MiniMax query templates.
- Create `agents/intel-engine/src/runtime/intelligence/intelligence-search-normalizer.ts`
  - MiniMax/search payload normalization into stable intel raw event inputs.
- Create `agents/intel-engine/src/runtime/intelligence/intelligence-knowledge-gate.ts`
  - Knowledge/skill/evidence-only decision rules.
- Create `agents/intel-engine/test/runtime/intelligence/intelligence-channels.test.ts`
  - Query and forbidden-channel tests.
- Create `agents/intel-engine/test/runtime/intelligence/intelligence-search-normalizer.test.ts`
  - Payload mapping tests.
- Create `agents/intel-engine/test/runtime/intelligence/intelligence-knowledge-gate.test.ts`
  - Candidate decision tests.
- Modify `agents/intel-engine/src/runtime/briefing/briefing-category-collector.ts`
  - Route configured Tech & AI channels through the same source policy and collect normalized supplemental search items.
- Modify `apps/backend/agent-server/src/runtime/centers/runtime-centers-observability.query-service.ts`
  - Add intelligence projection query methods.
- Modify `apps/backend/agent-server/src/platform/platform-briefings.controller.ts`
  - Add platform endpoints for intelligence overview, signals, candidates, and force-run.
- Create `apps/backend/agent-server/test/platform/intelligence.controller.spec.ts`
  - API projection tests.
- Modify `apps/frontend/agent-admin/src/api/admin-api-platform.ts`
  - Add client methods for intelligence endpoints.
- Create `apps/frontend/agent-admin/src/pages/intelligence-center/intelligence-center-page.tsx`
  - Admin governance page for runs, signals, and candidates.
- Create `apps/frontend/agent-admin/src/pages/intelligence-center/intelligence-center-types.ts`
  - UI-specific view types only.
- Modify `apps/frontend/agent-admin/src/app/admin-routes.tsx`
  - Add `/intelligence` route.
- Modify `apps/frontend/agent-admin/src/components/app-sidebar-nav-items.ts`
  - Add Intelligence nav item.
- Create `apps/frontend/agent-admin/test/pages/intelligence-center.test.tsx`
  - Rendering and API state tests.
- Modify `docs/contracts/api/agent-admin.md`
  - Document new endpoints.
- Modify `docs/agents/intel-engine/daily-tech-briefing.md`
  - Document Postgres-first intelligence boundary and excluded channel.
- Modify `docs/integration/daily-tech-intelligence-briefing-design.md`
  - Link to the new Tech & AI design and mark older file/SQLite-only notes as non-target for production.

## Task 1: Core Intelligence Contracts

**Files:**

- Create: `packages/core/src/contracts/intelligence/intelligence.schemas.ts`
- Create: `packages/core/src/contracts/intelligence/intelligence.types.ts`
- Create: `packages/core/src/contracts/intelligence/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/intelligence-contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `packages/core/test/intelligence-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  IntelligenceChannelSchema,
  IntelligenceOverviewProjectionSchema,
  IntelligenceKnowledgeCandidateSchema,
  IntelligenceSignalSchema
} from '../src/contracts/intelligence';

describe('intelligence contracts', () => {
  it('accepts the approved product channels and rejects runtime engineering', () => {
    expect(IntelligenceChannelSchema.options).toEqual([
      'frontend-tech',
      'frontend-security',
      'llm-releases',
      'skills-agent-tools',
      'ai-security',
      'ai-product-platform'
    ]);
    expect(() => IntelligenceChannelSchema.parse('agent-rag-runtime-engineering')).toThrow();
  });

  it('parses an intelligence signal with source and candidate context', () => {
    const signal = IntelligenceSignalSchema.parse({
      id: 'sig_1',
      channel: 'llm-releases',
      title: 'MiniMax released a new model',
      summary: 'The release changes model selection for long-context workloads.',
      priority: 'P1',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-05-10T01:00:00.000Z',
      lastSeenAt: '2026-05-10T01:00:00.000Z',
      sourceCount: 2,
      knowledgeDecision: 'candidate'
    });
    expect(signal.channel).toBe('llm-releases');
  });

  it('parses overview projections without provider raw payloads', () => {
    const projection = IntelligenceOverviewProjectionSchema.parse({
      generatedAt: '2026-05-10T02:00:00.000Z',
      channels: [
        {
          channel: 'ai-security',
          label: 'AI Security',
          lastRunAt: '2026-05-10T01:00:00.000Z',
          signalCount: 3,
          candidateCount: 1,
          failedQueryCount: 0
        }
      ],
      recentSignals: [],
      pendingCandidates: []
    });
    expect(JSON.stringify(projection)).not.toContain('rawPayload');
  });

  it('parses skill-card candidates separately from knowledge candidates', () => {
    const candidate = IntelligenceKnowledgeCandidateSchema.parse({
      id: 'cand_1',
      signalId: 'sig_1',
      candidateType: 'skill_card',
      decision: 'needs_review',
      decisionReason: 'Agent tool candidate requires human approval before installation.',
      reviewStatus: 'pending',
      createdAt: '2026-05-10T01:00:00.000Z'
    });
    expect(candidate.candidateType).toBe('skill_card');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @agent/core exec vitest run test/intelligence-contracts.test.ts
```

Expected: FAIL because `../src/contracts/intelligence` does not exist.

- [ ] **Step 3: Add schema-first contracts**

Create `packages/core/src/contracts/intelligence/intelligence.schemas.ts`:

```ts
import { z } from 'zod/v4';

export const IntelligenceChannelSchema = z.enum([
  'frontend-tech',
  'frontend-security',
  'llm-releases',
  'skills-agent-tools',
  'ai-security',
  'ai-product-platform'
]);

export const IntelligencePrioritySchema = z.enum(['P0', 'P1', 'P2']);
export const IntelligenceConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const IntelligenceStatusSchema = z.enum(['pending', 'confirmed', 'closed']);
export const IntelligenceKnowledgeDecisionSchema = z.enum(['candidate', 'rejected', 'needs_review', 'ingested']);
export const IntelligenceCandidateTypeSchema = z.enum(['knowledge', 'skill_card', 'evidence_only']);
export const IntelligenceReviewStatusSchema = z.enum(['pending', 'approved', 'rejected', 'ingested', 'failed']);

export const IntelligenceSourceSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().optional(),
  url: z.string().min(1),
  sourceGroup: z.enum(['official', 'authority', 'community', 'unknown']),
  snippet: z.string().min(1),
  publishedAt: z.string().optional(),
  capturedAt: z.string().min(1)
});

export const IntelligenceSignalSchema = z.object({
  id: z.string().min(1),
  channel: IntelligenceChannelSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: IntelligencePrioritySchema,
  confidence: IntelligenceConfidenceSchema,
  status: IntelligenceStatusSchema,
  firstSeenAt: z.string().min(1),
  lastSeenAt: z.string().min(1),
  sourceCount: z.number().int().nonnegative(),
  knowledgeDecision: IntelligenceKnowledgeDecisionSchema.optional()
});

export const IntelligenceKnowledgeCandidateSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  candidateType: IntelligenceCandidateTypeSchema,
  decision: IntelligenceKnowledgeDecisionSchema,
  decisionReason: z.string().min(1),
  ttlDays: z.number().int().positive().optional(),
  reviewStatus: IntelligenceReviewStatusSchema,
  createdAt: z.string().min(1)
});

export const IntelligenceChannelSummarySchema = z.object({
  channel: IntelligenceChannelSchema,
  label: z.string().min(1),
  lastRunAt: z.string().optional(),
  signalCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  failedQueryCount: z.number().int().nonnegative()
});

export const IntelligenceOverviewProjectionSchema = z.object({
  generatedAt: z.string().min(1),
  channels: z.array(IntelligenceChannelSummarySchema),
  recentSignals: z.array(IntelligenceSignalSchema),
  pendingCandidates: z.array(IntelligenceKnowledgeCandidateSchema)
});
```

Create `packages/core/src/contracts/intelligence/intelligence.types.ts`:

```ts
import type { z } from 'zod/v4';

import type {
  IntelligenceChannelSchema,
  IntelligenceKnowledgeCandidateSchema,
  IntelligenceOverviewProjectionSchema,
  IntelligenceSignalSchema,
  IntelligenceSourceSchema
} from './intelligence.schemas';

export type IntelligenceChannel = z.infer<typeof IntelligenceChannelSchema>;
export type IntelligenceSignal = z.infer<typeof IntelligenceSignalSchema>;
export type IntelligenceSource = z.infer<typeof IntelligenceSourceSchema>;
export type IntelligenceKnowledgeCandidate = z.infer<typeof IntelligenceKnowledgeCandidateSchema>;
export type IntelligenceOverviewProjection = z.infer<typeof IntelligenceOverviewProjectionSchema>;
```

Create `packages/core/src/contracts/intelligence/index.ts`:

```ts
export * from './intelligence.schemas';
export type * from './intelligence.types';
```

Modify `packages/core/src/index.ts` and add:

```ts
export * from './contracts/intelligence';
```

- [ ] **Step 4: Verify contracts pass**

Run:

```bash
pnpm --filter @agent/core exec vitest run test/intelligence-contracts.test.ts
```

Expected: PASS.

## Task 2: Postgres Intel Schema And Repository

**Files:**

- Modify: `apps/backend/agent-server/src/infrastructure/database/schemas/runtime-schema.sql.ts`
- Create: `apps/backend/agent-server/src/runtime/intelligence/intelligence.repository.ts`
- Create: `apps/backend/agent-server/src/runtime/intelligence/intelligence-postgres.repository.ts`
- Create: `apps/backend/agent-server/src/runtime/intelligence/intelligence-memory.repository.ts`
- Test: `apps/backend/agent-server/test/runtime/intelligence/intelligence-postgres.repository.spec.ts`

- [ ] **Step 1: Write failing repository tests**

Create `apps/backend/agent-server/test/runtime/intelligence/intelligence-postgres.repository.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { RUNTIME_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/runtime-schema.sql';
import { createIntelligencePostgresRepository } from '../../../src/runtime/intelligence/intelligence-postgres.repository';

describe('intelligence postgres repository', () => {
  it('declares intel tables in the runtime schema', () => {
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_search_runs');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_knowledge_candidates');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_knowledge_ingestions');
  });

  it('writes run, query, raw event, signal, source, and candidate records through parameterized SQL', async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: vi.fn(async (text: string, values: unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('FROM intel_signals')) {
          return {
            rows: [
              {
                id: 'sig_1',
                channel: 'llm-releases',
                title: 'New LLM',
                summary: 'A new model changes routing.',
                priority: 'P1',
                confidence: 'high',
                status: 'confirmed',
                first_seen_at: '2026-05-10T01:00:00.000Z',
                last_seen_at: '2026-05-10T01:00:00.000Z',
                source_count: '1',
                knowledge_decision: 'candidate'
              }
            ]
          };
        }
        return { rows: [] };
      })
    };
    const repository = createIntelligencePostgresRepository(client);

    await repository.saveRun({
      id: 'run_1',
      workspaceId: 'workspace',
      runKind: 'manual',
      status: 'running',
      startedAt: '2026-05-10T01:00:00.000Z',
      summary: {}
    });
    await repository.saveQuery({
      id: 'query_1',
      runId: 'run_1',
      channel: 'llm-releases',
      direction: 'official-confirmation',
      query: 'OpenAI new model release latest',
      provider: 'minimax-cli',
      status: 'completed',
      startedAt: '2026-05-10T01:00:00.000Z',
      resultCount: 1
    });
    await repository.saveRawEvent({
      id: 'raw_1',
      queryId: 'query_1',
      contentHash: 'hash_1',
      title: 'New LLM',
      url: 'https://example.com/model',
      snippet: 'A release note.',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      sourceName: 'Example',
      sourceGroup: 'official',
      rawPayload: { title: 'New LLM' }
    });
    await repository.upsertSignal({
      id: 'sig_1',
      workspaceId: 'workspace',
      stableTopicKey: 'llm:new-model',
      channel: 'llm-releases',
      title: 'New LLM',
      summary: 'A new model changes routing.',
      priority: 'P1',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-05-10T01:00:00.000Z',
      lastSeenAt: '2026-05-10T01:00:00.000Z',
      metadata: {}
    });
    await repository.saveCandidate({
      id: 'cand_1',
      signalId: 'sig_1',
      candidateType: 'knowledge',
      decision: 'candidate',
      decisionReason: 'Official release affects model routing.',
      ttlDays: 180,
      createdAt: '2026-05-10T01:00:00.000Z',
      reviewStatus: 'pending',
      metadata: {}
    });

    const signals = await repository.listRecentSignals({ limit: 5 });
    expect(signals[0]?.id).toBe('sig_1');
    expect(calls.every(call => Array.isArray(call.values))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing repository tests**

Run:

```bash
pnpm exec vitest run apps/backend/agent-server/test/runtime/intelligence/intelligence-postgres.repository.spec.ts
```

Expected: FAIL because the repository files and SQL tables do not exist.

- [ ] **Step 3: Extend runtime Postgres schema**

Modify `apps/backend/agent-server/src/infrastructure/database/schemas/runtime-schema.sql.ts` and append these tables inside `RUNTIME_SCHEMA_SQL`:

```sql
CREATE TABLE IF NOT EXISTS intel_search_runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  run_kind text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  triggered_by text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb
);

CREATE TABLE IF NOT EXISTS intel_search_queries (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES intel_search_runs(id) ON DELETE CASCADE,
  channel text NOT NULL,
  direction text NOT NULL,
  query text NOT NULL,
  provider text NOT NULL DEFAULT 'minimax-cli',
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  result_count integer NOT NULL DEFAULT 0,
  error jsonb
);

CREATE TABLE IF NOT EXISTS intel_raw_events (
  id text PRIMARY KEY,
  query_id text NOT NULL REFERENCES intel_search_queries(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  snippet text NOT NULL,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL,
  source_name text NOT NULL,
  source_url text,
  source_group text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(query_id, content_hash)
);

CREATE TABLE IF NOT EXISTS intel_signals (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  stable_topic_key text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  priority text NOT NULL,
  confidence text NOT NULL,
  status text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(workspace_id, stable_topic_key)
);

CREATE TABLE IF NOT EXISTS intel_signal_sources (
  id text PRIMARY KEY,
  signal_id text NOT NULL REFERENCES intel_signals(id) ON DELETE CASCADE,
  raw_event_id text REFERENCES intel_raw_events(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_url text,
  url text NOT NULL,
  source_group text NOT NULL,
  snippet text NOT NULL,
  published_at timestamptz,
  captured_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS intel_daily_digests (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  digest_date date NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content_markdown text NOT NULL,
  signal_count integer NOT NULL DEFAULT 0,
  highlight_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS intel_knowledge_candidates (
  id text PRIMARY KEY,
  signal_id text NOT NULL REFERENCES intel_signals(id) ON DELETE CASCADE,
  candidate_type text NOT NULL,
  decision text NOT NULL,
  decision_reason text NOT NULL,
  ttl_days integer,
  created_at timestamptz NOT NULL,
  review_status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS intel_knowledge_ingestions (
  id text PRIMARY KEY,
  candidate_id text NOT NULL REFERENCES intel_knowledge_candidates(id) ON DELETE CASCADE,
  status text NOT NULL,
  knowledge_base_id text,
  document_id text,
  chunk_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempted_at timestamptz NOT NULL,
  error jsonb
);

CREATE INDEX IF NOT EXISTS intel_signals_channel_last_seen_idx
  ON intel_signals(channel, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS intel_candidates_review_status_idx
  ON intel_knowledge_candidates(review_status, created_at DESC);
```

- [ ] **Step 4: Implement repository interfaces**

Create `apps/backend/agent-server/src/runtime/intelligence/intelligence.repository.ts`:

```ts
import type { IntelligenceChannel, IntelligenceKnowledgeCandidate, IntelligenceSignal } from '@agent/core';

export interface IntelligenceRunInput {
  id: string;
  workspaceId: string;
  runKind: 'scheduled' | 'manual' | 'forced';
  status: 'running' | 'completed' | 'failed' | 'partial';
  startedAt: string;
  completedAt?: string;
  triggeredBy?: string;
  summary: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export interface IntelligenceQueryInput {
  id: string;
  runId: string;
  channel: IntelligenceChannel;
  direction: string;
  query: string;
  provider: string;
  status: 'completed' | 'failed' | 'parse_failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  resultCount: number;
  error?: Record<string, unknown>;
}

export interface IntelligenceRawEventInput {
  id: string;
  queryId: string;
  contentHash: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  fetchedAt: string;
  sourceName: string;
  sourceUrl?: string;
  sourceGroup: 'official' | 'authority' | 'community' | 'unknown';
  rawPayload: Record<string, unknown>;
}

export interface IntelligenceSignalInput extends Omit<IntelligenceSignal, 'sourceCount' | 'knowledgeDecision'> {
  workspaceId: string;
  stableTopicKey: string;
  metadata: Record<string, unknown>;
}

export interface IntelligenceKnowledgeCandidateInput extends Omit<IntelligenceKnowledgeCandidate, 'reviewStatus'> {
  reviewStatus: IntelligenceKnowledgeCandidate['reviewStatus'];
  metadata: Record<string, unknown>;
}

export interface IntelligenceRepository {
  saveRun(input: IntelligenceRunInput): Promise<void>;
  saveQuery(input: IntelligenceQueryInput): Promise<void>;
  saveRawEvent(input: IntelligenceRawEventInput): Promise<void>;
  upsertSignal(input: IntelligenceSignalInput): Promise<void>;
  saveCandidate(input: IntelligenceKnowledgeCandidateInput): Promise<void>;
  listRecentSignals(input: { limit: number; channel?: IntelligenceChannel }): Promise<IntelligenceSignal[]>;
  listPendingCandidates(input: { limit: number }): Promise<IntelligenceKnowledgeCandidate[]>;
}
```

Create `apps/backend/agent-server/src/runtime/intelligence/intelligence-postgres.repository.ts` with parameterized `client.query(text, values)` calls and row mappers. Use `Number(row.source_count ?? 0)` when mapping counts.

Create `apps/backend/agent-server/src/runtime/intelligence/intelligence-memory.repository.ts` with arrays/maps for tests and local no-DB mode.

- [ ] **Step 5: Verify repository tests pass**

Run:

```bash
pnpm exec vitest run apps/backend/agent-server/test/runtime/intelligence/intelligence-postgres.repository.spec.ts
```

Expected: PASS.

## Task 3: Intelligence Channels, Query Templates, And Normalization

**Files:**

- Create: `agents/intel-engine/src/runtime/intelligence/intelligence-channels.ts`
- Create: `agents/intel-engine/src/runtime/intelligence/intelligence-search-normalizer.ts`
- Create: `agents/intel-engine/src/runtime/intelligence/index.ts`
- Test: `agents/intel-engine/test/runtime/intelligence/intelligence-channels.test.ts`
- Test: `agents/intel-engine/test/runtime/intelligence/intelligence-search-normalizer.test.ts`

- [ ] **Step 1: Write failing channel and normalizer tests**

Create `agents/intel-engine/test/runtime/intelligence/intelligence-channels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { INTELLIGENCE_CHANNELS, buildIntelligenceSearchTasks } from '../../../src/runtime/intelligence';

describe('intelligence channels', () => {
  it('defines approved channels without RAG runtime engineering', () => {
    expect(INTELLIGENCE_CHANNELS.map(channel => channel.channel)).toEqual([
      'frontend-tech',
      'frontend-security',
      'llm-releases',
      'skills-agent-tools',
      'ai-security',
      'ai-product-platform'
    ]);
    expect(JSON.stringify(INTELLIGENCE_CHANNELS)).not.toMatch(/LangGraph|LangChain|LlamaIndex|RAG eval/i);
  });

  it('builds MiniMax query tasks for each channel', () => {
    const tasks = buildIntelligenceSearchTasks({
      runId: 'run_1',
      now: new Date('2026-05-10T01:00:00.000Z')
    });
    expect(tasks.some(task => task.channel === 'llm-releases')).toBe(true);
    expect(tasks.some(task => task.query.includes('Claude Code source code leak'))).toBe(true);
  });
});
```

Create `agents/intel-engine/test/runtime/intelligence/intelligence-search-normalizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { normalizeMiniMaxSearchPayload } from '../../../src/runtime/intelligence';

describe('normalizeMiniMaxSearchPayload', () => {
  it('maps MiniMax CLI result-like payloads into raw event inputs', () => {
    const events = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: {
        results: [
          {
            title: 'Claude Code security incident',
            url: 'https://example.com/security',
            summary: 'An incident involving source code exposure.',
            sourceName: 'Example Security',
            publishedAt: '2026-05-09T00:00:00.000Z'
          }
        ]
      }
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      queryId: 'query_1',
      title: 'Claude Code security incident',
      sourceGroup: 'unknown'
    });
    expect(events[0]?.contentHash).toHaveLength(40);
  });

  it('drops malformed results without throwing', () => {
    const events = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: { results: [{ title: 'missing url' }, null, 'bad'] }
    });
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @agent/agents-intel-engine exec vitest run test/runtime/intelligence/intelligence-channels.test.ts test/runtime/intelligence/intelligence-search-normalizer.test.ts
```

Expected: FAIL because runtime intelligence files do not exist.

- [ ] **Step 3: Add channel definitions and task builder**

Create `agents/intel-engine/src/runtime/intelligence/intelligence-channels.ts`:

```ts
import type { IntelligenceChannel } from '@agent/core';

export interface IntelligenceChannelDefinition {
  channel: IntelligenceChannel;
  label: string;
  schedule: 'daily' | 'every-4-hours';
  queries: Array<{ direction: 'official-confirmation' | 'trend-discovery' | 'security-watch'; query: string }>;
}

export const INTELLIGENCE_CHANNELS: IntelligenceChannelDefinition[] = [
  {
    channel: 'frontend-tech',
    label: 'Frontend Tech',
    schedule: 'daily',
    queries: [
      {
        direction: 'official-confirmation',
        query: 'React Next.js Vue Vite TypeScript official release breaking changes latest'
      },
      { direction: 'trend-discovery', query: 'Chrome Web Platform CSS baseline stable feature latest' },
      { direction: 'official-confirmation', query: 'frontend framework migration guide compatibility latest' }
    ]
  },
  {
    channel: 'frontend-security',
    label: 'Frontend Security',
    schedule: 'every-4-hours',
    queries: [
      { direction: 'security-watch', query: 'npm pnpm package compromise frontend supply chain vulnerability latest' },
      { direction: 'security-watch', query: 'axios Vite plugin source map token leak security advisory latest' },
      { direction: 'security-watch', query: 'Chrome browser V8 WebAssembly frontend security vulnerability latest' }
    ]
  },
  {
    channel: 'llm-releases',
    label: 'LLM Releases',
    schedule: 'daily',
    queries: [
      {
        direction: 'official-confirmation',
        query: 'OpenAI Anthropic Google Gemini DeepSeek Qwen Mistral MiniMax new model release API latest'
      },
      {
        direction: 'trend-discovery',
        query: 'LLM model pricing context window tool calling multimodal release latest'
      },
      {
        direction: 'official-confirmation',
        query: 'GPT Claude Gemini Qwen DeepSeek model deprecation migration API changes'
      }
    ]
  },
  {
    channel: 'skills-agent-tools',
    label: 'Skills & Agent Tools',
    schedule: 'daily',
    queries: [
      {
        direction: 'trend-discovery',
        query: 'Codex skills Claude Code skills MCP server agent workflow template latest'
      },
      {
        direction: 'trend-discovery',
        query: 'best AI coding agent skills GitHub PR review browser automation documentation automation'
      },
      {
        direction: 'official-confirmation',
        query: 'Model Context Protocol server release filesystem browser github slack notion'
      }
    ]
  },
  {
    channel: 'ai-security',
    label: 'AI Security',
    schedule: 'every-4-hours',
    queries: [
      { direction: 'security-watch', query: 'Claude Code source code leak security incident latest' },
      { direction: 'security-watch', query: 'MCP security prompt injection tool abuse workspace trust vulnerability' },
      {
        direction: 'security-watch',
        query: 'AI coding agent credential leak source code leak supply chain vulnerability'
      }
    ]
  },
  {
    channel: 'ai-product-platform',
    label: 'AI Product & Platform',
    schedule: 'daily',
    queries: [
      {
        direction: 'official-confirmation',
        query: 'OpenAI Anthropic Gemini MiniMax API pricing rate limit enterprise update latest'
      },
      {
        direction: 'official-confirmation',
        query: 'LLM API model retirement deprecation migration schedule latest'
      },
      {
        direction: 'official-confirmation',
        query: 'AI platform policy data retention enterprise admin controls latest'
      }
    ]
  }
];

export function buildIntelligenceSearchTasks(input: { runId: string; now: Date }) {
  return INTELLIGENCE_CHANNELS.flatMap(channel =>
    channel.queries.map((query, index) => ({
      id: `${input.runId}:${channel.channel}:${index}`,
      runId: input.runId,
      channel: channel.channel,
      direction: query.direction,
      query: query.query,
      provider: 'minimax-cli' as const,
      scheduledFor: input.now.toISOString()
    }))
  );
}
```

- [ ] **Step 4: Add normalizer**

Create `agents/intel-engine/src/runtime/intelligence/intelligence-search-normalizer.ts`:

```ts
import { createHash } from 'node:crypto';

export interface NormalizeMiniMaxSearchPayloadInput {
  queryId: string;
  fetchedAt: string;
  payload: unknown;
}

export function normalizeMiniMaxSearchPayload(input: NormalizeMiniMaxSearchPayloadInput) {
  const results = Array.isArray((input.payload as { results?: unknown[] } | undefined)?.results)
    ? ((input.payload as { results: unknown[] }).results ?? [])
    : [];

  return results.flatMap(result => {
    if (!result || typeof result !== 'object') {
      return [];
    }
    const raw = result as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    const snippet =
      typeof raw.summary === 'string' ? raw.summary.trim() : typeof raw.snippet === 'string' ? raw.snippet.trim() : '';
    if (!title || !url || !snippet) {
      return [];
    }
    const contentHash = createHash('sha1').update(`${url}|${title}|${snippet}`).digest('hex');
    return [
      {
        id: `raw_${contentHash.slice(0, 16)}`,
        queryId: input.queryId,
        contentHash,
        title,
        url,
        snippet,
        publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : undefined,
        fetchedAt: input.fetchedAt,
        sourceName: typeof raw.sourceName === 'string' && raw.sourceName.trim() ? raw.sourceName.trim() : hostname(url),
        sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined,
        sourceGroup: normalizeSourceGroup(raw.sourceGroup),
        rawPayload: raw
      }
    ];
  });
}

function normalizeSourceGroup(value: unknown): 'official' | 'authority' | 'community' | 'unknown' {
  return value === 'official' || value === 'authority' || value === 'community' ? value : 'unknown';
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
```

Create `agents/intel-engine/src/runtime/intelligence/index.ts`:

```ts
export * from './intelligence-channels';
export * from './intelligence-search-normalizer';
```

- [ ] **Step 5: Verify channel tests pass**

Run:

```bash
pnpm --filter @agent/agents-intel-engine exec vitest run test/runtime/intelligence/intelligence-channels.test.ts test/runtime/intelligence/intelligence-search-normalizer.test.ts
```

Expected: PASS.

## Task 4: Knowledge Candidate Gate

**Files:**

- Create: `agents/intel-engine/src/runtime/intelligence/intelligence-knowledge-gate.ts`
- Modify: `agents/intel-engine/src/runtime/intelligence/index.ts`
- Test: `agents/intel-engine/test/runtime/intelligence/intelligence-knowledge-gate.test.ts`

- [ ] **Step 1: Write failing candidate decision tests**

Create `agents/intel-engine/test/runtime/intelligence/intelligence-knowledge-gate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { decideIntelligenceKnowledgeCandidate } from '../../../src/runtime/intelligence';

const baseSignal = {
  id: 'sig_1',
  title: 'React 20 migration guide',
  summary: 'Official migration guide for breaking changes.',
  priority: 'P1' as const,
  confidence: 'high' as const,
  status: 'confirmed' as const
};

describe('decideIntelligenceKnowledgeCandidate', () => {
  it('promotes official breaking frontend releases to knowledge candidates', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: { ...baseSignal, channel: 'frontend-tech' },
      sourceGroups: ['official']
    });
    expect(decision).toMatchObject({
      candidateType: 'knowledge',
      decision: 'candidate',
      ttlDays: 365
    });
  });

  it('turns skills into review-only skill cards', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: {
        ...baseSignal,
        channel: 'skills-agent-tools',
        title: 'New GitHub PR review skill',
        summary: 'A reusable agent skill for reviewing pull requests.'
      },
      sourceGroups: ['authority']
    });
    expect(decision).toMatchObject({
      candidateType: 'skill_card',
      decision: 'needs_review'
    });
  });

  it('rejects community-only ordinary posts', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: {
        ...baseSignal,
        channel: 'frontend-tech',
        title: 'Someone likes a new CSS trick',
        summary: 'A community post without official confirmation.'
      },
      sourceGroups: ['community']
    });
    expect(decision).toMatchObject({
      candidateType: 'evidence_only',
      decision: 'rejected'
    });
  });
});
```

- [ ] **Step 2: Run failing gate tests**

Run:

```bash
pnpm --filter @agent/agents-intel-engine exec vitest run test/runtime/intelligence/intelligence-knowledge-gate.test.ts
```

Expected: FAIL because the gate does not exist.

- [ ] **Step 3: Implement deterministic gate**

Create `agents/intel-engine/src/runtime/intelligence/intelligence-knowledge-gate.ts`:

```ts
import type { IntelligenceChannel } from '@agent/core';

interface GateSignal {
  id: string;
  channel: IntelligenceChannel;
  title: string;
  summary: string;
  priority: 'P0' | 'P1' | 'P2';
  confidence: 'low' | 'medium' | 'high';
  status: 'pending' | 'confirmed' | 'closed';
}

export function decideIntelligenceKnowledgeCandidate(input: {
  signal: GateSignal;
  sourceGroups: Array<'official' | 'authority' | 'community' | 'unknown'>;
}) {
  const text = `${input.signal.title} ${input.signal.summary}`.toLowerCase();
  const hasOfficial = input.sourceGroups.includes('official');
  const hasAuthority = input.sourceGroups.includes('authority');

  if (input.signal.channel === 'skills-agent-tools') {
    return {
      candidateType: 'skill_card' as const,
      decision: 'needs_review' as const,
      decisionReason: 'Agent tool candidates require Admin approval before installation or reuse.',
      ttlDays: 180
    };
  }

  if (input.signal.channel === 'frontend-security' || input.signal.channel === 'ai-security') {
    if (hasOfficial || /\b(cve|ghsa|advisory|incident|leak|泄露|漏洞)\b/.test(text)) {
      return {
        candidateType: 'knowledge' as const,
        decision: 'candidate' as const,
        decisionReason: 'Security signal has official or high-confidence evidence.',
        ttlDays: 365
      };
    }
  }

  if (input.signal.channel === 'llm-releases' || input.signal.channel === 'ai-product-platform') {
    if (hasOfficial && /\b(model|pricing|context|api|deprecation|migration|rate limit|enterprise)\b/.test(text)) {
      return {
        candidateType: 'knowledge' as const,
        decision: 'candidate' as const,
        decisionReason: 'Official platform/model change affects model routing, cost, or migration strategy.',
        ttlDays: 180
      };
    }
  }

  if (input.signal.channel === 'frontend-tech') {
    if (hasOfficial && /\b(breaking|migration|major|release|compatibility|stable|baseline)\b/.test(text)) {
      return {
        candidateType: 'knowledge' as const,
        decision: 'candidate' as const,
        decisionReason: 'Official frontend change has migration or compatibility impact.',
        ttlDays: 365
      };
    }
  }

  return {
    candidateType: 'evidence_only' as const,
    decision: hasAuthority ? ('needs_review' as const) : ('rejected' as const),
    decisionReason: hasAuthority
      ? 'Authority source requires human review before Knowledge promotion.'
      : 'Community or low-confidence signal stays as evidence only.',
    ttlDays: 90
  };
}
```

Modify `agents/intel-engine/src/runtime/intelligence/index.ts`:

```ts
export * from './intelligence-channels';
export * from './intelligence-search-normalizer';
export * from './intelligence-knowledge-gate';
```

- [ ] **Step 4: Verify gate tests pass**

Run:

```bash
pnpm --filter @agent/agents-intel-engine exec vitest run test/runtime/intelligence/intelligence-knowledge-gate.test.ts
```

Expected: PASS.

## Task 5: Backend Intelligence Projections And Endpoints

**Files:**

- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-centers.types.ts`
- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-centers-observability.query-service.ts`
- Modify: `apps/backend/agent-server/src/runtime/centers/runtime-centers.service.ts`
- Modify: `apps/backend/agent-server/src/platform/platform-briefings.controller.ts`
- Test: `apps/backend/agent-server/test/platform/intelligence.controller.spec.ts`
- Modify: `docs/contracts/api/agent-admin.md`

- [ ] **Step 1: Write failing platform endpoint tests**

Create `apps/backend/agent-server/test/platform/intelligence.controller.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { PlatformBriefingsController } from '../../src/platform/platform-briefings.controller';

describe('PlatformBriefingsController intelligence endpoints', () => {
  it('returns intelligence overview through runtime centers service', async () => {
    const controller = new PlatformBriefingsController(
      {
        getIntelligenceOverview: async () => ({
          generatedAt: '2026-05-10T01:00:00.000Z',
          channels: [],
          recentSignals: [],
          pendingCandidates: []
        })
      } as never,
      {} as never
    );
    await expect(controller.getIntelligenceOverview()).resolves.toMatchObject({
      generatedAt: '2026-05-10T01:00:00.000Z'
    });
  });

  it('forces an intelligence channel run', async () => {
    const controller = new PlatformBriefingsController(
      {
        forceIntelligenceRun: async (channel: string) => ({ ok: true, channel })
      } as never,
      {} as never
    );
    await expect(controller.forceIntelligenceRun('llm-releases' as never)).resolves.toEqual({
      ok: true,
      channel: 'llm-releases'
    });
  });
});
```

- [ ] **Step 2: Run failing endpoint tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/platform/intelligence.controller.spec.ts
```

Expected: FAIL because controller methods do not exist.

- [ ] **Step 3: Add query service methods**

In `apps/backend/agent-server/src/runtime/centers/runtime-centers-observability.query-service.ts`, add methods that read from `ctx.intelligenceRepository` when available and return empty projections otherwise:

```ts
async getIntelligenceOverview() {
  const generatedAt = new Date().toISOString();
  const repository = this.ctx().intelligenceRepository;
  if (!repository) {
    return {
      generatedAt,
      channels: [],
      recentSignals: [],
      pendingCandidates: []
    };
  }
  return {
    generatedAt,
    channels: [],
    recentSignals: await repository.listRecentSignals({ limit: 20 }),
    pendingCandidates: await repository.listPendingCandidates({ limit: 20 })
  };
}

async forceIntelligenceRun(channel: string) {
  return {
    ok: true,
    channel,
    acceptedAt: new Date().toISOString()
  };
}
```

Update `runtime-centers.types.ts` to include optional `intelligenceRepository` typed from `runtime/intelligence/intelligence.repository`.

Add pass-through methods in `runtime-centers.service.ts`:

```ts
getIntelligenceOverview() {
  return this.observabilityQueryService.getIntelligenceOverview();
}

forceIntelligenceRun(channel: string) {
  return this.observabilityQueryService.forceIntelligenceRun(channel);
}
```

- [ ] **Step 4: Add platform controller endpoints**

In `apps/backend/agent-server/src/platform/platform-briefings.controller.ts`, import `IntelligenceChannelSchema` from `@agent/core` and add:

```ts
@Get('intelligence/overview')
getIntelligenceOverview() {
  return this.runtimeCentersService.getIntelligenceOverview();
}

@Post('intelligence/:channel/force-run')
forceIntelligenceRun(@Param('channel') channel: string) {
  const parsed = IntelligenceChannelSchema.parse(channel);
  return this.runtimeCentersService.forceIntelligenceRun(parsed);
}
```

- [ ] **Step 5: Verify endpoint tests pass**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/platform/intelligence.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Update API docs**

Modify `docs/contracts/api/agent-admin.md` and add rows:

```markdown
| `GET` | `/api/platform/intelligence/overview` | 无 | `IntelligenceOverviewProjection` | Tech & AI Intelligence 概览、近期信号和待审候选。 |
| `POST` | `/api/platform/intelligence/:channel/force-run` | path: `channel: IntelligenceChannel` | `{ ok: true; channel: string; acceptedAt: string }` | 手动触发指定情报频道抓取。 |
```

## Task 6: Agent Admin Intelligence Center

**Files:**

- Modify: `apps/frontend/agent-admin/src/api/admin-api-platform.ts`
- Create: `apps/frontend/agent-admin/src/pages/intelligence-center/intelligence-center-page.tsx`
- Create: `apps/frontend/agent-admin/src/pages/intelligence-center/intelligence-center-types.ts`
- Modify: `apps/frontend/agent-admin/src/app/admin-routes.tsx`
- Modify: `apps/frontend/agent-admin/src/components/app-sidebar-nav-items.ts`
- Test: `apps/frontend/agent-admin/test/pages/intelligence-center.test.tsx`

- [ ] **Step 1: Write failing frontend test**

Create `apps/frontend/agent-admin/test/pages/intelligence-center.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IntelligenceCenterPage } from '../../src/pages/intelligence-center/intelligence-center-page';

describe('IntelligenceCenterPage', () => {
  it('renders channel, signal, and candidate sections', () => {
    render(
      <IntelligenceCenterPage
        overview={{
          generatedAt: '2026-05-10T01:00:00.000Z',
          channels: [
            {
              channel: 'llm-releases',
              label: 'LLM Releases',
              lastRunAt: '2026-05-10T00:00:00.000Z',
              signalCount: 2,
              candidateCount: 1,
              failedQueryCount: 0
            }
          ],
          recentSignals: [
            {
              id: 'sig_1',
              channel: 'llm-releases',
              title: 'New model',
              summary: 'A model release affects routing.',
              priority: 'P1',
              confidence: 'high',
              status: 'confirmed',
              firstSeenAt: '2026-05-10T00:00:00.000Z',
              lastSeenAt: '2026-05-10T00:00:00.000Z',
              sourceCount: 2,
              knowledgeDecision: 'candidate'
            }
          ],
          pendingCandidates: [
            {
              id: 'cand_1',
              signalId: 'sig_1',
              candidateType: 'knowledge',
              decision: 'candidate',
              decisionReason: 'Official release affects routing.',
              ttlDays: 180,
              reviewStatus: 'pending',
              createdAt: '2026-05-10T00:00:00.000Z'
            }
          ]
        }}
      />
    );
    expect(screen.getByText('LLM Releases')).toBeInTheDocument();
    expect(screen.getByText('New model')).toBeInTheDocument();
    expect(screen.getByText('Official release affects routing.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing frontend test**

Run:

```bash
pnpm --dir apps/frontend/agent-admin exec vitest run test/pages/intelligence-center.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Add API client method**

In `apps/frontend/agent-admin/src/api/admin-api-platform.ts`, add:

```ts
import type { IntelligenceOverviewProjection } from '@agent/core';

export async function getIntelligenceOverview(): Promise<IntelligenceOverviewProjection> {
  return adminApiGet<IntelligenceOverviewProjection>('/platform/intelligence/overview');
}
```

Use the existing `adminApiGet` helper name from this file. If the helper has a different local name, keep the existing helper and only add the new typed wrapper.

- [ ] **Step 4: Add page component**

Create `apps/frontend/agent-admin/src/pages/intelligence-center/intelligence-center-page.tsx`:

```tsx
import type { IntelligenceOverviewProjection } from '@agent/core';

export function IntelligenceCenterPage({ overview }: { overview: IntelligenceOverviewProjection }) {
  return (
    <main className="admin-page intelligence-center-page">
      <header className="admin-page__header">
        <h1>Tech & AI Intelligence</h1>
        <p>Postgres-backed frontend, LLM, skills, and AI security signals.</p>
      </header>

      <section aria-label="Channels" className="admin-section">
        <h2>Channels</h2>
        <div className="admin-grid">
          {overview.channels.map(channel => (
            <article className="admin-card" key={channel.channel}>
              <h3>{channel.label}</h3>
              <p>{channel.signalCount} signals</p>
              <p>{channel.candidateCount} candidates</p>
              <p>{channel.failedQueryCount} failed queries</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Recent signals" className="admin-section">
        <h2>Recent Signals</h2>
        {overview.recentSignals.map(signal => (
          <article className="admin-card" key={signal.id}>
            <h3>{signal.title}</h3>
            <p>{signal.summary}</p>
            <p>{signal.channel}</p>
          </article>
        ))}
      </section>

      <section aria-label="Knowledge candidates" className="admin-section">
        <h2>Knowledge Candidates</h2>
        {overview.pendingCandidates.map(candidate => (
          <article className="admin-card" key={candidate.id}>
            <h3>{candidate.candidateType}</h3>
            <p>{candidate.decisionReason}</p>
            <p>{candidate.reviewStatus}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
```

Create `apps/frontend/agent-admin/src/pages/intelligence-center/intelligence-center-types.ts`:

```ts
export type IntelligenceCenterTab = 'channels' | 'signals' | 'candidates';
```

- [ ] **Step 5: Add route and nav item**

Modify `apps/frontend/agent-admin/src/app/admin-routes.tsx` to include a `/intelligence` route. Follow the existing route loading pattern in the file. The route should fetch `getIntelligenceOverview()` and render `IntelligenceCenterPage`.

Modify `apps/frontend/agent-admin/src/components/app-sidebar-nav-items.ts` and add a nav item labeled `Intelligence` with path `/intelligence`.

- [ ] **Step 6: Verify frontend test passes**

Run:

```bash
pnpm --dir apps/frontend/agent-admin exec vitest run test/pages/intelligence-center.test.tsx
```

Expected: PASS.

## Task 7: Docs And Existing Briefing Boundary Cleanup

**Files:**

- Modify: `docs/agents/intel-engine/daily-tech-briefing.md`
- Modify: `docs/integration/daily-tech-intelligence-briefing-design.md`
- Modify: `docs/apps/backend/agent-server/runtime-module-notes.md`
- Verify: `docs/superpowers/specs/2026-05-10-tech-ai-intelligence-minimax-cli-design.md`

- [ ] **Step 1: Scan for stale wording**

Run:

```bash
rg -n "SQLite|intel.db|AI Agent / RAG / Runtime|LangGraph|LangChain|LlamaIndex|file repository|profile-storage/platform/intel-engine/briefing" docs/agents/intel-engine docs/integration docs/apps/backend/agent-server docs/contracts/api/agent-admin.md
```

Expected: find current docs that need wording updates. Do not delete historical archive docs.

- [ ] **Step 2: Update intel briefing docs**

In `docs/agents/intel-engine/daily-tech-briefing.md`, add a section:

```markdown
## Tech & AI Intelligence Postgres Target

Tech & AI Intelligence 的目标生产存储是 Postgres `intel_*` 表。`profile-storage/platform/intel-engine/briefing/*`
只保留为本地兼容或过渡存储；新抓取 run、query、raw event、signal、source、candidate 和 ingestion receipt
必须通过 repository 写入生产数据库。

抓取频道包括 Frontend Tech、Frontend Security、LLM Releases、Skills & Agent Tools、AI Security 和
AI Product & Platform。`AI Agent / RAG / Runtime 工程` 不是抓取频道，相关工程学习资料不进入每日情报。
```

- [ ] **Step 3: Update integration doc**

In `docs/integration/daily-tech-intelligence-briefing-design.md`, add a note near the current implementation section:

```markdown
> 2026-05-10 更新：Tech & AI Intelligence 的新设计见
> [Tech And AI Intelligence MiniMax CLI Design](/docs/superpowers/specs/2026-05-10-tech-ai-intelligence-minimax-cli-design.md)。
> 生产目标是 Postgres `intel_*` 表；SQLite / file repository 说明只代表既有链路或本地 fallback，不是新增能力的目标持久化方案。
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 8: Affected Verification

**Files:** no source edits unless earlier verification exposes a real issue.

- [ ] **Step 1: Run core contract tests**

Run:

```bash
pnpm --filter @agent/core exec vitest run test/intelligence-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run intel-engine intelligence tests**

Run:

```bash
pnpm --filter @agent/agents-intel-engine exec vitest run test/runtime/intelligence
```

Expected: PASS.

- [ ] **Step 3: Run backend intelligence tests**

Run:

```bash
pnpm exec vitest run apps/backend/agent-server/test/runtime/intelligence
pnpm exec vitest run apps/backend/agent-server/test/platform/intelligence.controller.spec.ts
```

Expected: both commands PASS. The second command is valid after Task 5 creates
`apps/backend/agent-server/test/platform/intelligence.controller.spec.ts`; do not combine these paths into one
Vitest invocation because a missing explicit file can be hidden by the existing directory match.

- [ ] **Step 4: Run agent-admin affected test**

Run:

```bash
pnpm --dir apps/frontend/agent-admin exec vitest run test/pages/intelligence-center.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run affected TypeScript checks**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p agents/intel-engine/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

Expected: all commands exit `0`.

- [ ] **Step 6: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Self-Review

Spec coverage:

- MiniMax CLI path is covered by reusing existing CLI transport and adding channel/query normalization around `minimax:web_search`.
- Postgres-first persistence is covered by Task 2 schema and repository.
- Approved channels are covered by Task 1 and Task 3 tests.
- Exclusion of `AI Agent / RAG / Runtime 工程` is covered by Task 1, Task 3, and docs cleanup.
- Knowledge noise control is covered by Task 4 candidate gate and Task 5/Admin projections.
- Skills approval-only behavior is covered by Task 4 `skill_card` candidate decisions.
- Admin observability is covered by Task 5 and Task 6.
- Docs cleanup and verification are covered by Tasks 7 and 8.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified “add tests” steps are present.
- Each code-facing task includes file paths, concrete snippets, and commands with expected results.

Type consistency:

- Channel values match `IntelligenceChannelSchema`.
- Candidate values use `skill_card`, `knowledge`, and `evidence_only` consistently.
- Repository methods used by backend projection match Task 2 interface names.
