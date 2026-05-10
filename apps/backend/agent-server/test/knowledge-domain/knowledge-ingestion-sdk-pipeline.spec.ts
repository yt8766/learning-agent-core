import { describe, expect, it, vi } from 'vitest';

import { KnowledgeIngestionWorker } from '../../src/domains/knowledge/services/knowledge-ingestion.worker';

describe('KnowledgeIngestionWorker SDK indexing pipeline', () => {
  it('processes uploaded content through the @agent/knowledge SDK indexing pipeline when runtime is enabled', async () => {
    const now = '2026-05-09T00:00:00.000Z';
    const document = {
      id: 'doc_sdk_ingestion',
      workspaceId: 'default',
      knowledgeBaseId: 'kb_sdk_ingestion',
      uploadId: 'upload_sdk_ingestion',
      objectKey: 'knowledge/kb_sdk_ingestion/upload_sdk_ingestion/sdk-ingestion.md',
      filename: 'sdk-ingestion.md',
      title: 'SDK Ingestion',
      sourceType: 'user-upload',
      status: 'queued',
      version: 'v1',
      chunkCount: 0,
      embeddedChunkCount: 0,
      createdBy: 'user_1',
      metadata: {},
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
      findDocument: vi.fn(async () => document),
      saveChunks: vi.fn(async (_documentId, chunks) => chunks),
      updateDocument: vi.fn(async input => input),
      updateJob: vi.fn(async input => input)
    };
    const storage = {
      getObject: vi.fn(async () => ({
        objectKey: document.objectKey,
        body: Buffer.from('# SDK Ingestion\n\nThe ingestion worker should call the SDK indexing pipeline.'),
        contentType: 'text/markdown',
        metadata: {}
      }))
    };
    const runtime = {
      enabled: true,
      runtime: {
        embeddingProvider: {
          providerId: 'test',
          defaultModel: 'test-embedding',
          embedBatch: vi.fn(async () => ({
            embeddings: [
              {
                text: 'The ingestion worker should call the SDK indexing pipeline.',
                embedding: [0.1, 0.2, 0.3]
              }
            ],
            model: 'test-embedding'
          }))
        },
        vectorStore: {
          upsert: vi.fn(async () => ({ upsertedCount: 1 }))
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
            content: expect.stringContaining('SDK indexing pipeline'),
            metadata: expect.objectContaining({
              tenantId: document.workspaceId,
              knowledgeBaseId: document.knowledgeBaseId,
              documentId: document.id,
              ordinal: expect.any(Number)
            })
          })
        ])
      })
    );
    expect(repository.saveChunks.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.runtime.vectorStore.upsert.mock.invocationCallOrder[0]
    );
  });

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

  it('records a failed job when SDK vector upsert fails', async () => {
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture('Vector failure content.');
    const runtime = {
      enabled: true,
      runtime: {
        embeddingProvider: {
          embedBatch: vi.fn(async input => ({
            embeddings: input.texts.map(() => [0.1, 0.2, 0.3]),
            model: 'test-embedding'
          }))
        },
        vectorStore: {
          upsert: vi.fn(async () => {
            throw new Error('vector unavailable');
          })
        }
      }
    };
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'failed',
      errorCode: 'knowledge_ingestion_index_failed',
      error: expect.objectContaining({
        code: 'knowledge_ingestion_index_failed',
        retryable: true,
        stage: 'indexing'
      })
    });
    expect(repository.updateDocument).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(repository.saveChunks).toHaveBeenLastCalledWith(
      'doc_sdk_ingestion',
      expect.arrayContaining([
        expect.objectContaining({
          embeddingStatus: 'failed',
          vectorIndexStatus: 'failed',
          keywordIndexStatus: 'succeeded'
        })
      ])
    );
  });
});

function createKnowledgeIngestionJobFixture() {
  const now = '2026-05-09T00:00:00.000Z';
  return {
    id: 'job_sdk_ingestion',
    documentId: 'doc_sdk_ingestion',
    status: 'queued',
    stage: 'uploaded',
    currentStage: 'queued',
    stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
    progress: { percent: 0 },
    attempts: 1,
    createdAt: now,
    updatedAt: now
  };
}

function createKnowledgeIngestionRepositoryFixture() {
  const now = '2026-05-09T00:00:00.000Z';
  const document = {
    id: 'doc_sdk_ingestion',
    workspaceId: 'default',
    knowledgeBaseId: 'kb_sdk_ingestion',
    uploadId: 'upload_sdk_ingestion',
    objectKey: 'knowledge/kb_sdk_ingestion/upload_sdk_ingestion/sdk-ingestion.md',
    filename: 'sdk-ingestion.md',
    title: 'SDK Ingestion',
    sourceType: 'user-upload',
    status: 'queued',
    version: 'v1',
    chunkCount: 0,
    embeddedChunkCount: 0,
    createdBy: 'user_1',
    metadata: {},
    createdAt: now,
    updatedAt: now
  };

  return {
    findDocument: vi.fn(async () => document),
    saveChunks: vi.fn(async (_documentId, chunks) => chunks),
    updateDocument: vi.fn(async input => input),
    updateJob: vi.fn(async input => input)
  };
}

function createKnowledgeIngestionStorageFixture(content: string) {
  return {
    getObject: vi.fn(async () => ({
      objectKey: 'knowledge/kb_sdk_ingestion/upload_sdk_ingestion/sdk-ingestion.md',
      body: Buffer.from(content),
      contentType: 'text/markdown',
      metadata: {}
    }))
  };
}
