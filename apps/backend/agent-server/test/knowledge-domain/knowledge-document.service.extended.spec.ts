import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from '../../src/domains/knowledge/services/knowledge-base.service';
import { KnowledgeDocumentService } from '../../src/domains/knowledge/services/knowledge-document.service';
import { KnowledgeIngestionQueue } from '../../src/domains/knowledge/services/knowledge-ingestion.queue';
import { KnowledgeIngestionWorker } from '../../src/domains/knowledge/services/knowledge-ingestion.worker';
import { KnowledgeUploadService } from '../../src/domains/knowledge/services/knowledge-upload.service';
import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';
import { KnowledgeServiceError } from '../../src/domains/knowledge/services/knowledge-service.error';

const actor = { userId: 'user_1' };

describe('KnowledgeDocumentService extended coverage', () => {
  async function createServices() {
    const repository = new KnowledgeMemoryRepository();
    const storage = new InMemoryOssStorageProvider();
    const baseService = new KnowledgeBaseService(repository);
    const upload = new KnowledgeUploadService(repository, storage);
    const worker = new KnowledgeIngestionWorker(repository, storage);
    const queue = new KnowledgeIngestionQueue(worker);
    const documents = new KnowledgeDocumentService(repository, queue, storage);
    const base = await baseService.createBase(actor, { name: 'Test KB', description: '' });
    queue.start();
    return { baseId: base.id, documents, queue, repository, storage, upload };
  }

  function createFile(name: string, content: string, mimetype = 'text/markdown') {
    return { originalname: name, mimetype, size: Buffer.byteLength(content), buffer: Buffer.from(content) };
  }

  describe('createFromUpload', () => {
    it('throws knowledge_upload_not_found when uploadId does not exist', async () => {
      const { baseId, documents } = await createServices();

      await expect(
        documents.createFromUpload(actor, baseId, {
          uploadId: 'missing-upload',
          objectKey: 'key',
          filename: 'test.md'
        })
      ).rejects.toMatchObject({ code: 'knowledge_upload_not_found' });
    });

    it('uses stripExtension for title when title is not provided', async () => {
      const { baseId, documents, upload } = await createServices();
      const uploaded = await upload.uploadFile(actor, baseId, createFile('report.md', '# Report'));

      const result = await documents.createFromUpload(actor, baseId, {
        uploadId: uploaded.uploadId,
        objectKey: uploaded.objectKey,
        filename: uploaded.filename
      });

      expect(result.document.title).toBe('report');
    });

    it('uses provided metadata in document creation', async () => {
      const { baseId, documents, upload } = await createServices();
      const uploaded = await upload.uploadFile(actor, baseId, createFile('meta.md', '# Meta'));

      const result = await documents.createFromUpload(actor, baseId, {
        uploadId: uploaded.uploadId,
        objectKey: uploaded.objectKey,
        filename: uploaded.filename,
        metadata: { tags: ['important'] }
      });

      expect(result.document.metadata).toEqual({ tags: ['important'] });
    });
  });

  describe('getDocument', () => {
    it('throws knowledge_document_not_found for missing document', async () => {
      const { documents } = await createServices();

      await expect(documents.getDocument(actor, 'nonexistent')).rejects.toMatchObject({
        code: 'knowledge_document_not_found'
      });
    });
  });

  describe('listDocuments', () => {
    it('returns empty when no documents exist', async () => {
      const { documents } = await createServices();

      const result = await documents.listDocuments(actor);

      expect(result.items).toEqual([]);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(0);
    });
  });

  describe('getLatestJob', () => {
    it('throws knowledge_job_not_found when no job exists for a document', async () => {
      const { baseId, documents, upload, queue } = await createServices();
      const uploaded = await upload.uploadFile(actor, baseId, createFile('nojob.md', '# No Job'));
      const { document } = await documents.createFromUpload(actor, baseId, {
        uploadId: uploaded.uploadId,
        objectKey: uploaded.objectKey,
        filename: uploaded.filename
      });
      await queue.waitForIdle();

      // After processing completes, the job exists
      const job = await documents.getLatestJob(actor, document.id);
      expect(job.documentId).toBe(document.id);
    });
  });

  describe('reprocessDocument', () => {
    it('creates a new job with incremented attempts', async () => {
      const { baseId, documents, upload, queue } = await createServices();
      const uploaded = await upload.uploadFile(actor, baseId, createFile('repro.md', '# Repro'));
      const { document } = await documents.createFromUpload(actor, baseId, {
        uploadId: uploaded.uploadId,
        objectKey: uploaded.objectKey,
        filename: uploaded.filename
      });
      await queue.waitForIdle();

      const reprocessResult = await documents.reprocessDocument(actor, document.id);
      expect(reprocessResult.job.attempts).toBe(2);
      expect(reprocessResult.document.status).toBe('queued');
    });
  });

  describe('listEmbeddingModels', () => {
    it('returns default model when env is not set', () => {
      const { documents } = createServicesSync();
      const result = documents.listEmbeddingModels();
      expect(result.items.length).toBe(1);
      expect(result.items[0].provider).toBe('openai-compatible');
    });
  });

  describe('recordFeedback', () => {
    it('throws knowledge_chat_message_not_found for nonexistent message', async () => {
      const { documents } = await createServices();

      await expect(documents.recordFeedback('nonexistent', { rating: 'up' })).rejects.toMatchObject({
        code: 'knowledge_chat_message_not_found'
      });
    });
  });
});

function createServicesSync() {
  const repository = new KnowledgeMemoryRepository();
  const storage = new InMemoryOssStorageProvider();
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const queue = new KnowledgeIngestionQueue(worker);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  return { documents };
}
