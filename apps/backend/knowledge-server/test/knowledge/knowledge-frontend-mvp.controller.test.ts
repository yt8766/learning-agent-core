import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { KnowledgeFrontendMvpController } from '../../src/knowledge/knowledge-frontend-mvp.controller';
import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
import { KnowledgeIngestionQueue } from '../../src/knowledge/knowledge-ingestion.queue';
import { KnowledgeServiceError } from '../../src/knowledge/knowledge.errors';
import { KnowledgeIngestionWorker } from '../../src/knowledge/knowledge-ingestion.worker';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { KnowledgeUploadService } from '../../src/knowledge/knowledge-upload.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { InMemoryOssStorageProvider } from '../../src/knowledge/storage/in-memory-oss-storage.provider';

const actor = { userId: 'user_1', username: 'dev', roles: ['user'] };

describe('KnowledgeFrontendMvpController', () => {
  const controller = new KnowledgeFrontendMvpController();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves frontend dashboard, documents, observability and eval list endpoints', () => {
    expect(controller.getDashboardOverview()).toMatchObject({
      activeAlertCount: expect.any(Number),
      recentEvalRuns: expect.any(Array),
      recentFailedJobs: expect.any(Array),
      recentLowScoreTraces: expect.any(Array),
      topMissingKnowledgeQuestions: expect.any(Array)
    });
    expect(controller.listDocuments()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.getObservabilityMetrics()).toMatchObject({
      stageLatency: expect.any(Array),
      traceCount: expect.any(Number)
    });
    expect(controller.listTraces()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.listEvalDatasets()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.listEvalRuns()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.reprocessDocument('doc_1').job).toMatchObject({ progress: { percent: 0 } });
  });
  it('serves eval run details and comparisons for frontend workflows', () => {
    expect(controller.listEvalRunResults()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.compareEvalRuns({ baselineRunId: 'run_1', candidateRunId: 'run_2' })).toEqual({
      baselineRunId: 'run_1',
      candidateRunId: 'run_2',
      generationScoreDelta: 0,
      perMetricDelta: {},
      retrievalScoreDelta: 0,
      totalScoreDelta: 0
    });
  });
  it('answers chat lab requests from stored document chunks with citation projections', async () => {
    const { controller: frontend, upload, documents, baseId } = await createFrontendController();
    const { document } = await documents.createFromUpload(actor, baseId, {
      ...(await uploadFixture(
        upload,
        baseId,
        'rotation-runbook.md',
        'Rotate signing keys every 90 days.\n\nEscalate expired credentials.'
      )),
      title: 'Rotation Runbook'
    });
    await expect(
      frontend.chat(actor, {
        knowledgeBaseId: baseId,
        knowledgeBaseIds: [baseId],
        message: 'How often should we rotate signing keys?'
      })
    ).resolves.toMatchObject({
      conversationId: expect.any(String),
      userMessage: expect.objectContaining({ role: 'user', content: 'How often should we rotate signing keys?' }),
      assistantMessage: expect.objectContaining({ role: 'assistant' }),
      answer: expect.stringContaining('Rotate signing keys every 90 days.'),
      citations: [
        expect.objectContaining({
          id: expect.any(String),
          documentId: document.id,
          chunkId: expect.any(String),
          title: 'Rotation Runbook',
          quote: 'Rotate signing keys every 90 days.',
          score: expect.any(Number)
        })
      ],
      traceId: expect.any(String)
    });
  });
  it('accepts OpenAI-compatible chat completion requests for chat lab', async () => {
    const { controller: frontend, upload, documents, baseId } = await createFrontendController();
    const content = 'core包如何设计的：core 包采用 schema-first contract 设计，稳定 DTO 统一从 zod schema 推导。';
    await documents.createFromUpload(actor, baseId, {
      ...(await uploadFixture(upload, baseId, 'core-design.md', content)),
      title: 'Core Design'
    });
    await expect(
      frontend.chat(actor, {
        model: 'knowledge-rag',
        messages: [{ role: 'user', content: 'core包如何设计的' }],
        metadata: {
          conversationId: 'frontend',
          debug: true,
          knowledgeBaseIds: [baseId]
        },
        stream: false
      })
    ).resolves.toMatchObject({
      conversationId: 'frontend',
      userMessage: expect.objectContaining({ role: 'user', content: 'core包如何设计的' }),
      answer: expect.stringContaining('schema-first contract'),
      citations: [expect.objectContaining({ title: 'Core Design' })],
      traceId: expect.any(String)
    });
  });
  it('maps missing chat knowledge bases to a stable not found error instead of leaking a 500', async () => {
    const { controller: frontend } = await createFrontendController();
    await expect(
      frontend.chat(actor, {
        knowledgeBaseIds: ['kb_frontend'],
        message: 'core怎么设计的'
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('maps chat requests without a user message to a stable bad request error', async () => {
    const { controller: frontend } = await createFrontendController();
    await expect(
      frontend.chat(actor, {
        model: 'knowledge-rag',
        messages: [{ role: 'assistant', content: '需要先有用户问题' }],
        stream: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('maps SDK chat failures to a stable service unavailable error', async () => {
    const controller = new KnowledgeFrontendMvpController({
      chat: async () => {
        throw new KnowledgeServiceError('knowledge_chat_failed', 'vector backend unavailable');
      }
    } as unknown as KnowledgeDocumentService);
    await expect(
      controller.chat(actor, {
        knowledgeBaseIds: ['kb_1'],
        message: 'rotation policy'
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps invalid RAG model profiles to stable bad request errors', async () => {
    const controller = new KnowledgeFrontendMvpController({
      chat: async () => {
        throw new KnowledgeServiceError('rag_model_profile_not_found', 'RAG model profile was not found.');
      }
    } as unknown as KnowledgeDocumentService);
    await expect(
      controller.chat(actor, {
        model: 'missing-profile',
        message: 'rotation policy'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes SSE error frames when stream iteration fails after headers are sent', async () => {
    const chunks: string[] = [];
    const controller = new KnowledgeFrontendMvpController({
      streamChat: async function* () {
        throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
        yield undefined as never;
      }
    } as unknown as KnowledgeDocumentService);
    await expect(
      controller.chat(actor, { message: 'private', stream: true }, createSseResponse(chunks))
    ).resolves.toBeUndefined();
    expect(chunks.join('')).toContain('event: rag.error');
    expect(chunks.join('')).toContain('knowledge_permission_denied');
  });

  it('writes stable RAG model profile codes in SSE error frames', async () => {
    const chunks: string[] = [];
    const controller = new KnowledgeFrontendMvpController({
      streamChat: async function* () {
        throw new KnowledgeServiceError('rag_model_profile_disabled', 'RAG model profile is disabled.');
        yield undefined as never;
      }
    } as unknown as KnowledgeDocumentService);

    await expect(
      controller.chat(actor, { model: 'disabled-profile', message: 'private', stream: true }, createSseResponse(chunks))
    ).resolves.toBeUndefined();
    expect(chunks.join('')).toContain('event: rag.error');
    expect(chunks.join('')).toContain('"code":"rag_model_profile_disabled"');
  });

  it('routes chat retrieval to an explicitly mentioned knowledge base', async () => {
    const setup = await createFrontendController();
    const frontendBase = await setup.knowledge.createBase(actor, {
      name: 'Frontend KB',
      description: 'React dynamic import guidance'
    });
    await addReadyDocuments(setup, [
      [setup.baseId, 'backend.md', 'Backend keys rotate every 90 days.', 'Backend Runbook'],
      [frontendBase.id, 'frontend.md', 'Dynamic imports require explicit code splitting approval.', 'Frontend Guide']
    ]);
    await expect(
      setup.controller.chat(actor, {
        model: 'knowledge-rag',
        messages: [{ role: 'user', content: '@Frontend KB dynamic imports?' }],
        metadata: {
          mentions: [{ type: 'knowledge_base', label: 'Frontend KB' }]
        },
        stream: false
      })
    ).resolves.toMatchObject({
      answer: expect.stringContaining('Dynamic imports require explicit code splitting approval.'),
      citations: [expect.objectContaining({ title: 'Frontend Guide' })]
    });
  });

  it('maps missing knowledge base mentions to a stable bad request error', async () => {
    const { controller: frontend } = await createFrontendController();
    await expect(
      frontend.chat(actor, {
        model: 'knowledge-rag',
        messages: [{ role: 'user', content: '@Missing KB dynamic imports?' }],
        metadata: {
          mentions: [{ type: 'knowledge_base', label: 'Missing KB' }]
        },
        stream: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('automatically routes chat retrieval by knowledge base metadata before searching chunks', async () => {
    const setup = await createFrontendController();
    const frontendBase = await setup.knowledge.createBase(actor, {
      name: 'Frontend KB',
      description: 'frontend react import'
    });
    await addReadyDocuments(setup, [
      [setup.baseId, 'runtime.md', 'Runtime budgets control graph execution.', 'Runtime Guide'],
      [
        frontendBase.id,
        'frontend-routing.md',
        'Dynamic imports are only allowed for explicit code splitting.',
        'Frontend Routing'
      ]
    ]);
    await expect(
      setup.controller.chat(actor, {
        model: 'knowledge-rag',
        messages: [{ role: 'user', content: 'frontend dynamic imports' }],
        metadata: { debug: true },
        stream: false
      })
    ).resolves.toMatchObject({
      answer: expect.stringContaining('Dynamic imports are only allowed for explicit code splitting.'),
      citations: [expect.objectContaining({ title: 'Frontend Routing' })]
    });
  });

  it('falls back to all accessible knowledge bases when routing has no metadata hit', async () => {
    const setup = await createFrontendController();
    const operationsBase = await setup.knowledge.createBase(actor, {
      name: 'Operations KB',
      description: 'incident response'
    });
    await addReadyDocuments(setup, [
      [setup.baseId, 'engineering.md', 'Shared policy requires design review.', 'Engineering Policy'],
      [operationsBase.id, 'operations.md', 'Shared policy requires audit notes.', 'Operations Policy']
    ]);
    await expect(
      setup.controller.chat(actor, {
        model: 'knowledge-rag',
        messages: [{ role: 'user', content: 'shared policy' }],
        stream: false
      })
    ).resolves.toMatchObject({
      citations: expect.arrayContaining([
        expect.objectContaining({ title: 'Engineering Policy' }),
        expect.objectContaining({ title: 'Operations Policy' })
      ])
    });
  });

  it('serves embedding model options without exposing provider secrets', () => {
    vi.stubEnv('KNOWLEDGE_EMBEDDING_MODEL', 'embed-default');
    vi.stubEnv('KNOWLEDGE_LLM_API_KEY', 'secret-key');
    expect(controller.listEmbeddingModels()).toEqual({
      items: [
        {
          id: 'embed-default',
          label: 'embed-default',
          provider: 'openai-compatible',
          status: 'available'
        }
      ]
    });
    expect(JSON.stringify(controller.listEmbeddingModels())).not.toMatch(/apiKey|secret|token|password/i);
  });

  it('serves RAG model profile summaries', async () => {
    const { controller: frontend } = await createFrontendController();
    expect(frontend.listRagModelProfiles(actor).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'coding-pro', label: '用于编程', useCase: 'coding', enabled: true })
      ])
    );
  });

  it('lists persisted conversations and messages with service pagination', async () => {
    const { controller: frontend, repository } = await createFrontendController();
    const conversation = await repository.createChatConversation({
      userId: actor.userId,
      title: '检索前技术名词',
      activeModelProfileId: 'coding-pro'
    });
    for (const [role, content] of [
      ['user', '检索前技术名词'],
      ['assistant', '依据如下。'],
      ['assistant', '补充说明。']
    ] as const) {
      await repository.appendChatMessage({ conversationId: conversation.id, userId: actor.userId, role, content });
    }
    await repository.createChatConversation({
      userId: actor.userId,
      title: '第二个会话',
      activeModelProfileId: 'coding-pro'
    });
    const conversations = await frontend.listConversations(actor, {});
    expect(conversations).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(conversations.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: conversation.id })]));
    await expect(frontend.listConversations(actor, { page: 2, pageSize: 1 })).resolves.toMatchObject({
      items: [conversations.items[1]],
      total: 2,
      page: 2,
      pageSize: 1
    });
    await expect(
      frontend.listConversationMessages(actor, conversation.id, { page: 2, pageSize: 1 })
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ role: 'assistant', content: '依据如下。' })],
      total: 3,
      page: 2,
      pageSize: 1
    });
    await expect(
      frontend.listConversationMessages(actor, 'conv_missing', { page: -1, pageSize: 500 })
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 100
    });
  });

  it('records chat lab message feedback through the frontend MVP endpoint', async () => {
    const { controller } = await createFrontendController();
    await expect(
      controller.createFeedback('msg_assistant', {
        rating: 'negative',
        category: 'wrong_citation',
        comment: '引用段落不匹配'
      })
    ).rejects.toMatchObject({
      code: 'knowledge_chat_message_not_found'
    });
  });
});

async function createFrontendController() {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const queue = new KnowledgeIngestionQueue(worker);
  queue.start();
  const upload = new KnowledgeUploadService(repository, storage);
  const documents = new KnowledgeDocumentService(repository, queue, storage);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return {
    baseId: base.id,
    controller: new KnowledgeFrontendMvpController(documents),
    documents,
    knowledge,
    queue,
    repository,
    upload
  };
}

function createSseResponse(chunks: string[]) {
  return {
    setHeader: vi.fn(),
    write: (chunk: string) => chunks.push(chunk),
    end: () => chunks.push('[end]')
  };
}

async function addReadyDocument(
  upload: KnowledgeUploadService,
  documents: KnowledgeDocumentService,
  baseId: string,
  filename: string,
  content: string,
  title: string,
  queue: KnowledgeIngestionQueue
) {
  const result = await documents.createFromUpload(actor, baseId, {
    ...(await uploadFixture(upload, baseId, filename, content)),
    title
  });
  await queue.waitForIdle();
  return result;
}

async function addReadyDocuments(
  setup: Awaited<ReturnType<typeof createFrontendController>>,
  documents: Array<[string, string, string, string]>
) {
  for (const [baseId, filename, content, title] of documents) {
    await addReadyDocument(setup.upload, setup.documents, baseId, filename, content, title, setup.queue);
  }
}

async function uploadFixture(upload: KnowledgeUploadService, baseId: string, filename: string, content: string) {
  const uploaded = await upload.uploadFile(actor, baseId, {
    originalname: filename,
    mimetype: filename.endsWith('.md') ? 'text/markdown' : 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  });
  return { uploadId: uploaded.uploadId, objectKey: uploaded.objectKey, filename: uploaded.filename };
}
