import { describe, expect, it, vi } from 'vitest';
import { KnowledgeRagStreamEventSchema } from '@agent/knowledge';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/domains/knowledge/runtime/knowledge-sdk-runtime.provider';
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
      expect.objectContaining({ quote: expect.stringContaining('Rollback steps'), score: expect.any(Number) })
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

  it('streams local RAG events and persists the assistant message with trace metadata', async () => {
    const { baseId, rag, repository, traces } = await createRagServices('Release checklist\n\nRollback steps');

    const events = [];
    for await (const event of rag.stream(actor, {
      knowledgeBaseId: baseId,
      message: 'How do I rollback?'
    })) {
      KnowledgeRagStreamEventSchema.parse(event);
      events.push(event);
    }

    expect(events.map(event => event.type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'retrieval.completed',
      'answer.started',
      'answer.delta',
      'answer.completed',
      'rag.completed'
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'answer.delta', delta: expect.stringContaining('Rollback steps') })
    );
    const completed = events.find(event => event.type === 'rag.completed');
    expect(completed).toMatchObject({
      result: {
        answer: { text: expect.stringContaining('Rollback steps') },
        retrieval: { hits: expect.any(Array) }
      }
    });
    const conversations = await repository.listChatConversationsForUser(actor.userId);
    const messages = await repository.listChatMessages(conversations.items[0].id, actor.userId);
    expect(messages.items.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages.items[1]).toMatchObject({
      content: expect.stringContaining('Rollback steps'),
      traceId: expect.stringMatching(/^trace_/)
    });
    expect(traces.getTrace(messages.items[1].traceId ?? '')).toMatchObject({ status: 'ok' });
  });

  it('uses SDK RAG facade when runtime is enabled and persists the projected answer', async () => {
    const generate = vi.fn(async input => {
      if (isGenerateInput(input)) {
        const content = input.messages.map(message => message.content).join('\n');
        if (content.includes('可访问知识库')) {
          return {
            text: JSON.stringify({
              selectedKnowledgeBaseIds: [baseId],
              queryVariants: ['sdk planner'],
              searchMode: 'hybrid',
              selectionReason: 'SDK planner selected the migrated domain KB.',
              confidence: 0.95
            }),
            model: 'fake-chat',
            providerId: 'fake'
          };
        }
      }

      return {
        text: 'SDK answer from unified knowledge domain.',
        model: 'fake-chat',
        providerId: 'fake'
      };
    });
    const runtime = enabledSdkRuntime({ generate });
    const { baseId, rag, repository } = await createRagServices('SDK planner can cite unified chunks.', runtime);

    const response = await rag.answer(actor, {
      knowledgeBaseId: baseId,
      message: 'sdk planner'
    });

    expect(generate).toHaveBeenCalled();
    expect(response).toMatchObject({
      answer: 'SDK answer from unified knowledge domain.',
      route: {
        selectedKnowledgeBaseIds: [baseId],
        reason: 'legacy-ids'
      },
      diagnostics: {
        hitCount: 1,
        contextChunkCount: 1
      }
    });
    const messages = await repository.listChatMessages(response.conversationId, actor.userId);
    expect(messages.items.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages.items[1]).toMatchObject({
      content: 'SDK answer from unified knowledge domain.',
      citations: [expect.objectContaining({ quote: 'SDK planner can cite unified chunks.' })]
    });
  });
});

async function createRagServices(content: string, sdkRuntime?: KnowledgeSdkRuntimeProviderValue) {
  const repository = new KnowledgeMemoryRepository();
  const storage = new InMemoryOssStorageProvider();
  const baseService = new KnowledgeBaseService(repository);
  const upload = new KnowledgeUploadService(repository, storage);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const queue = new KnowledgeIngestionQueue(worker);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  const traces = new KnowledgeTraceService();
  const rag = new KnowledgeRagService(repository, traces, sdkRuntime);
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

function enabledSdkRuntime(input: {
  generate: (input: { messages: Array<{ content: string }> }) => Promise<{
    text: string;
    model?: string;
    providerId?: string;
  }>;
}): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate: input.generate as (input: unknown) => Promise<{ text: string; model?: string; providerId?: string }>
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText: async () => ({ embedding: [0.1, 0.2] }),
        embedBatch: async input => ({ embeddings: input.texts.map(() => [0.1, 0.2]), model: 'fake-embedding' })
      },
      vectorStore: {
        search: async () => ({ hits: [] }),
        upsert: async input => ({ upsertedCount: input.records.length }),
        delete: async input => ({ deletedCount: input.ids?.length ?? 0 })
      }
    }
  };
}

function isGenerateInput(value: unknown): value is { messages: Array<{ content: string }> } {
  return typeof value === 'object' && value !== null && 'messages' in value && Array.isArray(value.messages);
}
