import { describe, expect, it, vi } from 'vitest';

import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
import { KnowledgeIngestionWorker } from '../../src/knowledge/knowledge-ingestion.worker';
import { KnowledgeRagService } from '../../src/knowledge/knowledge-rag.service';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { KnowledgeTraceService } from '../../src/knowledge/knowledge-trace.service';
import { KnowledgeRagModelProfileService } from '../../src/knowledge/rag/knowledge-rag-model-profile.service';
import { KnowledgeRagSdkFacade } from '../../src/knowledge/rag/knowledge-rag-sdk.facade';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/knowledge/runtime/knowledge-sdk-runtime.provider';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

type EnabledKnowledgeSdkRuntime = Extract<KnowledgeSdkRuntimeProviderValue, { enabled: true }>['runtime'];
type KnowledgeSdkChatProviderStream = NonNullable<EnabledKnowledgeSdkRuntime['chatProvider']['stream']>;

describe('Knowledge RAG SDK facade', () => {
  it('lets the SDK planner select accessible knowledge bases without chat metadata and maps repository hits to chat response', async () => {
    const generate = vi.fn(async input => ({
      text: 'SDK answer: SDK planner 可以在没有 metadata 时选择用户可访问知识库。',
      model: 'fake-chat',
      providerId: 'fake',
      metadata: input.metadata
    }));
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        generate
      })
    );
    await repository.createDocument({
      id: 'doc_rag',
      workspaceId: 'default',
      knowledgeBaseId: baseId,
      uploadId: 'upload_rag',
      objectKey: 'knowledge/kb/sdk-rag.md',
      filename: 'sdk-rag.md',
      title: 'SDK RAG Runbook',
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
    await repository.saveChunks('doc_rag', [
      {
        id: 'chunk_rag',
        documentId: 'doc_rag',
        ordinal: 0,
        content: 'SDK planner 可以在没有 metadata 时选择用户可访问知识库。',
        tokenCount: 12,
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'succeeded',
        keywordIndexStatus: 'succeeded',
        createdAt: '2026-05-03T08:00:00.000Z',
        updatedAt: '2026-05-03T08:00:00.000Z'
      }
    ]);

    const response = await documents.chat(actor, {
      message: '没有 metadata 时 SDK planner 怎么选择知识库？',
      stream: false
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('SDK planner 可以在没有 metadata 时选择用户可访问知识库。')
          })
        ]),
        metadata: expect.objectContaining({
          selectedKnowledgeBaseIds: [baseId],
          hitCount: 1,
          citationCount: 1
        })
      })
    );
    expect(response).toMatchObject({
      answer: 'SDK answer: SDK planner 可以在没有 metadata 时选择用户可访问知识库。',
      route: { requestedMentions: [], selectedKnowledgeBaseIds: [baseId], reason: 'fallback-all' },
      diagnostics: { retrievalMode: 'hybrid', hitCount: 1, contextChunkCount: 1 },
      citations: [
        {
          documentId: 'doc_rag',
          chunkId: 'chunk_rag',
          title: 'SDK RAG Runbook',
          quote: 'SDK planner 可以在没有 metadata 时选择用户可访问知识库。'
        }
      ],
      assistantMessage: {
        content: 'SDK answer: SDK planner 可以在没有 metadata 时选择用户可访问知识库。',
        citations: [expect.objectContaining({ documentId: 'doc_rag', chunkId: 'chunk_rag' })]
      }
    });
    expect(response.conversationId).toMatch(/^conv_/);
    expect(response.traceId).toBeTruthy();
  });

  it('only cites ready, indexed, non-empty, query-matching repository chunks', async () => {
    const generate = vi.fn(async input => ({
      text: 'SDK answer: only grounded chunks.',
      model: 'fake-chat',
      providerId: 'fake',
      metadata: input.metadata
    }));
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        generate
      })
    );
    await seedDocument(repository, baseId, {
      documentId: 'doc_ready',
      chunkId: 'chunk_ready',
      title: 'Rotation Runbook',
      content: 'Rotate signing keys every 90 days.'
    });
    await seedDocument(repository, baseId, {
      documentId: 'doc_processing',
      chunkId: 'chunk_processing',
      title: 'Processing Draft',
      status: 'processing',
      content: 'Rotate draft content must not be cited.'
    });
    await seedDocument(repository, baseId, {
      documentId: 'doc_empty',
      chunkId: 'chunk_empty',
      title: 'Empty Chunk',
      content: '   '
    });
    await seedDocument(repository, baseId, {
      documentId: 'doc_unindexed',
      chunkId: 'chunk_unindexed',
      title: 'Unindexed Chunk',
      vectorIndexStatus: 'pending',
      keywordIndexStatus: 'pending',
      content: 'Rotate unindexed content must not be cited.'
    });
    await seedDocument(repository, baseId, {
      documentId: 'doc_unmatched',
      chunkId: 'chunk_unmatched',
      title: 'Unmatched Chunk',
      content: 'Database backup retention window.'
    });

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'rotate signing keys'
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ hitCount: 1, citationCount: 1 })
      })
    );
    expect(response).toMatchObject({
      diagnostics: { retrievalMode: 'hybrid', hitCount: 1, contextChunkCount: 1 },
      citations: [
        {
          documentId: 'doc_ready',
          chunkId: 'chunk_ready',
          quote: 'Rotate signing keys every 90 days.'
        }
      ]
    });
  });

  it('does not cite ready repository chunks that have no query term overlap', async () => {
    const generate = vi.fn(async () => ({
      text: 'should not be called',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        generate
      })
    );
    await seedDocument(repository, baseId, {
      documentId: 'doc_unmatched',
      chunkId: 'chunk_unmatched',
      title: 'Backup Runbook',
      content: 'Database backup retention window.'
    });

    const response = await documents.chat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'rotate signing keys'
    });

    expect(generate).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      answer: '未在当前知识库中找到足够依据。',
      citations: [],
      diagnostics: { retrievalMode: 'none', hitCount: 0, contextChunkCount: 0 }
    });
  });

  it('bridges SDK chat provider streams to RAG answer delta events', async () => {
    const generate = vi.fn(async () => ({
      text: 'should not be called',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const stream = vi.fn(async function* () {
      yield { type: 'delta' as const, text: 'streamed ' };
      yield { type: 'delta' as const, text: 'answer' };
      yield {
        type: 'done' as const,
        result: {
          text: 'streamed answer',
          model: 'fake-chat',
          providerId: 'fake'
        }
      };
    }) satisfies KnowledgeSdkChatProviderStream;
    const { documents, repository, baseId } = await createService(
      enabledSdkRuntime({
        generate,
        stream
      })
    );
    await seedDocument(repository, baseId, {
      documentId: 'doc_stream',
      chunkId: 'chunk_stream',
      title: 'Streaming Runbook',
      content: 'Streaming answers emit answer.delta before completion.'
    });

    const events = [];
    for await (const event of documents.streamChat(actor, {
      knowledgeBaseIds: [baseId],
      message: 'streaming answers'
    })) {
      events.push(event);
    }

    expect(stream).toHaveBeenCalledOnce();
    expect(generate).not.toHaveBeenCalled();
    expect(events.filter(event => event.type === 'answer.delta')).toEqual([
      expect.objectContaining({ type: 'answer.delta', delta: 'streamed ' }),
      expect.objectContaining({ type: 'answer.delta', delta: 'answer' })
    ]);
    expect(events.find(event => event.type === 'answer.completed')).toMatchObject({
      answer: {
        text: 'streamed answer',
        noAnswer: false,
        citations: [expect.objectContaining({ chunkId: 'chunk_stream' })]
      }
    });
  });

  it('finishes stream traces when the consumer closes the iterator early', async () => {
    const stream = vi.fn(async function* () {
      yield { type: 'delta' as const, text: 'partial' };
    }) satisfies KnowledgeSdkChatProviderStream;
    const { documents, repository, traces, baseId } = await createService(
      enabledSdkRuntime({
        stream
      })
    );
    await seedDocument(repository, baseId, {
      documentId: 'doc_stream_close',
      chunkId: 'chunk_stream_close',
      title: 'Streaming Close Runbook',
      content: 'Streaming clients can close connections early.'
    });

    const iterator = documents
      .streamChat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'streaming clients'
      })
      [Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({ value: { type: 'rag.started' } });
    await iterator.return?.();

    expect(traces.listTraces()[0]).toMatchObject({
      status: 'error',
      endedAt: expect.any(String)
    });
  });

  it('fails stream responses when fallback generate records an answer provider error', async () => {
    const generate = vi.fn(async () => {
      throw new Error('llm unavailable');
    });
    const { documents, repository, traces, baseId } = await createService(enabledSdkRuntime({ generate }));
    await seedDocument(repository, baseId, {
      documentId: 'doc_stream_generate_error',
      chunkId: 'chunk_stream_generate_error',
      title: 'Stream Generate Error Runbook',
      content: 'Stream generate errors must not complete successfully.'
    });

    const events: unknown[] = [];
    await expect(async () => {
      for await (const event of documents.streamChat(actor, {
        knowledgeBaseIds: [baseId],
        message: 'stream generate errors'
      })) {
        events.push(event);
      }
    }).rejects.toMatchObject({
      name: 'KnowledgeServiceError',
      code: 'knowledge_chat_failed',
      message: 'llm unavailable'
    });

    expect(events.some(event => isStreamEventType(event, 'rag.completed'))).toBe(false);
    expect(traces.listTraces()[0]).toMatchObject({
      status: 'error',
      endedAt: expect.any(String)
    });
  });

  it('uses the requested model profile planner model before facade retrieval', async () => {
    let selectedBaseId = '';
    const generate = vi.fn(async input => {
      if (isGenerateInput(input) && input.model === 'planner-model') {
        return {
          text: JSON.stringify({
            rewrittenQuery: 'planner route sdk',
            queryVariants: ['planner route sdk'],
            selectedKnowledgeBaseIds: [selectedBaseId],
            searchMode: 'hybrid',
            selectionReason: 'planner selected requested profile model',
            confidence: 0.91
          }),
          model: 'planner-model',
          providerId: 'fake'
        };
      }

      return {
        text: 'SDK answer from model profile planner route.',
        model: 'fake-chat',
        providerId: 'fake'
      };
    });
    const runtime = enabledSdkRuntime({ generate });
    const { repository, baseId } = await createService(runtime);
    selectedBaseId = baseId;
    await seedDocument(repository, baseId, {
      documentId: 'doc_profile_planner',
      chunkId: 'chunk_profile_planner',
      title: 'Planner Profile Runbook',
      content: 'Planner route sdk terms match the selected knowledge base.'
    });

    const response = await new KnowledgeRagSdkFacade(repository, runtime).answer({
      actor,
      request: { message: 'planner route sdk' },
      accessibleBases: await repository.listBasesForUser(actor.userId),
      preferredKnowledgeBaseIds: [],
      modelProfile: {
        id: 'coding-pro',
        label: 'Coding Pro',
        description: 'Planner profile',
        useCase: 'coding',
        plannerModelId: 'planner-model',
        answerModelId: 'answer-model',
        embeddingModelId: 'embedding-model',
        enabled: true
      },
      traceId: 'trace_profile',
      routeReason: 'fallback-all'
    });

    expect(generate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'planner-model',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: expect.stringContaining('planner route sdk') })
        ])
      })
    );
    expect(response).toMatchObject({
      answer: 'SDK answer from model profile planner route.',
      route: { selectedKnowledgeBaseIds: [baseId] },
      diagnostics: { hitCount: 1 }
    });
  });

  it('uses deterministic fallback without calling the LLM planner when SDK runtime is disabled', async () => {
    const { repository, baseId } = await createService(disabledSdkRuntime());
    await seedDocument(repository, baseId, {
      documentId: 'doc_disabled_runtime',
      chunkId: 'chunk_disabled_runtime',
      title: 'Disabled Runtime Runbook',
      content: 'Disabled runtime still searches accessible knowledge base content.'
    });

    const response = await new KnowledgeRagSdkFacade(repository, disabledSdkRuntime()).answer({
      actor,
      request: { message: 'disabled runtime searches accessible content' },
      accessibleBases: await repository.listBasesForUser(actor.userId),
      preferredKnowledgeBaseIds: [],
      modelProfile: {
        id: 'coding-pro',
        label: 'Coding Pro',
        description: 'Planner profile',
        useCase: 'coding',
        plannerModelId: 'planner-model',
        answerModelId: 'answer-model',
        embeddingModelId: 'embedding-model',
        enabled: true
      },
      traceId: 'trace_disabled_runtime',
      routeReason: 'fallback-all'
    });

    expect(response).toMatchObject({
      answer: 'Disabled runtime still searches accessible knowledge base content.',
      diagnostics: { hitCount: 1 },
      route: { selectedKnowledgeBaseIds: [baseId] }
    });
  });

  it('uses deterministic fallback without calling the LLM planner when explicit knowledge base ids are preferred', async () => {
    const generate = vi.fn(async () => ({
      text: 'Answer from explicit preferred KB route.',
      model: 'fake-chat',
      providerId: 'fake'
    }));
    const runtime = enabledSdkRuntime({ generate });
    const { repository, baseId } = await createService(runtime);
    await seedDocument(repository, baseId, {
      documentId: 'doc_explicit_route',
      chunkId: 'chunk_explicit_route',
      title: 'Explicit Route Runbook',
      content: 'Explicit preferred knowledge base ids bypass the LLM planner.'
    });

    const response = await new KnowledgeRagSdkFacade(repository, runtime).answer({
      actor,
      request: { message: 'explicit preferred knowledge base ids' },
      accessibleBases: await repository.listBasesForUser(actor.userId),
      preferredKnowledgeBaseIds: [baseId],
      modelProfile: {
        id: 'coding-pro',
        label: 'Coding Pro',
        description: 'Planner profile',
        useCase: 'coding',
        plannerModelId: 'planner-model',
        answerModelId: 'answer-model',
        embeddingModelId: 'embedding-model',
        enabled: true
      },
      traceId: 'trace_explicit_route',
      routeReason: 'legacy-ids'
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(expect.not.objectContaining({ model: 'planner-model' }));
    expect(response).toMatchObject({
      answer: 'Answer from explicit preferred KB route.',
      diagnostics: { hitCount: 1 },
      route: { selectedKnowledgeBaseIds: [baseId] }
    });
  });

  it('falls back to accessible knowledge bases when the LLM planner fails', async () => {
    const generate = vi.fn(async input => {
      if (isGenerateInput(input) && input.model === 'planner-model') {
        throw new Error('planner failed');
      }
      return {
        text: 'Answer after planner fallback.',
        model: 'fake-chat',
        providerId: 'fake'
      };
    });
    const runtime = enabledSdkRuntime({ generate });
    const { repository, baseId } = await createService(runtime);
    await seedDocument(repository, baseId, {
      documentId: 'doc_planner_fallback',
      chunkId: 'chunk_planner_fallback',
      title: 'Planner Fallback Runbook',
      content: 'Planner fallback searches all accessible knowledge bases.'
    });

    const response = await new KnowledgeRagSdkFacade(repository, runtime).answer({
      actor,
      request: { message: 'planner fallback searches accessible bases' },
      accessibleBases: await repository.listBasesForUser(actor.userId),
      preferredKnowledgeBaseIds: [],
      modelProfile: {
        id: 'coding-pro',
        label: 'Coding Pro',
        description: 'Planner profile',
        useCase: 'coding',
        plannerModelId: 'planner-model',
        answerModelId: 'answer-model',
        embeddingModelId: 'embedding-model',
        enabled: true
      },
      traceId: 'trace_planner_fallback',
      routeReason: 'fallback-all'
    });

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ model: 'planner-model' }));
    expect(response).toMatchObject({
      answer: 'Answer after planner fallback.',
      diagnostics: { hitCount: 1 },
      route: { selectedKnowledgeBaseIds: [baseId] }
    });
  });

  it('resolves request model profiles on the public chat path and passes planner model to the facade', async () => {
    let selectedBaseId = '';
    const generate = vi.fn(async input => {
      if (isGenerateInput(input) && input.model === 'planner-model-from-profile') {
        return {
          text: JSON.stringify({
            queryVariants: ['public chat model profile'],
            selectedKnowledgeBaseIds: [selectedBaseId],
            searchMode: 'hybrid',
            selectionReason: 'public chat selected profile planner',
            confidence: 0.92
          }),
          model: 'planner-model-from-profile',
          providerId: 'fake'
        };
      }

      return {
        text: 'Answer using public chat model profile.',
        model: 'fake-chat',
        providerId: 'fake'
      };
    });
    const runtime = enabledSdkRuntime({ generate });
    const modelProfiles = new KnowledgeRagModelProfileService({
      profiles: [
        {
          id: 'planner-profile',
          label: 'Planner Profile',
          description: 'Routes with a specific planner model.',
          useCase: 'coding',
          plannerModelId: 'planner-model-from-profile',
          answerModelId: 'answer-model',
          embeddingModelId: 'embedding-model',
          enabled: true
        }
      ]
    });
    const { documents, repository, baseId } = await createService(runtime, modelProfiles);
    selectedBaseId = baseId;
    await seedDocument(repository, baseId, {
      documentId: 'doc_public_model',
      chunkId: 'chunk_public_model',
      title: 'Public Model Runbook',
      content: 'Public chat model profile selects the planner model.'
    });

    const response = await documents.chat(actor, {
      model: 'planner-profile',
      message: 'public chat model profile'
    });

    expect(generate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'planner-model-from-profile'
      })
    );
    expect(response).toMatchObject({
      answer: 'Answer using public chat model profile.',
      diagnostics: { hitCount: 1 },
      route: { selectedKnowledgeBaseIds: [baseId] }
    });
  });

  it('maps disabled public chat model profiles to stable service errors', async () => {
    const modelProfiles = new KnowledgeRagModelProfileService({
      profiles: [
        {
          id: 'disabled-profile',
          label: 'Disabled Profile',
          description: 'Disabled for testing.',
          useCase: 'coding',
          plannerModelId: 'planner-model',
          answerModelId: 'answer-model',
          embeddingModelId: 'embedding-model',
          enabled: false
        }
      ]
    });
    const { documents } = await createService(enabledSdkRuntime({}), modelProfiles);

    await expect(
      documents.chat(actor, {
        model: 'disabled-profile',
        message: 'should reject disabled profile'
      })
    ).rejects.toMatchObject({
      name: 'KnowledgeServiceError',
      code: 'rag_model_profile_disabled'
    });
  });

  it('maps unknown public chat model profiles to stable service errors', async () => {
    const modelProfiles = new KnowledgeRagModelProfileService({
      profiles: [
        {
          id: 'planner-profile',
          label: 'Planner Profile',
          description: 'Enabled profile for testing.',
          useCase: 'coding',
          plannerModelId: 'planner-model',
          answerModelId: 'answer-model',
          embeddingModelId: 'embedding-model',
          enabled: true
        }
      ]
    });
    const { documents } = await createService(enabledSdkRuntime({}), modelProfiles);

    await expect(
      documents.chat(actor, {
        model: 'missing-profile',
        message: 'should reject missing profile'
      })
    ).rejects.toMatchObject({
      name: 'KnowledgeServiceError',
      code: 'rag_model_profile_not_found'
    });
  });
});

async function createService(
  sdkRuntime: KnowledgeSdkRuntimeProviderValue,
  modelProfiles?: KnowledgeRagModelProfileService
) {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage, disabledSdkRuntime());
  const traces = new KnowledgeTraceService();
  const ragService = new KnowledgeRagService(repository, sdkRuntime, traces);
  const documents = new KnowledgeDocumentService(repository, worker, storage, sdkRuntime, ragService, modelProfiles);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return { documents, repository, traces, baseId: base.id };
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
  generate?: (input: unknown) => Promise<{ text: string; model: string; providerId: string }>;
  stream?: KnowledgeSdkChatProviderStream;
}): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate:
          input.generate ?? (async () => ({ text: 'generated answer', model: 'fake-chat', providerId: 'fake' })),
        ...(input.stream ? { stream: input.stream } : {})
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText: async () => ({
          embedding: [1, 2],
          model: 'fake-embedding'
        }),
        embedBatch: async ({ texts }) => ({
          embeddings: texts.map((_, index) => [index + 1, index + 2]),
          model: 'fake-embedding'
        })
      },
      vectorStore: {
        upsert: async ({ records }) => ({ upsertedCount: records.length }),
        search: async () => ({ hits: [] }),
        delete: async () => ({ deletedCount: 0 })
      }
    }
  };
}

function isGenerateInput(value: unknown): value is { model?: string } {
  return typeof value === 'object' && value !== null && 'messages' in value;
}

function isStreamEventType(value: unknown, type: string): boolean {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === type;
}

async function seedDocument(
  repository: InMemoryKnowledgeRepository,
  baseId: string,
  input: {
    documentId: string;
    chunkId: string;
    title: string;
    content: string;
    status?: 'queued' | 'processing' | 'ready' | 'failed';
    vectorIndexStatus?: 'pending' | 'succeeded' | 'failed';
    keywordIndexStatus?: 'pending' | 'succeeded' | 'failed';
  }
) {
  await repository.createDocument({
    id: input.documentId,
    workspaceId: 'default',
    knowledgeBaseId: baseId,
    uploadId: `upload_${input.documentId}`,
    objectKey: `knowledge/${baseId}/${input.documentId}.md`,
    filename: `${input.documentId}.md`,
    title: input.title,
    sourceType: 'user-upload',
    status: input.status ?? 'ready',
    version: 'v1',
    chunkCount: 1,
    embeddedChunkCount: 1,
    createdBy: actor.userId,
    metadata: {},
    createdAt: '2026-05-03T08:00:00.000Z',
    updatedAt: '2026-05-03T08:00:00.000Z'
  });
  await repository.saveChunks(input.documentId, [
    {
      id: input.chunkId,
      documentId: input.documentId,
      ordinal: 0,
      content: input.content,
      tokenCount: 8,
      embeddingStatus: 'succeeded',
      vectorIndexStatus: input.vectorIndexStatus ?? 'succeeded',
      keywordIndexStatus: input.keywordIndexStatus ?? 'succeeded',
      createdAt: '2026-05-03T08:00:00.000Z',
      updatedAt: '2026-05-03T08:00:00.000Z'
    }
  ]);
}
