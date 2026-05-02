import { describe, expect, it } from 'vitest';

import { KnowledgeController } from '../../src/knowledge/knowledge.controller';
import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
import { KnowledgeIngestionWorker } from '../../src/knowledge/knowledge-ingestion.worker';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { KnowledgeUploadService } from '../../src/knowledge/knowledge-upload.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('Knowledge document ingestion', () => {
  it('creates a document and processing job from an upload result', async () => {
    const { controller, baseId } = await createController();
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

    expect(result.document).toMatchObject({
      knowledgeBaseId: baseId,
      title: 'Ops Runbook',
      filename: 'runbook.md',
      sourceType: 'user-upload',
      status: 'ready'
    });
    expect(result.job).toMatchObject({
      documentId: result.document.id,
      status: 'succeeded',
      currentStage: 'commit'
    });
  });

  it('returns document detail, latest job and chunks for an ingested upload', async () => {
    const { controller, baseId } = await createController();
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
    const { baseId, controller, documents } = await createController();
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

    await expect(documents.listDocuments(actor)).resolves.toMatchObject({
      items: [expect.objectContaining({ id: document.id, knowledgeBaseId: baseId, title: 'visible' })],
      page: 1,
      pageSize: 20,
      total: 1
    });
  });

  it('deletes an ingested document and its stored object for the current actor', async () => {
    const { baseId, controller, documents, storage } = await createController();
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

    await expect(documents.deleteDocument(actor, document.id)).resolves.toMatchObject({ ok: true });

    await expect(controller.getDocument(actor, document.id)).rejects.toMatchObject({
      code: 'knowledge_document_not_found'
    });
    await expect(storage.getObject(upload.objectKey)).resolves.toBeUndefined();
  });

  it('reprocesses an existing document and replaces the latest job', async () => {
    const { controller, baseId } = await createController();
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

    const second = await controller.reprocessDocument(actor, first.document.id);

    expect(second.document).toMatchObject({
      id: first.document.id,
      status: 'ready',
      chunkCount: 2
    });
    expect(second.job).toMatchObject({
      documentId: first.document.id,
      status: 'succeeded',
      currentStage: 'commit'
    });
    expect(second.job.id).not.toBe(first.job.id);
    await expect(controller.getLatestDocumentJob(actor, first.document.id)).resolves.toMatchObject({
      id: second.job.id
    });
  });
});

async function createController() {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const upload = new KnowledgeUploadService(repository, storage);
  const documents = new KnowledgeDocumentService(repository, worker, storage);
  const controller = new KnowledgeController(knowledge, upload, documents);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return { controller, documents, storage, baseId: base.id };
}
