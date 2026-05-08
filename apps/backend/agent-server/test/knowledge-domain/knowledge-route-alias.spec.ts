import { describe, expect, it } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';

const service = {
  listBases: async () => [{ id: 'base_1', name: 'Default' }],
  createBase: async (actor: { userId: string }, input: { name: string }) => ({
    id: 'base_created',
    name: input.name,
    createdBy: actor.userId
  })
};

const uploads = {
  uploadFile: async (actor: { userId: string }, baseId: string, file: { originalname: string }) => ({
    uploadId: 'upload_1',
    baseId,
    filename: file.originalname,
    uploadedBy: actor.userId
  })
};

const documents = {
  listDocuments: async (actor: { userId: string }, input?: { knowledgeBaseId?: string }) => ({
    items: [{ id: 'doc_1', owner: actor.userId, knowledgeBaseId: input?.knowledgeBaseId }],
    total: 1,
    page: 1,
    pageSize: 20
  }),
  createFromUpload: async (actor: { userId: string }, baseId: string, input: { uploadId: string }) => ({
    document: { id: 'doc_1', createdBy: actor.userId, knowledgeBaseId: baseId, uploadId: input.uploadId },
    job: { id: 'job_1', documentId: 'doc_1' }
  }),
  getDocument: async (_actor: { userId: string }, documentId: string) => ({ id: documentId }),
  getLatestJob: async (_actor: { userId: string }, documentId: string) => ({ id: 'job_1', documentId }),
  listChunks: async (_actor: { userId: string }, documentId: string) => ({ items: [{ documentId }], total: 1 }),
  reprocessDocument: async (_actor: { userId: string }, documentId: string) => ({
    document: { id: documentId, status: 'queued' },
    job: { id: 'job_retry', documentId }
  }),
  deleteDocument: async () => ({ ok: true }),
  listEmbeddingModels: () => ({
    items: [{ id: 'embedding-1', label: 'embedding-1', provider: 'test', status: 'available' }]
  }),
  listConversations: async (actor: { userId: string }) => ({
    items: [{ id: 'conv_1', userId: actor.userId }],
    total: 1,
    page: 1,
    pageSize: 20
  }),
  listConversationMessages: async (_actor: { userId: string }, conversationId: string) => ({
    items: [{ id: 'msg_1', conversationId }],
    total: 1,
    page: 1,
    pageSize: 20
  }),
  recordFeedback: async (messageId: string, feedback: { rating: 'positive' | 'negative' }) => ({
    id: messageId,
    conversationId: 'conv_1',
    role: 'assistant',
    content: 'Answer',
    citations: [],
    feedback,
    createdAt: '2026-05-07T00:00:00.000Z'
  })
};

const rag = {
  answer: async (actor: { userId: string }, request: { message: string }) => ({
    conversationId: 'conv_1',
    answer: `answer:${request.message}`,
    citations: [],
    traceId: `trace_${actor.userId}`,
    userMessage: { id: 'msg_user', conversationId: 'conv_1', role: 'user', content: request.message },
    assistantMessage: { id: 'msg_assistant', conversationId: 'conv_1', role: 'assistant', content: 'answer' }
  }),
  async *stream(actor: { userId: string }, request: { message: string }) {
    yield { type: 'rag.started' as const, runId: `run_${actor.userId}` };
    yield { type: 'answer.delta' as const, runId: `run_${actor.userId}`, delta: `answer:${request.message}` };
    yield {
      type: 'rag.error' as const,
      runId: `run_${actor.userId}`,
      error: { code: 'unknown' as const, message: 'done sentinel' }
    };
  }
};

const modelProfiles = {
  listSummaries: () => [{ id: 'coding-pro', label: '用于编程', useCase: 'coding', enabled: true }],
  resolveEnabled: () => ({ id: 'coding-pro' })
};

const request = { principal: { sub: 'user_1' } };

function createController() {
  return new KnowledgeApiController(
    service as never,
    uploads as never,
    documents as never,
    rag as never,
    modelProfiles as never
  );
}

describe('knowledge route aliases', () => {
  it('serves knowledge bases through the canonical controller', async () => {
    const controller = createController();

    await expect(controller.listBases(request)).resolves.toEqual([{ id: 'base_1', name: 'Default' }]);
  });

  it('mounts canonical and v1 knowledge routes through one controller', () => {
    expect(Reflect.getMetadata(PATH_METADATA, KnowledgeApiController)).toEqual(['knowledge', 'knowledge/v1']);
  });

  it('exposes document upload, processing and retrieval endpoints from the unified controller', async () => {
    const controller = createController();

    await expect(
      controller.createBase(request, { name: 'Docs', description: 'Internal runbooks' })
    ).resolves.toMatchObject({ id: 'base_created', createdBy: 'user_1' });
    await expect(
      controller.uploadKnowledgeFile(request, 'base_1', {
        originalname: 'runbook.md',
        mimetype: 'text/markdown',
        size: 8,
        buffer: Buffer.from('content')
      })
    ).resolves.toMatchObject({ uploadId: 'upload_1', uploadedBy: 'user_1' });
    await expect(
      controller.createDocumentFromUpload(request, 'base_1', {
        uploadId: 'upload_1',
        objectKey: 'knowledge/base_1/upload_1/runbook.md',
        filename: 'runbook.md'
      })
    ).resolves.toMatchObject({ document: { id: 'doc_1', createdBy: 'user_1' } });
    await expect(controller.listDocuments(request, 'base_1')).resolves.toMatchObject({
      items: [{ id: 'doc_1', owner: 'user_1', knowledgeBaseId: 'base_1' }]
    });
    await expect(controller.getDocument(request, 'doc_1')).resolves.toEqual({ id: 'doc_1' });
    await expect(controller.getLatestDocumentJob(request, 'doc_1')).resolves.toEqual({
      id: 'job_1',
      documentId: 'doc_1'
    });
    await expect(controller.listDocumentChunks(request, 'doc_1')).resolves.toEqual({
      items: [{ documentId: 'doc_1' }],
      total: 1
    });
  });

  it('exposes knowledge chat, conversations, model profiles and feedback endpoints', async () => {
    const controller = createController();

    await expect(controller.chat(request, { message: 'How to deploy?' })).resolves.toMatchObject({
      answer: 'answer:How to deploy?',
      traceId: 'trace_user_1'
    });
    await expect(controller.listRagModelProfiles(request)).resolves.toEqual({
      items: [{ id: 'coding-pro', label: '用于编程', useCase: 'coding', enabled: true }]
    });
    await expect(controller.listEmbeddingModels()).toEqual({
      items: [{ id: 'embedding-1', label: 'embedding-1', provider: 'test', status: 'available' }]
    });
    await expect(controller.listConversations(request, {})).resolves.toMatchObject({
      items: [{ id: 'conv_1', userId: 'user_1' }]
    });
    await expect(controller.listConversationMessages(request, 'conv_1', {})).resolves.toMatchObject({
      items: [{ id: 'msg_1', conversationId: 'conv_1' }]
    });
    await expect(controller.createFeedback('msg_1', { rating: 'positive' })).resolves.toMatchObject({
      id: 'msg_1',
      feedback: { rating: 'positive' }
    });
  });

  it('streams knowledge chat events as server-sent events from the unified controller', async () => {
    const controller = createController();
    const response = createSseResponse();

    await expect(
      controller.chat(request, { message: 'How to deploy?', stream: true }, response)
    ).resolves.toBeUndefined();

    expect(response.headers).toMatchObject({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
    expect(response.frames).toEqual([
      'event: rag.started\ndata: {"type":"rag.started","runId":"run_user_1"}\n\n',
      'event: answer.delta\ndata: {"type":"answer.delta","runId":"run_user_1","delta":"answer:How to deploy?"}\n\n',
      'event: rag.error\ndata: {"type":"rag.error","runId":"run_user_1","error":{"code":"unknown","message":"done sentinel"}}\n\n'
    ]);
    expect(response.ended).toBe(true);
  });
});

function createSseResponse() {
  return {
    headers: {} as Record<string, string>,
    frames: [] as string[],
    ended: false,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    write(frame: string) {
      this.frames.push(frame);
    },
    end() {
      this.ended = true;
    }
  };
}
