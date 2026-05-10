# Knowledge Frontend Core Operations Implementation Plan

> 历史说明：本文记录 standalone `auth-server` / `knowledge-server` 方案形成时的设计背景。当前实现已 hard cut 到 unified `apps/backend/agent-server`；正确入口见 `docs/superpowers/specs/2026-05-08-unified-backend-hard-cut-design.md`。

> Historical note: this document predates the real API domain-model cutover. Current Knowledge frontend runtime data must come from `/api/knowledge/*`; frontend runtime mock mode has been removed.

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/knowledge`、`apps/backend/knowledge-server`、`packages/knowledge`、`docs/contracts/api/knowledge.md`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade Knowledge App core operations loop: create a knowledge base, upload Markdown/TXT through `knowledge-server`, persist the original file to Aliyun OSS, create a document ingestion job, asynchronously parse/chunk/embed/index it, and show document/job/chunk status in the frontend.

**Architecture:** The frontend only calls `knowledge-server`; it never talks to OSS or package runtime internals. `knowledge-server` owns multipart upload, OSS provider injection, document/job repositories, and ingestion worker orchestration. `packages/knowledge` remains a reusable contract/pipeline package and receives no OSS credentials or backend environment coupling.

**Tech Stack:** TypeScript, NestJS, React/Vite, Ant Design, Vitest, Zod contracts, `@agent/knowledge`, Aliyun OSS adapter boundary, pnpm workspace.

---

## Source Spec

- [Knowledge Frontend Core Operations Design](/docs/superpowers/specs/2026-05-02-knowledge-frontend-core-ops-design.md)

## Scope Check

This plan intentionally implements only the core operations loop. It does not implement Chat Lab retrieval/generation, trace drilldown, eval workflows, PDF/DOCX parsing, or web crawling. The only accepted file types are Markdown and TXT. Web URL content remains an already-curated content source and must not introduce a crawler.

## File Structure

### Contracts

- Modify `docs/contracts/api/knowledge.md`: add upload, create document from upload, latest job, chunks, reprocess contract.
- Modify `apps/frontend/knowledge/src/types/api.ts`: add `KnowledgeUploadResult`, `CreateDocumentFromUploadRequest`, `CreateDocumentFromUploadResponse`, `DocumentChunksResponse`.
- Modify `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`: expose upload/create/get detail/job/chunks methods.
- Modify `apps/frontend/knowledge/src/api/knowledge-api-client.ts`: implement real request paths.
- Modify `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`: keep mock mode working.

### Backend

- Create `apps/backend/knowledge-server/src/knowledge/storage/oss-storage.provider.ts`: project-owned OSS storage interface and env-backed provider factory.
- Create `apps/backend/knowledge-server/src/knowledge/storage/in-memory-oss-storage.provider.ts`: fake provider for tests/local.
- Create `apps/backend/knowledge-server/src/knowledge/domain/knowledge-upload.types.ts`: upload result and file validation types.
- Create `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`: document/job/chunk domain records.
- Modify `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`: document/job/chunk repository methods.
- Modify `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`: in-memory implementation.
- Modify `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`: persistent implementation and mapping.
- Modify `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`: tables for uploads, documents, jobs, job stages, chunks.
- Create `apps/backend/knowledge-server/src/knowledge/knowledge-upload.service.ts`: multipart validation and OSS upload.
- Create `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`: create document from upload, query documents/jobs/chunks, reprocess.
- Create `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`: parse/chunk/embed/index worker boundary.
- Modify `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`: add core operations endpoints under `/api/knowledge`.
- Modify `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`: wire services/providers.
- Modify `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`: add stable error codes.

### Frontend

- Create `apps/frontend/knowledge/src/hooks/use-knowledge-base-detail.ts`: load base, documents, active jobs.
- Create `apps/frontend/knowledge/src/hooks/use-document-upload.ts`: upload -> create document -> poll job.
- Create `apps/frontend/knowledge/src/hooks/use-document-detail.ts`: load document, latest job, chunks and reprocess.
- Create `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-base-detail-page.tsx`.
- Create `apps/frontend/knowledge/src/pages/documents/document-detail-page.tsx`.
- Create `apps/frontend/knowledge/src/pages/documents/document-upload-panel.tsx`.
- Modify `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`: create modal and row navigation.
- Modify `apps/frontend/knowledge/src/pages/documents/documents-page.tsx`: route to detail where applicable.
- Modify `apps/frontend/knowledge/src/app/App.tsx`: add detail routes.

### Tests

- Create `apps/backend/knowledge-server/test/knowledge/knowledge-upload.controller.spec.ts`.
- Create `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`.
- Modify `apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts`.
- Create `apps/frontend/knowledge/test/knowledge-upload-flow.test.tsx`.
- Create `apps/frontend/knowledge/test/knowledge-document-detail.test.tsx`.
- Modify `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`.

## Task 1: Contract and Frontend API Boundary

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `apps/frontend/knowledge/src/types/api.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Test: `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`

- [x] **Step 1: Add failing API path tests**

Add tests to `apps/frontend/knowledge/test/knowledge-real-api-paths.test.ts`:

```ts
it('uploads a knowledge file through knowledge-server', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        uploadId: 'upload_1',
        knowledgeBaseId: 'kb_1',
        filename: 'runbook.md',
        size: 12,
        contentType: 'text/markdown',
        objectKey: 'knowledge/kb_1/upload_1/runbook.md',
        ossUrl: 'oss://bucket/knowledge/kb_1/upload_1/runbook.md',
        uploadedAt: '2026-05-02T00:00:00.000Z'
      }),
      { status: 200 }
    )
  );
  const client = createKnowledgeApiClient({
    baseUrl: 'http://127.0.0.1:3020/api',
    getAccessToken: () => 'access-token',
    fetchImpl: fetcher
  });

  const file = new File(['hello'], 'runbook.md', { type: 'text/markdown' });
  await client.uploadKnowledgeFile({ knowledgeBaseId: 'kb_1', file });

  expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/bases/kb_1/uploads');
  const [, init] = fetcher.mock.calls[0] ?? [];
  expect(init?.method).toBe('POST');
  expect(init?.body).toBeInstanceOf(FormData);
});

it('creates a document from an upload result', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ document: { id: 'doc_1' }, job: { id: 'job_1' } }), { status: 200 })
    );
  const client = createKnowledgeApiClient({
    baseUrl: 'http://127.0.0.1:3020/api',
    getAccessToken: () => 'access-token',
    fetchImpl: fetcher
  });

  await client.createDocumentFromUpload('kb_1', {
    uploadId: 'upload_1',
    objectKey: 'knowledge/kb_1/upload_1/runbook.md',
    filename: 'runbook.md'
  });

  expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3020/api/knowledge/bases/kb_1/documents');
  expect(fetcher.mock.calls[0]?.[1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        uploadId: 'upload_1',
        objectKey: 'knowledge/kb_1/upload_1/runbook.md',
        filename: 'runbook.md'
      })
    })
  );
});
```

- [x] **Step 2: Run the failing tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths.test.ts
```

Expected: FAIL because `uploadKnowledgeFile()` and `createDocumentFromUpload()` are not defined.

- [x] **Step 3: Extend frontend API types**

In `apps/frontend/knowledge/src/types/api.ts`, add:

```ts
export interface KnowledgeUploadResult {
  uploadId: ID;
  knowledgeBaseId: ID;
  filename: string;
  size: number;
  contentType: 'text/markdown' | 'text/plain';
  objectKey: string;
  ossUrl: string;
  uploadedAt: ISODateTime;
}

export interface UploadKnowledgeFileRequest {
  knowledgeBaseId: ID;
  file: File;
}

export interface CreateDocumentFromUploadRequest {
  uploadId: ID;
  objectKey: string;
  filename: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentFromUploadResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface DocumentChunksResponse {
  items: DocumentChunk[];
  total: number;
}
```

- [x] **Step 4: Extend provider interface**

In `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`, import the new types and add methods:

```ts
uploadKnowledgeFile(input: UploadKnowledgeFileRequest): Promise<KnowledgeUploadResult>;
createDocumentFromUpload(
  knowledgeBaseId: string,
  input: CreateDocumentFromUploadRequest
): Promise<CreateDocumentFromUploadResponse>;
getDocument(documentId: string): Promise<KnowledgeDocument>;
getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob>;
listDocumentChunks(documentId: string): Promise<DocumentChunksResponse>;
```

- [x] **Step 5: Implement real client methods**

In `apps/frontend/knowledge/src/api/knowledge-api-client.ts`, add:

```ts
uploadKnowledgeFile(input: UploadKnowledgeFileRequest) {
  const body = new FormData();
  body.set('file', input.file);
  return this.request<KnowledgeUploadResult>(`/knowledge/bases/${input.knowledgeBaseId}/uploads`, {
    body,
    method: 'POST'
  });
}

createDocumentFromUpload(knowledgeBaseId: string, input: CreateDocumentFromUploadRequest) {
  return this.post<CreateDocumentFromUploadResponse>(`/knowledge/bases/${knowledgeBaseId}/documents`, input);
}

getDocument(documentId: string) {
  return this.get<KnowledgeDocument>(`/knowledge/documents/${documentId}`);
}

getLatestDocumentJob(documentId: string) {
  return this.get<DocumentProcessingJob>(`/knowledge/documents/${documentId}/jobs/latest`);
}

listDocumentChunks(documentId: string) {
  return this.get<DocumentChunksResponse>(`/knowledge/documents/${documentId}/chunks`);
}
```

Also update `listDocuments()` later in Task 4 to accept a base id; do not overload it in this task.

- [x] **Step 6: Implement mock client methods**

In `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`, add deterministic fake responses:

```ts
async uploadKnowledgeFile(input: UploadKnowledgeFileRequest): Promise<KnowledgeUploadResult> {
  return {
    uploadId: 'upload_mock',
    knowledgeBaseId: input.knowledgeBaseId,
    filename: input.file.name,
    size: input.file.size,
    contentType: input.file.name.endsWith('.md') ? 'text/markdown' : 'text/plain',
    objectKey: `knowledge/${input.knowledgeBaseId}/upload_mock/${input.file.name}`,
    ossUrl: `oss://mock-bucket/knowledge/${input.knowledgeBaseId}/upload_mock/${input.file.name}`,
    uploadedAt: new Date().toISOString()
  };
}
```

- [x] **Step 7: Update API contract docs**

In `docs/contracts/api/knowledge.md`, add sections for:

- `POST /knowledge/bases/:baseId/uploads`
- `POST /knowledge/bases/:baseId/documents`
- `GET /knowledge/documents/:documentId`
- `GET /knowledge/documents/:documentId/jobs/latest`
- `GET /knowledge/documents/:documentId/chunks`
- `POST /knowledge/documents/:documentId/reprocess`

Use the DTO names from this task.

- [x] **Step 8: Verify**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-real-api-paths.test.ts
pnpm check:docs
```

Expected: both PASS.

## Task 2: Backend Upload Provider and Endpoint

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/storage/oss-storage.provider.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/storage/in-memory-oss-storage.provider.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-upload.types.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-upload.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-upload.controller.spec.ts`

- [x] **Step 1: Write failing upload controller tests**

Create `apps/backend/knowledge-server/test/knowledge/knowledge-upload.controller.spec.ts` with fake `OssStorageProvider`. The test should post multipart `.md` and expect `uploadId`, `objectKey`, and `ossUrl`.

Core assertion:

```ts
expect(response.body).toMatchObject({
  knowledgeBaseId: 'kb_1',
  filename: 'runbook.md',
  contentType: 'text/markdown',
  objectKey: expect.stringContaining('kb_1'),
  ossUrl: expect.stringContaining('oss://')
});
```

Also add a `.pdf` upload test expecting `400` and code `knowledge_upload_invalid_type`.

- [x] **Step 2: Run failing test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-upload.controller.spec.ts
```

Expected: FAIL because upload endpoint/provider do not exist.

- [x] **Step 3: Add upload types**

Create `apps/backend/knowledge-server/src/knowledge/domain/knowledge-upload.types.ts`:

```ts
export interface KnowledgeUploadResult {
  uploadId: string;
  knowledgeBaseId: string;
  filename: string;
  size: number;
  contentType: 'text/markdown' | 'text/plain';
  objectKey: string;
  ossUrl: string;
  uploadedAt: string;
}

export interface KnowledgeUploadFile {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
}
```

- [x] **Step 4: Add storage provider interface**

Create `apps/backend/knowledge-server/src/knowledge/storage/oss-storage.provider.ts`:

```ts
export interface OssPutObjectInput {
  objectKey: string;
  body: Buffer;
  contentType: string;
}

export interface OssPutObjectResult {
  objectKey: string;
  ossUrl: string;
}

export interface OssStorageProvider {
  putObject(input: OssPutObjectInput): Promise<OssPutObjectResult>;
}

export const OSS_STORAGE_PROVIDER = Symbol('OSS_STORAGE_PROVIDER');
```

Do not import Aliyun SDK in this interface file. Add a later concrete provider only when credentials and dependency are introduced with `pnpm add`.

- [x] **Step 5: Add in-memory provider**

Create `apps/backend/knowledge-server/src/knowledge/storage/in-memory-oss-storage.provider.ts`:

```ts
import type { OssPutObjectInput, OssPutObjectResult, OssStorageProvider } from './oss-storage.provider';

export class InMemoryOssStorageProvider implements OssStorageProvider {
  readonly objects = new Map<string, OssPutObjectInput>();

  async putObject(input: OssPutObjectInput): Promise<OssPutObjectResult> {
    this.objects.set(input.objectKey, input);
    return {
      objectKey: input.objectKey,
      ossUrl: `oss://local-dev/${input.objectKey}`
    };
  }
}
```

- [x] **Step 6: Implement upload service**

Create `apps/backend/knowledge-server/src/knowledge/knowledge-upload.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { KnowledgeServiceError } from './knowledge.errors';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { OssStorageProvider } from './storage/oss-storage.provider';
import type { KnowledgeUploadFile, KnowledgeUploadResult } from './domain/knowledge-upload.types';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export class KnowledgeUploadService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly storage: OssStorageProvider
  ) {}

  async uploadFile(
    actor: { userId: string },
    knowledgeBaseId: string,
    file: KnowledgeUploadFile
  ): Promise<KnowledgeUploadResult> {
    const member = await this.repository.findMember(knowledgeBaseId, actor.userId);
    if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
      throw new KnowledgeServiceError('knowledge_upload_permission_denied', '无权上传到该知识库');
    }
    const contentType = resolveContentType(file.originalname, file.mimetype);
    if (!contentType) {
      throw new KnowledgeServiceError('knowledge_upload_invalid_type', '仅支持 Markdown 和 TXT 文档');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new KnowledgeServiceError('knowledge_upload_too_large', '文件超过 2MB 限制');
    }
    const uploadId = `upload_${randomUUID()}`;
    const objectKey = `knowledge/${knowledgeBaseId}/${uploadId}/${sanitizeFilename(file.originalname)}`;
    const uploaded = await this.storage.putObject({ objectKey, body: file.buffer, contentType });
    return {
      uploadId,
      knowledgeBaseId,
      filename: file.originalname,
      size: file.size,
      contentType,
      objectKey: uploaded.objectKey,
      ossUrl: uploaded.ossUrl,
      uploadedAt: new Date().toISOString()
    };
  }
}

function resolveContentType(filename: string, mimetype?: string): 'text/markdown' | 'text/plain' | undefined {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith('.md') || normalized.endsWith('.markdown')) return 'text/markdown';
  if (normalized.endsWith('.txt')) return 'text/plain';
  if (mimetype === 'text/markdown' || mimetype === 'text/plain') return mimetype;
  return undefined;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
```

- [x] **Step 7: Add controller endpoint**

In `KnowledgeController`, add `@Post('bases/:baseId/uploads')` with Nest file interceptor. Use memory storage and pass `file.buffer` to `KnowledgeUploadService.uploadFile()`.

- [x] **Step 8: Wire module**

In `KnowledgeModule`, provide `OSS_STORAGE_PROVIDER` as `InMemoryOssStorageProvider` first. Later production Aliyun provider can replace this in a focused follow-up.

- [x] **Step 9: Verify**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-upload.controller.spec.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 3: Document, Job, and Chunk Repository

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-memory.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/repositories/knowledge-postgres.repository.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts`

- [x] **Step 1: Add failing repository tests**

Add tests that assert:

- `createDocument()` persists a document with `status: 'queued'`.
- `createProcessingJob()` persists job with stages.
- `appendJobStage()` preserves stage order.
- `upsertChunks()` stores chunks by document.
- `listDocuments(baseId)` and `listChunks(documentId)` return stable order.

- [x] **Step 2: Run failing repository tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts
```

Expected: FAIL because methods do not exist.

- [x] **Step 3: Add domain record types**

Create `knowledge-document.types.ts` with:

```ts
export type KnowledgeDocumentStatus = 'queued' | 'running' | 'ready' | 'failed' | 'disabled';
export type DocumentProcessingStage =
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'commit';
export type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface KnowledgeDocumentRecord {
  id: string;
  knowledgeBaseId: string;
  title: string;
  filename: string;
  sourceType: 'user-upload';
  objectKey: string;
  ossUrl: string;
  status: KnowledgeDocumentStatus;
  version: string;
  chunkCount: number;
  embeddedChunkCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  latestJobId?: string;
  latestError?: { code: string; message: string; stage?: DocumentProcessingStage };
}

export interface DocumentProcessingJobRecord {
  id: string;
  documentId: string;
  status: ProcessingJobStatus;
  currentStage?: DocumentProcessingStage;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: { code: string; message: string; stage?: DocumentProcessingStage };
}

export interface DocumentProcessingStageRecord {
  jobId: string;
  stage: DocumentProcessingStage;
  status: ProcessingJobStatus;
  startedAt?: string;
  completedAt?: string;
  error?: { code: string; message: string; stage?: DocumentProcessingStage };
}

export interface KnowledgeChunkRecord {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  chunkIndex: number;
  content: string;
  status: 'ready' | 'failed';
  embeddingStatus: 'missing' | 'ready' | 'failed';
  vectorIndexed: boolean;
  keywordIndexed: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [x] **Step 4: Extend repository interface**

Add methods:

```ts
createDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord>;
listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocumentRecord[]>;
findDocument(documentId: string): Promise<KnowledgeDocumentRecord | undefined>;
updateDocument(input: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord>;
createProcessingJob(input: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord>;
findLatestJob(documentId: string): Promise<DocumentProcessingJobRecord | undefined>;
appendJobStage(input: DocumentProcessingStageRecord): Promise<DocumentProcessingStageRecord>;
listJobStages(jobId: string): Promise<DocumentProcessingStageRecord[]>;
upsertChunks(chunks: KnowledgeChunkRecord[]): Promise<void>;
listChunks(documentId: string): Promise<KnowledgeChunkRecord[]>;
```

- [x] **Step 5: Implement in-memory repository**

Use `Map` fields for documents, jobs, stages, and chunks. Sort documents/chunks by `createdAt` then `chunkIndex` where appropriate.

- [x] **Step 6: Implement Postgres schema and mapper**

Add tables:

- `knowledge_uploads`
- `knowledge_documents`
- `knowledge_processing_jobs`
- `knowledge_processing_job_stages`
- `knowledge_document_chunks`

Use primary keys and `(knowledge_base_id, updated_at desc)` indexes. Store `latest_error` and `metadata` as JSONB.

- [x] **Step 7: Verify**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-postgres.repository.spec.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 4: Create Document From Upload and Query Endpoints

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`

- [x] **Step 1: Add failing service/controller tests**

Test:

- `POST /knowledge/bases/:baseId/documents` creates document and queued job from upload result.
- `GET /knowledge/bases/:baseId/documents` lists documents.
- `GET /knowledge/documents/:documentId/jobs/latest` returns latest job.
- `GET /knowledge/documents/:documentId/chunks` returns chunks.
- Unauthorized user gets `knowledge_permission_denied`.

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
```

Expected: FAIL because endpoints do not exist.

- [x] **Step 3: Implement document service**

Create methods:

```ts
createDocumentFromUpload(actor, baseId, input): Promise<{ document; job }>;
listDocuments(actor, baseId): Promise<{ items; total; page; pageSize }>;
getDocument(actor, documentId): Promise<KnowledgeDocumentRecord>;
getLatestJob(actor, documentId): Promise<DocumentProcessingJobRecord & { stages: DocumentProcessingStageRecord[] }>;
listChunks(actor, documentId): Promise<{ items: KnowledgeChunkRecord[]; total: number }>;
reprocessDocument(actor, documentId): Promise<{ document; job }>;
```

The first implementation may enqueue by calling an injected runner function directly after persistence; do not process inside the upload endpoint.

- [x] **Step 4: Implement controller endpoints**

Add endpoint methods with body validation. Use small local Zod schemas in `knowledge-document.service.ts` or a dedicated schema file if validation grows beyond 80 lines.

- [x] **Step 5: Verify**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 5: Ingestion Worker for Markdown/TXT

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/providers/knowledge-embedding.provider.ts`
- Create: `apps/backend/knowledge-server/src/knowledge/providers/knowledge-index.provider.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`

- [x] **Step 1: Add failing worker tests**

Add a test that seeds:

- document with objectKey
- fake OSS object body with Markdown text
- fake embedding provider returning vectors
- fake index provider recording vector and keyword writes

Expected after worker run:

- job status `succeeded`
- document status `ready`
- chunk count greater than 0
- every chunk has `embeddingStatus: 'ready'`
- vector and keyword index providers called

- [x] **Step 2: Run failing worker tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
```

Expected: FAIL because worker/providers do not exist.

- [x] **Step 3: Define provider boundaries**

Create interfaces:

```ts
export interface KnowledgeEmbeddingProvider {
  embedBatch(input: { texts: string[] }): Promise<Array<{ embedding: number[] }>>;
}

export interface KnowledgeIndexProvider {
  upsertVector(input: {
    chunkId: string;
    embedding: number[];
    content: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  upsertKeyword(input: { chunkId: string; content: string; metadata: Record<string, unknown> }): Promise<void>;
}
```

Use fake providers by default in tests/local. Production provider wiring can be a follow-up if credentials are not yet available.

- [x] **Step 4: Implement worker**

Worker stages:

1. load object from storage provider
2. parse text from buffer
3. normalize whitespace
4. chunk with `FixedWindowChunker` or existing `runKnowledgeIndexing` helpers where practical
5. embed chunks
6. write vector index
7. write keyword index
8. commit document ready

On any failure, update job/document failed state with a stable code and stage.

- [x] **Step 5: Verify**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

## Task 6: Frontend Detail Pages, Upload Panel, and Polling

**Files:**

- Create: `apps/frontend/knowledge/src/hooks/use-knowledge-base-detail.ts`
- Create: `apps/frontend/knowledge/src/hooks/use-document-upload.ts`
- Create: `apps/frontend/knowledge/src/hooks/use-document-detail.ts`
- Create: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-base-detail-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/documents/document-detail-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/documents/document-upload-panel.tsx`
- Modify: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`
- Modify: `apps/frontend/knowledge/src/app/App.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-upload-flow.test.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-document-detail.test.tsx`

- [x] **Step 1: Add failing frontend upload flow tests**

Test:

- knowledge base detail renders upload panel.
- selecting `.pdf` shows invalid type error and does not call API.
- selecting `.md` calls `uploadKnowledgeFile`, then `createDocumentFromUpload`.
- queued job polls until succeeded.

- [x] **Step 2: Add failing document detail tests**

Test:

- document detail loads document, latest job, and chunks.
- failed job shows error code and reprocess button.
- clicking reprocess calls API and restarts polling.

- [x] **Step 3: Run failing frontend tests**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-upload-flow.test.tsx knowledge-document-detail.test.tsx
```

Expected: FAIL because pages/hooks do not exist.

- [x] **Step 4: Implement hooks**

`useDocumentUpload` should expose:

```ts
{
  uploadStatus,
  ingestionStatus,
  uploadResult,
  document,
  job,
  error,
  upload(file: File): Promise<void>,
  retryCreateDocument(): Promise<void>
}
```

It must keep `uploadResult` after document creation failure.

`useDocumentDetail` should poll only while latest job status is `queued` or `running`.

- [x] **Step 5: Implement pages/components**

Use Ant Design components already used in the app. Keep text compact and workbench-like. Add stable dimensions for upload buttons/tables so loading states do not shift layout.

- [x] **Step 6: Wire routes**

In `App.tsx`, add:

```tsx
<Route element={<KnowledgeBaseDetailPage />} path="knowledge-bases/:id" />
<Route element={<DocumentDetailPage />} path="documents/:id" />
```

- [x] **Step 7: Verify**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- knowledge-upload-flow.test.tsx knowledge-document-detail.test.tsx
pnpm --dir apps/frontend/knowledge typecheck
```

Expected: PASS.

## Task 7: Final Verification and Docs

**Files:**

- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Modify: `docs/packages/knowledge/README.md` if package boundaries changed.

- [x] **Step 1: Update docs**

Document:

- OSS upload is backend-proxy only.
- Frontend never receives credentials.
- Markdown/TXT only.
- Upload result and document ingestion are separate steps.
- Web crawling remains out of scope.

- [x] **Step 2: Run affected verification**

Run:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
pnpm exec vitest run --config vitest.config.js apps/backend/knowledge-server/test/knowledge
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm check:docs
```

Expected: PASS. If unrelated existing generated artifacts under `packages/core/src` block commit hooks, report them as existing blocker and do not bypass hooks.

## Self-Review Notes

- Spec coverage: upload to OSS, document creation, async job, parse/chunk/embed/index, frontend detail pages, polling, retry, permission, and no crawler are covered.
- Placeholder scan: no task relies on unresolved marker text.
- Type consistency: DTO names match the design spec: `KnowledgeUploadResult`, `CreateDocumentFromUploadRequest`, `CreateDocumentFromUploadResponse`, `DocumentProcessingJob`, `DocumentChunk`.
- Scope: this is large but still one coherent core operations loop; Chat Lab, trace drilldown, and eval are explicitly excluded.
