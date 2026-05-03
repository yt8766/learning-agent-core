import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { KnowledgeFrontendMvpController } from '../../src/knowledge/knowledge-frontend-mvp.controller';
import { KnowledgeDocumentService } from '../../src/knowledge/knowledge-document.service';
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
    const uploaded = await upload.uploadFile(actor, baseId, {
      originalname: 'rotation-runbook.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength('Rotate signing keys every 90 days.\n\nEscalate expired credentials.'),
      buffer: Buffer.from('Rotate signing keys every 90 days.\n\nEscalate expired credentials.')
    });
    const { document } = await documents.createFromUpload(actor, baseId, {
      uploadId: uploaded.uploadId,
      objectKey: uploaded.objectKey,
      filename: uploaded.filename,
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
    const uploaded = await upload.uploadFile(actor, baseId, {
      originalname: 'core-design.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength(content),
      buffer: Buffer.from(content)
    });
    await documents.createFromUpload(actor, baseId, {
      uploadId: uploaded.uploadId,
      objectKey: uploaded.objectKey,
      filename: uploaded.filename,
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

  it('routes chat retrieval to an explicitly mentioned knowledge base', async () => {
    const {
      controller: frontend,
      upload,
      documents,
      knowledge,
      baseId: engineeringBaseId
    } = await createFrontendController();
    const frontendBase = await knowledge.createBase(actor, {
      name: 'Frontend KB',
      description: 'React dynamic import guidance'
    });
    await addReadyDocument(
      upload,
      documents,
      engineeringBaseId,
      'backend.md',
      'Backend keys rotate every 90 days.',
      'Backend Runbook'
    );
    await addReadyDocument(
      upload,
      documents,
      frontendBase.id,
      'frontend.md',
      'Dynamic imports require explicit code splitting approval.',
      'Frontend Guide'
    );
    await expect(
      frontend.chat(actor, {
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
    const {
      controller: frontend,
      upload,
      documents,
      knowledge,
      baseId: engineeringBaseId
    } = await createFrontendController();
    const frontendBase = await knowledge.createBase(actor, {
      name: 'Frontend KB',
      description: 'frontend react import'
    });
    await addReadyDocument(
      upload,
      documents,
      engineeringBaseId,
      'runtime.md',
      'Runtime budgets control graph execution.',
      'Runtime Guide'
    );
    await addReadyDocument(
      upload,
      documents,
      frontendBase.id,
      'frontend-routing.md',
      'Dynamic imports are only allowed for explicit code splitting.',
      'Frontend Routing'
    );
    await expect(
      frontend.chat(actor, {
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
    const {
      controller: frontend,
      upload,
      documents,
      knowledge,
      baseId: engineeringBaseId
    } = await createFrontendController();
    const operationsBase = await knowledge.createBase(actor, {
      name: 'Operations KB',
      description: 'incident response'
    });
    await addReadyDocument(
      upload,
      documents,
      engineeringBaseId,
      'engineering.md',
      'Shared policy requires design review.',
      'Engineering Policy'
    );
    await addReadyDocument(
      upload,
      documents,
      operationsBase.id,
      'operations.md',
      'Shared policy requires audit notes.',
      'Operations Policy'
    );
    await expect(
      frontend.chat(actor, {
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

  it('lists persisted conversations and messages', async () => {
    const { controller: frontend, repository } = await createFrontendController();
    const conversation = await repository.createChatConversation({
      userId: actor.userId,
      title: '检索前技术名词',
      activeModelProfileId: 'coding-pro'
    });
    for (const [role, content] of [
      ['user', '检索前技术名词'],
      ['assistant', '依据如下。']
    ] as const) {
      await repository.appendChatMessage({ conversationId: conversation.id, userId: actor.userId, role, content });
    }
    const conversations = await frontend.listConversations(actor, {});
    expect(conversations.items[0]).toMatchObject({
      id: conversation.id,
      activeModelProfileId: 'coding-pro'
    });
    const messages = await frontend.listConversationMessages(actor, conversation.id, {});
    expect(messages.items.map(item => item.role)).toEqual(['user', 'assistant']);
  });

  it('records chat lab message feedback through the frontend MVP endpoint', () => {
    expect(
      controller.createFeedback('msg_assistant', {
        rating: 'negative',
        category: 'wrong_citation',
        comment: '引用段落不匹配'
      })
    ).toMatchObject({
      id: 'msg_assistant',
      role: 'assistant',
      feedback: {
        rating: 'negative',
        category: 'wrong_citation',
        comment: '引用段落不匹配'
      }
    });
  });
});

async function createFrontendController() {
  const repository = new InMemoryKnowledgeRepository();
  const storage = new InMemoryOssStorageProvider();
  const knowledge = new KnowledgeService(repository);
  const worker = new KnowledgeIngestionWorker(repository, storage);
  const upload = new KnowledgeUploadService(repository, storage);
  const documents = new KnowledgeDocumentService(repository, worker, storage);
  const base = await knowledge.createBase(actor, { name: 'Engineering KB', description: '' });
  return {
    baseId: base.id,
    controller: new KnowledgeFrontendMvpController(documents),
    documents,
    knowledge,
    repository,
    upload
  };
}

async function addReadyDocument(
  upload: KnowledgeUploadService,
  documents: KnowledgeDocumentService,
  baseId: string,
  filename: string,
  content: string,
  title: string
) {
  const uploaded = await upload.uploadFile(actor, baseId, {
    originalname: filename,
    mimetype: filename.endsWith('.md') ? 'text/markdown' : 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content)
  });
  return documents.createFromUpload(actor, baseId, {
    uploadId: uploaded.uploadId,
    objectKey: uploaded.objectKey,
    filename: uploaded.filename,
    title
  });
}
