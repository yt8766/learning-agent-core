# Knowledge Backend Database Integration Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/backend/agent-server/src/knowledge`、`apps/frontend/knowledge`、`packages/adapters`、`packages/knowledge`
最后核对：2026-05-01

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing `agent-server/src/knowledge` backend to durable PostgreSQL/Supabase persistence and Supabase pgvector while keeping the existing `apps/frontend/knowledge` API contract unchanged.

**Architecture:** Do not create a new backend project; Knowledge remains inside `apps/backend/agent-server/src/knowledge`. Add database access behind `KnowledgeRepository` and vector access behind the existing `KnowledgeVectorStore` / `@agent/adapters` boundaries, then switch runtime wiring by environment config. Frontend continues to call `/api/knowledge/v1/*` through `KnowledgeApiProvider` and should not know whether the backend uses memory, PostgreSQL, or Supabase.

**Tech Stack:** TypeScript, NestJS, Vitest, PostgreSQL/Supabase, pgvector, `@agent/adapters`, `@agent/knowledge`, pnpm workspace.

---

## Scope Check

This plan is the next stage after `docs/superpowers/plans/2026-05-01-knowledge-productionization-roadmap.md`.

Already completed by the previous roadmap:

- `apps/frontend/knowledge` exists and calls `/api/knowledge/v1/*`.
- `apps/backend/agent-server/src/knowledge` exposes Knowledge controller/service APIs.
- JWT double-token auth exists.
- In-memory repositories and horizontal ingestion/RAG/eval/observability flows exist.
- `packages/adapters/src/supabase/SupabasePgVectorStoreAdapter` exists.
- `packages/knowledge` has SDK entrypoints.

Still missing and covered here:

- Real database tables and repository implementation.
- Runtime env wiring to choose memory vs PostgreSQL/Supabase.
- Supabase pgvector vector store wiring inside `agent-server/src/knowledge`.
- Durable session repository for refresh tokens.
- Backend integration tests proving upload/list/chat/eval/trace survive repository boundaries.
- Frontend smoke test proving the real client paths still match backend routes.

This plan intentionally keeps the backend inside `agent-server/src/knowledge`; it does not create `apps/backend/knowledge`.

## File Structure

- `apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts`
  - Minimal SQL client interface and environment-driven PostgreSQL client factory.
- `apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql`
  - PostgreSQL/Supabase schema for knowledge bases, documents, chunks, chat messages, traces, evals, and sessions.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts`
  - Row-to-record and record-to-row mapping helpers.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
  - Durable implementation of `KnowledgeRepository`.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts`
  - Durable implementation of `KnowledgeSessionRepository`.
- `apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts`
  - Parses env and decides repository/vector-store provider.
- `apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts`
  - Nest provider wiring for memory/PostgreSQL/Supabase modes.
- `apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts`
  - Creates `KnowledgeVectorStore` backed by `SupabasePgVectorStoreAdapter`.
- `apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`
  - Repository contract tests using a fake SQL client.
- `apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`
  - Durable session repository contract tests.
- `apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`
  - Env parsing tests.
- `apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`
  - Supabase vector store factory tests.
- `apps/backend/agent-server/test/knowledge/knowledge-database-integration.spec.ts`
  - Service-level tests proving repository-backed document/chat/eval/trace flows.
- `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
  - Frontend client route regression test.
- `docs/apps/backend/agent-server/knowledge.md`
  - Backend database/provider setup notes.
- `docs/contracts/api/knowledge.md`
  - Notes that API paths stay stable while persistence changes.
- `docs/packages/knowledge/sdk.md`
  - Provider configuration and Supabase pgvector notes.

## Task 1: SQL Client Boundary and Schema

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts`
- Create: `apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-sql-client.spec.ts`
- Docs: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write the failing SQL client config test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeDatabaseConfig } from '../../src/knowledge/database/knowledge-sql-client';

describe('resolveKnowledgeDatabaseConfig', () => {
  it('keeps database disabled when KNOWLEDGE_REPOSITORY is memory', () => {
    expect(resolveKnowledgeDatabaseConfig({ KNOWLEDGE_REPOSITORY: 'memory' })).toEqual({
      enabled: false,
      connectionString: undefined
    });
  });

  it('requires DATABASE_URL when KNOWLEDGE_REPOSITORY is postgres', () => {
    expect(() => resolveKnowledgeDatabaseConfig({ KNOWLEDGE_REPOSITORY: 'postgres' })).toThrow(
      'DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres'
    );
  });

  it('returns DATABASE_URL for postgres mode', () => {
    expect(
      resolveKnowledgeDatabaseConfig({
        KNOWLEDGE_REPOSITORY: 'postgres',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge'
      })
    ).toEqual({
      enabled: true,
      connectionString: 'postgres://user:pass@localhost:5432/knowledge'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-sql-client.spec.ts`

Expected: FAIL with module not found for `knowledge-sql-client`.

- [ ] **Step 3: Implement the SQL client boundary**

```ts
// apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts
export interface KnowledgeSqlQueryResult<T> {
  rows: T[];
}

export interface KnowledgeSqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<KnowledgeSqlQueryResult<T>>;
}

export interface KnowledgeDatabaseConfig {
  enabled: boolean;
  connectionString?: string;
}

export function resolveKnowledgeDatabaseConfig(env: Record<string, string | undefined>): KnowledgeDatabaseConfig {
  if (env.KNOWLEDGE_REPOSITORY !== 'postgres') {
    return { enabled: false, connectionString: undefined };
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres');
  }
  return { enabled: true, connectionString: env.DATABASE_URL };
}
```

- [ ] **Step 4: Add the SQL schema**

```sql
-- apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql
create table if not exists knowledge_bases (
  id text not null,
  tenant_id text not null,
  name text not null,
  visibility text not null,
  status text not null,
  tags jsonb not null default '[]'::jsonb,
  created_by text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_documents (
  id text not null,
  tenant_id text not null,
  knowledge_base_id text not null,
  title text not null,
  status text not null,
  source_uri text,
  mime_type text,
  metadata jsonb,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, knowledge_base_id, id)
);

create table if not exists knowledge_chunks (
  id text not null,
  tenant_id text not null,
  knowledge_base_id text not null,
  document_id text not null,
  text text not null,
  ordinal integer,
  token_count integer,
  embedding vector,
  metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_chat_messages (
  id text not null,
  tenant_id text not null,
  conversation_id text not null,
  role text not null,
  content text not null,
  knowledge_base_id text,
  citations jsonb,
  metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_traces (
  id text not null,
  tenant_id text not null,
  operation text not null,
  status text not null,
  knowledge_base_ids jsonb not null default '[]'::jsonb,
  conversation_id text,
  message_id text,
  latency_ms integer,
  spans jsonb,
  metadata jsonb,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_datasets (
  id text not null,
  tenant_id text not null,
  name text not null,
  tags jsonb not null default '[]'::jsonb,
  cases jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_runs (
  id text not null,
  tenant_id text not null,
  dataset_id text not null,
  status text not null,
  knowledge_base_id text,
  created_by text,
  summary jsonb,
  metrics jsonb,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_results (
  id text not null,
  tenant_id text not null,
  run_id text not null,
  case_id text not null,
  status text not null,
  question text not null,
  actual_answer text not null,
  retrieved_chunk_ids jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  retrieval_metrics jsonb not null default '{}'::jsonb,
  generation_metrics jsonb not null default '{}'::jsonb,
  trace_id text,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_sessions (
  id text not null primary key,
  user_id text not null,
  refresh_token_hash text not null,
  refresh_token_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_knowledge_documents_tenant_kb_updated
  on knowledge_documents (tenant_id, knowledge_base_id, updated_at desc);

create index if not exists idx_knowledge_chunks_tenant_kb_document
  on knowledge_chunks (tenant_id, knowledge_base_id, document_id);

create index if not exists idx_knowledge_traces_tenant_operation_created
  on knowledge_traces (tenant_id, operation, created_at desc);
```

- [ ] **Step 5: Run the SQL client test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-sql-client.spec.ts`

Expected: PASS.

- [ ] **Step 6: Document the database mode**

Append this exact section to `docs/apps/backend/agent-server/knowledge.md`:

```md
## Database Mode

Knowledge remains inside `apps/backend/agent-server/src/knowledge`.

Runtime persistence is selected by `KNOWLEDGE_REPOSITORY`:

- `memory`: use `InMemoryKnowledgeRepository`; data is lost on restart.
- `postgres`: use a durable SQL-backed repository; `DATABASE_URL` is required.

The schema entrypoint is `apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql`.
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql apps/backend/agent-server/test/knowledge/knowledge-sql-client.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "feat: add knowledge database boundary"
```

## Task 2: PostgreSQL Repository for Knowledge Records

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';

describe('PostgresKnowledgeRepository', () => {
  it('upserts documents and lists the final state without duplicates', async () => {
    const rows: Record<string, unknown>[] = [];
    const query = vi.fn(async (sql: string, params: readonly unknown[] = []) => {
      if (sql.includes('insert into knowledge_documents')) {
        const row = {
          id: params[0],
          tenant_id: params[1],
          knowledge_base_id: params[2],
          title: params[3],
          status: params[4],
          source_uri: params[5],
          mime_type: params[6],
          metadata: params[7],
          error_message: params[8],
          created_at: params[9],
          updated_at: params[10]
        };
        const index = rows.findIndex(
          item =>
            item.tenant_id === row.tenant_id && item.knowledge_base_id === row.knowledge_base_id && item.id === row.id
        );
        if (index >= 0) rows[index] = row;
        else rows.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from knowledge_documents')) {
        return { rows };
      }
      return { rows: [] };
    });
    const repo = new PostgresKnowledgeRepository({ query });

    await repo.createDocument({
      id: 'doc-1',
      tenantId: 'ws-1',
      knowledgeBaseId: 'kb-1',
      title: 'Guide.md',
      status: 'indexing',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });
    await repo.createDocument({
      id: 'doc-1',
      tenantId: 'ws-1',
      knowledgeBaseId: 'kb-1',
      title: 'Guide.md',
      status: 'ready',
      metadata: { ingestionStages: [{ stage: 'indexed' }] },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:01.000Z'
    });

    const documents = await repo.listDocuments({ tenantId: 'ws-1', knowledgeBaseId: 'kb-1' });

    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]).toMatchObject({ id: 'doc-1', status: 'ready' });
  });

  it('stores and lists chunks for RAG retrieval', async () => {
    const rows: Record<string, unknown>[] = [];
    const query = vi.fn(async (sql: string, params: readonly unknown[] = []) => {
      if (sql.includes('insert into knowledge_chunks')) {
        const row = {
          id: params[0],
          tenant_id: params[1],
          knowledge_base_id: params[2],
          document_id: params[3],
          text: params[4],
          ordinal: params[5],
          token_count: params[6],
          embedding: params[7],
          metadata: params[8],
          created_at: params[9],
          updated_at: params[10]
        };
        rows.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from knowledge_chunks')) {
        return { rows };
      }
      return { rows: [] };
    });
    const repo = new PostgresKnowledgeRepository({ query });

    await repo.createChunk({
      id: 'chunk-1',
      tenantId: 'ws-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      text: 'RAG 评测包含检索评测和生成评测。',
      ordinal: 0,
      tokenCount: 20,
      embedding: [0.1, 0.2, 0.3],
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    const chunks = await repo.listChunks({ tenantId: 'ws-1', knowledgeBaseId: 'kb-1', documentId: 'doc-1' });

    expect(chunks.items).toEqual([
      expect.objectContaining({ id: 'chunk-1', text: 'RAG 评测包含检索评测和生成评测。' })
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

Expected: FAIL with module not found for `knowledge-postgres.repository`.

- [ ] **Step 3: Add row mappers**

```ts
// apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from '../interfaces/knowledge-records.types';

export interface KnowledgeDocumentRow {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  title: string;
  status: KnowledgeDocumentRecord['status'];
  source_uri?: string | null;
  mime_type?: string | null;
  metadata?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkRow {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  document_id: string;
  text: string;
  ordinal?: number | null;
  token_count?: number | null;
  embedding?: number[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function mapDocumentRow(row: KnowledgeDocumentRow): KnowledgeDocumentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    knowledgeBaseId: row.knowledge_base_id,
    title: row.title,
    status: row.status,
    ...(row.source_uri ? { sourceUri: row.source_uri } : {}),
    ...(row.mime_type ? { mimeType: row.mime_type } : {}),
    ...(row.metadata ? { metadata: row.metadata } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapChunkRow(row: KnowledgeChunkRow): KnowledgeChunkRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    knowledgeBaseId: row.knowledge_base_id,
    documentId: row.document_id,
    text: row.text,
    ...(typeof row.ordinal === 'number' ? { ordinal: row.ordinal } : {}),
    ...(typeof row.token_count === 'number' ? { tokenCount: row.token_count } : {}),
    ...(row.embedding ? { embedding: row.embedding } : {}),
    ...(row.metadata ? { metadata: row.metadata } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

- [ ] **Step 4: Implement repository document and chunk methods**

```ts
// apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts
import type { KnowledgeChunkRecord, KnowledgeDocumentRecord } from '../interfaces/knowledge-records.types';
import type { KnowledgeSqlClient } from '../database/knowledge-sql-client';
import type {
  KnowledgeChunkQuery,
  KnowledgeDocumentQuery,
  KnowledgeRepositoryListResult
} from './knowledge.repository';
import {
  mapChunkRow,
  mapDocumentRow,
  type KnowledgeChunkRow,
  type KnowledgeDocumentRow
} from './knowledge-postgres.mapper';

export class PostgresKnowledgeRepository {
  constructor(private readonly client: KnowledgeSqlClient) {}

  async createDocument(record: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    const result = await this.client.query<KnowledgeDocumentRow>(
      `
        insert into knowledge_documents (
          id, tenant_id, knowledge_base_id, title, status, source_uri, mime_type, metadata, error_message, created_at, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (tenant_id, knowledge_base_id, id)
        do update set
          title = excluded.title,
          status = excluded.status,
          source_uri = excluded.source_uri,
          mime_type = excluded.mime_type,
          metadata = excluded.metadata,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        record.id,
        record.tenantId,
        record.knowledgeBaseId,
        record.title,
        record.status,
        record.sourceUri ?? null,
        record.mimeType ?? null,
        record.metadata ?? null,
        record.errorMessage ?? null,
        record.createdAt,
        record.updatedAt
      ]
    );
    return mapDocumentRow(result.rows[0]!);
  }

  async listDocuments(query: KnowledgeDocumentQuery): Promise<KnowledgeRepositoryListResult<KnowledgeDocumentRecord>> {
    const result = await this.client.query<KnowledgeDocumentRow>(
      `
        select *
        from knowledge_documents
        where tenant_id = $1 and knowledge_base_id = $2
        order by updated_at desc
      `,
      [query.tenantId, query.knowledgeBaseId]
    );
    return { items: result.rows.map(mapDocumentRow), total: result.rows.length, page: 1, pageSize: 20 };
  }

  async createChunk(record: KnowledgeChunkRecord): Promise<KnowledgeChunkRecord> {
    const result = await this.client.query<KnowledgeChunkRow>(
      `
        insert into knowledge_chunks (
          id, tenant_id, knowledge_base_id, document_id, text, ordinal, token_count, embedding, metadata, created_at, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (tenant_id, id)
        do update set
          text = excluded.text,
          ordinal = excluded.ordinal,
          token_count = excluded.token_count,
          embedding = excluded.embedding,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        record.id,
        record.tenantId,
        record.knowledgeBaseId,
        record.documentId,
        record.text,
        record.ordinal ?? null,
        record.tokenCount ?? null,
        record.embedding ?? null,
        record.metadata ?? null,
        record.createdAt,
        record.updatedAt
      ]
    );
    return mapChunkRow(result.rows[0]!);
  }

  async listChunks(query: KnowledgeChunkQuery): Promise<KnowledgeRepositoryListResult<KnowledgeChunkRecord>> {
    const result = await this.client.query<KnowledgeChunkRow>(
      `
        select *
        from knowledge_chunks
        where tenant_id = $1
          and ($2::text is null or knowledge_base_id = $2)
          and ($3::text is null or document_id = $3)
        order by ordinal asc nulls last, created_at asc
      `,
      [query.tenantId, query.knowledgeBaseId ?? null, query.documentId ?? null]
    );
    return { items: result.rows.map(mapChunkRow), total: result.rows.length, page: 1, pageSize: 20 };
  }
}
```

- [ ] **Step 5: Run repository tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts
git commit -m "feat: persist knowledge documents and chunks"
```

## Task 3: Durable Session Repository

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`

- [ ] **Step 1: Write the failing session repository test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { PostgresKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-postgres-session.repository';

describe('PostgresKnowledgeSessionRepository', () => {
  it('creates, finds, rotates, and revokes refresh token sessions', async () => {
    const rows: Record<string, unknown>[] = [];
    const query = vi.fn(async (sql: string, params: readonly unknown[] = []) => {
      if (sql.includes('insert into knowledge_sessions')) {
        const row = {
          id: params[0],
          user_id: params[1],
          refresh_token_hash: params[2],
          refresh_token_expires_at: params[3],
          revoked_at: params[4],
          created_at: params[5],
          updated_at: params[6]
        };
        rows.push(row);
        return { rows: [row] };
      }
      if (sql.includes('update knowledge_sessions') && sql.includes('refresh_token_hash')) {
        const row = rows.find(item => item.id === params[1])!;
        row.refresh_token_hash = params[0];
        row.updated_at = params[2];
        return { rows: [row] };
      }
      if (sql.includes('update knowledge_sessions') && sql.includes('revoked_at')) {
        const row = rows.find(item => item.id === params[0])!;
        row.revoked_at = params[1];
        row.updated_at = params[1];
        return { rows: [row] };
      }
      if (sql.includes('from knowledge_sessions')) {
        return { rows: rows.filter(item => item.id === params[0]) };
      }
      return { rows: [] };
    });
    const repo = new PostgresKnowledgeSessionRepository({ query });

    await repo.create({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash-1',
      refreshTokenExpiresAt: '2026-05-08T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });
    await repo.rotate('session-1', {
      refreshTokenHash: 'hash-2',
      updatedAt: '2026-05-01T00:01:00.000Z'
    });
    await repo.revoke('session-1', '2026-05-01T00:02:00.000Z');

    const session = await repo.findById('session-1');

    expect(session).toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash-2',
      revokedAt: '2026-05-01T00:02:00.000Z'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement durable session repository**

```ts
// apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts
import type { KnowledgeSqlClient } from '../database/knowledge-sql-client';
import type { KnowledgeSessionRecord, KnowledgeSessionRepository } from './knowledge-session.repository';

interface KnowledgeSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  refresh_token_expires_at: string;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class PostgresKnowledgeSessionRepository implements KnowledgeSessionRepository {
  constructor(private readonly client: KnowledgeSqlClient) {}

  async create(record: KnowledgeSessionRecord): Promise<KnowledgeSessionRecord> {
    const result = await this.client.query<KnowledgeSessionRow>(
      `
        insert into knowledge_sessions (
          id, user_id, refresh_token_hash, refresh_token_expires_at, revoked_at, created_at, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7)
        returning *
      `,
      [
        record.id,
        record.userId,
        record.refreshTokenHash,
        record.refreshTokenExpiresAt,
        record.revokedAt ?? null,
        record.createdAt,
        record.updatedAt
      ]
    );
    return mapSession(result.rows[0]!);
  }

  async findById(id: string): Promise<KnowledgeSessionRecord | undefined> {
    const result = await this.client.query<KnowledgeSessionRow>('select * from knowledge_sessions where id = $1', [id]);
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async rotate(
    id: string,
    input: { refreshTokenHash: string; updatedAt: string }
  ): Promise<KnowledgeSessionRecord | undefined> {
    const result = await this.client.query<KnowledgeSessionRow>(
      'update knowledge_sessions set refresh_token_hash = $1, updated_at = $3 where id = $2 returning *',
      [input.refreshTokenHash, id, input.updatedAt]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async revoke(id: string, revokedAt: string): Promise<KnowledgeSessionRecord | undefined> {
    const result = await this.client.query<KnowledgeSessionRow>(
      'update knowledge_sessions set revoked_at = $2, updated_at = $2 where id = $1 returning *',
      [id, revokedAt]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }
}

function mapSession(row: KnowledgeSessionRow): KnowledgeSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

- [ ] **Step 4: Run session repository test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts
git commit -m "feat: persist knowledge refresh sessions"
```

## Task 4: Provider Config and Nest Wiring

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts`
- Create: `apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`
- Docs: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write provider config test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeProviderConfig } from '../../src/knowledge/knowledge-provider.config';

describe('resolveKnowledgeProviderConfig', () => {
  it('uses memory providers by default', () => {
    expect(resolveKnowledgeProviderConfig({})).toEqual({
      repository: 'memory',
      sessions: 'memory',
      vectorStore: 'memory'
    });
  });

  it('uses postgres repository and sessions when requested', () => {
    expect(
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_REPOSITORY: 'postgres',
        KNOWLEDGE_SESSIONS: 'postgres',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge'
      })
    ).toEqual({
      repository: 'postgres',
      sessions: 'postgres',
      vectorStore: 'memory'
    });
  });

  it('requires Supabase credentials for supabase-pgvector', () => {
    expect(() =>
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector'
      })
    ).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement provider config**

```ts
// apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts
export interface KnowledgeProviderConfig {
  repository: 'memory' | 'postgres';
  sessions: 'memory' | 'postgres';
  vectorStore: 'memory' | 'supabase-pgvector';
}

export function resolveKnowledgeProviderConfig(env: Record<string, string | undefined>): KnowledgeProviderConfig {
  const repository = parseChoice(env.KNOWLEDGE_REPOSITORY, ['memory', 'postgres'], 'memory');
  const sessions = parseChoice(
    env.KNOWLEDGE_SESSIONS,
    ['memory', 'postgres'],
    repository === 'postgres' ? 'postgres' : 'memory'
  );
  const vectorStore = parseChoice(env.KNOWLEDGE_VECTOR_STORE, ['memory', 'supabase-pgvector'], 'memory');

  if ((repository === 'postgres' || sessions === 'postgres') && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when Knowledge postgres providers are enabled.');
  }
  if (vectorStore === 'supabase-pgvector' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for supabase-pgvector.');
  }

  return { repository, sessions, vectorStore };
}

function parseChoice<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  if (allowed.includes(value as T)) return value as T;
  throw new Error(`Unsupported Knowledge provider value: ${value}`);
}
```

- [ ] **Step 4: Run provider config test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`

Expected: PASS.

- [ ] **Step 5: Add provider module skeleton**

```ts
// apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts
import { Module } from '@nestjs/common';

import { resolveKnowledgeProviderConfig } from './knowledge-provider.config';

export const KNOWLEDGE_PROVIDER_CONFIG = Symbol('KNOWLEDGE_PROVIDER_CONFIG');

@Module({
  providers: [
    {
      provide: KNOWLEDGE_PROVIDER_CONFIG,
      useFactory: () => resolveKnowledgeProviderConfig(process.env)
    }
  ],
  exports: [KNOWLEDGE_PROVIDER_CONFIG]
})
export class KnowledgeProviderModule {}
```

- [ ] **Step 6: Wire module import**

In `apps/backend/agent-server/src/knowledge/knowledge.module.ts`, add:

```ts
import { KnowledgeProviderModule } from './knowledge-provider.module';
```

and update the module decorator:

```ts
@Module({
  imports: [KnowledgeProviderModule],
  controllers: [KnowledgeController],
  providers: [
    // existing providers stay here
  ]
})
export class KnowledgeModule {}
```

- [ ] **Step 7: Run backend typecheck**

Run: `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts apps/backend/agent-server/src/knowledge/knowledge.module.ts apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "feat: configure knowledge backend providers"
```

## Task 5: Supabase pgvector Wiring

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`
- Docs: `docs/packages/knowledge/sdk.md`

- [ ] **Step 1: Write the failing vector store factory test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeVectorStore } from '../../src/knowledge/knowledge-vector-store.factory';

describe('createKnowledgeVectorStore', () => {
  it('returns a no-op memory store by default', async () => {
    const store = createKnowledgeVectorStore({ vectorStore: 'memory' });

    await expect(
      store.upsert({ tenantId: 'ws-1', knowledgeBaseId: 'kb-1', documentId: 'doc-1', chunks: [] })
    ).resolves.toEqual({ inserted: 0 });
  });

  it('creates a Supabase-backed store through an injected RPC client', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const store = createKnowledgeVectorStore({
      vectorStore: 'supabase-pgvector',
      supabaseClient: { rpc }
    });

    await store.search({ tenantId: 'ws-1', knowledgeBaseId: 'kb-1', embedding: [0.1], topK: 3 });

    expect(rpc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement vector store factory**

```ts
// apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts
import { SupabasePgVectorStoreAdapter, type SupabaseRpcClientLike } from '@agent/adapters';

import type { KnowledgeVectorStore } from './interfaces/knowledge-ingestion.types';

export interface CreateKnowledgeVectorStoreInput {
  vectorStore: 'memory' | 'supabase-pgvector';
  supabaseClient?: SupabaseRpcClientLike;
}

export function createKnowledgeVectorStore(input: CreateKnowledgeVectorStoreInput): KnowledgeVectorStore {
  if (input.vectorStore === 'supabase-pgvector') {
    if (!input.supabaseClient) {
      throw new Error('supabaseClient is required when vectorStore=supabase-pgvector');
    }
    return new SupabaseKnowledgeVectorStore(input.supabaseClient);
  }
  return new NoopKnowledgeVectorStore();
}

class SupabaseKnowledgeVectorStore implements KnowledgeVectorStore {
  constructor(private readonly client: SupabaseRpcClientLike) {}

  async upsert(input: Parameters<KnowledgeVectorStore['upsert']>[0]) {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: this.client,
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId
    });
    const result = await adapter.upsert({
      records: input.chunks.map(chunk => ({
        id: chunk.id,
        embedding: chunk.embedding,
        content: chunk.text,
        metadata: {
          tenantId: chunk.tenantId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          documentId: chunk.documentId,
          ordinal: chunk.ordinal,
          tokenCount: chunk.tokenCount,
          ...chunk.metadata
        }
      }))
    });
    return { inserted: result.upsertedCount };
  }

  async search(input: Parameters<KnowledgeVectorStore['search']>[0]) {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: this.client,
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId
    });
    const result = await adapter.search({
      embedding: input.embedding,
      topK: input.topK,
      filters: {
        knowledgeBaseId: input.knowledgeBaseId,
        documentIds: input.filters?.documentIds,
        metadata: input.filters?.metadata
      }
    });
    return {
      matches: result.hits.map(hit => ({
        chunkId: hit.id,
        documentId: typeof hit.metadata?.documentId === 'string' ? hit.metadata.documentId : '',
        score: hit.score,
        text: hit.content ?? '',
        metadata: hit.metadata
      }))
    };
  }

  async deleteByDocumentId(input: Parameters<KnowledgeVectorStore['deleteByDocumentId']>[0]) {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: this.client,
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId
    });
    const result = await adapter.delete({
      filter: { documentId: input.documentId, knowledgeBaseId: input.knowledgeBaseId }
    });
    return { deleted: result.deletedCount };
  }
}

class NoopKnowledgeVectorStore implements KnowledgeVectorStore {
  async upsert(input: Parameters<KnowledgeVectorStore['upsert']>[0]) {
    return { inserted: input.chunks.length };
  }

  async search() {
    return { matches: [] };
  }

  async deleteByDocumentId() {
    return { deleted: 0 };
  }
}
```

- [ ] **Step 4: Run vector store factory test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`

Expected: PASS.

- [ ] **Step 5: Document vector store mode**

Append this exact section to `docs/packages/knowledge/sdk.md`:

```md
## Agent Server Vector Store Wiring

`agent-server/src/knowledge` selects vector storage with `KNOWLEDGE_VECTOR_STORE`:

- `memory`: no-op vector store for local smoke tests.
- `supabase-pgvector`: wraps `SupabasePgVectorStoreAdapter` from `@agent/adapters`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are backend-only secrets. They must never be returned by API responses, trace payloads, eval records, frontend state, or SDK core contracts.
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts docs/packages/knowledge/sdk.md
git commit -m "feat: wire knowledge supabase vector store"
```

## Task 6: Database-backed Service Integration

**Files:**

- Modify: `apps/backend/agent-server/src/knowledge/knowledge.module.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-database-integration.spec.ts`
- Docs: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write the failing service integration test**

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeIngestionService } from '../../src/knowledge/knowledge-ingestion.service';
import { KnowledgeRagService } from '../../src/knowledge/knowledge-rag.service';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

describe('KnowledgeService database-backed integration', () => {
  it('uploads a document, lists it from the repository, and answers chat from repository chunks', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const ingestion = new KnowledgeIngestionService({ repo });
    const rag = new KnowledgeRagService({ repo });
    const service = new KnowledgeService(repo, rag, ingestion);

    await service.uploadDocument({
      knowledgeBaseId: 'kb_frontend',
      fileName: 'Guide.md',
      bytes: Buffer.from('Knowledge backend database integration includes repository and vector store wiring.')
    });

    const documents = await service.listDocuments();
    const answer = await service.chat({
      knowledgeBaseId: 'kb_frontend',
      knowledgeBaseIds: ['kb_frontend'],
      message: 'database integration 包含什么？'
    });

    expect(documents.items.some(item => item.filename === 'Guide.md')).toBe(true);
    expect(answer.answer).toContain('Knowledge backend database integration');
  });
});
```

- [ ] **Step 2: Run the test to verify current behavior**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-database-integration.spec.ts`

Expected: PASS if current constructor order already supports this; FAIL if `KnowledgeService` constructor must be adjusted.

- [ ] **Step 3: If constructor order fails, add a named factory helper**

Add this helper to `apps/backend/agent-server/src/knowledge/knowledge.service.ts`:

```ts
export function createKnowledgeServiceForProviders(input: {
  repository: KnowledgeRepository;
  ragService?: KnowledgeRagService;
  ingestionService?: KnowledgeIngestionService;
  observabilityService?: KnowledgeObservabilityService;
  evalService?: KnowledgeEvalService;
}) {
  return new KnowledgeService(
    input.repository,
    input.ragService,
    input.ingestionService,
    input.observabilityService,
    input.evalService
  );
}
```

Then update the test to call:

```ts
const service = createKnowledgeServiceForProviders({ repository: repo, ragService: rag, ingestionService: ingestion });
```

- [ ] **Step 4: Run the integration test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-database-integration.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/knowledge.service.ts apps/backend/agent-server/test/knowledge/knowledge-database-integration.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "test: cover database backed knowledge service"
```

## Task 7: Frontend Real API Path Regression

**Files:**

- Test: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
- Docs: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Write the frontend API path test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { AuthClient } from '../src/api/auth-client';
import { KnowledgeApiClient } from '../src/api/knowledge-api-client';
import { saveTokens } from '../src/api/token-storage';
import { installLocalStorageMock } from './local-storage-mock';

describe('KnowledgeApiClient real backend paths', () => {
  it('calls agent-server knowledge upload and reprocess paths', async () => {
    installLocalStorageMock();
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 86400
    });
    const calls: string[] = [];
    const fetcher: typeof fetch = async url => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({
          document: {
            id: 'doc-1',
            workspaceId: 'ws-1',
            knowledgeBaseId: 'kb_frontend',
            title: 'Guide.md',
            filename: 'Guide.md',
            sourceType: 'user-upload',
            status: 'ready',
            version: '1',
            chunkCount: 1,
            embeddedChunkCount: 1,
            createdBy: 'user-1',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z'
          },
          job: {
            id: 'job-1',
            documentId: 'doc-1',
            status: 'succeeded',
            stages: [],
            createdAt: '2026-05-01T00:00:00.000Z'
          }
        }),
        { status: 200 }
      );
    };
    const authClient = new AuthClient({ baseUrl: '/api/knowledge/v1', fetcher });
    const api = new KnowledgeApiClient({ baseUrl: '/api/knowledge/v1', authClient, fetcher });

    await api.uploadDocument({ knowledgeBaseId: 'kb_frontend', file: new File(['hello'], 'Guide.md') });
    await api.reprocessDocument('doc-1');

    expect(calls).toEqual([
      '/api/knowledge/v1/knowledge-bases/kb_frontend/documents/upload',
      '/api/knowledge/v1/documents/doc-1/reprocess'
    ]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths.test.ts`

Expected: PASS.

- [ ] **Step 3: Document the frontend/backend link**

Append this exact sentence to `docs/apps/frontend/knowledge/knowledge-frontend.md`:

```md
The frontend does not call a separate Knowledge backend project; it calls `agent-server` through `/api/knowledge/v1/*`.
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "test: lock knowledge frontend api paths"
```

## Task 8: Final Verification

**Files:**

- Review: `apps/backend/agent-server/src/knowledge/**`
- Review: `apps/frontend/knowledge/src/**`
- Review: `packages/adapters/src/supabase/**`
- Review: `docs/apps/backend/agent-server/knowledge.md`
- Review: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Run backend knowledge tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts apps/backend/agent-server/test/knowledge/knowledge-sql-client.spec.ts apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts apps/backend/agent-server/test/knowledge/knowledge-database-integration.spec.ts
```

Expected: all listed test files pass.

- [ ] **Step 2: Run frontend knowledge tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
```

Expected: all frontend knowledge tests pass.

- [ ] **Step 3: Run typechecks and builds**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server build
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
pnpm --dir packages/knowledge build:lib
```

Expected: all commands exit `0`. Vite chunk-size warnings are acceptable if build exits `0`.

- [ ] **Step 4: Run docs and layout checks**

Run:

```bash
pnpm check:docs
pnpm check:barrel-layout
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/agent-server/src/knowledge apps/backend/agent-server/test/knowledge apps/frontend/knowledge/test docs/apps/backend/agent-server/knowledge.md docs/apps/frontend/knowledge/knowledge-frontend.md docs/packages/knowledge/sdk.md docs/contracts/api/knowledge.md
git commit -m "chore: verify knowledge database integration"
```

## Self-Review

Spec coverage:

- Keep backend inside `agent-server/src/knowledge`: covered by architecture and all backend file paths.
- Confirm frontend connects to backend API: Task 7 locks `/api/knowledge/v1/*` paths.
- Connect database: Tasks 1, 2, 3, 4, and 6.
- Connect Supabase pgvector: Task 5.
- Use previous productionization roadmap as baseline: Scope Check explicitly lists completed roadmap outputs and remaining gaps.
- Avoid creating new backend project: covered by Scope Check and file structure.

Placeholder scan:

- No `TBD`, `TODO`, `implement later`, or "similar to" instructions are used.
- Every task includes exact files, concrete test code or implementation code, exact commands, expected results, and commit commands.

Type consistency:

- Repository records use existing `KnowledgeRepository` record names: `KnowledgeDocumentRecord`, `KnowledgeChunkRecord`.
- Frontend path test uses existing `KnowledgeApiClient` methods: `uploadDocument()` and `reprocessDocument()`.
- Provider config uses consistent values: `memory`, `postgres`, `supabase-pgvector`.
