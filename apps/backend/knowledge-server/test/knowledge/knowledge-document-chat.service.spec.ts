import { describe, expect, it, vi } from 'vitest';

import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
import { KnowledgeIngestionWorker } from '../../src/knowledge/knowledge-ingestion.worker';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/knowledge/runtime/knowledge-sdk-runtime.provider';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';
import { KnowledgeRagService } from '../../src/knowledge/knowledge-rag.service';
import { KnowledgeTraceService } from '../../src/knowledge/knowledge-trace.service';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('KnowledgeDocumentService chat SDK RAG', () => {
  it('answers through the enabled SDK answer provider with repository-backed SDK RAG citations', async () => {
    const embedText = vi.fn(async ({ text }: { text: string }) => ({
      embedding: [text.length, 1],
      model: 'fake-embed'
    }));
    const search = vi.fn(async () => ({ hits: [] }));
    const generate = vi.fn(async () => ({
      text: 'Keys should rotate every 90 days.',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        embedText,
        search,
        generate
      })
    );
    await seedDocument(repository, baseId, {
      documentId: 'doc_1',
      chunkId: 'chunk_1',
      title: 'Rotation Runbook',
      content: 'Rotate signing keys every 90 days.'
    });

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'How often should we rotate signing keys?'
    });

    expect(embedText).toHaveBeenCalledWith({ text: 'How often should we rotate signing keys?' });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: ['How often should we rotate signing keys?'.length, 1],
        filters: expect.objectContaining({ knowledgeBaseId: baseId, tenantId: 'default' })
      })
    );
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('只基于') }),
          expect.objectContaining({ role: 'user', content: 'How often should we rotate signing keys?' }),
          expect.objectContaining({ content: expect.stringContaining('Rotate signing keys every 90 days.') })
        ]),
        metadata: expect.objectContaining({ selectedKnowledgeBaseIds: [baseId], hitCount: 1, citationCount: 1 })
      })
    );
    expect(response).toMatchObject({
      answer: 'Keys should rotate every 90 days.',
      route: { selectedKnowledgeBaseIds: [baseId], reason: 'legacy-ids' },
      diagnostics: { retrievalMode: 'keyword-only', hitCount: 1, contextChunkCount: 1 },
      citations: [
        {
          documentId: 'doc_1',
          chunkId: 'chunk_1',
          title: 'Rotation Runbook',
          quote: 'Rotate signing keys every 90 days.'
        }
      ],
      assistantMessage: {
        content: 'Keys should rotate every 90 days.',
        citations: [expect.objectContaining({ documentId: 'doc_1' })]
      }
    });
  });

  it('returns route diagnostics and repository citations grounded in retrieved chunks', async () => {
    const { documents, repository, baseId } = await createService(disabledSdkRuntime());
    await repository.createDocument({
      id: 'doc_1',
      workspaceId: 'default',
      knowledgeBaseId: baseId,
      uploadId: 'upload_1',
      objectKey: 'knowledge/kb_1/upload_1/rag.md',
      filename: 'rag.md',
      title: 'Trustworthy RAG',
      sourceType: 'user-upload',
      status: 'ready',
      version: 'v1',
      chunkCount: 1,
      embeddedChunkCount: 1,
      createdBy: actor.userId,
      metadata: {},
      createdAt: '2026-05-03T08:00:00.000Z',
      updatedAt: '2026-05-03T08:00:00.000Z'
    });
    await repository.saveChunks('doc_1', [
      {
        id: 'chunk_1',
        documentId: 'doc_1',
        ordinal: 0,
        content: 'citation 必须来自 retrieval hits',
        tokenCount: 4,
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'succeeded',
        keywordIndexStatus: 'succeeded',
        createdAt: '2026-05-03T08:00:00.000Z',
        updatedAt: '2026-05-03T08:00:00.000Z'
      }
    ]);

    const response = await documents.chat(actor, {
      model: 'knowledge-default',
      messages: [{ role: 'user', content: '@Engineering KB citation retrieval hits 怎么保证可信？' }],
      metadata: { conversationId: 'conv_1', mentions: [{ type: 'knowledge_base', label: 'Engineering KB' }] },
      stream: false
    });

    expect(response).toMatchObject({
      route: { selectedKnowledgeBaseIds: [baseId], reason: 'mentions' },
      diagnostics: { retrievalMode: 'keyword-only', hitCount: 1, contextChunkCount: 1 },
      citations: [{ chunkId: 'chunk_1', documentId: 'doc_1', quote: 'citation 必须来自 retrieval hits' }]
    });
  });

  it('persists user and assistant messages for non-stream chat', async () => {
    const { documents, repository, baseId } = await createService(disabledSdkRuntime());
    await seedDocument(repository, baseId, {
      content: 'PreRetrievalPlanner 是检索前规划器，会生成 query rewrite 和 query variants。'
    });

    const response = await documents.chat(actor, {
      model: 'coding-pro',
      messages: [{ role: 'user', content: '检索前技术名词' }],
      stream: false
    });

    const messages = await repository.listChatMessages(response.conversationId, actor.userId);
    expect(messages.items).toEqual([
      expect.objectContaining({
        role: 'user',
        content: '检索前技术名词',
        modelProfileId: 'coding-pro'
      }),
      expect.objectContaining({
        role: 'assistant',
        content: response.answer,
        traceId: response.traceId,
        modelProfileId: 'coding-pro',
        diagnostics: response.diagnostics,
        citations: response.citations
      })
    ]);
  });

  it('persists final assistant message after rag.completed stream event', async () => {
    const { documents, repository, baseId } = await createService(disabledSdkRuntime());
    await seedDocument(repository, baseId, {
      content: 'PreRetrievalPlanner stream completion should persist assistant messages.'
    });
    const events = [];

    for await (const event of documents.streamChat(actor, {
      model: 'coding-pro',
      messages: [{ role: 'user', content: 'PreRetrievalPlanner stream completion' }],
      stream: true
    })) {
      events.push(event);
    }

    const completed = events.find(event => event.type === 'rag.completed');
    expect(completed).toBeDefined();
    const conversations = await repository.listChatConversationsForUser(actor.userId);
    expect(conversations.items).toHaveLength(1);
    const messages = await repository.listChatMessages(conversations.items[0]!.id, actor.userId);
    expect(messages.items.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages.items[1]).toMatchObject({
      modelProfileId: 'coding-pro',
      traceId: expect.stringMatching(/^trace_/),
      diagnostics: expect.any(Object)
    });
  });

  it('falls back to repository keyword retrieval when SDK vector search fails', async () => {
    const search = vi.fn(async () => {
      throw new Error('vector backend unavailable');
    });
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        search
      })
    );
    await seedDocument(repository, baseId, {
      content: 'rotation policy comes from repository chunks'
    });

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'rotation policy'
      })
    ).resolves.toMatchObject({
      route: { selectedKnowledgeBaseIds: [baseId], reason: 'legacy-ids' },
      diagnostics: { hitCount: 1 }
    });
    expect(search).toHaveBeenCalledOnce();
  });

  it('does not prompt the chat provider when repository retrieval has no grounded hits', async () => {
    const generate = vi.fn(async () => ({
      text: '依据不足。',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        generate
      })
    );

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'rotation policy'
    });

    expect(response.citations).toEqual([]);
    expect(response.answer).toBe('未在当前知识库中找到足够依据。');
    expect(generate).not.toHaveBeenCalled();
  });

  it('does not return model-invented citations when retrieval has no grounded hits', async () => {
    const { documents, baseId } = await createService(
      enabledSdkRuntime({
        search: vi.fn(async () => ({ hits: [] })),
        generate: vi.fn(async () => ({
          text: '模型声称引用了不存在的文档。',
          model: 'fake-chat',
          providerId: 'fake',
          citations: [{ chunkId: 'invented', documentId: 'invented' }]
        }))
      })
    );

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: '没有命中时怎么办？'
    });

    expect(response).toMatchObject({
      citations: [],
      diagnostics: { hitCount: 0, contextChunkCount: 0 }
    });
  });

  it('keeps explicit knowledgeBaseIds compatible while reading citations from repository chunks', async () => {
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        generate: vi.fn(async () => ({
          text: 'Repository citation answer.',
          model: 'fake-chat',
          providerId: 'fake'
        }))
      })
    );
    await seedDocument(repository, baseId, {
      documentId: 'doc_legacy',
      chunkId: 'chunk_legacy',
      title: 'legacy.md',
      content: 'Legacy repository metadata quote.'
    });

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'legacy metadata'
      })
    ).resolves.toMatchObject({
      citations: [
        expect.objectContaining({
          documentId: 'doc_legacy',
          chunkId: 'chunk_legacy',
          quote: 'Legacy repository metadata quote.'
        })
      ]
    });
  });

  it('surfaces knowledge_chat_failed when SDK chat generation fails', async () => {
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        generate: vi.fn(async () => {
          throw new Error('llm unavailable');
        })
      })
    );
    await seedDocument(repository, baseId, {
      content: 'rotation policy requires generated answer'
    });

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'rotation policy'
      })
    ).rejects.toMatchObject({
      code: 'knowledge_chat_failed',
      message: 'llm unavailable'
    });
  });

  it('records retrieve trace hitCount from retrieval diagnostics instead of final citations', async () => {
    const { documents, repository, traces, baseId } = await createService(
      enabledSdkRuntime({
        generate: vi.fn(async () => ({
          text: '   ',
          model: 'fake-chat',
          providerId: 'fake'
        }))
      })
    );
    await seedDocument(repository, baseId, {
      content: 'rotation policy requires generated answer'
    });

    await expect(
      documents.chat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'rotation policy'
      })
    ).resolves.toMatchObject({
      answer: '未在当前知识库中找到足够依据。',
      citations: [],
      diagnostics: { hitCount: 1, contextChunkCount: 1 }
    });

    const trace = traces.listTraces()[0];
    expect(trace?.spans.find(span => span.name === 'retrieve')).toMatchObject({
      attributes: { retrievalMode: 'keyword-only', hitCount: 1 }
    });
    expect(trace?.spans.find(span => span.name === 'generate')).toMatchObject({
      attributes: { contextChunkCount: 1 }
    });
  });
});

async function createService(sdkRuntime: KnowledgeSdkRuntimeProviderValue) {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage, disabledSdkRuntime());
  const traces = new KnowledgeTraceService();
  const ragService = new KnowledgeRagService(repository, sdkRuntime, traces);
  const documents = new KnowledgeDocumentService(repository, worker, storage, sdkRuntime, ragService);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return { documents, repository, traces, baseId: base.id };
}

async function seedDocument(
  repository: InMemoryKnowledgeRepository,
  baseId: string,
  input: {
    documentId?: string;
    chunkId?: string;
    title?: string;
    content: string;
  }
) {
  const documentId = input.documentId ?? 'doc_seed';
  await repository.createDocument({
    id: documentId,
    workspaceId: 'default',
    knowledgeBaseId: baseId,
    uploadId: `upload_${documentId}`,
    objectKey: `knowledge/${baseId}/${documentId}.md`,
    filename: `${documentId}.md`,
    title: input.title ?? 'Seed Document',
    sourceType: 'user-upload',
    status: 'ready',
    version: 'v1',
    chunkCount: 1,
    embeddedChunkCount: 1,
    createdBy: actor.userId,
    metadata: {},
    createdAt: '2026-05-03T08:00:00.000Z',
    updatedAt: '2026-05-03T08:00:00.000Z'
  });
  await repository.saveChunks(documentId, [
    {
      id: input.chunkId ?? 'chunk_seed',
      documentId,
      ordinal: 0,
      content: input.content,
      tokenCount: 8,
      embeddingStatus: 'succeeded',
      vectorIndexStatus: 'succeeded',
      keywordIndexStatus: 'succeeded',
      createdAt: '2026-05-03T08:00:00.000Z',
      updatedAt: '2026-05-03T08:00:00.000Z'
    }
  ]);
}

function disabledSdkRuntime(): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: false,
    reason: 'missing_env',
    missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
    runtime: null
  };
}

function enabledSdkRuntime(input: {
  embedText?: (input: { text: string }) => Promise<{ embedding: number[]; model: string }>;
  search?: (input: {
    embedding: number[];
    topK: number;
    filters?: Record<string, unknown>;
  }) => Promise<{ hits: Array<{ id: string; score: number; content?: string; metadata?: Record<string, unknown> }> }>;
  generate?: (input: unknown) => Promise<{ text: string; model: string; providerId: string }>;
}): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate: input.generate ?? (async () => ({ text: 'generated answer', model: 'fake-chat', providerId: 'fake' }))
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText: input.embedText ?? (async () => ({ embedding: [1, 2], model: 'fake-embedding' })),
        embedBatch: async ({ texts }) => ({
          embeddings: texts.map((_, index) => [index + 1, index + 2]),
          model: 'fake-embedding'
        })
      },
      vectorStore: {
        upsert: async ({ records }) => ({ upsertedCount: records.length }),
        search: input.search ?? (async () => ({ hits: [] })),
        delete: async () => ({ deletedCount: 0 })
      }
    }
  };
}
