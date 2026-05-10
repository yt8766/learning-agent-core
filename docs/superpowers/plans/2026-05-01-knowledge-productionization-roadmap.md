# Knowledge Productionization Roadmap Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/agent-server/src/knowledge`、`packages/knowledge`、`packages/adapters`
最后核对：2026-05-01

> Historical note: this document predates the real API domain-model cutover. Current Knowledge frontend runtime data must come from `/api/knowledge/*`; frontend runtime mock mode has been removed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current knowledge horizontal MVP into a production-ready knowledge frontend, backend API, SDK, RAG runtime, evaluation system, and observability system.

**Architecture:** Keep stable contracts in `packages/knowledge/src/core` and consume them from frontend/backend through package exports. Backend owns auth, persistence, jobs, RAG orchestration, evaluation runs, and trace aggregation behind repositories and services. Frontend `apps/frontend/knowledge` consumes the same API/domain contracts through an injectable client, with mock mode retained only as an explicit local demo provider.

**Tech Stack:** TypeScript, NestJS, React, Vite, Vitest, Zod, JWT access token + refresh token rotation, Supabase PostgreSQL + pgvector, `@agent/knowledge/core`, `@agent/knowledge/client`, `@agent/adapters`, pnpm workspace.

---

## Scope Check

This is a multi-subsystem productionization plan. It is intentionally split into independently verifiable tasks so each task can be implemented, tested, documented, and committed without requiring the whole roadmap to land at once.

This plan covers what remains after the existing horizontal MVP:

- Frontend still relies on mock/demo data in several workflows.
- Backend knowledge APIs are stubbed and do not persist real business data.
- JWT refresh exists at contract level but is not production-grade session rotation.
- Upload, parsing, chunking, embedding, indexing, and reprocessing are not wired as a durable pipeline.
- Vector store selection is not implemented; recommended production default is Supabase PostgreSQL + pgvector with a stable `VectorStore` adapter boundary.
- RAG chat is not a real retrieval + generation pipeline.
- Evaluation system exists only as design/API direction, not as runnable datasets, cases, runs, metrics, and regression comparisons.
- Observability system exists only as design/API direction, not as trace/span capture, metric aggregation, and UI drilldown.
- SDK is not yet fully publishable as a third-party package with browser/node/default implementation boundaries.

## File Structure

Create and modify these files across the roadmap:

- `packages/knowledge/src/core/auth.ts`: Stable auth/session schemas shared by SDK clients and backend DTO parsing.
- `packages/knowledge/src/core/vector-store.ts`: Stable vector store interfaces and schemas.
- `packages/knowledge/src/core/rag.ts`: Stable retrieval, citation, answer, and feedback contracts.
- `packages/knowledge/src/core/evals.ts`: Stable evaluation dataset, case, run, metric, and result schemas.
- `packages/knowledge/src/core/observability.ts`: Stable trace, span, metric, and debug event schemas.
- `packages/knowledge/src/client/knowledge-api-client.ts`: Browser-safe HTTP API client with token refresh hooks.
- `packages/knowledge/src/node/index.ts`: Node-oriented SDK exports for server-side adapters.
- `packages/knowledge/src/browser/index.ts`: Browser-oriented SDK exports for frontend consumers.
- `packages/knowledge/src/index.ts`: Root SDK exports for stable public entrypoints.
- `packages/knowledge/test/*.test.ts`: Contract, client, and export regression tests.
- `packages/adapters/src/supabase/supabase-pgvector-store.adapter.ts`: Default Supabase + pgvector vector store adapter.
- `packages/adapters/test/supabase-pgvector-store.adapter.test.ts`: Adapter mapping tests using a fake Supabase client.
- `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`: HTTP API boundary for auth-protected knowledge operations.
- `apps/backend/agent-server/src/knowledge/knowledge.service.ts`: Application service facade for knowledge workflows.
- `apps/backend/agent-server/src/knowledge/knowledge-auth.service.ts`: JWT/session rotation and auth facade.
- `apps/backend/agent-server/src/knowledge/knowledge-ingestion.service.ts`: Upload processing, parsing, chunking, embedding, and indexing orchestration.
- `apps/backend/agent-server/src/knowledge/knowledge-rag.service.ts`: Retrieval, rerank, context assembly, generation, citation, and feedback orchestration.
- `apps/backend/agent-server/src/knowledge/knowledge-eval.service.ts`: Evaluation dataset/case/run lifecycle and metric calculation.
- `apps/backend/agent-server/src/knowledge/knowledge-observability.service.ts`: Trace/span ingestion and metric aggregation.
- `apps/backend/agent-server/src/knowledge/interfaces/*.ts`: Internal service/repository interfaces.
- `apps/backend/agent-server/src/knowledge/repositories/*.ts`: Repository implementations and in-memory test implementations.
- `apps/backend/agent-server/test/knowledge/*.spec.ts`: Backend contract, service, and controller tests.
- `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`: React provider for real and mock API clients.
- `apps/frontend/knowledge/src/hooks/*.ts`: Query/action hooks for auth, knowledge bases, documents, chat, evals, and observability.
- `apps/frontend/knowledge/src/pages/*.tsx`: Production UI workflows backed by real API hooks.
- `apps/frontend/knowledge/test/*.test.tsx`: Frontend provider and page behavior tests.
- `docs/contracts/api/knowledge.md`: API contract updated from MVP stubs to production semantics.
- `docs/sdk/knowledge.md`: SDK public API, default implementations, and extension policy.
- `docs/apps/frontend/knowledge/knowledge-frontend.md`: Frontend architecture and workflow documentation.
- `docs/apps/backend/agent-server/knowledge.md`: Backend knowledge service architecture and runtime notes.

## Task 1: Stabilize Shared Knowledge Core Contracts

**Files:**

- Modify: `packages/knowledge/src/core/auth.ts`
- Modify: `packages/knowledge/src/core/vector-store.ts`
- Modify: `packages/knowledge/src/core/rag.ts`
- Modify: `packages/knowledge/src/core/evals.ts`
- Modify: `packages/knowledge/src/core/observability.ts`
- Modify: `packages/knowledge/src/core/index.ts`
- Test: `packages/knowledge/test/core-production-contracts.test.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  KnowledgeAuthSessionSchema,
  KnowledgeEvalRunSchema,
  KnowledgeRagAnswerSchema,
  KnowledgeTraceSchema,
  KnowledgeVectorSearchRequestSchema
} from '../src/core';

describe('knowledge production core contracts', () => {
  it('parses a JWT double-token auth session', () => {
    expect(
      KnowledgeAuthSessionSchema.parse({
        accessToken: 'access.jwt.value',
        refreshToken: 'refresh.jwt.value',
        tokenType: 'Bearer',
        expiresAt: '2026-05-01T09:00:00.000Z',
        refreshExpiresAt: '2026-05-08T09:00:00.000Z',
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner',
          roles: ['owner']
        }
      })
    ).toMatchObject({ tokenType: 'Bearer' });
  });

  it('parses a vector search request without leaking vendor fields', () => {
    expect(
      KnowledgeVectorSearchRequestSchema.parse({
        knowledgeBaseId: 'kb-1',
        query: '如何设计知识库评测系统',
        embedding: [0.1, 0.2, 0.3],
        topK: 8,
        filters: {
          documentIds: ['doc-1'],
          tags: ['frontend'],
          metadata: { source: 'manual' }
        }
      })
    ).toMatchObject({ topK: 8 });
  });

  it('parses a RAG answer with citations', () => {
    expect(
      KnowledgeRagAnswerSchema.parse({
        id: 'answer-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        answer: '可以先评测检索，再评测生成，最后做端到端回归。',
        citations: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            title: 'RAG知识框架.pptx',
            score: 0.91,
            text: '常见的评测内容有检索评测、生成评测、端到端评测。'
          }
        ],
        usage: { inputTokens: 1200, outputTokens: 180, totalTokens: 1380 }
      })
    ).toMatchObject({ citations: [{ chunkId: 'chunk-1' }] });
  });

  it('parses an eval run with retrieval and generation metrics', () => {
    expect(
      KnowledgeEvalRunSchema.parse({
        id: 'eval-run-1',
        datasetId: 'dataset-1',
        status: 'completed',
        startedAt: '2026-05-01T09:00:00.000Z',
        completedAt: '2026-05-01T09:03:00.000Z',
        metrics: {
          recallAtK: 0.86,
          precisionAtK: 0.72,
          mrr: 0.67,
          ndcg: 0.81,
          faithfulness: 0.9,
          answerRelevance: 0.88,
          citationAccuracy: 0.84
        }
      })
    ).toMatchObject({ status: 'completed' });
  });

  it('parses an observability trace with stage spans', () => {
    expect(
      KnowledgeTraceSchema.parse({
        traceId: 'trace-1',
        requestId: 'request-1',
        userId: 'user-1',
        knowledgeBaseId: 'kb-1',
        operation: 'rag.chat',
        startedAt: '2026-05-01T09:00:00.000Z',
        endedAt: '2026-05-01T09:00:02.000Z',
        status: 'ok',
        spans: [
          {
            spanId: 'span-1',
            name: 'retrieval',
            startedAt: '2026-05-01T09:00:00.100Z',
            endedAt: '2026-05-01T09:00:00.650Z',
            attributes: { topK: 8 }
          }
        ]
      })
    ).toMatchObject({ operation: 'rag.chat' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-production-contracts.test.ts`

Expected: FAIL because the production schemas are not exported yet.

- [ ] **Step 3: Add the schemas and inferred types**

Add stable Zod schemas for auth session, vector search, RAG answer, eval run, and trace. Every exported long-lived type must be inferred from a schema:

```ts
export const KnowledgeAuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresAt: z.string().datetime(),
  refreshExpiresAt: z.string().datetime(),
  user: KnowledgeUserSchema
});

export type KnowledgeAuthSession = z.infer<typeof KnowledgeAuthSessionSchema>;
```

- [ ] **Step 4: Export the contracts from `packages/knowledge/src/core/index.ts`**

```ts
export * from './auth';
export * from './vector-store';
export * from './rag';
export * from './evals';
export * from './observability';
```

- [ ] **Step 5: Verify the contracts**

Run: `pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-production-contracts.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/knowledge/src/core packages/knowledge/test/core-production-contracts.test.ts
git commit -m "feat: stabilize knowledge production contracts"
```

## Task 2: Replace Frontend Mock Access With an Injectable API Provider

**Files:**

- Create: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-dashboard.ts`
- Modify: `apps/frontend/knowledge/src/App.tsx`
- Modify: `apps/frontend/knowledge/src/main.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-api-provider.test.tsx`

- [ ] **Step 1: Write the failing provider test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KnowledgeApiProvider, useKnowledgeApi } from '../src/api/knowledge-api-provider';

function Probe() {
  const api = useKnowledgeApi();

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await api.knowledgeBases.list();
        document.body.dataset.firstKnowledgeBase = result.items[0]?.name ?? '';
      }}
    >
      load
    </button>
  );
}

describe('KnowledgeApiProvider', () => {
  it('injects a concrete API client into frontend workflows', async () => {
    render(
      <KnowledgeApiProvider
        client={{
          knowledgeBases: {
            list: async () => ({ items: [{ id: 'kb-1', name: '前端知识库' }] })
          }
        }}
      >
        <Probe />
      </KnowledgeApiProvider>
    );

    screen.getByRole('button', { name: 'load' }).click();

    await waitFor(() => {
      expect(document.body.dataset.firstKnowledgeBase).toBe('前端知识库');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-api-provider.test.tsx`

Expected: FAIL because `KnowledgeApiProvider` does not exist.

- [ ] **Step 3: Implement the provider**

```tsx
import { createContext, useContext } from 'react';

export interface KnowledgeFrontendApi {
  knowledgeBases: {
    list(): Promise<{ items: Array<{ id: string; name: string }> }>;
  };
}

const KnowledgeApiContext = createContext<KnowledgeFrontendApi | null>(null);

export function KnowledgeApiProvider({
  children,
  client
}: {
  children: React.ReactNode;
  client: KnowledgeFrontendApi;
}) {
  return <KnowledgeApiContext.Provider value={client}>{children}</KnowledgeApiContext.Provider>;
}

export function useKnowledgeApi(): KnowledgeFrontendApi {
  const client = useContext(KnowledgeApiContext);
  if (!client) {
    throw new Error('KnowledgeApiProvider is required before using knowledge API hooks.');
  }
  return client;
}
```

- [ ] **Step 4: Add a dashboard hook that consumes the provider**

```ts
import { useEffect, useState } from 'react';
import { useKnowledgeApi } from '../api/knowledge-api-provider';

export function useKnowledgeDashboard() {
  const api = useKnowledgeApi();
  const [state, setState] = useState<{ loading: boolean; names: string[] }>({
    loading: true,
    names: []
  });

  useEffect(() => {
    let cancelled = false;
    api.knowledgeBases.list().then(result => {
      if (!cancelled) {
        setState({ loading: false, names: result.items.map(item => item.name) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return state;
}
```

- [ ] **Step 5: Wire `main.tsx` to create a real client in production and a mock client in demo mode**

Use `import.meta.env.VITE_KNOWLEDGE_API_MODE === "mock"` as the only mock switch. The default mode must instantiate the SDK API client.

- [ ] **Step 6: Verify frontend provider behavior**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-api-provider.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge/src/api apps/frontend/knowledge/src/hooks apps/frontend/knowledge/src/App.tsx apps/frontend/knowledge/src/main.tsx apps/frontend/knowledge/test/knowledge-api-provider.test.tsx
git commit -m "feat: inject knowledge frontend api client"
```

## Task 3: Add Production JWT Session Rotation

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/interfaces/knowledge-auth.types.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-session.repository.ts`
- Create: `apps/backend/agent-server/src/knowledge/knowledge-auth.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts`

- [ ] **Step 1: Write the failing auth rotation test**

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeAuthService } from '../../src/knowledge/knowledge-auth.service';
import { InMemoryKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-session.repository';

describe('KnowledgeAuthService', () => {
  it('rotates refresh tokens and invalidates the previous token', async () => {
    const sessions = new InMemoryKnowledgeSessionRepository();
    const auth = new KnowledgeAuthService({
      sessions,
      now: () => new Date('2026-05-01T09:00:00.000Z'),
      jwtSecret: 'local-test-secret'
    });

    const first = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const second = await auth.refresh({ refreshToken: first.refreshToken });

    await expect(auth.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
      'Refresh token has been rotated or revoked.'
    );
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts`

Expected: FAIL because `KnowledgeAuthService` does not exist.

- [ ] **Step 3: Define the repository boundary**

```ts
export interface KnowledgeSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedToSessionId: string | null;
}

export interface KnowledgeSessionRepository {
  create(record: KnowledgeSessionRecord): Promise<KnowledgeSessionRecord>;
  findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<KnowledgeSessionRecord | null>;
  revokeAndRotate(input: { sessionId: string; rotatedToSessionId: string; revokedAt: string }): Promise<void>;
}
```

- [ ] **Step 4: Implement `KnowledgeAuthService`**

The service must issue short-lived access tokens, longer-lived refresh tokens, hash refresh tokens before storage, and rotate refresh tokens on every refresh call.

- [ ] **Step 5: Wire controller endpoints**

Expose these endpoints through the existing knowledge controller:

- `POST /knowledge/auth/login`
- `POST /knowledge/auth/refresh`
- `GET /knowledge/auth/me`
- `POST /knowledge/auth/logout`

Logout only deletes the local frontend token by contract, but backend must also accept optional refresh-token revocation when the client sends a refresh token.

- [ ] **Step 6: Verify backend auth**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts
git commit -m "feat: add knowledge jwt session rotation"
```

## Task 4: Add Durable Knowledge Persistence Repositories

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/interfaces/knowledge-records.types.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge.repository.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-memory.repository.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
import { describe, expect, it } from 'vitest';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('InMemoryKnowledgeRepository', () => {
  it('stores knowledge bases, documents, chunks, chat messages, eval runs, and traces by tenant', async () => {
    const repo = new InMemoryKnowledgeRepository();

    await repo.createKnowledgeBase({
      id: 'kb-1',
      tenantId: 'tenant-1',
      name: '前端知识库',
      description: 'Frontend docs',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z'
    });

    await repo.createDocument({
      id: 'doc-1',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      title: 'RAG知识框架.pptx',
      status: 'uploaded',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z'
    });

    const documents = await repo.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });

    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]?.title).toBe('RAG知识框架.pptx');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts`

Expected: FAIL because repository files do not exist.

- [ ] **Step 3: Define record types**

Record types must include these ownership fields on every persisted entity:

- `tenantId`
- `createdAt`
- `updatedAt`

Documents must include `status: "uploaded" | "processing" | "indexed" | "failed"`.

- [ ] **Step 4: Implement repository interface and in-memory implementation**

The in-memory implementation must copy records on read/write to avoid tests passing through shared object mutation.

- [ ] **Step 5: Wire `KnowledgeService` to depend on repository interface**

Keep controller logic thin. The controller validates transport DTOs and delegates to `KnowledgeService`; `KnowledgeService` delegates persistence to `KnowledgeRepository`.

- [ ] **Step 6: Verify repository behavior**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts
git commit -m "feat: add knowledge persistence repositories"
```

## Task 5: Build Upload, Processing, Chunking, Embedding, and Indexing Pipeline

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/interfaces/knowledge-ingestion.types.ts`
- Create: `apps/backend/agent-server/src/knowledge/knowledge-ingestion.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts`

- [ ] **Step 1: Write the failing ingestion test**

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeIngestionService } from '../../src/knowledge/knowledge-ingestion.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeIngestionService', () => {
  it('moves an uploaded document through processing, chunking, embedding, and indexing', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeIngestionService({
      repo,
      parser: {
        parse: async () => ({
          title: 'RAG知识框架.pptx',
          text: '检索评测包含 Recall@K、Precision@K、MRR、NDCG。',
          metadata: { mimeType: 'application/vnd.ms-powerpoint' }
        })
      },
      embedder: {
        embedTexts: async texts => texts.map(() => [0.1, 0.2, 0.3])
      },
      vectorStore: {
        upsert: async () => ({ inserted: 1 }),
        search: async () => ({ matches: [] }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      now: () => new Date('2026-05-01T09:00:00.000Z')
    });

    const result = await service.processUploadedDocument({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      fileName: 'RAG知识框架.pptx',
      bytes: Buffer.from('binary-file')
    });

    expect(result.status).toBe('indexed');
    expect(result.chunkCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts`

Expected: FAIL because ingestion service does not exist.

- [ ] **Step 3: Define ingestion boundaries**

```ts
export interface KnowledgeDocumentParser {
  parse(input: { fileName: string; bytes: Buffer }): Promise<{
    title: string;
    text: string;
    metadata: Record<string, unknown>;
  }>;
}

export interface KnowledgeEmbedder {
  embedTexts(texts: string[]): Promise<number[][]>;
}
```

- [ ] **Step 4: Implement deterministic chunking**

The first production chunker uses fixed-size text chunks with overlap:

- `maxChars = 1200`
- `overlapChars = 160`
- Empty text produces one failed job with reason `Parsed document text is empty.`

- [ ] **Step 5: Persist job stages**

Persist these stages as processing events:

- `uploaded`
- `parsed`
- `chunked`
- `embedded`
- `indexed`
- `failed`

- [ ] **Step 6: Verify ingestion**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts
git commit -m "feat: add knowledge ingestion pipeline"
```

## Task 6: Add Supabase PostgreSQL + pgvector Adapter

**Files:**

- Create: `packages/adapters/src/supabase/supabase-pgvector-store.adapter.ts`
- Modify: `packages/adapters/src/index.ts`
- Test: `packages/adapters/test/supabase-pgvector-store.adapter.test.ts`
- Docs: `docs/sdk/knowledge.md`

- [ ] **Step 1: Write the failing adapter mapping test**

```ts
import { describe, expect, it } from 'vitest';
import { SupabasePgVectorStoreAdapter } from '../src/supabase/supabase-pgvector-store.adapter';

describe('SupabasePgVectorStoreAdapter', () => {
  it('maps vector search requests to the match_knowledge_chunks RPC', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name: string, args: unknown) => {
          calls.push({ name, args });
          return {
            data: [
              {
                chunk_id: 'chunk-1',
                document_id: 'doc-1',
                content: '检索评测包含 Recall@K。',
                score: 0.91,
                metadata: { title: 'RAG知识框架.pptx' }
              }
            ],
            error: null
          };
        }
      }
    });

    const result = await adapter.search({
      knowledgeBaseId: 'kb-1',
      query: '检索评测有哪些指标',
      embedding: [0.1, 0.2, 0.3],
      topK: 5,
      filters: { tags: ['rag'] }
    });

    expect(calls[0]).toMatchObject({ name: 'match_knowledge_chunks' });
    expect(result.matches[0]).toMatchObject({ chunkId: 'chunk-1', score: 0.91 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js packages/adapters/test/supabase-pgvector-store.adapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter against the `VectorStore` interface**

The adapter must expose:

- `upsert(input)`
- `search(input)`
- `deleteByDocumentId(input)`

It must convert snake_case database rows into SDK camelCase contracts before returning.

- [ ] **Step 4: Document the recommended vector database choice**

Update `docs/sdk/knowledge.md` with this recommendation:

- Default production recommendation: Supabase PostgreSQL + pgvector.
- Reason: one operational database for auth metadata, document metadata, eval records, traces, and vector search.
- Escape hatch: users can implement `VectorStore` and pass their own adapter for Milvus, Qdrant, Pinecone, Elasticsearch, or a private service.

- [ ] **Step 5: Verify adapter**

Run: `pnpm exec vitest run --config vitest.config.js packages/adapters/test/supabase-pgvector-store.adapter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/src/supabase packages/adapters/src/index.ts packages/adapters/test/supabase-pgvector-store.adapter.test.ts docs/sdk/knowledge.md
git commit -m "feat: add supabase pgvector knowledge adapter"
```

## Task 7: Build Real RAG Chat Pipeline

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/interfaces/knowledge-rag.types.ts`
- Create: `apps/backend/agent-server/src/knowledge/knowledge-rag.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts`

- [ ] **Step 1: Write the failing RAG pipeline test**

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeRagService } from '../../src/knowledge/knowledge-rag.service';

describe('KnowledgeRagService', () => {
  it('retrieves chunks, reranks them, generates an answer, and returns citations', async () => {
    const service = new KnowledgeRagService({
      queryRewriter: { rewrite: async query => ({ query, variants: [query] }) },
      embedder: { embedTexts: async () => [[0.1, 0.2, 0.3]] },
      vectorStore: {
        search: async () => ({
          matches: [
            {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              text: '评测包含检索评测和生成评测。',
              score: 0.9,
              metadata: { title: 'RAG知识框架.pptx' }
            }
          ]
        }),
        upsert: async () => ({ inserted: 0 }),
        deleteByDocumentId: async () => ({ deleted: 0 })
      },
      reranker: { rerank: async ({ matches }) => matches },
      generator: {
        generate: async () => ({
          text: '可以从检索评测、生成评测、端到端评测三层设计。',
          usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 }
        })
      },
      now: () => new Date('2026-05-01T09:00:00.000Z')
    });

    const answer = await service.chat({
      tenantId: 'tenant-1',
      userId: 'user-1',
      knowledgeBaseId: 'kb-1',
      conversationId: 'conversation-1',
      message: '知识库评测怎么做'
    });

    expect(answer.answer).toContain('检索评测');
    expect(answer.citations[0]).toMatchObject({ chunkId: 'chunk-1' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts`

Expected: FAIL because `KnowledgeRagService` does not exist.

- [ ] **Step 3: Define internal RAG provider interfaces**

```ts
export interface KnowledgeQueryRewriter {
  rewrite(query: string): Promise<{ query: string; variants: string[] }>;
}

export interface KnowledgeReranker {
  rerank(input: { query: string; matches: KnowledgeVectorMatch[] }): Promise<KnowledgeVectorMatch[]>;
}

export interface KnowledgeAnswerGenerator {
  generate(input: {
    query: string;
    context: Array<{ chunkId: string; text: string; title: string }>;
  }): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }>;
}
```

- [ ] **Step 4: Implement pipeline stages**

The service must execute stages in this order:

1. Normalize and rewrite query.
2. Embed rewritten query.
3. Search vector store with `topK`.
4. Rerank matches.
5. Assemble context with chunk IDs and document titles.
6. Generate answer.
7. Return answer with citations and usage.
8. Emit trace spans for each stage through `KnowledgeObservabilityService` when configured.

- [ ] **Step 5: Verify RAG chat**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts
git commit -m "feat: add knowledge rag chat pipeline"
```

## Task 8: Build Observability Capture and Metrics Dashboard APIs

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/interfaces/knowledge-observability.types.ts`
- Create: `apps/backend/agent-server/src/knowledge/knowledge-observability.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/knowledge/repositories/knowledge.repository.ts`
- Modify: `apps/backend/agent-server/src/knowledge/repositories/knowledge-memory.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts`

- [ ] **Step 1: Write the failing observability test**

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeObservabilityService } from '../../src/knowledge/knowledge-observability.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeObservabilityService', () => {
  it('aggregates latency, p95, qps, error rate, timeout rate, and feedback distribution', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeObservabilityService({ repo });

    await service.recordTrace({
      traceId: 'trace-1',
      tenantId: 'tenant-1',
      operation: 'rag.chat',
      startedAt: '2026-05-01T09:00:00.000Z',
      endedAt: '2026-05-01T09:00:01.000Z',
      status: 'ok',
      spans: [],
      feedback: 'positive'
    });

    const metrics = await service.getMetrics({
      tenantId: 'tenant-1',
      from: '2026-05-01T08:00:00.000Z',
      to: '2026-05-01T10:00:00.000Z'
    });

    expect(metrics.averageLatencyMs).toBe(1000);
    expect(metrics.qps).toBeGreaterThan(0);
    expect(metrics.feedback.positive).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts`

Expected: FAIL because observability service does not exist.

- [ ] **Step 3: Implement trace capture**

Trace records must include:

- Performance: average latency, p95, p99, QPS, error rate, timeout rate.
- Business: satisfaction, follow-up rate, citation click rate, feedback distribution.
- Debug: per-stage duration, query rewrite output, retrieval candidates, rerank changes, final prompt, final answer.

- [ ] **Step 4: Expose observability APIs**

Add controller endpoints:

- `GET /knowledge/observability/metrics`
- `GET /knowledge/observability/traces`
- `GET /knowledge/observability/traces/:traceId`

- [ ] **Step 5: Verify observability**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts
git commit -m "feat: add knowledge observability system"
```

## Task 9: Build Evaluation Dataset, Runner, and Regression Comparison APIs

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/interfaces/knowledge-eval.types.ts`
- Create: `apps/backend/agent-server/src/knowledge/knowledge-eval.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/agent-server/src/knowledge/repositories/knowledge.repository.ts`
- Modify: `apps/backend/agent-server/src/knowledge/repositories/knowledge-memory.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts`

- [ ] **Step 1: Write the failing evaluation test**

```ts
import { describe, expect, it } from 'vitest';
import { KnowledgeEvalService } from '../../src/knowledge/knowledge-eval.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeEvalService', () => {
  it('runs retrieval and generation evaluation metrics for a dataset', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeEvalService({
      repo,
      runner: {
        answerCase: async () => ({
          retrievedChunkIds: ['chunk-1'],
          answer: '检索评测包含 Recall@K。',
          citations: ['chunk-1']
        })
      },
      judge: {
        judge: async () => ({ faithfulness: 0.9, answerRelevance: 0.85, citationAccuracy: 1 })
      },
      now: () => new Date('2026-05-01T09:00:00.000Z')
    });

    const dataset = await service.createDataset({
      tenantId: 'tenant-1',
      name: 'RAG回归集',
      cases: [
        {
          id: 'case-1',
          question: '检索评测指标有哪些',
          expectedChunkIds: ['chunk-1'],
          referenceAnswer: 'Recall@K、Precision@K、MRR、NDCG。'
        }
      ]
    });

    const run = await service.runDataset({ tenantId: 'tenant-1', datasetId: dataset.id });

    expect(run.metrics.recallAtK).toBe(1);
    expect(run.metrics.faithfulness).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts`

Expected: FAIL because eval service does not exist.

- [ ] **Step 3: Implement metric calculators**

Retrieval metrics:

- `Recall@K = hits / expectedRelevantCount`
- `Precision@K = hits / retrievedCount`
- `MRR = reciprocal rank of first relevant result`
- `NDCG = discounted cumulative gain normalized by ideal gain`

Generation metrics:

- `faithfulness`
- `answerRelevance`
- `citationAccuracy`

The LLM judge implementation must be behind `KnowledgeEvalJudge` so users can replace it.

- [ ] **Step 4: Expose eval APIs**

Add controller endpoints:

- `POST /knowledge/evals/datasets`
- `GET /knowledge/evals/datasets`
- `POST /knowledge/evals/runs`
- `GET /knowledge/evals/runs`
- `GET /knowledge/evals/runs/:runId`
- `POST /knowledge/evals/compare`

- [ ] **Step 5: Verify eval system**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts
git commit -m "feat: add knowledge evaluation system"
```

## Task 10: Complete Frontend Production Workflows

**Files:**

- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-auth.ts`
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-upload.ts`
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-evals.ts`
- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-observability.ts`
- Modify: `apps/frontend/knowledge/src/pages/KnowledgeBasePage.tsx`
- Modify: `apps/frontend/knowledge/src/pages/KnowledgeChatPage.tsx`
- Modify: `apps/frontend/knowledge/src/pages/KnowledgeEvalPage.tsx`
- Modify: `apps/frontend/knowledge/src/pages/KnowledgeObservabilityPage.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

- [ ] **Step 1: Write the failing workflow test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KnowledgeApiProvider } from '../src/api/knowledge-api-provider';
import { KnowledgeChatPage } from '../src/pages/KnowledgeChatPage';

describe('knowledge production workflows', () => {
  it('renders chat answers with citations from the injected API client', async () => {
    render(
      <KnowledgeApiProvider
        client={{
          knowledgeBases: { list: async () => ({ items: [] }) },
          chat: {
            send: async () => ({
              id: 'answer-1',
              answer: '评测系统分为检索、生成、端到端三层。',
              citations: [{ chunkId: 'chunk-1', title: 'RAG知识框架.pptx', score: 0.91 }]
            })
          }
        }}
      >
        <KnowledgeChatPage knowledgeBaseId="kb-1" />
      </KnowledgeApiProvider>
    );

    screen.getByRole('textbox').focus();
    await userEvent.keyboard('知识库评测怎么做');
    await userEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(screen.getByText('评测系统分为检索、生成、端到端三层。')).toBeInTheDocument();
      expect(screen.getByText('RAG知识框架.pptx')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-production-workflows.test.tsx`

Expected: FAIL because the production workflow hooks/pages are not fully wired.

- [ ] **Step 3: Implement hooks**

Each hook must expose:

- `loading`
- `error`
- domain data
- action method
- `reload` when the page needs manual refresh

- [ ] **Step 4: Replace mock page data with hooks**

Pages must display:

- Upload: document status, processing stage, error reason, reprocess action.
- Chat: answer, citations, feedback, trace link.
- Eval: dataset list, run status, metrics, comparison.
- Observability: metrics cards, trace table, trace stage drawer.

- [ ] **Step 5: Verify frontend workflows**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-production-workflows.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/knowledge/src apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
git commit -m "feat: wire knowledge frontend production workflows"
```

## Task 11: Make `@agent/knowledge` Publishable as an SDK

**Files:**

- Create: `packages/knowledge/src/browser/index.ts`
- Create: `packages/knowledge/src/node/index.ts`
- Modify: `packages/knowledge/src/client/knowledge-api-client.ts`
- Modify: `packages/knowledge/src/index.ts`
- Modify: `packages/knowledge/package.json`
- Test: `packages/knowledge/test/sdk-entrypoints.test.ts`
- Docs: `docs/sdk/knowledge.md`

- [ ] **Step 1: Write the failing SDK entrypoint test**

```ts
import { describe, expect, it } from 'vitest';

describe('@agent/knowledge SDK entrypoints', () => {
  it('exports stable browser and node entrypoints without vendor objects', async () => {
    const root = await import('../src');
    const browser = await import('../src/browser');
    const node = await import('../src/node');

    expect(root.KnowledgeVectorSearchRequestSchema).toBeDefined();
    expect(browser.KnowledgeApiClient).toBeDefined();
    expect(node.createKnowledgeRuntime).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js packages/knowledge/test/sdk-entrypoints.test.ts`

Expected: FAIL because browser/node entrypoints are incomplete.

- [ ] **Step 3: Define package exports**

`packages/knowledge/package.json` must expose:

- `.`
- `./core`
- `./client`
- `./browser`
- `./node`

- [ ] **Step 4: Keep default implementations replaceable**

The SDK must export interfaces and factory functions, not hard-wire Supabase, a specific LLM, or a specific embedding model into public contracts. Default adapters can be imported from `@agent/adapters`.

- [ ] **Step 5: Document extension policy**

Update `docs/sdk/knowledge.md` with:

- Core interfaces that users can implement.
- Default implementations provided by this repo.
- Browser token refresh behavior.
- Node runtime composition example.
- Semver compatibility rule for stable schemas.

- [ ] **Step 6: Verify SDK**

Run: `pnpm exec vitest run --config vitest.config.js packages/knowledge/test/sdk-entrypoints.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/knowledge/src packages/knowledge/package.json packages/knowledge/test/sdk-entrypoints.test.ts docs/sdk/knowledge.md
git commit -m "feat: prepare knowledge package sdk entrypoints"
```

## Task 12: Update API and Architecture Documentation

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`
- Modify: `docs/sdk/knowledge.md`

- [ ] **Step 1: Update API contract sections**

Document these endpoint groups:

- Auth: login, refresh, me, logout.
- Knowledge bases: list, create, update, archive.
- Documents: upload, list, detail, status, reprocess, delete.
- Chat: send message, feedback, citation click.
- Observability: metrics, traces, trace detail.
- Evals: dataset CRUD, run CRUD, comparison.

- [ ] **Step 2: Update frontend architecture doc**

Record:

- `KnowledgeApiProvider` is the only UI API entrypoint.
- Mock mode is controlled by `VITE_KNOWLEDGE_API_MODE=mock`.
- Token storage is local browser storage.
- Logout removes local tokens and may call backend refresh-token revocation when a refresh token exists.
- Auto-refresh is handled by the SDK client before retrying the original request once.

- [ ] **Step 3: Update backend architecture doc**

Record:

- Controller stays transport-only.
- Services own application orchestration.
- Repositories own persistence.
- Provider interfaces isolate parsers, embedders, vector stores, rerankers, generators, LLM judges, and trace sinks.
- Third-party objects must not leak into core contracts.

- [ ] **Step 4: Run docs check**

Run: `pnpm check:docs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/contracts/api/knowledge.md docs/apps/frontend/knowledge/knowledge-frontend.md docs/apps/backend/agent-server/knowledge.md docs/sdk/knowledge.md
git commit -m "docs: update knowledge production architecture"
```

## Task 13: Final Verification and Cleanup

**Files:**

- Review: `packages/knowledge/src/**`
- Review: `packages/adapters/src/**`
- Review: `apps/backend/agent-server/src/knowledge/**`
- Review: `apps/frontend/knowledge/src/**`
- Review: `docs/contracts/api/knowledge.md`
- Review: `docs/sdk/knowledge.md`

- [ ] **Step 1: Run targeted package verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-production-contracts.test.ts packages/knowledge/test/sdk-entrypoints.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm --dir packages/knowledge build:lib
```

Expected: all commands exit with code `0`.

- [ ] **Step 2: Run backend verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server build
```

Expected: all commands exit with code `0`.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
```

Expected: all commands exit with code `0`.

- [ ] **Step 4: Run documentation and workspace checks**

Run:

```bash
pnpm check:docs
pnpm check:barrel-layout
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Remove obsolete mock-only routes and dead exports**

Run:

```bash
rg "mockKnowledge|demoOnly|stub" apps/frontend/knowledge/src apps/backend/agent-server/src/knowledge packages/knowledge/src
```

Expected: every match is either in an explicit mock provider guarded by `VITE_KNOWLEDGE_API_MODE=mock`, a test fixture, or removed in this task.

- [ ] **Step 6: Commit final cleanup**

```bash
git add packages/knowledge packages/adapters apps/backend/agent-server apps/frontend/knowledge docs
git commit -m "chore: verify knowledge productionization"
```

## Self-Review

Spec coverage:

- Frontend project named `knowledge`: covered by Tasks 2 and 10.
- Login with JWT double token, local frontend storage, logout token deletion, auto refresh: covered by Tasks 2, 3, 10, and 12.
- `packages/knowledge` as independently publishable SDK: covered by Tasks 1, 6, 11, and 12.
- SDK principle of default implementations plus user-provided implementations: covered by Tasks 1, 6, 7, 9, and 11.
- Core responsibility under `packages/knowledge/src/core`: covered by Task 1.
- Supabase PostgreSQL + pgvector recommendation: covered by Task 6.
- Upload/file knowledge pipeline: covered by Tasks 4 and 5.
- RAG chat pipeline: covered by Task 7.
- Evaluation system with retrieval, generation, and end-to-end metrics: covered by Task 9.
- Observability system with performance, business, and debug metrics: covered by Task 8.
- API/domain model first for frontend development: covered by Tasks 1, 2, 3, 7, 8, 9, and 12.
- Verification and documentation closure: covered by Tasks 12 and 13.

Placeholder scan:

- This plan avoids placeholder markers and gives concrete file paths, commands, expected outputs, and representative code for each code-bearing task.

Type consistency:

- Shared contracts live under `packages/knowledge/src/core`.
- Backend services consume repository/provider interfaces and return SDK-shaped DTOs.
- Frontend consumes `KnowledgeApiProvider` and never imports backend implementation files.
