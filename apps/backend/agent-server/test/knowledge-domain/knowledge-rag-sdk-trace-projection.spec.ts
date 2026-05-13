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

describe('Knowledge RAG SDK trace projection', () => {
  it('persists projected SDK trace spans for streamed RAG without leaking provider secrets', async () => {
    const generate = vi.fn(async input => {
      if (isGenerateInput(input)) {
        const content = input.messages.map(message => message.content).join('\n');
        if (content.includes('可访问知识库')) {
          return {
            text: JSON.stringify({
              selectedKnowledgeBaseIds: [baseId],
              queryVariants: ['sdk trace projection'],
              searchMode: 'hybrid',
              selectionReason: 'SDK planner selected the trace projection KB.',
              confidence: 0.91
            }),
            model: 'fake-chat',
            providerId: 'fake'
          };
        }
      }

      return {
        text: 'SDK streamed answer should cite the backend trace projection chunk.',
        model: 'fake-chat',
        providerId: 'fake',
        rawResponse: { apiKey: 'sk-should-not-leak' }
      };
    });
    const runtime = enabledSdkRuntime({ generate });
    const { baseId, rag, repository, traces } = await createRagServices('Backend trace projection chunk.', runtime);

    const events = [];
    for await (const event of rag.stream(actor, {
      knowledgeBaseId: baseId,
      message: 'sdk trace projection'
    })) {
      KnowledgeRagStreamEventSchema.parse(event);
      events.push(event);
    }

    const conversations = await repository.listChatConversationsForUser(actor.userId);
    const messages = await repository.listChatMessages(conversations.items[0].id, actor.userId);
    const trace = traces.getTrace(messages.items[1]?.traceId ?? '');
    expect(events.map(event => event.type)).toContain('rag.completed');
    expect(trace?.status).toBe('ok');
    expect(trace?.spans).toContainEqual(
      expect.objectContaining({
        name: 'retrieve',
        attributes: expect.objectContaining({
          sdkTraceId: messages.items[1]?.traceId,
          sdkEventName: 'runtime.retrieval.complete',
          retrievalMode: 'hybrid',
          hitCount: 1
        })
      })
    );
    expect(trace?.spans).toContainEqual(
      expect.objectContaining({
        name: 'generate',
        attributes: expect.objectContaining({
          sdkEventName: 'runtime.generation.complete',
          citedChunkCount: 1
        })
      })
    );
    expect(JSON.stringify(trace)).not.toContain('sk-should-not-leak');
    expect(JSON.stringify(trace)).not.toContain('rawResponse');
  });

  it('projects selection trace as redacted retrieval selection counts', () => {
    const service = new KnowledgeTraceService();
    const traceId = service.startTrace({
      operation: 'retrieval.run'
    });

    service.projectSdkTrace(traceId, {
      traceId: 'sdk-trace-1',
      status: 'succeeded',
      startedAt: '2026-05-11T00:00:00.000Z',
      events: [
        {
          eventId: 'event-1',
          traceId: 'sdk-trace-1',
          name: 'runtime.retrieval.complete',
          stage: 'retrieval',
          occurredAt: '2026-05-11T00:00:00.500Z',
          retrieval: {
            hits: [],
            citations: [],
            diagnostics: {
              retrievalMode: 'hybrid',
              candidateCount: 3,
              selectedCount: 1,
              latencyMs: 100,
              selectionTrace: [
                {
                  chunkId: 'chunk-low',
                  sourceId: 'source-a',
                  selected: false,
                  stage: 'filtering',
                  reason: 'low-score',
                  score: 0.01
                },
                {
                  chunkId: 'chunk-selected',
                  sourceId: 'source-b',
                  selected: true,
                  stage: 'post-processor',
                  reason: 'selected',
                  score: 0.9,
                  order: 0
                }
              ]
            }
          }
        }
      ],
      metrics: []
    });

    const projected = service.getTrace(traceId);
    const retrievalSpan = projected?.spans.find(span => span.name === 'retrieve');

    expect(retrievalSpan?.attributes).toMatchObject({
      retrievalMode: 'hybrid',
      candidateCount: 3,
      selectedCount: 1,
      droppedCount: 1,
      dropReasons: {
        'low-score': 1
      }
    });
  });

  it('projects a sanitized SDK failure span when answer generation throws after retrieval', async () => {
    let generateCallCount = 0;
    const generate = vi.fn(async input => {
      generateCallCount += 1;
      if (generateCallCount === 1 && isGenerateInput(input)) {
        return {
          text: JSON.stringify({
            selectedKnowledgeBaseIds: [baseId],
            queryVariants: ['sdk trace failure'],
            searchMode: 'hybrid',
            selectionReason: 'SDK planner selected the failure KB.',
            confidence: 0.91
          }),
          model: 'fake-chat',
          providerId: 'fake'
        };
      }

      throw new Error('Authorization: Bearer secret-token apiKey=sk-should-not-leak raw vendor body');
    });
    const runtime = enabledSdkRuntime({ generate });
    const { baseId, rag, repository, traces } = await createRagServices('Backend trace failure chunk.', runtime);

    const events = [];
    await expect(async () => {
      for await (const event of rag.stream(actor, {
        knowledgeBaseId: baseId,
        message: 'sdk trace failure'
      })) {
        events.push(event);
      }
    }).rejects.toThrow('Authorization');

    const conversations = await repository.listChatConversationsForUser(actor.userId);
    const messages = await repository.listChatMessages(conversations.items[0].id, actor.userId);
    const trace = traces.listTraces()[0];
    expect(events.map(event => event.type)).toContain('retrieval.completed');
    expect(trace?.status).toBe('error');
    expect(trace?.spans).toContainEqual(
      expect.objectContaining({
        name: 'generate',
        status: 'error',
        error: {
          code: 'Error',
          message: 'Knowledge RAG SDK event failed.'
        }
      })
    );
    expect(JSON.stringify(trace)).not.toContain('secret-token');
    expect(JSON.stringify(trace)).not.toContain('sk-should-not-leak');
    expect(JSON.stringify(trace)).not.toContain('raw vendor body');
  });
});

async function createRagServices(content: string, sdkRuntime: KnowledgeSdkRuntimeProviderValue) {
  const repository = new KnowledgeMemoryRepository();
  const storage = new InMemoryOssStorageProvider();
  const baseService = new KnowledgeBaseService(repository);
  const upload = new KnowledgeUploadService(repository, storage);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const queue = new KnowledgeIngestionQueue(worker);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  const traces = new KnowledgeTraceService();
  const rag = new KnowledgeRagService(repository, traces, sdkRuntime);
  const base = await baseService.createBase(actor, { name: 'Trace KB', description: '' });
  const uploaded = await upload.uploadFile(actor, base.id, {
    originalname: 'trace.md',
    mimetype: 'text/markdown',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  });

  queue.start();
  await documents.createFromUpload(actor, base.id, {
    uploadId: uploaded.uploadId,
    objectKey: uploaded.objectKey,
    filename: uploaded.filename,
    title: 'Trace Runbook'
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
