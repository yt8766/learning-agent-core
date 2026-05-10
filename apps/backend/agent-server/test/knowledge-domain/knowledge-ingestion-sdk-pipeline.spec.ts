import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeIngestionWorker } from '../../src/domains/knowledge/services/knowledge-ingestion.worker';

describe('KnowledgeIngestionWorker SDK indexing pipeline', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    expect(repository.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready', chunkCount: 1, embeddedChunkCount: 1 })
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

  it('stores structured markdown chunk metadata in document chunks and vector records', async () => {
    vi.stubEnv('KNOWLEDGE_INGESTION_CHUNKER', 'auto');
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture(
      [
        '# Runtime Guide',
        '',
        'Intro paragraph.',
        '',
        '## Deploy Steps',
        '',
        '- Build the server',
        '- Run the smoke check',
        '',
        '```ts',
        'export const status = "ready";',
        '```'
      ].join('\n')
    );
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
          upsert: vi.fn(async input => ({ upsertedCount: input.records.length }))
        }
      }
    };
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result.status).toBe('succeeded');
    const savedChunks = repository.saveChunks.mock.calls.at(-1)?.[1] ?? [];
    expect(savedChunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('- Build the server'),
          metadata: expect.objectContaining({
            heading: 'Deploy Steps',
            sectionPath: ['Runtime Guide', 'Deploy Steps'],
            contentType: 'list',
            parentId: 'doc_sdk_ingestion#section-deploy-steps',
            chunkHash: expect.any(String)
          })
        }),
        expect.objectContaining({
          content: expect.stringContaining('export const status'),
          metadata: expect.objectContaining({
            heading: 'Deploy Steps',
            sectionPath: ['Runtime Guide', 'Deploy Steps'],
            contentType: 'code',
            parentId: 'doc_sdk_ingestion#section-deploy-steps',
            chunkHash: expect.any(String)
          })
        })
      ])
    );
    expect(runtime.runtime.vectorStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        records: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('- Build the server'),
            metadata: expect.objectContaining({
              heading: 'Deploy Steps',
              sectionPath: ['Runtime Guide', 'Deploy Steps'],
              contentType: 'list',
              parentId: 'doc_sdk_ingestion#section-deploy-steps',
              chunkHash: expect.any(String)
            })
          }),
          expect.objectContaining({
            content: expect.stringContaining('export const status'),
            metadata: expect.objectContaining({
              heading: 'Deploy Steps',
              sectionPath: ['Runtime Guide', 'Deploy Steps'],
              contentType: 'code',
              parentId: 'doc_sdk_ingestion#section-deploy-steps',
              chunkHash: expect.any(String)
            })
          })
        ])
      })
    );
  });

  it('can force fixed-window chunking through ingestion config', async () => {
    vi.stubEnv('KNOWLEDGE_INGESTION_CHUNKER', 'fixed');
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture(
      ['# Runtime Guide', '', '## Deploy Steps', '', '- Build the server'].join('\n')
    );
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
          upsert: vi.fn(async input => ({ upsertedCount: input.records.length }))
        }
      }
    };
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result.status).toBe('succeeded');
    const savedChunks = repository.saveChunks.mock.calls.at(-1)?.[1] ?? [];
    expect(savedChunks).toHaveLength(1);
    expect(savedChunks[0]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining('# Runtime Guide'),
        metadata: expect.not.objectContaining({
          heading: 'Deploy Steps',
          contentType: 'list'
        })
      })
    );
    expect(runtime.runtime.vectorStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        records: [
          expect.objectContaining({
            metadata: expect.not.objectContaining({
              heading: 'Deploy Steps',
              contentType: 'list'
            })
          })
        ]
      })
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

  it('fails ingestion when embedBatch returns fewer embeddings than chunks', async () => {
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture('Embedding count mismatch content.');
    const runtime = createEnabledKnowledgeRuntimeFixture({ embeddings: [] });
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result).toMatchObject({
      status: 'failed',
      currentStage: 'embed',
      errorCode: 'knowledge_ingestion_embedding_invalid',
      error: expect.objectContaining({
        code: 'knowledge_ingestion_embedding_invalid',
        stage: 'embedding'
      })
    });
    expect(result.errorMessage).toContain('embedBatch returned 0 embeddings for 1 chunks');
    expect(runtime.runtime.vectorStore.upsert).not.toHaveBeenCalled();
    expect(repository.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', embeddedChunkCount: 0 })
    );
    expect(repository.saveChunks).toHaveBeenLastCalledWith(
      'doc_sdk_ingestion',
      expect.arrayContaining([
        expect.objectContaining({
          embeddingStatus: 'failed',
          vectorIndexStatus: 'failed'
        })
      ])
    );
  });

  it('fails ingestion when embedBatch returns an empty embedding vector', async () => {
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture('Empty embedding content.');
    const runtime = createEnabledKnowledgeRuntimeFixture({ embeddings: [[]] });
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result).toMatchObject({
      status: 'failed',
      currentStage: 'embed',
      errorCode: 'knowledge_ingestion_embedding_invalid'
    });
    expect(result.errorMessage).toContain('Embedding 0 is empty');
    expect(runtime.runtime.vectorStore.upsert).not.toHaveBeenCalled();
  });

  it('fails ingestion when embedding dimensions do not match the provider result', async () => {
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture('Embedding dimension mismatch content.');
    const runtime = createEnabledKnowledgeRuntimeFixture({ dimensions: 4, embeddings: [[0.1, 0.2, 0.3]] });
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result).toMatchObject({
      status: 'failed',
      currentStage: 'embed',
      errorCode: 'knowledge_ingestion_embedding_invalid'
    });
    expect(result.errorMessage).toContain('Embedding 0 has 3 dimensions, expected 4');
    expect(runtime.runtime.vectorStore.upsert).not.toHaveBeenCalled();
  });

  it('fails ingestion when embedding contains non-finite values', async () => {
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture('Malformed embedding content.');
    const runtime = createEnabledKnowledgeRuntimeFixture({ embeddings: [[0.1, 'bad', 0.3]] });
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result).toMatchObject({
      status: 'failed',
      currentStage: 'embed',
      errorCode: 'knowledge_ingestion_embedding_invalid'
    });
    expect(result.errorMessage).toContain('Embedding contains a non-finite value at dimension 1');
    expect(runtime.runtime.vectorStore.upsert).not.toHaveBeenCalled();
  });

  it('fails ingestion when vector upsert count cannot be confirmed', async () => {
    const repository = createKnowledgeIngestionRepositoryFixture();
    const storage = createKnowledgeIngestionStorageFixture('Unknown upsert count content.');
    const runtime = createEnabledKnowledgeRuntimeFixture({
      embeddings: [[0.1, 0.2, 0.3]],
      upsertResult: {}
    });
    const worker = new KnowledgeIngestionWorker(repository as never, storage as never, runtime as never);

    const result = await worker.process(createKnowledgeIngestionJobFixture());

    expect(result).toMatchObject({
      status: 'failed',
      currentStage: 'index_vector',
      errorCode: 'knowledge_ingestion_vector_upsert_unconfirmed',
      error: expect.objectContaining({
        code: 'knowledge_ingestion_vector_upsert_unconfirmed',
        stage: 'indexing'
      })
    });
    expect(result.errorMessage).toContain('Vector upsert count is unknown');
    expect(repository.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', embeddedChunkCount: 0 })
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

function createEnabledKnowledgeRuntimeFixture(input: {
  embeddings: unknown[];
  dimensions?: number;
  upsertResult?: unknown;
}) {
  return {
    enabled: true,
    runtime: {
      embeddingProvider: {
        embedBatch: vi.fn(async () => ({
          embeddings: input.embeddings,
          model: 'test-embedding',
          dimensions: input.dimensions
        }))
      },
      vectorStore: {
        upsert: vi.fn(async () => input.upsertResult ?? { upsertedCount: input.embeddings.length })
      }
    }
  };
}
