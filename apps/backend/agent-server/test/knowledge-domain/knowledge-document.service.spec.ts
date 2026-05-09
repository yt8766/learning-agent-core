import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from '../../src/domains/knowledge/services/knowledge-base.service';
import { KnowledgeDocumentService } from '../../src/domains/knowledge/services/knowledge-document.service';
import { KnowledgeIngestionQueue } from '../../src/domains/knowledge/services/knowledge-ingestion.queue';
import { KnowledgeIngestionWorker } from '../../src/domains/knowledge/services/knowledge-ingestion.worker';
import { KnowledgeUploadService } from '../../src/domains/knowledge/services/knowledge-upload.service';
import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1' };

describe('KnowledgeDocumentService', () => {
  it('creates a document and processing job from an upload result', async () => {
    const { baseId, documents, queue, upload } = await createDocumentServices();
    const uploaded = await upload.uploadFile(actor, baseId, createFile('runbook.md', '# Runbook\n\nStep one.'));

    const result = await documents.createFromUpload(actor, baseId, {
      uploadId: uploaded.uploadId,
      objectKey: uploaded.objectKey,
      filename: uploaded.filename,
      title: 'Ops Runbook'
    });
    await queue.waitForIdle();

    await expect(documents.getDocument(actor, result.document.id)).resolves.toMatchObject({
      knowledgeBaseId: baseId,
      title: 'Ops Runbook',
      filename: 'runbook.md',
      sourceType: 'user-upload',
      status: 'ready'
    });
    await expect(documents.getLatestJob(actor, result.document.id)).resolves.toMatchObject({
      documentId: result.document.id,
      status: 'succeeded',
      currentStage: 'commit'
    });
  });

  it('returns document detail, latest job and chunks for an ingested upload', async () => {
    const { baseId, documents, queue, upload } = await createDocumentServices();
    const uploaded = await upload.uploadFile(actor, baseId, createFile('notes.txt', 'alpha\n\nbeta', 'text/plain'));
    const { document, job } = await documents.createFromUpload(actor, baseId, {
      uploadId: uploaded.uploadId,
      objectKey: uploaded.objectKey,
      filename: uploaded.filename
    });
    await queue.waitForIdle();

    await expect(documents.getDocument(actor, document.id)).resolves.toMatchObject({
      id: document.id,
      knowledgeBaseId: baseId,
      chunkCount: 1
    });
    await expect(documents.getLatestJob(actor, document.id)).resolves.toMatchObject({
      id: job.id,
      documentId: document.id,
      status: 'succeeded'
    });
    await expect(documents.listChunks(actor, document.id)).resolves.toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          documentId: document.id,
          content: expect.stringContaining('alpha'),
          embeddingStatus: 'skipped',
          keywordIndexStatus: 'succeeded'
        })
      ]
    });
  });

  it('deletes an ingested document and its stored object for the current actor', async () => {
    const { baseId, documents, queue, storage, upload } = await createDocumentServices();
    const uploaded = await upload.uploadFile(actor, baseId, createFile('delete-me.md', '# Delete me'));
    const { document } = await documents.createFromUpload(actor, baseId, {
      uploadId: uploaded.uploadId,
      objectKey: uploaded.objectKey,
      filename: uploaded.filename
    });
    await queue.waitForIdle();

    await expect(documents.deleteDocument(actor, document.id)).resolves.toMatchObject({ ok: true });
    await expect(documents.getDocument(actor, document.id)).rejects.toMatchObject({
      code: 'knowledge_document_not_found'
    });
    await expect(storage.getObject(uploaded.objectKey)).resolves.toBeUndefined();
  });
});

async function createDocumentServices() {
  const repository = new KnowledgeMemoryRepository();
  const storage = new InMemoryOssStorageProvider();
  const baseService = new KnowledgeBaseService(repository);
  const upload = new KnowledgeUploadService(repository, storage);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const queue = new KnowledgeIngestionQueue(worker);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  const base = await baseService.createBase(actor, { name: 'Engineering KB', description: '' });

  queue.start();

  return { baseId: base.id, documents, queue, storage, upload };
}

function createFile(originalname: string, content: string, mimetype = 'text/markdown') {
  return {
    originalname,
    mimetype,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  };
}
