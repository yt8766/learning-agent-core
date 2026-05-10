# Knowledge RAG Next Steps Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`apps/knowledge-cli`
最后核对：2026-05-09

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Knowledge SDK and Knowledge App into a stronger enterprise RAG platform by SDK-ifying backend ingestion, adding SDK-level observability, hardening ingestion jobs, and extending provider/debug capabilities.

**Architecture:** Keep stable contracts in `packages/knowledge`, keep production orchestration in `apps/backend/agent-server/src/domains/knowledge`, and keep developer tooling in `apps/knowledge-cli`. Each track below is independently shippable; execute Track A first because it closes the biggest credibility gap in the ingestion chain.

**Tech Stack:** TypeScript, NestJS, Vitest, zod, `@agent/knowledge`, PostgreSQL/Supabase pgvector adapter, existing pnpm workspace scripts.

---

## Scope Check

This plan intentionally covers multiple independent follow-up subsystems. Do not implement the whole document as one giant patch. Execute the tracks in order, and treat each track as a separately reviewable development slice:

1. Track A: Backend ingestion uses the Knowledge SDK indexing pipeline.
2. Track B: SDK-level observability facade and JSONL/memory exporters.
3. Track C: Repository-backed ingestion queue with retry and recovery.
4. Track D: Provider presets and real-provider CLI configuration.
5. Track E: Trace alignment, eval SDK abstraction, and retrieval debug surfaces.

Track A is the next recommended implementation target.

## File Structure

Create or modify these files as the plan progresses:

- Modify `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`
  Responsibility: orchestrate backend ingestion using `@agent/knowledge` indexing output rather than local paragraph splitting.
- Create `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion-sdk.mapper.ts`
  Responsibility: map SDK `KnowledgeChunk` / `KnowledgeSource` records into backend `DocumentChunkRecord` and vector upsert payloads.
- Modify `apps/backend/agent-server/src/domains/knowledge/runtime/knowledge-sdk-runtime.provider.ts`
  Responsibility: expose enough runtime capability to embedding/vector upsert during ingestion.
- Modify `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.tokens.ts` and `knowledge-domain.module.ts` only if a new ingestion runtime token is needed.
- Create `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`
  Responsibility: regression tests proving upload ingestion calls the SDK indexing pipeline and writes chunk/vector state.
- Create `packages/knowledge/src/observability/*`
  Responsibility: SDK observer contracts, event schema, memory exporter, JSONL exporter.
- Modify `packages/knowledge/src/index.ts`
  Responsibility: export only stable observability contracts and factories.
- Create `packages/knowledge/test/knowledge-observer.test.ts`
  Responsibility: unit tests for SDK observer event emission/export.
- Modify `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.queue.ts`
  Responsibility: replace process-memory-only queue semantics with repository-backed pending job drain.
- Modify `apps/backend/agent-server/src/domains/knowledge/repositories/knowledge.repository.ts` and `knowledge-postgres.repository.ts`
  Responsibility: list pending jobs, claim jobs, record retry/failure metadata.
- Create `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-queue-recovery.spec.ts`
  Responsibility: prove queued jobs survive queue restart and retry safely.
- Modify `packages/knowledge/src/node/knowledge-sdk-runtime.ts`
  Responsibility: add default provider presets for MiniMax, GLM, DeepSeek, and OpenAI-compatible.
- Create `packages/knowledge/test/sdk-provider-presets.test.ts`
  Responsibility: parse/default-provider tests.
- Modify `apps/knowledge-cli/src/*` and create `apps/knowledge-cli/src/config.ts`
  Responsibility: optional real-provider config file support.
- Create `apps/knowledge-cli/test/knowledge-cli-config.test.ts`
  Responsibility: CLI config parse and real-provider wiring tests without network calls.
- Modify `docs/sdk/knowledge.md`, `docs/apps/knowledge-cli/knowledge-cli.md`, and `docs/integration/knowledge-sdk-rag-rollout.md` after each shipped track.

## Track A: Backend Ingestion Uses SDK Indexing Pipeline

### Task A1: Write the failing backend ingestion SDK test

**Files:**

- Create: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`
- Read first: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`
- Read first: `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeIngestionWorker } from '../../src/domains/knowledge/services/knowledge-ingestion.worker';

describe('KnowledgeIngestionWorker SDK pipeline', () => {
  it('indexes uploaded content through the Knowledge SDK pipeline and stores generated chunks', async () => {
    const now = '2026-05-09T00:00:00.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const document = {
      id: 'doc_sdk_ingestion',
      workspaceId: 'workspace-1',
      knowledgeBaseId: 'kb-1',
      objectKey: 'uploads/doc.md',
      filename: 'doc.md',
      title: 'SDK Ingestion',
      sourceType: 'user-upload',
      status: 'queued',
      version: 'v1',
      chunkCount: 0,
      embeddedChunkCount: 0,
      createdBy: 'user-1',
      metadata: { tags: ['sdk'] },
      createdAt: now,
      updatedAt: now
    };
    const job = {
      id: 'job_sdk_ingestion',
      documentId: document.id,
      status: 'queued',
      stage: 'uploaded',
      currentStage: 'queued',
      stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
      progress: { percent: 0 },
      attempts: 1,
      createdAt: now,
      updatedAt: now
    };
    const repository = {
      findDocument: vi.fn().mockResolvedValue(document),
      saveChunks: vi.fn().mockResolvedValue(undefined),
      updateDocument: vi.fn().mockImplementation(input => Promise.resolve(input)),
      updateJob: vi.fn().mockImplementation(input => Promise.resolve(input))
    };
    const storage = {
      getObject: vi.fn().mockResolvedValue({
        body: Buffer.from('# SDK Ingestion\n\nThe ingestion worker should call the SDK indexing pipeline.')
      })
    };
    const runtime = {
      enabled: true,
      runtime: {
        embeddingProvider: {
          embedBatch: vi.fn().mockResolvedValue({
            embeddings: [
              { text: 'The ingestion worker should call the SDK indexing pipeline.', embedding: [0.1, 0.2, 0.3] }
            ],
            model: 'test-embedding'
          })
        },
        vectorStore: {
          upsert: vi.fn().mockResolvedValue({ upsertedCount: 1 })
        }
      }
    };

    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(job as never);

    expect(result.status).toBe('succeeded');
    expect(repository.saveChunks).toHaveBeenCalledWith(
      document.id,
      expect.arrayContaining([
        expect.objectContaining({
          documentId: document.id,
          content: expect.stringContaining('SDK indexing pipeline'),
          embeddingStatus: 'succeeded',
          vectorIndexStatus: 'succeeded'
        })
      ])
    );
    expect(runtime.runtime.embeddingProvider.embedBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        texts: expect.arrayContaining([expect.stringContaining('SDK indexing pipeline')])
      })
    );
    expect(runtime.runtime.vectorStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        records: expect.arrayContaining([
          expect.objectContaining({
            documentId: document.id,
            content: expect.stringContaining('SDK indexing pipeline')
          })
        ])
      })
    );

    vi.useRealTimers();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: FAIL because `KnowledgeIngestionWorker` currently accepts only repository/storage and does not call SDK embedding/vector upsert.

### Task A2: Add SDK ingestion mapping helpers

**Files:**

- Create: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion-sdk.mapper.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`

- [x] **Step 1: Add the mapper**

```ts
import { randomUUID } from 'node:crypto';

import type { KnowledgeChunk } from '@agent/knowledge';

import type { DocumentChunkRecord, KnowledgeDocumentRecord } from '../domain/knowledge-document.types';

export function mapSdkChunkToDocumentChunk(input: {
  document: KnowledgeDocumentRecord;
  chunk: KnowledgeChunk;
  now: string;
}): DocumentChunkRecord {
  return {
    id: input.chunk.id || `chunk_${randomUUID()}`,
    documentId: input.document.id,
    ordinal: input.chunk.chunkIndex,
    content: input.chunk.content,
    tokenCount: countTokens(input.chunk.content),
    embeddingStatus: 'pending',
    vectorIndexStatus: 'pending',
    keywordIndexStatus: 'succeeded',
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function countTokens(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}
```

- [x] **Step 2: Run targeted test**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: still FAIL until the worker uses this mapper.

### Task A3: Inject SDK runtime into the ingestion worker

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts`
- Read: `apps/backend/agent-server/src/domains/knowledge/runtime/knowledge-sdk-runtime.provider.ts`

- [x] **Step 1: Update constructor signature**

```ts
constructor(
  @Inject(KNOWLEDGE_REPOSITORY) private readonly repository: KnowledgeRepository,
  @Inject(KNOWLEDGE_OSS_STORAGE) private readonly storage: OssStorageProvider,
  @Inject(KNOWLEDGE_SDK_RUNTIME) private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue
) {}
```

If this creates a circular provider issue, introduce a smaller token named `KNOWLEDGE_INGESTION_RUNTIME` in `knowledge-domain.tokens.ts` and bind it to the same provider value in `knowledge-domain.module.ts`.

- [x] **Step 2: Run TypeScript to verify constructor wiring errors**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: FAIL only if imports/tokens are not wired yet.

### Task A4: Replace paragraph splitting with SDK indexing output

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`
- Use: `runKnowledgeIndexing` from `@agent/knowledge`
- Use: `mapSdkChunkToDocumentChunk` from `knowledge-ingestion-sdk.mapper.ts`

- [x] **Step 1: Replace `splitIntoChunks()` flow**

```ts
const now = new Date().toISOString();
const sdkChunks: KnowledgeChunk[] = [];

await runKnowledgeIndexing({
  loader: {
    load: async () => [
      {
        id: document.id,
        content: object.body.toString('utf8'),
        metadata: {
          sourceId: document.id,
          documentId: document.id,
          title: document.title,
          uri: document.objectKey,
          sourceType: document.sourceType,
          trustClass: 'internal',
          knowledgeBaseId: document.knowledgeBaseId
        }
      }
    ]
  },
  vectorIndex: { upsertKnowledge: async () => undefined },
  fulltextIndex: {
    upsertKnowledgeChunk: async chunk => {
      sdkChunks.push(chunk);
    }
  },
  sourceConfig: {
    sourceId: document.id,
    sourceType: document.sourceType,
    trustClass: 'internal'
  }
});

const chunks = sdkChunks.map(chunk => mapSdkChunkToDocumentChunk({ document, chunk, now }));
```

- [x] **Step 2: Keep status/progress updates unchanged**

Use the existing `repository.saveChunks()`, `repository.updateDocument()`, and `repository.updateJob()` calls. Do not rewrite job stage names in this step.

- [x] **Step 3: Run targeted test**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: FAIL because embedding/vector upsert has not been connected yet.

### Task A5: Add embedding and vector upsert inside ingestion

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`

- [x] **Step 1: Embed chunks when SDK runtime is enabled**

```ts
const embeddingResults = this.sdkRuntime.enabled
  ? await this.sdkRuntime.runtime.embeddingProvider.embedBatch({
      texts: chunks.map(chunk => chunk.content),
      metadata: { documentId: document.id, knowledgeBaseId: document.knowledgeBaseId }
    })
  : undefined;
```

- [x] **Step 2: Upsert vectors when embeddings exist**

```ts
if (this.sdkRuntime.enabled && embeddingResults) {
  await this.sdkRuntime.runtime.vectorStore.upsert({
    records: chunks.map((chunk, index) => ({
      id: chunk.id,
      documentId: document.id,
      chunkId: chunk.id,
      content: chunk.content,
      embedding: embeddingResults.embeddings[index]?.embedding ?? [],
      metadata: {
        tenantId: document.workspaceId,
        knowledgeBaseId: document.knowledgeBaseId,
        documentId: document.id,
        title: document.title,
        filename: document.filename,
        ordinal: chunk.ordinal
      }
    }))
  });
}
```

- [x] **Step 3: Mark chunk statuses after successful vector upsert**

```ts
const persistedChunks = chunks.map(chunk => ({
  ...chunk,
  embeddingStatus: this.sdkRuntime.enabled ? 'succeeded' : 'skipped',
  vectorIndexStatus: this.sdkRuntime.enabled ? 'succeeded' : 'skipped',
  updatedAt: now
}));
```

- [x] **Step 4: Run targeted test**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: PASS.

### Task A6: Add disabled-runtime fallback test

**Files:**

- Modify: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`

- [x] **Step 1: Add test**

```ts
it('still stores searchable chunks when SDK runtime is disabled', async () => {
  const repository = createKnowledgeIngestionRepositoryFixture();
  const storage = createKnowledgeIngestionStorageFixture('Fallback content for local deterministic search.');
  const runtime = { enabled: false };
  const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

  const result = await worker.process(createKnowledgeIngestionJobFixture());

  expect(result.status).toBe('succeeded');
  expect(repository.saveChunks).toHaveBeenCalledWith(
    'doc_sdk_ingestion',
    expect.arrayContaining([
      expect.objectContaining({
        content: expect.stringContaining('Fallback content'),
        embeddingStatus: 'skipped',
        vectorIndexStatus: 'skipped',
        keywordIndexStatus: 'succeeded'
      })
    ])
  );
});
```

- [x] **Step 2: Extract fixture helpers in the test file**

```ts
function createKnowledgeIngestionJobFixture() {
  return {
    id: 'job_sdk_ingestion',
    documentId: 'doc_sdk_ingestion',
    status: 'queued',
    stage: 'uploaded',
    currentStage: 'queued',
    stages: [{ stage: 'queued', status: 'queued', startedAt: '2026-05-09T00:00:00.000Z' }],
    progress: { percent: 0 },
    attempts: 1,
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z'
  };
}
```

- [x] **Step 3: Run targeted tests**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: PASS.

### Task A7: Verify Track A and update docs

**Files:**

- Modify: `docs/apps/backend/agent-server/knowledge.md`
- Modify: `docs/integration/knowledge-sdk-rag-rollout.md`
- Modify: `docs/sdk/knowledge.md`

- [x] **Step 1: Document current ingestion path**

Add this sentence to `docs/apps/backend/agent-server/knowledge.md` under the ingestion section:

```md
文档入库由 `KnowledgeIngestionWorker` 调用 `@agent/knowledge` indexing pipeline 生成 chunk；当 `KNOWLEDGE_SDK_RUNTIME.enabled=true` 时继续调用 SDK embedding provider 与 vector store upsert，disabled 时只保留 keyword-searchable chunk fallback。
```

- [x] **Step 2: Run verification**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```

Expected: all PASS.

- [ ] **Step 3: Commit Track A**

```bash
git add apps/backend/agent-server/src/domains/knowledge apps/backend/agent-server/test/knowledge-domain docs/apps/backend/agent-server/knowledge.md docs/integration/knowledge-sdk-rag-rollout.md docs/sdk/knowledge.md
git commit -m "feat: route knowledge ingestion through sdk pipeline"
```

Do not use `--no-verify`. If hooks fail, fix the failure or record the blocker.

## Track B: SDK-Level Observability Facade

### Task B1: Add observer contract and schema

**Files:**

- Create: `packages/knowledge/src/observability/knowledge-observer.schema.ts`
- Create: `packages/knowledge/src/observability/knowledge-observer.ts`
- Modify: `packages/knowledge/src/index.ts`
- Test: `packages/knowledge/test/knowledge-observer.test.ts`

- [ ] **Step 1: Write failing schema test**

```ts
import { describe, expect, it } from 'vitest';

import { KnowledgeSdkTraceEventSchema } from '../src/observability/knowledge-observer.schema';

describe('Knowledge SDK observer schema', () => {
  it('parses a retrieval completed event with safe diagnostics', () => {
    const event = KnowledgeSdkTraceEventSchema.parse({
      traceId: 'trace-1',
      runId: 'run-1',
      stage: 'retrieval',
      type: 'completed',
      timestamp: '2026-05-09T00:00:00.000Z',
      durationMs: 12,
      attributes: { hitCount: 3, retrievalMode: 'hybrid' }
    });

    expect(event.stage).toBe('retrieval');
    expect(event.attributes.hitCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge test -- knowledge-observer.test.ts
```

Expected: FAIL because observability schema does not exist.

- [ ] **Step 3: Implement schema**

```ts
import { z } from 'zod';

export const KnowledgeSdkTraceStageSchema = z.enum([
  'indexing',
  'planning',
  'retrieval',
  'post-retrieval',
  'answer',
  'error'
]);

export const KnowledgeSdkTraceEventSchema = z
  .object({
    traceId: z.string().min(1),
    runId: z.string().min(1).optional(),
    stage: KnowledgeSdkTraceStageSchema,
    type: z.enum(['started', 'completed', 'failed']),
    timestamp: z.string().min(1),
    durationMs: z.number().int().nonnegative().optional(),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
  })
  .strict();

export type KnowledgeSdkTraceEvent = z.infer<typeof KnowledgeSdkTraceEventSchema>;
```

- [ ] **Step 4: Implement observer interface**

```ts
import type { KnowledgeSdkTraceEvent } from './knowledge-observer.schema';

export interface KnowledgeSdkObserver {
  record(event: KnowledgeSdkTraceEvent): void | Promise<void>;
}

export class NoopKnowledgeSdkObserver implements KnowledgeSdkObserver {
  record(): void {}
}
```

- [ ] **Step 5: Export from root**

```ts
export * from './observability/knowledge-observer';
export * from './observability/knowledge-observer.schema';
```

- [ ] **Step 6: Run test**

Run:

```bash
pnpm --dir packages/knowledge test -- knowledge-observer.test.ts
```

Expected: PASS.

### Task B2: Add memory and JSONL exporters

**Files:**

- Create: `packages/knowledge/src/observability/memory-knowledge-observer.ts`
- Create: `packages/knowledge/src/observability/jsonl-knowledge-observer.ts`
- Modify: `packages/knowledge/test/knowledge-observer.test.ts`

- [ ] **Step 1: Add failing exporter tests**

```ts
it('stores events in memory for tests and debug tools', async () => {
  const observer = new MemoryKnowledgeSdkObserver();
  await observer.record(createTraceEvent('retrieval'));
  expect(observer.getEvents()).toHaveLength(1);
});
```

```ts
it('writes JSONL trace events', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowledge-observer-'));
  const file = join(dir, 'trace.jsonl');
  const observer = new JsonlKnowledgeSdkObserver(file);
  await observer.record(createTraceEvent('answer'));
  expect(await readFile(file, 'utf8')).toContain('"stage":"answer"');
});
```

- [ ] **Step 2: Implement memory observer**

```ts
export class MemoryKnowledgeSdkObserver implements KnowledgeSdkObserver {
  private readonly events: KnowledgeSdkTraceEvent[] = [];

  record(event: KnowledgeSdkTraceEvent): void {
    this.events.push(KnowledgeSdkTraceEventSchema.parse(event));
  }

  getEvents(): KnowledgeSdkTraceEvent[] {
    return [...this.events];
  }
}
```

- [ ] **Step 3: Implement JSONL observer using `fs-extra` only if already available in package dependencies**

If `packages/knowledge` does not depend on `fs-extra`, use `node:fs/promises` only for this Node-only exporter and keep it out of browser entrypoints:

```ts
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonlKnowledgeSdkObserver implements KnowledgeSdkObserver {
  constructor(private readonly filePath: string) {}

  async record(event: KnowledgeSdkTraceEvent): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(KnowledgeSdkTraceEventSchema.parse(event))}\n`);
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir packages/knowledge test -- knowledge-observer.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

## Track C: Repository-Backed Ingestion Queue

### Task C1: Add repository queue contract

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/repositories/knowledge.repository.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/repositories/knowledge-memory.repository.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/repositories/knowledge-postgres.repository.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-queue-recovery.spec.ts`

- [ ] **Step 1: Write failing recovery test**

```ts
it('drains queued jobs from the repository after queue restart', async () => {
  const repository = createRepositoryWithQueuedJob('job-restart-1');
  const worker = { process: vi.fn().mockResolvedValue({ id: 'job-restart-1', status: 'succeeded' }) };
  const queue = new KnowledgeIngestionQueue(worker as never, repository as never);

  queue.start();
  await queue.waitForIdle();

  expect(repository.claimNextQueuedJob).toHaveBeenCalled();
  expect(worker.process).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-restart-1' }));
});
```

- [ ] **Step 2: Add repository methods**

```ts
claimNextQueuedJob(now: string): Promise<DocumentProcessingJobRecord | null>;
markJobFailed(input: { jobId: string; error: string; retryable: boolean; now: string }): Promise<void>;
```

- [ ] **Step 3: Implement memory repository behavior**

```ts
async claimNextQueuedJob(now: string): Promise<DocumentProcessingJobRecord | null> {
  const job = this.jobs.find(item => item.status === 'queued');
  if (!job) return null;
  const running = { ...job, status: 'running', currentStage: 'running', updatedAt: now };
  this.jobs.set(job.id, running);
  return running;
}
```

- [ ] **Step 4: Implement Postgres query**

Use `FOR UPDATE SKIP LOCKED` in `knowledge-postgres.repository.ts`:

```sql
SELECT * FROM knowledge_document_processing_jobs
WHERE status = 'queued'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

- [ ] **Step 5: Run queue recovery test**

Run:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-queue-recovery.spec.ts
```

Expected: PASS.

## Track D: Provider Presets And Real-Provider CLI Config

### Task D1: Add default runtime provider preset tests

**Files:**

- Modify: `packages/knowledge/src/node/knowledge-sdk-runtime.ts`
- Create: `packages/knowledge/test/sdk-provider-presets.test.ts`

- [ ] **Step 1: Write failing preset test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeDefaultProviderPreset } from '../src/node/knowledge-sdk-runtime';

describe('Knowledge SDK provider presets', () => {
  it('resolves minimax chat and embedding providers', () => {
    expect(resolveKnowledgeDefaultProviderPreset('minimax')).toEqual({
      chatProvider: 'minimax',
      embeddingProvider: 'minimax'
    });
  });
});
```

- [ ] **Step 2: Implement preset resolver**

```ts
export type KnowledgeDefaultProviderPreset = 'openai-compatible' | 'minimax' | 'glm' | 'deepseek';

export function resolveKnowledgeDefaultProviderPreset(preset: KnowledgeDefaultProviderPreset) {
  switch (preset) {
    case 'minimax':
      return { chatProvider: 'minimax', embeddingProvider: 'minimax' };
    case 'glm':
      return { chatProvider: 'glm', embeddingProvider: 'glm' };
    case 'deepseek':
      return { chatProvider: 'deepseek', embeddingProvider: 'openai-compatible' };
    case 'openai-compatible':
      return { chatProvider: 'openai-compatible', embeddingProvider: 'openai-compatible' };
  }
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --dir packages/knowledge test -- sdk-provider-presets.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

### Task D2: Add CLI config parser

**Files:**

- Create: `apps/knowledge-cli/src/config.ts`
- Create: `apps/knowledge-cli/test/knowledge-cli-config.test.ts`
- Modify: `apps/knowledge-cli/README.md`

- [ ] **Step 1: Write failing config test**

```ts
it('parses provider config without exposing secrets in output', async () => {
  const config = parseKnowledgeCliConfig({
    provider: 'openai-compatible',
    chatModel: 'gpt-test',
    embeddingModel: 'embedding-test',
    apiKey: 'secret-key',
    baseURL: 'https://example.test/v1'
  });

  expect(config.provider).toBe('openai-compatible');
  expect(redactKnowledgeCliConfig(config)).not.toContain('secret-key');
});
```

- [ ] **Step 2: Implement schema-first parser**

```ts
import { z } from 'zod';

export const KnowledgeCliConfigSchema = z
  .object({
    provider: z.enum(['openai-compatible', 'minimax', 'glm', 'deepseek']),
    chatModel: z.string().min(1),
    embeddingModel: z.string().min(1),
    apiKey: z.string().min(1).optional(),
    baseURL: z.string().url().optional()
  })
  .strict();

export type KnowledgeCliConfig = z.infer<typeof KnowledgeCliConfigSchema>;

export function parseKnowledgeCliConfig(value: unknown): KnowledgeCliConfig {
  return KnowledgeCliConfigSchema.parse(value);
}

export function redactKnowledgeCliConfig(config: KnowledgeCliConfig): string {
  return JSON.stringify({ ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined });
}
```

- [ ] **Step 3: Run CLI tests**

Run:

```bash
pnpm --dir apps/knowledge-cli test
pnpm --dir apps/knowledge-cli typecheck
```

Expected: PASS.

## Track E: Trace Alignment, Eval SDK, Retrieval Debug UI

Track E should be split into separate detailed plans before implementation. Use these plan names:

- `docs/superpowers/plans/YYYY-MM-DD-knowledge-trace-alignment.md`
- `docs/superpowers/plans/YYYY-MM-DD-knowledge-eval-sdk.md`
- `docs/superpowers/plans/YYYY-MM-DD-knowledge-retrieval-debug-ui.md`

Each plan must start with failing tests and must update the canonical docs that describe the affected behavior.

## Final Verification Matrix

Run the smallest relevant verification after each track:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-sdk-pipeline.spec.ts
pnpm --dir apps/backend/agent-server test -- knowledge-ingestion-queue-recovery.spec.ts
pnpm --dir packages/knowledge test -- knowledge-observer.test.ts
pnpm --dir packages/knowledge test -- sdk-provider-presets.test.ts
pnpm --dir apps/knowledge-cli test
pnpm --dir apps/knowledge-cli typecheck
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
pnpm check:package-boundaries
```

If any command fails because of unrelated existing worktree changes, document the blocker and still run the narrower command that proves the changed track.

## Self-Review

- Spec coverage: P0 ingestion SDK, SDK observability, repository-backed queue, provider presets, CLI real config, trace/eval/debug follow-ups are covered by explicit tracks.
- Placeholder scan: no `TBD`, `TODO`, or unspecified “add tests” steps remain.
- Type consistency: `KnowledgeSdkTraceEvent`, `KnowledgeSdkObserver`, `KnowledgeIngestionWorker`, `KnowledgeCliConfig`, and runtime/provider names are consistent across tasks.
- Scope safety: Track E is intentionally split into future plans because it spans frontend UI, eval contracts, and trace projection.
