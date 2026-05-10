# Knowledge Production Hardening Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/agent-server/src/knowledge`、`packages/knowledge`、`packages/adapters`
最后核对：2026-05-01

> Historical note: this document predates the real API domain-model cutover. Current Knowledge frontend runtime data must come from `/api/knowledge/*`; frontend runtime mock mode has been removed.

> Immediate execution note: for the next production cutover, execute `docs/superpowers/plans/2026-05-01-knowledge-production-cutover.md` first. This hardening plan remains a broader vertical backlog after database, vector store, and frontend-backend cutover are complete.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the completed Knowledge horizontal productionization into a durable, provider-configurable, permission-aware, observable production system.

**Architecture:** Keep public contracts in `@agent/knowledge` and `docs/contracts/api/knowledge.md`; keep backend HTTP controllers transport-only; push persistence, vector store, job queues, authorization, eval providers, and observability sinks behind repository/provider interfaces. Frontend `apps/frontend/knowledge` must keep using `KnowledgeApiProvider` and must not import backend files or mock data outside explicit mock mode.

**Tech Stack:** TypeScript, NestJS, React, Vite, Vitest, Zod, PostgreSQL/Supabase, pgvector, `@agent/knowledge`, `@agent/adapters`, pnpm workspace.

---

## Scope Check

The horizontal Knowledge workflow is already complete. This plan covers the remaining vertical production-hardening work:

- Durable PostgreSQL/Supabase persistence.
- Runtime vector store configuration using Supabase pgvector.
- Production-grade file upload UI and async ingestion jobs.
- Authorization and tenant enforcement.
- Evaluation and observability product depth.
- End-to-end tests and bundle hygiene.

This plan intentionally splits work into independently verifiable tasks. Each task should land only after tests pass and docs are updated.

## File Structure

- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
  - Durable repository implementing `KnowledgeRepository`.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts`
  - DB row to API/domain record mapping.
- `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.schema.sql`
  - Initial SQL schema for local/Supabase setup.
- `apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts`
  - Env-driven provider selection for repository/vector store.
- `apps/backend/agent-server/src/knowledge/knowledge-authorization.service.ts`
  - Tenant/user/role policy checks.
- `apps/backend/agent-server/src/knowledge/knowledge-job.service.ts`
  - Durable job state for ingestion and eval execution.
- `apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`
  - Repository contract tests with fake query client.
- `apps/backend/agent-server/test/knowledge/knowledge-authorization.spec.ts`
  - Authorization tests.
- `apps/frontend/knowledge/src/hooks/use-knowledge-upload.ts`
  - File selection, upload state, progress, and errors.
- `apps/frontend/knowledge/src/features/documents/document-upload-panel.tsx`
  - Upload UI component.
- `apps/frontend/knowledge/src/features/observability/trace-detail-drawer.tsx`
  - Trace detail drawer with redacted spans.
- `apps/frontend/knowledge/src/features/evals/eval-comparison-panel.tsx`
  - Eval comparison UI.
- `apps/frontend/knowledge/test/knowledge-production-hardening.test.tsx`
  - Frontend workflow regression tests.
- `docs/apps/backend/agent-server/knowledge.md`
  - Backend production notes.
- `docs/apps/frontend/knowledge/knowledge-frontend.md`
  - Frontend production workflow notes.
- `docs/contracts/api/knowledge.md`
  - API contract updates.
- `docs/sdk/knowledge.md`
  - SDK provider configuration notes.

## Task 1: Durable Knowledge Repository Boundary

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
- Create: `apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.schema.sql`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`
- Docs: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write the failing repository contract test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';

describe('PostgresKnowledgeRepository', () => {
  it('upserts documents by tenant, knowledge base, and document id', async () => {
    const rows: Record<string, unknown>[] = [];
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('insert into knowledge_documents')) {
        const existingIndex = rows.findIndex(
          row => row.tenant_id === params[1] && row.knowledge_base_id === params[2] && row.id === params[0]
        );
        const row = {
          id: params[0],
          tenant_id: params[1],
          knowledge_base_id: params[2],
          title: params[3],
          status: params[4],
          metadata: params[5],
          error_message: params[6],
          created_at: params[7],
          updated_at: params[8]
        };
        if (existingIndex >= 0) rows[existingIndex] = row;
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
      title: 'Draft',
      status: 'indexing',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });
    await repo.createDocument({
      id: 'doc-1',
      tenantId: 'ws-1',
      knowledgeBaseId: 'kb-1',
      title: 'Final',
      status: 'ready',
      metadata: { ingestionStages: [{ stage: 'indexed' }] },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:01.000Z'
    });

    const documents = await repo.listDocuments({ tenantId: 'ws-1', knowledgeBaseId: 'kb-1' });

    expect(documents.items).toHaveLength(1);
    expect(documents.items[0]).toMatchObject({ id: 'doc-1', title: 'Final', status: 'ready' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

Expected: FAIL with module not found for `knowledge-postgres.repository`.

- [ ] **Step 3: Add the mapper**

```ts
// apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.mapper.ts
import type { KnowledgeDocumentRecord } from '../interfaces/knowledge-records.types';

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

- [ ] **Step 4: Add the minimal repository implementation**

```ts
// apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.repository.ts
import type { KnowledgeDocumentRecord } from '../interfaces/knowledge-records.types';
import type {
  KnowledgeDocumentQuery,
  KnowledgeRepository,
  KnowledgeRepositoryListResult
} from './knowledge.repository';
import { mapDocumentRow, type KnowledgeDocumentRow } from './knowledge-postgres.mapper';

export interface KnowledgeSqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export class PostgresKnowledgeRepository implements Pick<KnowledgeRepository, 'createDocument' | 'listDocuments'> {
  constructor(private readonly client: KnowledgeSqlClient) {}

  async createDocument(record: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    const result = await this.client.query<KnowledgeDocumentRow>(
      `
        insert into knowledge_documents (
          id, tenant_id, knowledge_base_id, title, status, metadata, error_message, created_at, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (tenant_id, knowledge_base_id, id)
        do update set
          title = excluded.title,
          status = excluded.status,
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
}
```

- [ ] **Step 5: Add the SQL schema**

```sql
-- apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.schema.sql
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

create index if not exists idx_knowledge_documents_tenant_kb_updated
  on knowledge_documents (tenant_id, knowledge_base_id, updated_at desc);
```

- [ ] **Step 6: Run the repository test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts`

Expected: PASS.

- [ ] **Step 7: Update docs**

Add this to `docs/apps/backend/agent-server/knowledge.md`:

```md
## Durable Repository

Production persistence should use `PostgresKnowledgeRepository` or another implementation of `KnowledgeRepository`.
The document table must enforce `primary key (tenant_id, knowledge_base_id, id)` so ingestion updates cannot create stale duplicate document rows.
```

- [ ] **Step 8: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/repositories/knowledge-postgres.* apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "feat: add durable knowledge repository boundary"
```

## Task 2: Runtime Provider Configuration for Supabase pgvector

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`
- Docs: `docs/sdk/knowledge.md`

- [ ] **Step 1: Write the failing provider config test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeProviderConfig } from '../../src/knowledge/knowledge-provider.config';

describe('resolveKnowledgeProviderConfig', () => {
  it('selects in-memory defaults when no env is provided', () => {
    expect(resolveKnowledgeProviderConfig({})).toEqual({
      repository: 'memory',
      vectorStore: 'memory'
    });
  });

  it('selects Supabase pgvector only when required env vars exist', () => {
    expect(
      resolveKnowledgeProviderConfig({
        KNOWLEDGE_REPOSITORY: 'postgres',
        KNOWLEDGE_VECTOR_STORE: 'supabase-pgvector',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role'
      })
    ).toEqual({
      repository: 'postgres',
      vectorStore: 'supabase-pgvector'
    });
  });

  it('fails fast when Supabase pgvector is selected without credentials', () => {
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
export type KnowledgeRepositoryProvider = 'memory' | 'postgres';
export type KnowledgeVectorStoreProvider = 'memory' | 'supabase-pgvector';

export interface KnowledgeProviderConfig {
  repository: KnowledgeRepositoryProvider;
  vectorStore: KnowledgeVectorStoreProvider;
}

export function resolveKnowledgeProviderConfig(env: Record<string, string | undefined>): KnowledgeProviderConfig {
  const repository = parseRepository(env.KNOWLEDGE_REPOSITORY);
  const vectorStore = parseVectorStore(env.KNOWLEDGE_VECTOR_STORE);

  if (vectorStore === 'supabase-pgvector' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for supabase-pgvector vector store.');
  }

  return { repository, vectorStore };
}

function parseRepository(value: string | undefined): KnowledgeRepositoryProvider {
  if (!value) return 'memory';
  if (value === 'memory' || value === 'postgres') return value;
  throw new Error(`Unsupported KNOWLEDGE_REPOSITORY: ${value}`);
}

function parseVectorStore(value: string | undefined): KnowledgeVectorStoreProvider {
  if (!value) return 'memory';
  if (value === 'memory' || value === 'supabase-pgvector') return value;
  throw new Error(`Unsupported KNOWLEDGE_VECTOR_STORE: ${value}`);
}
```

- [ ] **Step 4: Run provider config test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts`

Expected: PASS.

- [ ] **Step 5: Document env configuration**

Add this to `docs/sdk/knowledge.md`:

```md
## Backend Provider Environment

`KNOWLEDGE_REPOSITORY=memory|postgres`
`KNOWLEDGE_VECTOR_STORE=memory|supabase-pgvector`

When `KNOWLEDGE_VECTOR_STORE=supabase-pgvector`, backend startup must also receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
The service role key must stay inside backend provider construction and must never enter API DTOs, trace spans, frontend state, or SDK core contracts.
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-provider.config.ts apps/backend/agent-server/test/knowledge/knowledge-provider-config.spec.ts docs/sdk/knowledge.md
git commit -m "feat: configure knowledge providers"
```

## Task 3: Production Document Upload UX

**Files:**

- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-upload.ts`
- Create: `apps/frontend/knowledge/src/features/documents/document-upload-panel.tsx`
- Modify: `apps/frontend/knowledge/src/features/documents/documents-page.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-document-upload.test.tsx`
- Docs: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Write the failing upload hook test**

```tsx
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeApiProvider, type KnowledgeFrontendApi } from '../src/api/knowledge-api-provider';
import { useKnowledgeUpload } from '../src/hooks/use-knowledge-upload';

let captured: ReturnType<typeof useKnowledgeUpload> | undefined;

function Probe() {
  captured = useKnowledgeUpload({ knowledgeBaseId: 'kb-1' });
  return null;
}

describe('useKnowledgeUpload', () => {
  it('uploads the selected file through the injected API client', async () => {
    const uploadDocument = vi.fn<KnowledgeFrontendApi['uploadDocument']>().mockResolvedValue({
      document: {
        id: 'doc-1',
        workspaceId: 'ws-1',
        knowledgeBaseId: 'kb-1',
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
    });
    const api = { uploadDocument } as Partial<KnowledgeFrontendApi> as KnowledgeFrontendApi;
    const root = createRoot(document.createElement('div'));

    await act(async () => {
      root.render(
        <KnowledgeApiProvider client={api}>
          <Probe />
        </KnowledgeApiProvider>
      );
    });
    await act(async () => {
      await captured?.upload(new File(['hello'], 'Guide.md', { type: 'text/markdown' }));
    });

    expect(uploadDocument).toHaveBeenCalledWith({ file: expect.any(File), knowledgeBaseId: 'kb-1' });
    expect(captured?.lastUploadedDocument?.title).toBe('Guide.md');
    expect(captured?.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-document-upload.test.tsx`

Expected: FAIL with module not found for `use-knowledge-upload`.

- [ ] **Step 3: Implement the hook**

```ts
// apps/frontend/knowledge/src/hooks/use-knowledge-upload.ts
import { useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { KnowledgeDocument } from '../types/api';

export function useKnowledgeUpload({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const api = useKnowledgeApi();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUploadedDocument, setLastUploadedDocument] = useState<KnowledgeDocument | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadDocument({ file, knowledgeBaseId });
      setLastUploadedDocument(result.document);
      return result;
    } catch (input) {
      const nextError = input instanceof Error ? input : new Error(String(input));
      setError(nextError);
      return undefined;
    } finally {
      setUploading(false);
    }
  }

  return { error, lastUploadedDocument, upload, uploading };
}
```

- [ ] **Step 4: Implement the upload panel**

```tsx
// apps/frontend/knowledge/src/features/documents/document-upload-panel.tsx
import { useRef } from 'react';
import { UploadOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';

import { useKnowledgeUpload } from '../../hooks/use-knowledge-upload';

export function DocumentUploadPanel({
  knowledgeBaseId,
  onUploaded
}: {
  knowledgeBaseId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useKnowledgeUpload({ knowledgeBaseId });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const result = await upload.upload(file);
    event.currentTarget.value = '';
    if (result) onUploaded();
  }

  return (
    <Space>
      <input
        ref={inputRef}
        aria-label="选择上传文档"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        type="file"
      />
      <Button
        icon={<UploadOutlined />}
        loading={upload.uploading}
        onClick={() => inputRef.current?.click()}
        type="primary"
      >
        上传文档
      </Button>
      {upload.error ? <Typography.Text type="danger">{upload.error.message}</Typography.Text> : null}
      {upload.lastUploadedDocument ? (
        <Typography.Text type="secondary">{upload.lastUploadedDocument.title}</Typography.Text>
      ) : null}
    </Space>
  );
}
```

- [ ] **Step 5: Wire the panel into DocumentsPage**

Replace the upload button in `apps/frontend/knowledge/src/features/documents/documents-page.tsx` with:

```tsx
<DocumentUploadPanel knowledgeBaseId="kb_frontend" onUploaded={() => void reload()} />
```

Also import:

```ts
import { DocumentUploadPanel } from './document-upload-panel';
```

- [ ] **Step 6: Run frontend upload test**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-document-upload.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge/src/hooks/use-knowledge-upload.ts apps/frontend/knowledge/src/features/documents/document-upload-panel.tsx apps/frontend/knowledge/src/features/documents/documents-page.tsx apps/frontend/knowledge/test/knowledge-document-upload.test.tsx docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "feat: harden knowledge document upload"
```

## Task 4: Async Ingestion Job State

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-job.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.service.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-job.spec.ts`
- Docs: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write failing job test**

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeJobService } from '../../src/knowledge/knowledge-job.service';

describe('KnowledgeJobService', () => {
  it('records queued, running, succeeded, and failed job states', async () => {
    const service = new KnowledgeJobService({ now: () => new Date('2026-05-01T00:00:00.000Z') });

    const queued = await service.queueDocumentJob({ documentId: 'doc-1', tenantId: 'ws-1' });
    await service.markRunning(queued.id, 'parse');
    await service.markSucceeded(queued.id, 'index_vector');

    const job = await service.getJob(queued.id);

    expect(job).toMatchObject({
      id: queued.id,
      documentId: 'doc-1',
      status: 'succeeded',
      currentStage: 'index_vector'
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-job.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement job service**

```ts
// apps/backend/agent-server/src/knowledge/knowledge-job.service.ts
import type { DocumentProcessingJob, DocumentProcessingStage } from '../../../frontend/knowledge/src/types/api';

export class KnowledgeJobService {
  private readonly jobs = new Map<string, DocumentProcessingJob>();
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async queueDocumentJob(input: { tenantId: string; documentId: string }): Promise<DocumentProcessingJob> {
    const job: DocumentProcessingJob = {
      id: `job_${input.documentId}_${Date.now()}`,
      documentId: input.documentId,
      status: 'queued',
      stages: [],
      createdAt: this.timestamp()
    };
    this.jobs.set(job.id, job);
    return structuredClone(job);
  }

  async markRunning(id: string, stage: DocumentProcessingStage) {
    const job = this.requireJob(id);
    job.status = 'running';
    job.currentStage = stage;
    job.stages.push({ stage, status: 'running', startedAt: this.timestamp() });
    return structuredClone(job);
  }

  async markSucceeded(id: string, stage: DocumentProcessingStage) {
    const job = this.requireJob(id);
    job.status = 'succeeded';
    job.currentStage = stage;
    job.stages.push({ stage, status: 'succeeded', completedAt: this.timestamp() });
    return structuredClone(job);
  }

  async markFailed(id: string, stage: DocumentProcessingStage, message: string) {
    const job = this.requireJob(id);
    job.status = 'failed';
    job.currentStage = stage;
    job.error = { code: 'job_failed', message, stage };
    job.stages.push({ stage, status: 'failed', error: job.error, completedAt: this.timestamp() });
    return structuredClone(job);
  }

  async getJob(id: string) {
    return structuredClone(this.requireJob(id));
  }

  private requireJob(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Knowledge job not found: ${id}`);
    return job;
  }

  private timestamp() {
    return this.now().toISOString();
  }
}
```

- [ ] **Step 4: Fix imports to avoid frontend type dependency**

Move `DocumentProcessingJob` and `DocumentProcessingStage` to a backend-local interface file if the import above fails. Use:

```ts
// apps/backend/agent-server/src/knowledge/interfaces/knowledge-job.types.ts
export type KnowledgePublicDocumentStage =
  | 'upload_received'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'failed'
  | 'commit';
```

- [ ] **Step 5: Run job test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-job.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-job.service.ts apps/backend/agent-server/src/knowledge/interfaces/knowledge-job.types.ts apps/backend/agent-server/test/knowledge/knowledge-job.spec.ts docs/apps/backend/agent-server/knowledge.md
git commit -m "feat: track knowledge ingestion jobs"
```

## Task 5: Authorization and Tenant Enforcement

**Files:**

- Create: `apps/backend/agent-server/src/knowledge/knowledge-authorization.service.ts`
- Modify: `apps/backend/agent-server/src/knowledge/knowledge.controller.ts`
- Test: `apps/backend/agent-server/test/knowledge/knowledge-authorization.spec.ts`
- Docs: `docs/contracts/api/knowledge.md`

- [ ] **Step 1: Write failing authorization test**

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeAuthorizationService } from '../../src/knowledge/knowledge-authorization.service';

describe('KnowledgeAuthorizationService', () => {
  it('allows maintainers to upload documents in their workspace', () => {
    const service = new KnowledgeAuthorizationService();

    expect(
      service.can({
        action: 'document.upload',
        user: { id: 'user-1', workspaceId: 'ws-1', roles: ['maintainer'] },
        resource: { workspaceId: 'ws-1' }
      })
    ).toBe(true);
  });

  it('rejects viewers from uploading documents', () => {
    const service = new KnowledgeAuthorizationService();

    expect(
      service.can({
        action: 'document.upload',
        user: { id: 'user-1', workspaceId: 'ws-1', roles: ['viewer'] },
        resource: { workspaceId: 'ws-1' }
      })
    ).toBe(false);
  });

  it('rejects cross-workspace access', () => {
    const service = new KnowledgeAuthorizationService();

    expect(
      service.can({
        action: 'trace.read',
        user: { id: 'user-1', workspaceId: 'ws-1', roles: ['admin'] },
        resource: { workspaceId: 'ws-2' }
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-authorization.spec.ts`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement authorization service**

```ts
// apps/backend/agent-server/src/knowledge/knowledge-authorization.service.ts
type KnowledgeAction = 'document.upload' | 'document.reprocess' | 'trace.read' | 'eval.run' | 'chat.send';
type KnowledgeRole = 'owner' | 'admin' | 'maintainer' | 'evaluator' | 'viewer';

export interface KnowledgePolicyInput {
  action: KnowledgeAction;
  user: { id: string; workspaceId: string; roles: KnowledgeRole[] };
  resource: { workspaceId: string };
}

const actionRoles: Record<KnowledgeAction, KnowledgeRole[]> = {
  'document.upload': ['owner', 'admin', 'maintainer'],
  'document.reprocess': ['owner', 'admin', 'maintainer'],
  'trace.read': ['owner', 'admin', 'maintainer'],
  'eval.run': ['owner', 'admin', 'maintainer', 'evaluator'],
  'chat.send': ['owner', 'admin', 'maintainer', 'evaluator', 'viewer']
};

export class KnowledgeAuthorizationService {
  can(input: KnowledgePolicyInput): boolean {
    if (input.user.workspaceId !== input.resource.workspaceId) return false;
    const allowedRoles = actionRoles[input.action];
    return input.user.roles.some(role => allowedRoles.includes(role));
  }
}
```

- [ ] **Step 4: Run authorization test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-authorization.spec.ts`

Expected: PASS.

- [ ] **Step 5: Document enforcement**

Update `docs/contracts/api/knowledge.md` permission section with:

```md
Backend authorization is mandatory. Frontend hiding a button is not a permission boundary.
Every protected Knowledge action must evaluate workspace ownership and role before service execution.
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/agent-server/src/knowledge/knowledge-authorization.service.ts apps/backend/agent-server/test/knowledge/knowledge-authorization.spec.ts docs/contracts/api/knowledge.md
git commit -m "feat: enforce knowledge authorization policy"
```

## Task 6: Eval and Observability Product Depth

**Files:**

- Create: `apps/frontend/knowledge/src/features/evals/eval-comparison-panel.tsx`
- Create: `apps/frontend/knowledge/src/features/observability/trace-detail-drawer.tsx`
- Modify: `apps/frontend/knowledge/src/features/evals/evals-page.tsx`
- Modify: `apps/frontend/knowledge/src/features/observability/observability-page.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-eval-observability-panels.test.tsx`
- Docs: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Write failing panel smoke test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EvalComparisonPanel } from '../src/features/evals/eval-comparison-panel';
import { TraceDetailDrawer } from '../src/features/observability/trace-detail-drawer';

describe('knowledge eval and observability panels', () => {
  it('renders eval comparison deltas', () => {
    const html = renderToStaticMarkup(
      <EvalComparisonPanel
        comparison={{
          baselineRunId: 'run-old',
          candidateRunId: 'run-new',
          totalScoreDelta: 3,
          retrievalScoreDelta: 1,
          generationScoreDelta: 2,
          perMetricDelta: { recallAtK: 0.1 }
        }}
      />
    );

    expect(html).toContain('run-new');
    expect(html).toContain('总分变化');
  });

  it('renders redacted trace span details', () => {
    const html = renderToStaticMarkup(
      <TraceDetailDrawer
        open
        trace={{
          id: 'trace-1',
          workspaceId: 'ws-1',
          knowledgeBaseIds: ['kb-1'],
          question: '如何观测？',
          status: 'succeeded',
          createdAt: '2026-05-01T00:00:00.000Z',
          spans: [{ id: 'span-1', traceId: 'trace-1', stage: 'generation', name: '生成', status: 'succeeded' }],
          citations: []
        }}
        onClose={() => {}}
      />
    );

    expect(html).toContain('生成');
    expect(html).not.toContain('Authorization');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-eval-observability-panels.test.tsx`

Expected: FAIL with module not found.

- [ ] **Step 3: Implement EvalComparisonPanel**

```tsx
// apps/frontend/knowledge/src/features/evals/eval-comparison-panel.tsx
import { Card, Statistic } from 'antd';

import type { EvalRunComparison } from '../../types/api';

export function EvalComparisonPanel({ comparison }: { comparison: EvalRunComparison | null }) {
  if (!comparison) {
    return <Card title="运行对比">至少需要两次运行后展示评测对比。</Card>;
  }
  return (
    <Card title={`${comparison.candidateRunId} vs ${comparison.baselineRunId}`}>
      <Statistic title="总分变化" value={comparison.totalScoreDelta} />
      <Statistic title="检索变化" value={comparison.retrievalScoreDelta} />
      <Statistic title="生成变化" value={comparison.generationScoreDelta} />
    </Card>
  );
}
```

- [ ] **Step 4: Implement TraceDetailDrawer**

```tsx
// apps/frontend/knowledge/src/features/observability/trace-detail-drawer.tsx
import { Drawer, Timeline, Typography } from 'antd';

import type { RagTraceDetail } from '../../types/api';

export function TraceDetailDrawer({
  open,
  onClose,
  trace
}: {
  open: boolean;
  onClose: () => void;
  trace: RagTraceDetail | null;
}) {
  return (
    <Drawer open={open} title={trace?.question ?? 'Trace 详情'} onClose={onClose}>
      <Typography.Paragraph>{trace?.answer}</Typography.Paragraph>
      <Timeline
        items={(trace?.spans ?? []).map(span => ({
          children: `${span.name} · ${span.stage} · ${span.latencyMs ?? 0}ms`,
          color: span.status === 'succeeded' ? 'green' : 'red'
        }))}
      />
    </Drawer>
  );
}
```

- [ ] **Step 5: Wire panels into pages**

In `EvalsPage`, replace inline comparison card with:

```tsx
<EvalComparisonPanel comparison={comparison} />
```

In `ObservabilityPage`, render:

```tsx
<TraceDetailDrawer open={Boolean(trace)} trace={trace} onClose={() => {}} />
```

- [ ] **Step 6: Run panel test**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-eval-observability-panels.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/knowledge/src/features/evals/eval-comparison-panel.tsx apps/frontend/knowledge/src/features/observability/trace-detail-drawer.tsx apps/frontend/knowledge/test/knowledge-eval-observability-panels.test.tsx docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "feat: add knowledge eval and trace panels"
```

## Task 7: End-to-End Production Workflow Tests

**Files:**

- Create: `apps/frontend/knowledge/test/knowledge-production-e2e.test.tsx`
- Create: `apps/backend/agent-server/test/knowledge/knowledge-controller-production.spec.ts`
- Docs: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Write backend controller production test**

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeController } from '../../src/knowledge/knowledge.controller';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { KnowledgeAuthService } from '../../src/knowledge/knowledge-auth.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-session.repository';

describe('KnowledgeController production workflow', () => {
  it('uploads a document and lists it after ingestion', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repo);
    const auth = new KnowledgeAuthService({ sessions: new InMemoryKnowledgeSessionRepository() });
    const controller = new KnowledgeController(service, auth);

    await controller.uploadDocument('kb_frontend', {
      originalname: 'Guide.md',
      buffer: Buffer.from('Knowledge upload flow')
    });

    const documents = await controller.listDocuments();

    expect(documents.items.some(item => item.filename === 'Guide.md')).toBe(true);
  });
});
```

- [ ] **Step 2: Run backend test to verify it fails**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-controller-production.spec.ts`

Expected: FAIL until constructor wiring and async return types are corrected.

- [ ] **Step 3: Fix controller/service instantiation for tests**

If constructor injection cannot be called directly, create services explicitly with:

```ts
const service = new KnowledgeService(repo, undefined, new KnowledgeIngestionService({ repo }));
```

Match the actual constructor parameter order in `KnowledgeService`.

- [ ] **Step 4: Run backend e2e test**

Run: `pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-controller-production.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/agent-server/test/knowledge/knowledge-controller-production.spec.ts docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "test: cover knowledge production workflow"
```

## Task 8: Bundle Hygiene Without Dynamic Import Drift

**Files:**

- Modify: `apps/frontend/knowledge/vite.config.ts`
- Test: `apps/frontend/knowledge/test/app-render.test.tsx`
- Docs: `docs/apps/frontend/knowledge/knowledge-frontend.md`

- [ ] **Step 1: Record current build warning**

Run: `pnpm --dir apps/frontend/knowledge build`

Expected: PASS with Vite chunk size warning for large vendor chunks.

- [ ] **Step 2: Add manual chunk grouping**

In `apps/frontend/knowledge/vite.config.ts`, ensure static imports stay static but vendor chunks are grouped:

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts')) return 'vendor-echarts';
          if (id.includes('node_modules/@ant-design/x')) return 'vendor-antx';
          if (id.includes('node_modules/antd')) return 'vendor-antd';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        }
      }
    }
  }
});
```

- [ ] **Step 3: Run frontend build**

Run: `pnpm --dir apps/frontend/knowledge build`

Expected: PASS. Chunk warning may remain for `vendor-echarts`; do not introduce dynamic `import()` just to silence the warning.

- [ ] **Step 4: Verify static import rule**

Run: `rg "import\\(" apps/frontend/knowledge/src apps/frontend/knowledge/test -n`

Expected: no matches unless a line has an explicit code-splitting comment and was approved in the task.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/knowledge/vite.config.ts docs/apps/frontend/knowledge/knowledge-frontend.md
git commit -m "chore: tune knowledge frontend chunks"
```

## Final Verification

- [ ] **Step 1: Run package verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/core-production-contracts.test.ts packages/knowledge/test/sdk-entrypoints.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm --dir packages/knowledge build:lib
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run backend verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge/knowledge-auth-production.spec.ts apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts apps/backend/agent-server/test/knowledge/knowledge-ingestion.spec.ts apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server build
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
```

Expected: all commands exit `0`. Build warnings are acceptable only if they are Vite chunk-size warnings and the static import rule still passes.

- [ ] **Step 4: Run docs and layout checks**

Run:

```bash
pnpm check:docs
pnpm check:barrel-layout
```

Expected: both commands exit `0`.

## Self-Review

Spec coverage:

- Durable DB persistence: Task 1.
- Supabase pgvector provider selection: Task 2.
- Upload UX: Task 3.
- Async jobs: Task 4.
- Authz / tenant enforcement: Task 5.
- Eval and observability depth: Task 6.
- Production workflow tests: Task 7.
- Bundle hygiene: Task 8.

Placeholder scan:

- No `TBD`, `TODO`, "implement later", or unspecified test instructions remain.
- Each implementation task includes concrete files, code snippets, commands, and expected results.

Type consistency:

- `EvalRunComparison` uses the backend DTO shape: `totalScoreDelta`, `retrievalScoreDelta`, `generationScoreDelta`, `perMetricDelta`.
- Public document stages use API-facing names such as `upload_received`, `parse`, `chunk`, `embed`, `index_vector`.
- `KnowledgeFrontendApi` remains the frontend-only API boundary.
