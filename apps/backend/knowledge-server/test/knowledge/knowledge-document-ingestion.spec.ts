import { describe, expect, it } from 'vitest';

import { KnowledgeController } from '../../src/knowledge/knowledge.controller';
import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
import { KnowledgeIngestionQueue } from '../../src/knowledge/knowledge-ingestion.queue';
import { KnowledgeIngestionWorker } from '../../src/knowledge/knowledge-ingestion.worker';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { KnowledgeUploadService } from '../../src/knowledge/knowledge-upload.service';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/knowledge/runtime/knowledge-sdk-runtime.provider';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('Knowledge document ingestion', () => {
  it('creates a document and processing job from an upload result', async () => {
    const { controller, baseId, queue } = await createController();
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'runbook.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('# Runbook\n\nStep one.'),
      buffer: Buffer.from('# Runbook\n\nStep one.')
    });

    const result = await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename,
      title: 'Ops Runbook'
    });
    await queue.waitForIdle();

    const document = await controller.getDocument(actor, result.document.id);
    expect(document).toMatchObject({
      knowledgeBaseId: baseId,
      title: 'Ops Runbook',
      filename: 'runbook.md',
      sourceType: 'user-upload',
      status: 'ready'
    });
    const job = await controller.getLatestDocumentJob(actor, result.document.id);
    expect(job).toMatchObject({
      documentId: result.document.id,
      status: 'succeeded',
      currentStage: 'commit'
    });
  });

  it('returns document detail, latest job and chunks for an ingested upload', async () => {
    const { controller, baseId, queue } = await createController();
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength('alpha\n\nbeta'),
      buffer: Buffer.from('alpha\n\nbeta')
    });
    const { document, job } = await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    await expect(controller.getDocument(actor, document.id)).resolves.toMatchObject({
      id: document.id,
      knowledgeBaseId: baseId,
      chunkCount: 2
    });
    await expect(controller.getLatestDocumentJob(actor, document.id)).resolves.toMatchObject({
      id: job.id,
      documentId: document.id,
      status: 'succeeded'
    });
    await expect(controller.listDocumentChunks(actor, document.id)).resolves.toMatchObject({
      total: 2,
      items: [
        expect.objectContaining({ documentId: document.id, content: 'alpha', embeddingStatus: 'succeeded' }),
        expect.objectContaining({ documentId: document.id, content: 'beta', keywordIndexStatus: 'succeeded' })
      ]
    });
  });

  it('lists ingested documents for the current actor', async () => {
    const { baseId, controller, documents, queue } = await createController();
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'visible.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('# Visible'),
      buffer: Buffer.from('# Visible')
    });
    const { document } = await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    await expect(documents.listDocuments(actor)).resolves.toMatchObject({
      items: [expect.objectContaining({ id: document.id, knowledgeBaseId: baseId, title: 'visible' })],
      page: 1,
      pageSize: 20,
      total: 1
    });
  });

  it('deletes an ingested document and its stored object for the current actor', async () => {
    const { baseId, controller, documents, storage, queue } = await createController();
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'delete-me.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('# Delete me'),
      buffer: Buffer.from('# Delete me')
    });
    const { document } = await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    await expect(documents.deleteDocument(actor, document.id)).resolves.toMatchObject({ ok: true });

    await expect(controller.getDocument(actor, document.id)).rejects.toMatchObject({
      code: 'knowledge_document_not_found'
    });
    await expect(storage.getObject(upload.objectKey)).resolves.toBeUndefined();
  });

  it('reprocesses an existing document and replaces the latest job', async () => {
    const { controller, baseId, queue } = await createController();
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength('alpha\n\nbeta'),
      buffer: Buffer.from('alpha\n\nbeta')
    });
    const first = await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    await controller.reprocessDocument(actor, first.document.id);
    await queue.waitForIdle();

    const reprocessedDocument = await controller.getDocument(actor, first.document.id);
    expect(reprocessedDocument).toMatchObject({
      id: first.document.id,
      status: 'ready',
      chunkCount: 2
    });
    const latestJob = await controller.getLatestDocumentJob(actor, first.document.id);
    expect(latestJob).toMatchObject({
      documentId: first.document.id,
      status: 'succeeded',
      currentStage: 'commit'
    });
    expect(latestJob.id).not.toBe(first.job.id);
  });

  it('embeds and upserts chunks through the enabled SDK runtime', async () => {
    const upserts: Array<{
      records: Array<{ id: string; embedding: number[]; content?: string; metadata?: Record<string, unknown> }>;
    }> = [];
    const sdkRuntime = createEnabledSdkRuntime({
      upsert: async input => {
        upserts.push(input);
        return { upsertedCount: input.records.length };
      }
    });
    const { controller, baseId, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'vectors.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('alpha\n\nbeta'),
      buffer: Buffer.from('alpha\n\nbeta')
    });

    const result = await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename,
      title: 'Vector Runbook',
      metadata: { tags: ['ops', 'runtime'] }
    });
    await queue.waitForIdle();

    const document = await controller.getDocument(actor, result.document.id);
    expect(document).toMatchObject({
      status: 'ready',
      chunkCount: 2,
      embeddedChunkCount: 2
    });
    const job = await controller.getLatestDocumentJob(actor, result.document.id);
    expect(job).toMatchObject({
      status: 'succeeded',
      currentStage: 'commit'
    });
    expect(job.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'embed', status: 'succeeded' }),
        expect.objectContaining({ stage: 'index_vector', status: 'succeeded' })
      ])
    );
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.records).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^chunk_/),
        content: 'alpha',
        embedding: [0.1, 0.2],
        metadata: {
          tenantId: 'default',
          knowledgeBaseId: baseId,
          documentId: result.document.id,
          ordinal: 0,
          title: 'Vector Runbook',
          filename: 'vectors.md',
          tags: ['ops', 'runtime']
        }
      }),
      expect.objectContaining({
        id: expect.stringMatching(/^chunk_/),
        content: 'beta',
        embedding: [1.1, 1.2],
        metadata: expect.objectContaining({
          tenantId: 'default',
          knowledgeBaseId: baseId,
          documentId: result.document.id,
          ordinal: 1
        })
      })
    ]);
  });

  it('marks the document and job failed when vector upsert fails', async () => {
    const sdkRuntime = createEnabledSdkRuntime({
      upsert: async () => {
        throw new Error('pgvector unavailable');
      }
    });
    const { controller, baseId, documents, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'broken.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('alpha'),
      buffer: Buffer.from('alpha')
    });

    await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    const failedDocument = (await documents.listDocuments(actor)).items[0];
    expect(failedDocument).toMatchObject({
      filename: 'broken.md',
      status: 'failed',
      chunkCount: 1,
      embeddedChunkCount: 1
    });
    await expect(controller.getLatestDocumentJob(actor, failedDocument.id)).resolves.toMatchObject({
      documentId: failedDocument.id,
      status: 'failed',
      currentStage: 'index_vector',
      errorCode: 'knowledge_index_failed',
      errorMessage: 'pgvector unavailable'
    });
  });

  it('marks ingestion failed when embedding count does not match chunks', async () => {
    const sdkRuntime = createEnabledSdkRuntime({
      embeddings: [[0.1, 0.2]],
      upsert: async input => ({ upsertedCount: input.records.length })
    });
    const { controller, baseId, documents, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'mismatch.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('alpha\n\nbeta'),
      buffer: Buffer.from('alpha\n\nbeta')
    });

    await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    const failedDocument = (await documents.listDocuments(actor)).items[0];
    expect(failedDocument).toMatchObject({ status: 'failed', chunkCount: 2, embeddedChunkCount: 0 });
    await expect(controller.getLatestDocumentJob(actor, failedDocument.id)).resolves.toMatchObject({
      status: 'failed',
      currentStage: 'embed',
      errorCode: 'knowledge_embedding_failed',
      errorMessage: 'embedding count mismatch: expected 2, got 1'
    });
  });

  it('records a retryable embedding failure without marking the document searchable', async () => {
    const sdkRuntime = createEnabledSdkRuntime({
      embedBatch: async () => {
        throw new Error('embedding unavailable');
      },
      upsert: async input => ({ upsertedCount: input.records.length })
    });
    const { controller, baseId, documents, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'retryable.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('alpha'),
      buffer: Buffer.from('alpha')
    });

    await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    const failedDocument = (await documents.listDocuments(actor)).items[0];
    expect(failedDocument).toMatchObject({ status: 'failed', chunkCount: 1, embeddedChunkCount: 0 });
    await expect(controller.getLatestDocumentJob(actor, failedDocument.id)).resolves.toMatchObject({
      status: 'failed',
      stage: 'embedding',
      progress: { percent: 60, processedChunks: 0, totalChunks: 1 },
      attempts: 1,
      error: {
        code: 'knowledge_ingestion_embedding_failed',
        message: 'embedding unavailable',
        retryable: true,
        stage: 'embedding'
      }
    });
  });

  it('creates a new job attempt when reprocessing a failed document', async () => {
    let shouldFailEmbedding = true;
    const sdkRuntime = createEnabledSdkRuntime({
      embedBatch: async ({ texts }) => {
        if (shouldFailEmbedding) {
          shouldFailEmbedding = false;
          throw new Error('embedding unavailable');
        }
        return {
          embeddings: texts.map((_, index) => [index + 0.1, index + 0.2]),
          model: 'fake-embedding'
        };
      },
      upsert: async input => ({ upsertedCount: input.records.length })
    });
    const { controller, baseId, documents, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'retry.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('alpha'),
      buffer: Buffer.from('alpha')
    });

    await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    const failedDocument = (await documents.listDocuments(actor)).items[0];
    const failedJob = await controller.getLatestDocumentJob(actor, failedDocument.id);
    await controller.reprocessDocument(actor, failedDocument.id);
    await queue.waitForIdle();

    const latestJob = await controller.getLatestDocumentJob(actor, failedDocument.id);
    expect(latestJob.id).not.toBe(failedJob.id);
    expect(latestJob).toMatchObject({
      documentId: failedDocument.id,
      status: 'succeeded',
      stage: 'succeeded',
      attempts: 2,
      progress: { percent: 100, processedChunks: 1, totalChunks: 1 }
    });
  });

  it('marks ingestion failed when vector upsert writes fewer chunks than requested', async () => {
    const sdkRuntime = createEnabledSdkRuntime({
      upsert: async () => ({ upsertedCount: 0 })
    });
    const { controller, baseId, documents, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'partial.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('alpha'),
      buffer: Buffer.from('alpha')
    });

    await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    const failedDocument = (await documents.listDocuments(actor)).items[0];
    expect(failedDocument).toMatchObject({ status: 'failed', chunkCount: 1, embeddedChunkCount: 1 });
    await expect(controller.getLatestDocumentJob(actor, failedDocument.id)).resolves.toMatchObject({
      status: 'failed',
      currentStage: 'index_vector',
      errorCode: 'knowledge_index_failed',
      errorMessage: 'vector upsert count mismatch: expected 1, got 0'
    });
  });

  it('marks ingestion failed when enabled SDK runtime receives no non-empty chunks', async () => {
    const sdkRuntime = createEnabledSdkRuntime({
      upsert: async input => ({ upsertedCount: input.records.length })
    });
    const { controller, baseId, documents, queue } = await createController(sdkRuntime);
    const upload = await controller.uploadKnowledgeFile(actor, baseId, {
      originalname: 'blank.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('   \n\n   '),
      buffer: Buffer.from('   \n\n   ')
    });

    await controller.createDocumentFromUpload(actor, baseId, {
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: upload.filename
    });
    await queue.waitForIdle();

    const failedDocument = (await documents.listDocuments(actor)).items[0];
    expect(failedDocument).toMatchObject({ status: 'failed', chunkCount: 0, embeddedChunkCount: 0 });
    await expect(controller.getLatestDocumentJob(actor, failedDocument.id)).resolves.toMatchObject({
      status: 'failed',
      currentStage: 'embed',
      errorMessage: 'document has no non-empty chunks to embed'
    });
  });
});

async function createController(sdkRuntime: KnowledgeSdkRuntimeProviderValue = disabledSdkRuntime()) {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage, sdkRuntime);
  const queue = new KnowledgeIngestionQueue(worker);
  queue.start();
  const upload = new KnowledgeUploadService(repository, storage);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  const controller = new KnowledgeController(knowledge, upload, documents);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return { controller, documents, storage, baseId: base.id, queue };
}

function disabledSdkRuntime(): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: false,
    reason: 'missing_env',
    missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
    runtime: null
  };
}

function createEnabledSdkRuntime(input: {
  embeddings?: number[][];
  embedBatch?: (input: { texts: string[] }) => Promise<{ embeddings: number[][]; model: string }>;
  upsert: (input: {
    records: Array<{ id: string; embedding: number[]; content?: string; metadata?: Record<string, unknown> }>;
  }) => Promise<{ upsertedCount: number }>;
}): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate: async () => ({ text: '', model: 'fake-chat', providerId: 'fake' })
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText: async ({ text }) => ({ embedding: [text.length, text.length + 1], model: 'fake-embedding' }),
        embedBatch:
          input.embedBatch ??
          (async ({ texts }) => ({
            embeddings: input.embeddings ?? texts.map((_, index) => [index + 0.1, index + 0.2]),
            model: 'fake-embedding'
          }))
      },
      vectorStore: {
        upsert: input.upsert,
        search: async () => ({ hits: [] }),
        delete: async () => ({ deletedCount: 0 })
      }
    }
  };
}
