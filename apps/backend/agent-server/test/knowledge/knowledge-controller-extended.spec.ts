import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ZodError } from 'zod';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';
import { KnowledgeServiceError } from '../../src/domains/knowledge/services/knowledge-service.error';

function createMockService(overrides: Record<string, unknown> = {}) {
  return {
    listBases: vi.fn().mockResolvedValue({ items: [] }),
    listBasesResponse: vi.fn().mockResolvedValue({ bases: [] }),
    createBase: vi.fn().mockResolvedValue({ id: 'b1' }),
    listMembers: vi.fn().mockResolvedValue({ items: [] }),
    addMember: vi.fn().mockResolvedValue({ id: 'm1' }),
    ...overrides
  } as any;
}

function createMockUploads(overrides: Record<string, unknown> = {}) {
  return {
    uploadFile: vi.fn().mockResolvedValue({ id: 'u1' }),
    ...overrides
  } as any;
}

function createMockDocuments(overrides: Record<string, unknown> = {}) {
  return {
    listDocuments: vi.fn().mockResolvedValue({ items: [] }),
    createFromUpload: vi.fn().mockResolvedValue({ id: 'd1' }),
    getDocument: vi.fn().mockResolvedValue({ id: 'd1' }),
    getLatestJob: vi.fn().mockResolvedValue(null),
    listChunks: vi.fn().mockResolvedValue({ items: [] }),
    reprocessDocument: vi.fn().mockResolvedValue(undefined),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    listEmbeddingModels: vi.fn().mockReturnValue({ items: [] }),
    listConversations: vi.fn().mockResolvedValue({ items: [] }),
    listConversationMessages: vi.fn().mockResolvedValue({ items: [] }),
    recordFeedback: vi.fn().mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      role: 'assistant',
      content: 'answer',
      citations: [],
      traceId: 't1',
      feedback: null,
      createdAt: '2026-05-11T00:00:00.000Z'
    }),
    ...overrides
  } as any;
}

function createMockRag(overrides: Record<string, unknown> = {}) {
  return {
    answer: vi.fn().mockResolvedValue({ text: 'answer', citations: [] }),
    stream: vi.fn().mockReturnValue(
      (async function* () {
        yield { type: 'rag.text', runId: 'r1', text: 'hello' };
      })()
    ),
    ...overrides
  } as any;
}

function createMockModelProfiles(overrides: Record<string, unknown> = {}) {
  return {
    listSummaries: vi.fn().mockReturnValue([{ id: 'p1', name: 'Default' }]),
    resolveEnabled: vi.fn().mockReturnValue({ id: 'p1' }),
    ...overrides
  } as any;
}

function createMockIdentityAuth(overrides: Record<string, unknown> = {}) {
  return {
    me: vi.fn().mockResolvedValue({ account: { id: 'user-1' } }),
    ...overrides
  } as any;
}

function makeRequest(principal?: unknown, authorization?: string) {
  return {
    principal,
    headers: authorization ? { authorization } : {}
  } as any;
}

function makeSseResponse() {
  const chunks: string[] = [];
  return {
    setHeader: vi.fn(),
    write: vi.fn((chunk: string) => chunks.push(chunk)),
    end: vi.fn(),
    flushHeaders: vi.fn(),
    chunks
  } as any;
}

describe('KnowledgeApiController', () => {
  describe('listBases', () => {
    it('resolves actor from principal.userId and lists bases', async () => {
      const knowledgeBaseService = createMockService();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.listBases(makeRequest({ userId: 'u1' }));
      expect(knowledgeBaseService.listBasesResponse).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('returns the stable knowledge bases response envelope', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi.fn().mockResolvedValue({
          bases: [{ id: 'kb_1', name: 'Policies' }]
        })
      });
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).resolves.toEqual({
        bases: [{ id: 'kb_1', name: 'Policies' }]
      });
    });

    it('resolves actor from principal.sub when userId is missing', async () => {
      const knowledgeBaseService = createMockService();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.listBases(makeRequest({ sub: 'u2' }));
      expect(knowledgeBaseService.listBasesResponse).toHaveBeenCalledWith({ userId: 'u2' });
    });

    it('resolves actor from bearer token when principal has no userId', async () => {
      const knowledgeBaseService = createMockService();
      const identityAuth = createMockIdentityAuth();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles(),
        identityAuth
      );

      await controller.listBases(makeRequest(undefined, 'Bearer my-token'));
      expect(identityAuth.me).toHaveBeenCalledWith('my-token');
      expect(knowledgeBaseService.listBasesResponse).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('throws UnauthorizedException when no principal and no bearer token', async () => {
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest())).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when bearer token present but no identityAuth', async () => {
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest(undefined, 'Bearer token'))).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when principal is null', async () => {
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest(null))).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createBase', () => {
    it('creates a knowledge base', async () => {
      const knowledgeBaseService = createMockService();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.createBase(makeRequest({ userId: 'u1' }), { name: 'test' });
      expect(knowledgeBaseService.createBase).toHaveBeenCalledWith({ userId: 'u1' }, { name: 'test', description: '' });
    });
  });

  describe('chat', () => {
    it('returns non-streaming answer', async () => {
      const rag = createMockRag();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        rag,
        createMockModelProfiles()
      );

      const result = await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hello' });
      expect(result).toEqual({ text: 'answer', citations: [] });
    });

    it('throws BadRequestException when stream=true but no response object', async () => {
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.chat(makeRequest({ userId: 'u1' }), { message: 'hello', stream: true })).rejects.toThrow(
        BadRequestException
      );
    });

    it('streams response when stream=true and response is provided', async () => {
      const rag = createMockRag();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        rag,
        createMockModelProfiles()
      );

      const response = makeSseResponse();
      const result = await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hello', stream: true }, response);

      expect(result).toBeUndefined();
      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
      expect(response.end).toHaveBeenCalled();
    });

    it('uses undefined profileId for knowledge-default model', async () => {
      const modelProfiles = createMockModelProfiles();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', model: 'knowledge-default' });
      expect(modelProfiles.resolveEnabled).toHaveBeenCalledWith(undefined);
    });

    it('uses undefined profileId for knowledge-rag model', async () => {
      const modelProfiles = createMockModelProfiles();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', model: 'knowledge-rag' });
      expect(modelProfiles.resolveEnabled).toHaveBeenCalledWith(undefined);
    });

    it('passes custom model as profileId', async () => {
      const modelProfiles = createMockModelProfiles();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', model: 'custom-model' });
      expect(modelProfiles.resolveEnabled).toHaveBeenCalledWith('custom-model');
    });

    it('throws BadRequestException for rag_model_profile_disabled', async () => {
      const modelProfiles = createMockModelProfiles({
        resolveEnabled: vi.fn().mockImplementation(() => {
          throw new Error('rag_model_profile_disabled');
        })
      });
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      await expect(
        controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', model: 'disabled-model' })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for rag_model_profile_not_found', async () => {
      const modelProfiles = createMockModelProfiles({
        resolveEnabled: vi.fn().mockImplementation(() => {
          throw new Error('rag_model_profile_not_found');
        })
      });
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      await expect(
        controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', model: 'missing-model' })
      ).rejects.toThrow(BadRequestException);
    });

    it('rethrows unknown errors from resolveEnabled', async () => {
      const modelProfiles = createMockModelProfiles({
        resolveEnabled: vi.fn().mockImplementation(() => {
          throw new Error('unexpected error');
        })
      });
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      await expect(controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', model: 'x' })).rejects.toThrow(
        'unexpected error'
      );
    });
  });

  describe('listRagModelProfiles', () => {
    it('returns model profile summaries', async () => {
      const modelProfiles = createMockModelProfiles();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        modelProfiles
      );

      const result = await controller.listRagModelProfiles(makeRequest({ userId: 'u1' }));
      expect(result).toEqual({ items: [{ id: 'p1', name: 'Default' }] });
    });
  });

  describe('createFeedback', () => {
    it('creates feedback and returns KnowledgeChatMessage', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      const result = await controller.createFeedback('m1', { rating: 'positive' });
      expect(result.id).toBe('m1');
      expect(result.role).toBe('assistant');
    });
  });

  describe('error mapping', () => {
    it('maps ZodError to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        createBase: vi.fn().mockRejectedValue(
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['name'],
              message: 'Required'
            }
          ])
        )
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.createBase(makeRequest({ userId: 'u1' }), {})).rejects.toThrow(BadRequestException);
    });

    it('maps permission denied error to ForbiddenException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_permission_denied', 'No access'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(ForbiddenException);
    });

    it('maps upload permission denied error to ForbiddenException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_upload_permission_denied', 'No upload access'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(ForbiddenException);
    });

    it('maps chat_message_required error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_chat_message_required', 'Message required'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('maps upload_invalid_type error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_upload_invalid_type', 'Invalid file type'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('maps upload_too_large error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_upload_too_large', 'File too large'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('maps upload_not_found error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_upload_not_found', 'Upload not found'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('maps chat_message_not_found error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('knowledge_chat_message_not_found', 'Message not found'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('maps rag_model_profile_disabled error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('rag_model_profile_disabled', 'Disabled'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('maps rag_model_profile_not_found error to BadRequestException', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi
          .fn()
          .mockRejectedValue(new KnowledgeServiceError('rag_model_profile_not_found', 'Not found'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow(BadRequestException);
    });

    it('passes through unknown errors unchanged', async () => {
      const knowledgeBaseService = createMockService({
        listBasesResponse: vi.fn().mockRejectedValue(new Error('unknown error'))
      });

      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(controller.listBases(makeRequest({ userId: 'u1' }))).rejects.toThrow('unknown error');
    });
  });

  describe('bearer token edge cases', () => {
    it('handles array authorization header', async () => {
      const knowledgeBaseService = createMockService();
      const identityAuth = createMockIdentityAuth();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles(),
        identityAuth
      );

      await controller.listBases({
        principal: undefined,
        headers: { authorization: ['Bearer array-token'] }
      } as any);
      expect(identityAuth.me).toHaveBeenCalledWith('array-token');
    });

    it('returns undefined when authorization does not start with Bearer', async () => {
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(
        controller.listBases({
          principal: undefined,
          headers: { authorization: 'Basic abc123' }
        } as any)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns undefined when bearer token is empty after Bearer prefix', async () => {
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await expect(
        controller.listBases({
          principal: undefined,
          headers: { authorization: 'Bearer   ' }
        } as any)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('streamChatResponse', () => {
    it('writes error SSE frame when stream throws', async () => {
      const rag = createMockRag({
        stream: vi.fn().mockReturnValue(
          (async function* () {
            if (Date.now() < 0) yield { type: 'noop' };
            throw new Error('stream failed');
          })()
        )
      });
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        rag,
        createMockModelProfiles()
      );

      const response = makeSseResponse();
      await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', stream: true }, response);

      expect(response.write).toHaveBeenCalled();
      expect(response.end).toHaveBeenCalled();
    });

    it('calls flushHeaders when available', async () => {
      const rag = createMockRag();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        createMockDocuments(),
        rag,
        createMockModelProfiles()
      );

      const response = makeSseResponse();
      await controller.chat(makeRequest({ userId: 'u1' }), { message: 'hi', stream: true }, response);

      expect(response.flushHeaders).toHaveBeenCalled();
    });
  });

  describe('other endpoints', () => {
    it('listMembers calls service', async () => {
      const knowledgeBaseService = createMockService();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.listMembers(makeRequest({ userId: 'u1' }), 'b1');
      expect(knowledgeBaseService.listMembers).toHaveBeenCalledWith({ userId: 'u1' }, 'b1');
    });

    it('addMember calls service', async () => {
      const knowledgeBaseService = createMockService();
      const controller = new KnowledgeApiController(
        knowledgeBaseService,
        createMockUploads(),
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.addMember(makeRequest({ userId: 'u1' }), 'b1', { userId: 'u2', role: 'viewer' });
      expect(knowledgeBaseService.addMember).toHaveBeenCalled();
    });

    it('listDocuments calls service', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.listDocuments(makeRequest({ userId: 'u1' }), 'b1');
      expect(documents.listDocuments).toHaveBeenCalledWith({ userId: 'u1' }, { knowledgeBaseId: 'b1' });
    });

    it('uploadKnowledgeFile calls service', async () => {
      const uploads = createMockUploads();
      const controller = new KnowledgeApiController(
        createMockService(),
        uploads,
        createMockDocuments(),
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.uploadKnowledgeFile(makeRequest({ userId: 'u1' }), 'b1', { originalname: 'test.pdf' } as any);
      expect(uploads.uploadFile).toHaveBeenCalled();
    });

    it('getDocument calls service', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.getDocument(makeRequest({ userId: 'u1' }), 'd1');
      expect(documents.getDocument).toHaveBeenCalledWith({ userId: 'u1' }, 'd1');
    });

    it('deleteDocument calls service', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.deleteDocument(makeRequest({ userId: 'u1' }), 'd1');
      expect(documents.deleteDocument).toHaveBeenCalledWith({ userId: 'u1' }, 'd1');
    });

    it('listEmbeddingModels delegates without actor', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      controller.listEmbeddingModels();
      expect(documents.listEmbeddingModels).toHaveBeenCalled();
    });

    it('listConversations calls service', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.listConversations(makeRequest({ userId: 'u1' }), { page: '1' });
      expect(documents.listConversations).toHaveBeenCalled();
    });

    it('listConversationMessages calls service', async () => {
      const documents = createMockDocuments();
      const controller = new KnowledgeApiController(
        createMockService(),
        createMockUploads(),
        documents,
        createMockRag(),
        createMockModelProfiles()
      );

      await controller.listConversationMessages(makeRequest({ userId: 'u1' }), 'conv-1', { page: '1' });
      expect(documents.listConversationMessages).toHaveBeenCalled();
    });
  });
});
