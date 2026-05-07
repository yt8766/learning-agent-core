import { describe, expect, it } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from '../../src/domains/knowledge/services/knowledge-base.service';
import { KnowledgeDocumentService } from '../../src/domains/knowledge/services/knowledge-document.service';
import { KnowledgeIngestionQueue } from '../../src/domains/knowledge/services/knowledge-ingestion.queue';
import { KnowledgeIngestionWorker } from '../../src/domains/knowledge/services/knowledge-ingestion.worker';
import { KnowledgeRagService } from '../../src/domains/knowledge/services/knowledge-rag.service';
import { KnowledgeTraceService } from '../../src/domains/knowledge/services/knowledge-trace.service';
import { KnowledgeUploadService } from '../../src/domains/knowledge/services/knowledge-upload.service';
import { InMemoryOssStorageProvider } from '../../src/domains/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1' };

describe('KnowledgeRagService', () => {
  it('answers from accessible chunks and persists chat messages with trace metadata', async () => {
    const { baseId, rag, repository, traces } = await createRagServices('Release checklist\n\nRollback steps');

    const response = await rag.answer(actor, {
      knowledgeBaseId: baseId,
      message: 'How do I rollback?'
    });

    expect(response).toMatchObject({
      conversationId: expect.stringMatching(/^conv_/),
      answer: expect.stringContaining('Rollback steps'),
      route: {
        selectedKnowledgeBaseIds: [baseId],
        reason: 'legacy-ids'
      },
      diagnostics: {
        retrievalMode: 'keyword-only',
        hitCount: 2,
        contextChunkCount: 2
      },
      traceId: expect.stringMatching(/^trace_/)
    });
    expect(response.citations).toContainEqual(
      expect.objectContaining({ quote: 'Rollback steps', score: expect.any(Number) })
    );
    const messages = await repository.listChatMessages(response.conversationId, actor.userId);
    expect(messages.items.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages.items[1]).toMatchObject({
      traceId: response.traceId,
      citations: response.citations
    });
    const trace = traces.getTrace(response.traceId);
    expect(trace).toMatchObject({ status: 'ok' });
    expect(trace?.spans).toContainEqual(expect.objectContaining({ name: 'route' }));
    expect(trace?.spans).toContainEqual(expect.objectContaining({ name: 'retrieve' }));
  });

  it('rejects inaccessible requested knowledge bases before retrieval', async () => {
    const { rag } = await createRagServices('Only owner can read');

    await expect(
      rag.answer({ userId: 'other_user' }, { knowledgeBaseId: 'kb_missing', message: 'hello' })
    ).rejects.toMatchObject({
      code: 'knowledge_base_not_found'
    });
  });
});

async function createRagServices(content: string) {
  const repository = new KnowledgeMemoryRepository();
  const storage = new InMemoryOssStorageProvider();
  const baseService = new KnowledgeBaseService(repository);
  const upload = new KnowledgeUploadService(repository, storage);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const queue = new KnowledgeIngestionQueue(worker);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  const traces = new KnowledgeTraceService();
  const rag = new KnowledgeRagService(repository, traces);
  const base = await baseService.createBase(actor, { name: 'Engineering KB', description: '' });
  const uploaded = await upload.uploadFile(actor, base.id, {
    originalname: 'runbook.md',
    mimetype: 'text/markdown',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  });

  queue.start();
  await documents.createFromUpload(actor, base.id, {
    uploadId: uploaded.uploadId,
    objectKey: uploaded.objectKey,
    filename: uploaded.filename,
    title: 'Runbook'
  });
  await queue.waitForIdle();

  return { baseId: base.id, rag, repository, traces };
}
