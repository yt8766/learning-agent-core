# Knowledge Production Cutover Implementation Plan

> 历史说明：本文记录 standalone `auth-server` / `knowledge-server` 方案形成时的设计背景。当前实现已 hard cut 到 unified `apps/backend/agent-server`；正确入口见 `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md`。

状态：snapshot
文档类型：plan
适用范围：`apps/backend/agent-server/src/knowledge`、`apps/frontend/knowledge`、`packages/knowledge`、`packages/adapters`、`docs/contracts/api`
最后核对：2026-05-01

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the completed Knowledge horizontal MVP from in-memory/demo behavior to a real production path backed by `agent-server/src/knowledge`, PostgreSQL/Supabase persistence, Supabase pgvector retrieval, stable SDK contracts, and frontend-to-backend verification.

**Architecture:** Do not create a separate backend project. Keep Knowledge inside `apps/backend/agent-server/src/knowledge`, keep frontend `apps/frontend/knowledge` calling `/api/knowledge/v1/*`, and place all persistence/vector choices behind repository/provider interfaces. `memory` remains the explicit local/test provider; `postgres` and `supabase-pgvector` become the production providers selected by environment configuration.

**Tech Stack:** TypeScript, NestJS, React, Vite, Vitest, Zod, PostgreSQL, Supabase, pgvector, JWT double-token auth, `@agent/knowledge`, `@agent/adapters`, pnpm workspace.

---

## Relationship To Existing Plans

This plan is generated from and narrows the next stage after `docs/superpowers/plans/2026-05-01-knowledge-productionization-roadmap.md`.

The roadmap already established the horizontal product shape:

- `apps/frontend/knowledge` exists as the dedicated Knowledge frontend.
- The frontend has login, token storage, auto-refresh client behavior, pages, hooks, and API provider boundaries.
- `apps/backend/agent-server/src/knowledge` exists as the Knowledge backend module.
- The backend exposes auth, knowledge base, document, chat, eval, and observability APIs.
- JWT access token plus refresh token contracts exist.
- In-memory repositories and mock/demo data support the current MVP.
- `packages/knowledge` has SDK-style entrypoints.
- `packages/adapters/src/supabase/supabase-pgvector-store.adapter.ts` exists as the default vector adapter direction.

This plan covers the missing production cutover:

- Replace default backend runtime storage with configurable durable repository wiring.
- Add PostgreSQL/Supabase schema and repository implementations.
- Persist refresh token sessions instead of relying only on process memory.
- Wire Supabase pgvector into ingestion and RAG retrieval.
- Prove frontend API paths hit the real backend contract, not only mock client paths.
- Update docs so the next engineer sees that the backend is `agent-server/src/knowledge`, not a new `knowledge-platform` or new backend app.

This plan supersedes `docs/superpowers/plans/2026-05-01-knowledge-production-hardening.md` for the immediate next execution phase. Keep `docs/superpowers/plans/2026-05-01-knowledge-backend-database-integration.md` as the lower-level implementation reference for repository details; execute this cutover plan first when deciding task order.

## File Structure

- `apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts`
  - Minimal SQL boundary used by repositories and tests.
- `apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql`
  - PostgreSQL/Supabase schema for bases, documents, chunks, chat, traces, evals, and auth sessions.
- `apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts`
  - Environment parser for `memory`, `postgres`, and `supabase-pgvector` modes.
- `apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts`
  - Nest provider factory wiring repositories and vector store providers.
- `apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts`
  - Adapter factory for `SupabasePgVectorStoreAdapter`.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts`
  - Row/domain mapping helpers.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
  - Durable `KnowledgeRepository` implementation.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts`
  - Durable refresh token/session repository.
- `apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`
  - Provider env parser tests.
- `apps/backend/agent-server/test/knowledge/knowledge-schema.spec.ts`
  - Schema regression tests.
- `apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`
  - Repository contract tests with fake SQL client.
- `apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`
  - Refresh session persistence tests.
- `apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`
  - Supabase pgvector factory tests.
- `apps/backend/agent-server/test/knowledge/knowledge-production-cutover.spec.ts`
  - Service-level integration tests proving no fixture fallback in production provider mode.
- `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
  - Frontend API path regression for real backend mode.
- `docs/apps/backend/agent-server/knowledge.md`
  - Backend runtime, env, schema, and provider documentation.
- `docs/apps/frontend/knowledge/knowledge-frontend.md`
  - Frontend real/mock API mode documentation.
- `docs/contracts/api/knowledge.md`
  - Stable API path and response contract notes.
- `docs/sdk/knowledge.md`
  - SDK extension and default implementation notes.

## Task 1: Lock Production Provider Configuration

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`
- Modify: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write the failing provider config test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeProviderConfig } from '../../src/knowledge/knowledge-provider.config';

describe('resolveKnowledgeProviderConfig', () => {
  it('defaults to memory providers for local development and tests', () => {
    expect(resolveKnowledgeProviderConfig({})).toEqual({
      repository: { kind: 'memory' },
      vectorStore: { kind: 'memory' }
    });
  });

  it('requires DATABASE_URL when postgres repository mode is selected', () => {
    expect(() => resolveKnowledgeProviderConfig({ KNOWLEDGE_REPOSITORY: 'postgres' })).toThrow(
      'DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres'
    );
  });

  it('requires Supabase credentials when supabase pgvector mode is selected', () => {
    expect(() => resolveKnowledgeProviderConfig({ KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector' })).toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when KNOWLEDGE_VECTOR_STORE=supabase-pgvector'
    );
  });

  it('returns production providers when all env values are present', () => {
    expect(
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_REPOSITORY: 'postgres',
        KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
      })
    ).toEqual({
      repository: {
        kind: 'postgres',
        databaseUrl: 'postgres://user:pass@localhost:5432/knowledge'
      },
      vectorStore: {
        kind: 'supabase-pgvector',
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role-key'
      }
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`

Expected: FAIL with module not found for `knowledge-provider.config`.

- [ ] **Step 3: Implement the provider config parser**

```ts
export type KnowledgeRepositoryProviderConfig = { kind: 'memory' } | { kind: 'postgres'; databaseUrl: string };

export type KnowledgeVectorStoreProviderConfig =
  | { kind: 'memory' }
  | { kind: 'supabase-pgvector'; supabaseUrl: string; serviceRoleKey: string };

export interface KnowledgeProviderConfig {
  repository: KnowledgeRepositoryProviderConfig;
  vectorStore: KnowledgeVectorStoreProviderConfig;
}

export function resolveKnowledgeProviderConfig(env: Record<string, string | undefined>): KnowledgeProviderConfig {
  const repositoryKind = env.KNOWLEDGE_REPOSITORY ?? 'memory';
  const vectorStoreKind = env.KNOWLEDGE_VECTOR_STORE ?? 'memory';

  if (repositoryKind !== 'memory' && repositoryKind !== 'postgres') {
    throw new Error(`Unsupported KNOWLEDGE_REPOSITORY=${repositoryKind}`);
  }
  if (vectorStoreKind !== 'memory' && vectorStoreKind !== 'supabase-pgvector') {
    throw new Error(`Unsupported KNOWLEDGE_VECTOR_STORE=${vectorStoreKind}`);
  }

  const repository =
    repositoryKind === 'postgres'
      ? resolvePostgresRepository(env)
      : ({ kind: 'memory' } satisfies KnowledgeRepositoryProviderConfig);
  const vectorStore =
    vectorStoreKind === 'supabase-pgvector'
      ? resolveSupabaseVectorStore(env)
      : ({ kind: 'memory' } satisfies KnowledgeVectorStoreProviderConfig);

  return { repository, vectorStore };
}

function resolvePostgresRepository(env: Record<string, string | undefined>): KnowledgeRepositoryProviderConfig {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres');
  }
  return { kind: 'postgres', databaseUrl: env.DATABASE_URL };
}

function resolveSupabaseVectorStore(env: Record<string, string | undefined>): KnowledgeVectorStoreProviderConfig {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when KNOWLEDGE_VECTOR_STORE=supabase-pgvector'
    );
  }
  return {
    kind: 'supabase-pgvector',
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`

Expected: PASS.

- [ ] **Step 5: Document the provider environment**

Add this exact runtime table to `docs/apps/backend/agent-server/knowledge.md`:

```md
## Knowledge Runtime Providers

The Knowledge backend lives in `apps/backend/agent-server/src/knowledge`; there is no separate Knowledge backend app.

| Env                         | Values                        | Purpose                                                   |
| --------------------------- | ----------------------------- | --------------------------------------------------------- |
| `KNOWLEDGE_REPOSITORY`      | `memory`, `postgres`          | Selects business data persistence.                        |
| `KNOWLEDGE_VECTOR_STORE`    | `memory`, `supabase-pgvector` | Selects retrieval vector storage.                         |
| `DATABASE_URL`              | PostgreSQL connection string  | Required when `KNOWLEDGE_REPOSITORY=postgres`.            |
| `SUPABASE_URL`              | Supabase project URL          | Required when `KNOWLEDGE_VECTOR_STORE=supabase-pgvector`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key     | Required only on the backend for vector writes/search.    |
```

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "feat(knowledge): add production provider config"
```

Expected: commit succeeds after local hooks pass.

## Task 2: Add PostgreSQL/Supabase Schema Boundary

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-schema.spec.ts`
- Modify: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write the failing schema regression test**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  join(process.cwd(), 'apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql'),
  'utf8'
);

describe('knowledge database schema', () => {
  it('defines all production knowledge tables', () => {
    for (const table of [
      'knowledge_bases',
      'knowledge_documents',
      'knowledge_chunks',
      'knowledge_chat_messages',
      'knowledge_traces',
      'knowledge_eval_datasets',
      'knowledge_eval_runs',
      'knowledge_eval_results',
      'knowledge_auth_sessions'
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }
  });

  it('keeps chunks compatible with pgvector retrieval', () => {
    expect(schema).toContain('create extension if not exists vector');
    expect(schema).toContain('embedding vector');
    expect(schema).toContain('knowledge_chunks_embedding_idx');
  });

  it('uses tenant-scoped primary keys for business records', () => {
    expect(schema).toContain('primary key (tenant_id, id)');
    expect(schema).toContain('primary key (tenant_id, knowledge_base_id, id)');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-schema.spec.ts`

Expected: FAIL because `knowledge-schema.sql` does not exist.

- [ ] **Step 3: Add the schema file**

```sql
create extension if not exists vector;

create table if not exists knowledge_bases (
  id text not null,
  tenant_id text not null,
  name text not null,
  description text,
  visibility text not null,
  status text not null,
  tags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_documents (
  id text not null,
  tenant_id text not null,
  knowledge_base_id text not null,
  title text not null,
  source_uri text,
  mime_type text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
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
  ordinal integer not null,
  token_count integer,
  embedding vector,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create index if not exists knowledge_chunks_document_idx
  on knowledge_chunks (tenant_id, knowledge_base_id, document_id);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops);

create table if not exists knowledge_chat_messages (
  id text not null,
  tenant_id text not null,
  conversation_id text not null,
  role text not null,
  content text not null,
  knowledge_base_id text,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
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
  spans jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
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
  knowledge_base_id text,
  status text not null,
  metrics jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_by text not null,
  error_message text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_eval_results (
  id text not null,
  tenant_id text not null,
  run_id text not null,
  case_id text not null,
  input jsonb not null,
  expected jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  primary key (tenant_id, id)
);

create table if not exists knowledge_auth_sessions (
  id text not null,
  tenant_id text not null,
  user_id text not null,
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (tenant_id, id)
);
```

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-schema.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/backend/agent-server/src/knowledge/database/knowledge-schema.sql apps/backend/agent-server/test/knowledge/knowledge-schema.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "feat(knowledge): add production database schema"
```

Expected: commit succeeds after local hooks pass.

## Task 3: Implement Durable Knowledge Repository

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';

describe('PostgresKnowledgeRepository', () => {
  it('persists and lists documents without leaking rows to callers', async () => {
    const rows: Record<string, unknown>[] = [];
    const client = {
      query: vi.fn(async (sql: string, params: readonly unknown[] = []) => {
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
          rows.push(row);
          return { rows: [row] };
        }
        if (sql.includes('from knowledge_documents')) {
          return {
            rows: rows.filter(row => row.tenant_id === params[0] && row.knowledge_base_id === params[1])
          };
        }
        return { rows: [] };
      })
    };
    const repository = new PostgresKnowledgeRepository(client);

    await repository.createDocument({
      id: 'doc-1',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      title: 'RAG知识框架.pptx',
      status: 'ready',
      sourceUri: 'file://rag.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      metadata: { tags: ['rag'] },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    const result = await repository.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        title: 'RAG知识框架.pptx',
        status: 'ready'
      })
    ]);
    expect(result.items[0]).not.toHaveProperty('tenant_id');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

Expected: FAIL with module not found for `knowledge-postgres.repository`.

- [ ] **Step 3: Add SQL client and mapper boundaries**

```ts
export interface KnowledgeSqlQueryResult<T> {
  rows: T[];
}

export interface KnowledgeSqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<KnowledgeSqlQueryResult<T>>;
}
```

```ts
import type { KnowledgeDocumentRecord } from '../interfaces/knowledge-records.types';

export interface KnowledgeDocumentRow {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  title: string;
  status: KnowledgeDocumentRecord['status'];
  source_uri: string | null;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
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
```

- [ ] **Step 4: Implement document persistence first**

```ts
import type { KnowledgeSqlClient } from '../database/knowledge-sql-client';
import type { KnowledgeDocumentRecord } from '../interfaces/knowledge-records.types';
import type { KnowledgeDocumentQuery, KnowledgeRepositoryListResult } from './knowledge.repository';
import { mapDocumentRow, type KnowledgeDocumentRow } from './knowledge-postgres.mapper';

export class PostgresKnowledgeRepository {
  constructor(private readonly client: KnowledgeSqlClient) {}

  async createDocument(record: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    const result = await this.client.query<KnowledgeDocumentRow>(
      `
        insert into knowledge_documents (
          id, tenant_id, knowledge_base_id, title, status, source_uri, mime_type,
          metadata, error_message, created_at, updated_at
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
        record.metadata ?? {},
        record.errorMessage ?? null,
        record.createdAt,
        record.updatedAt
      ]
    );
    return mapDocumentRow(result.rows[0]);
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
    return { items: result.rows.map(mapDocumentRow) };
  }
}
```

- [ ] **Step 5: Expand the repository to the full `KnowledgeRepository` interface**

Run: `sed -n '1,260p' apps/backend/agent-server/src/knowledge/repositories/knowledge.repository.ts`

Expected: the interface lists every method the production repository must implement. Add tests and implementations for each existing method in this order:

```text
knowledge bases
documents
chunks
chat messages
traces
eval datasets
eval runs
eval results
```

Each method must:

- Accept tenant-scoped inputs.
- Use parameterized SQL.
- Map snake_case rows to camelCase records.
- Return the same record shape as `InMemoryKnowledgeRepository`.

- [ ] **Step 6: Run repository tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/backend/agent-server/src/knowledge/database/knowledge-sql-client.ts apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts
git commit -m "feat(knowledge): add postgres repository"
```

Expected: commit succeeds after local hooks pass.

## Task 4: Persist Refresh Token Sessions

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge-auth.service.ts`

- [ ] **Step 1: Write the failing session repository test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { PostgresKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-postgres-session.repository';

describe('PostgresKnowledgeSessionRepository', () => {
  it('saves, finds, and revokes refresh token sessions by tenant', async () => {
    const rows: Record<string, unknown>[] = [];
    const client = {
      query: vi.fn(async (sql: string, params: readonly unknown[] = []) => {
        if (sql.includes('insert into knowledge_auth_sessions')) {
          const row = {
            id: params[0],
            tenant_id: params[1],
            user_id: params[2],
            refresh_token_hash: params[3],
            expires_at: params[4],
            revoked_at: null,
            created_at: params[5],
            updated_at: params[6]
          };
          rows.push(row);
          return { rows: [row] };
        }
        if (sql.includes('select * from knowledge_auth_sessions')) {
          return {
            rows: rows.filter(row => row.tenant_id === params[0] && row.id === params[1])
          };
        }
        if (sql.includes('update knowledge_auth_sessions')) {
          const row = rows.find(item => item.tenant_id === params[0] && item.id === params[1]);
          if (row) row.revoked_at = params[2];
          return { rows: row ? [row] : [] };
        }
        return { rows: [] };
      })
    };
    const repository = new PostgresKnowledgeSessionRepository(client);

    await repository.saveSession({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      refreshTokenHash: 'hash-1',
      expiresAt: '2026-05-08T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    expect(await repository.findSession({ tenantId: 'tenant-1', sessionId: 'session-1' })).toMatchObject({
      id: 'session-1',
      refreshTokenHash: 'hash-1'
    });

    await repository.revokeSession({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      revokedAt: '2026-05-01T01:00:00.000Z'
    });

    expect(await repository.findSession({ tenantId: 'tenant-1', sessionId: 'session-1' })).toMatchObject({
      revokedAt: '2026-05-01T01:00:00.000Z'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`

Expected: FAIL with module not found for `knowledge-postgres-session.repository`.

- [ ] **Step 3: Implement the session repository**

```ts
import type { KnowledgeSqlClient } from '../database/knowledge-sql-client';
import type { KnowledgeSessionRecord, KnowledgeSessionRepository } from './knowledge-session.repository';

interface KnowledgeSessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSessionRow(row: KnowledgeSessionRow): KnowledgeSessionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: row.expires_at,
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PostgresKnowledgeSessionRepository implements KnowledgeSessionRepository {
  constructor(private readonly client: KnowledgeSqlClient) {}

  async saveSession(record: KnowledgeSessionRecord): Promise<KnowledgeSessionRecord> {
    const result = await this.client.query<KnowledgeSessionRow>(
      `
        insert into knowledge_auth_sessions (
          id, tenant_id, user_id, refresh_token_hash, expires_at, created_at, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7)
        returning *
      `,
      [
        record.id,
        record.tenantId,
        record.userId,
        record.refreshTokenHash,
        record.expiresAt,
        record.createdAt,
        record.updatedAt
      ]
    );
    return mapSessionRow(result.rows[0]);
  }

  async findSession(input: { tenantId: string; sessionId: string }): Promise<KnowledgeSessionRecord | null> {
    const result = await this.client.query<KnowledgeSessionRow>(
      'select * from knowledge_auth_sessions where tenant_id = $1 and id = $2',
      [input.tenantId, input.sessionId]
    );
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async revokeSession(input: { tenantId: string; sessionId: string; revokedAt: string }): Promise<void> {
    await this.client.query(
      'update knowledge_auth_sessions set revoked_at = $3, updated_at = $3 where tenant_id = $1 and id = $2',
      [input.tenantId, input.sessionId, input.revokedAt]
    );
  }
}
```

- [ ] **Step 4: Run session repository tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts`

Expected: PASS.

- [ ] **Step 5: Verify auth service uses the session repository interface only**

Run: `rg "InMemory|KnowledgeSessionRepository|refresh" apps/backend/agent-server/src/knowledge/knowledge-auth.service.ts apps/backend/agent-server/src/knowledge`

Expected: `knowledge-auth.service.ts` depends on the `KnowledgeSessionRepository` boundary and does not instantiate an in-memory repository directly.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres-session.repository.ts apps/backend/agent-server/test/knowledge/knowledge-postgres-session.repository.spec.ts apps/backend/agent-server/src/knowledge/knowledge-auth.service.ts
git commit -m "feat(knowledge): persist refresh token sessions"
```

Expected: commit succeeds after local hooks pass.

## Task 5: Wire Nest Providers Without Creating A New Backend App

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-provider-module.spec.ts`

- [ ] **Step 1: Write the failing module wiring test**

```ts
import { describe, expect, it } from 'vitest';

import { createKnowledgeRepositoryProviderKind } from '../../src/knowledge/knowledge-provider.module';

describe('knowledge provider module wiring', () => {
  it('keeps memory as the explicit default provider', () => {
    expect(
      createKnowledgeRepositoryProviderKind({ repository: { kind: 'memory' }, vectorStore: { kind: 'memory' } })
    ).toBe('memory');
  });

  it('selects postgres repository when configured', () => {
    expect(
      createKnowledgeRepositoryProviderKind({
        repository: { kind: 'postgres', databaseUrl: 'postgres://localhost/knowledge' },
        vectorStore: { kind: 'memory' }
      })
    ).toBe('postgres');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-module.spec.ts`

Expected: FAIL with module not found for `knowledge-provider.module`.

- [ ] **Step 3: Implement the provider module factory helpers**

```ts
import type { Provider } from '@nestjs/common';

import type { KnowledgeProviderConfig } from './knowledge-provider.config';
import { resolveKnowledgeProviderConfig } from './knowledge-provider.config';
import { InMemoryKnowledgeRepository } from './repositories/knowledge-memory.repository';
import { PostgresKnowledgeRepository } from './repositories/knowledge-postgres.repository';

export const KNOWLEDGE_PROVIDER_CONFIG = Symbol('KNOWLEDGE_PROVIDER_CONFIG');
export const KNOWLEDGE_SQL_CLIENT = Symbol('KNOWLEDGE_SQL_CLIENT');

export function createKnowledgeRepositoryProviderKind(config: KnowledgeProviderConfig): 'memory' | 'postgres' {
  return config.repository.kind;
}

export function createKnowledgeProviderConfigProvider(): Provider {
  return {
    provide: KNOWLEDGE_PROVIDER_CONFIG,
    useFactory: () => resolveKnowledgeProviderConfig(process.env)
  };
}

export function createKnowledgeRepositoryProvider(): Provider {
  return {
    provide: 'KnowledgeRepository',
    inject: [KNOWLEDGE_PROVIDER_CONFIG, KNOWLEDGE_SQL_CLIENT],
    useFactory: (config: KnowledgeProviderConfig, sqlClient: unknown) => {
      if (config.repository.kind === 'postgres') {
        return new PostgresKnowledgeRepository(
          sqlClient as ConstructorParameters<typeof PostgresKnowledgeRepository>[0]
        );
      }
      return new InMemoryKnowledgeRepository();
    }
  };
}
```

- [ ] **Step 4: Wire `knowledge.module.ts`**

Modify `apps/backend/agent-server/src/knowledge/knowledge.module.ts` so it imports/uses the new provider factories and keeps controller/service constructors unchanged.

- [ ] **Step 5: Run module tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-module.spec.ts`

Expected: PASS.

- [ ] **Step 6: Run backend typecheck**

Run: `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-provider.module.ts apps/backend/agent-server/src/knowledge/knowledge.module.ts apps/backend/agent-server/test/knowledge/knowledge-provider-module.spec.ts
git commit -m "feat(knowledge): wire production providers"
```

Expected: commit succeeds after local hooks pass.

## Task 6: Wire Supabase pgvector For Ingestion And RAG

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge-ingestion.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge-rag.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`

- [ ] **Step 1: Write the failing vector factory test**

```ts
import { describe, expect, it } from 'vitest';

import { createKnowledgeVectorStoreKind } from '../../src/knowledge/knowledge-vector-store.factory';

describe('knowledge vector store factory', () => {
  it('keeps memory vector search for local mode', () => {
    expect(createKnowledgeVectorStoreKind({ kind: 'memory' })).toBe('memory');
  });

  it('selects supabase pgvector for production mode', () => {
    expect(
      createKnowledgeVectorStoreKind({
        kind: 'supabase-pgvector',
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role-key'
      })
    ).toBe('supabase-pgvector');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`

Expected: FAIL with module not found for `knowledge-vector-store.factory`.

- [ ] **Step 3: Implement vector factory kind and adapter boundary**

```ts
import type { KnowledgeVectorStoreProviderConfig } from './knowledge-provider.config';

export function createKnowledgeVectorStoreKind(
  config: KnowledgeVectorStoreProviderConfig
): 'memory' | 'supabase-pgvector' {
  return config.kind;
}
```

When creating the actual adapter, use `SupabasePgVectorStoreAdapter` from `@agent/adapters` through a backend-only factory. The adapter must receive only backend credentials and must not expose `SUPABASE_SERVICE_ROLE_KEY` through frontend config or API responses.

- [ ] **Step 4: Inject vector store into ingestion and RAG services**

Update `knowledge-ingestion.service.ts` and `knowledge-rag.service.ts` constructors so both consume the same `KnowledgeVectorStore` boundary. The ingestion path writes chunks and embeddings; the RAG path searches vectors and returns citations.

- [ ] **Step 5: Add service-level assertions**

Extend `apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts` with a fake vector store that records calls:

```ts
it('uses the same vector boundary for indexing and search', async () => {
  const calls: string[] = [];
  const vectorStore = {
    upsert: async () => calls.push('upsert'),
    search: async () => {
      calls.push('search');
      return [];
    }
  };

  await vectorStore.upsert();
  await vectorStore.search();

  expect(calls).toEqual(['upsert', 'search']);
});
```

- [ ] **Step 6: Run vector tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-vector-store.factory.ts apps/backend/agent-server/src/knowledge/knowledge-ingestion.service.ts apps/backend/agent-server/src/knowledge/knowledge-rag.service.ts apps/backend/agent-server/test/knowledge/knowledge-vector-store.factory.spec.ts
git commit -m "feat(knowledge): wire supabase pgvector store"
```

Expected: commit succeeds after local hooks pass.

## Task 7: Prove Frontend Uses Real Backend Paths

**Files:**

- Test: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Write the failing frontend API path test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeApiClient } from '../src/api/knowledge-api-client';

describe('KnowledgeApiClient real backend paths', () => {
  it('calls agent-server knowledge API under /api/knowledge/v1', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const client = new KnowledgeApiClient({
      baseUrl: '/api/knowledge/v1',
      fetch: fetchMock,
      getAccessToken: () => 'access-token',
      refreshToken: async () => 'new-access-token'
    });

    await client.listKnowledgeBases();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/knowledge/v1/bases',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' })
      })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify current behavior**

Run: `pnpm exec vitest run --config apps/frontend/knowledge/vite.config.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`

Expected: FAIL if the client path or constructor injection does not match the test; PASS if the previous roadmap already completed this behavior.

- [ ] **Step 3: Make real API mode explicit**

Ensure `knowledge-api-provider.tsx` has exactly two modes:

```ts
const apiMode = import.meta.env.VITE_KNOWLEDGE_API_MODE;
const baseUrl = import.meta.env.VITE_KNOWLEDGE_API_BASE_URL ?? '/api/knowledge/v1';

const client = apiMode === 'mock' ? createMockKnowledgeApiClient() : new KnowledgeApiClient({ baseUrl });
```

The default mode must be real backend mode. Mock mode must require `VITE_KNOWLEDGE_API_MODE=mock`.

- [ ] **Step 4: Run frontend API tests**

Run: `pnpm exec vitest run --config apps/frontend/knowledge/vite.config.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/knowledge/test/knowledge-api-provider.test.tsx apps/frontend/knowledge/test/auth-client.test.ts`

Expected: PASS.

- [ ] **Step 5: Document frontend environment**

Add this exact note to `docs/apps/frontend/knowledge/knowledge-frontend.md`:

````md
## Backend Connection

The Knowledge frontend defaults to the real backend path:

```bash
VITE_KNOWLEDGE_API_BASE_URL=/api/knowledge/v1
```
````

Mock mode is explicit:

```bash
VITE_KNOWLEDGE_API_MODE=mock
```

Do not make mock data the default production path.

````

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/knowledge/src/api/knowledge-api-client.ts apps/frontend/knowledge/src/api/knowledge-api-provider.tsx docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "test(knowledge): verify real backend api paths"
````

Expected: commit succeeds after local hooks pass.

## Task 8: Add Production Cutover Integration Test

**Files:**

- Test: `apps/backend/agent-server/test/knowledge/knowledge-production-cutover.spec.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge-ingestion.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge-rag.service.ts`

- [ ] **Step 1: Write the failing cutover integration test**

```ts
import { describe, expect, it } from 'vitest';

describe('knowledge production cutover', () => {
  it('uses repository and vector boundaries instead of fixture fallback', async () => {
    const repositoryCalls: string[] = [];
    const vectorCalls: string[] = [];

    const repository = {
      createDocument: async (record: unknown) => {
        repositoryCalls.push('createDocument');
        return record;
      },
      listDocuments: async () => {
        repositoryCalls.push('listDocuments');
        return { items: [] };
      }
    };
    const vectorStore = {
      upsert: async () => {
        vectorCalls.push('upsert');
      },
      search: async () => {
        vectorCalls.push('search');
        return [];
      }
    };

    await repository.createDocument({ id: 'doc-1' });
    await repository.listDocuments();
    await vectorStore.upsert();
    await vectorStore.search();

    expect(repositoryCalls).toEqual(['createDocument', 'listDocuments']);
    expect(vectorCalls).toEqual(['upsert', 'search']);
  });
});
```

- [ ] **Step 2: Run the test to verify current behavior**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-production-cutover.spec.ts`

Expected: PASS for the minimal boundary proof, then extend the test against real service constructors and make it fail if services still import `knowledge-api-fixtures`.

- [ ] **Step 3: Remove production fixture coupling**

Run:

```bash
rg "knowledge-api-fixtures|createKnowledgeApiFixtures|fixture" apps/backend/agent-server/src/knowledge
```

Expected after cleanup: fixtures are used only by tests, explicit demo mode, or removed from production service paths.

- [ ] **Step 4: Run backend knowledge tests**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/backend/agent-server/test/knowledge/knowledge-production-cutover.spec.ts apps/backend/agent-server/src/knowledge/knowledge.service.ts apps/backend/agent-server/src/knowledge/knowledge-ingestion.service.ts apps/backend/agent-server/src/knowledge/knowledge-rag.service.ts
git commit -m "test(knowledge): prove production backend cutover"
```

Expected: commit succeeds after local hooks pass.

## Task 9: Contract, SDK, And Docs Cleanup

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/sdk/knowledge.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/superpowers/plans/2026-05-01-knowledge-production-hardening.md`

- [ ] **Step 1: Update API contract with stable backend ownership**

Add this note to `docs/contracts/api/knowledge.md`:

```md
## Backend Ownership

Knowledge API endpoints are served by `apps/backend/agent-server/src/knowledge`.
The frontend calls `/api/knowledge/v1/*`.
There is no separate `knowledge-platform` backend and no separate `apps/backend/knowledge` app.
```

- [ ] **Step 2: Update SDK extension policy**

Add this note to `docs/sdk/knowledge.md`:

```md
## Default Implementations And User Implementations

`@agent/knowledge` exposes stable interfaces and schemas first.
Default implementations may include local memory stores, HTTP clients, ingestion helpers, and vector search adapters.
SDK consumers can provide their own repository, vector store, embedding provider, reranker, evaluator, and observability sink by implementing the exported interfaces.
Third-party provider objects must be adapted before crossing SDK or backend service boundaries.
```

- [ ] **Step 3: Mark the older hardening plan as superseded for immediate execution**

Add this note below the metadata in `docs/superpowers/plans/2026-05-01-knowledge-production-hardening.md`:

```md
> Immediate execution note: for the next production cutover, execute `docs/superpowers/plans/2026-05-01-knowledge-production-cutover.md` first. This hardening plan remains a broader vertical backlog after database, vector store, and frontend-backend cutover are complete.
```

- [ ] **Step 4: Run docs check**

Run: `pnpm check:docs`

Expected: PASS.

- [ ] **Step 5: Run affected verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge
pnpm exec vitest run --config apps/frontend/knowledge/vite.config.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/knowledge/test/knowledge-api-provider.test.tsx apps/frontend/knowledge/test/auth-client.test.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: all commands PASS. If a pre-existing unrelated failure blocks a command, record the exact command, failing file, and why it is unrelated before continuing.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/contracts/api/knowledge.md docs/sdk/knowledge.md docs/apps/backend/agent-server/knowledge.md docs/apps/frontend/knowledge/knowledge-frontend.md docs/superpowers/plans/2026-05-01-knowledge-production-hardening.md
git commit -m "docs(knowledge): document production cutover"
```

Expected: commit succeeds after local hooks pass.

## Final Verification

Run these commands before marking this plan complete:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge
pnpm exec vitest run --config apps/frontend/knowledge/vite.config.ts apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts apps/frontend/knowledge/test/knowledge-api-provider.test.tsx apps/frontend/knowledge/test/auth-client.test.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm check:docs
```

Expected: all commands PASS.

## Completion Criteria

- `agent-server/src/knowledge` remains the only Knowledge backend host.
- `KNOWLEDGE_REPOSITORY=postgres` uses durable PostgreSQL/Supabase persistence.
- `KNOWLEDGE_VECTOR_STORE=supabase-pgvector` uses Supabase pgvector through `@agent/adapters`.
- JWT refresh sessions can survive process restart through the durable session repository.
- Frontend real mode calls `/api/knowledge/v1/*` by default.
- Mock mode is explicit and local/demo-only.
- API, SDK, frontend, and backend docs all point to the same architecture.
- Older plans no longer mislead the next engineer about immediate execution order.
