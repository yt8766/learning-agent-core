import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Optional,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseCreateRequestSchema, KnowledgeBaseMemberCreateRequestSchema } from '@agent/core';
import type { KnowledgeRagErrorCode, KnowledgeRagStreamEvent } from '@agent/knowledge';
import { ZodError } from 'zod';

import type { IdentityAuthService } from '../../domains/identity/services/identity-auth.service';
import {
  CreateDocumentFromUploadRequestSchema,
  CreateKnowledgeMessageFeedbackRequestSchema,
  KnowledgeChatRequestSchema
} from '../../domains/knowledge/domain/knowledge-document.schemas';
import type {
  KnowledgeChatMessage,
  KnowledgeChatRequest
} from '../../domains/knowledge/domain/knowledge-document.types';
import type { UploadedKnowledgeFile } from '../../domains/knowledge/domain/knowledge-upload.types';
import { normalizeKnowledgeChatRequest } from '../../domains/knowledge/services/knowledge-chat-request.helpers';
import { KnowledgeBaseService } from '../../domains/knowledge/services/knowledge-base.service';
import type { KnowledgeActor } from '../../domains/knowledge/services/knowledge-base.service';
import { KnowledgeDocumentService, type PageQuery } from '../../domains/knowledge/services/knowledge-document.service';
import { KnowledgeRagModelProfileService } from '../../domains/knowledge/services/knowledge-rag-model-profile.service';
import { KnowledgeRagService } from '../../domains/knowledge/services/knowledge-rag.service';
import { KnowledgeServiceError } from '../../domains/knowledge/services/knowledge-service.error';
import { KnowledgeUploadService } from '../../domains/knowledge/services/knowledge-upload.service';

interface KnowledgeApiRequest {
  principal?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface KnowledgeSseResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
  flushHeaders?: () => void;
}

@Controller(['knowledge', 'knowledge/v1'])
export class KnowledgeApiController {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly uploads: KnowledgeUploadService,
    private readonly documents: KnowledgeDocumentService,
    private readonly rag: KnowledgeRagService,
    private readonly modelProfiles: KnowledgeRagModelProfileService,
    @Optional() private readonly identityAuth?: IdentityAuthService
  ) {}

  @Get('bases')
  async listBases(@Req() request: KnowledgeApiRequest) {
    return this.handleKnowledgeErrors(async () =>
      this.knowledgeBaseService.listBases(await this.resolveActor(request))
    );
  }

  @Post('bases')
  async createBase(@Req() request: KnowledgeApiRequest, @Body() body: unknown) {
    return this.handleKnowledgeErrors(async () =>
      this.knowledgeBaseService.createBase(
        await this.resolveActor(request),
        KnowledgeBaseCreateRequestSchema.parse(body)
      )
    );
  }

  @Get('bases/:baseId/members')
  async listMembers(@Req() request: KnowledgeApiRequest, @Param('baseId') baseId: string) {
    return this.handleKnowledgeErrors(async () =>
      this.knowledgeBaseService.listMembers(await this.resolveActor(request), baseId)
    );
  }

  @Post('bases/:baseId/members')
  async addMember(@Req() request: KnowledgeApiRequest, @Param('baseId') baseId: string, @Body() body: unknown) {
    return this.handleKnowledgeErrors(async () =>
      this.knowledgeBaseService.addMember(
        await this.resolveActor(request),
        baseId,
        KnowledgeBaseMemberCreateRequestSchema.parse(body)
      )
    );
  }

  @Get('documents')
  async listDocuments(@Req() request: KnowledgeApiRequest, @Query('knowledgeBaseId') knowledgeBaseId?: string) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.listDocuments(await this.resolveActor(request), { knowledgeBaseId })
    );
  }

  @Post('bases/:baseId/uploads')
  @UseInterceptors(FileInterceptor('file'))
  async uploadKnowledgeFile(
    @Req() request: KnowledgeApiRequest,
    @Param('baseId') baseId: string,
    @UploadedFile() file: UploadedKnowledgeFile
  ) {
    return this.handleKnowledgeErrors(async () =>
      this.uploads.uploadFile(await this.resolveActor(request), baseId, file)
    );
  }

  @Post('bases/:baseId/documents')
  async createDocumentFromUpload(
    @Req() request: KnowledgeApiRequest,
    @Param('baseId') baseId: string,
    @Body() body: unknown
  ) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.createFromUpload(
        await this.resolveActor(request),
        baseId,
        CreateDocumentFromUploadRequestSchema.parse(body)
      )
    );
  }

  @Get('documents/:documentId')
  async getDocument(@Req() request: KnowledgeApiRequest, @Param('documentId') documentId: string) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.getDocument(await this.resolveActor(request), documentId)
    );
  }

  @Get('documents/:documentId/jobs/latest')
  async getLatestDocumentJob(@Req() request: KnowledgeApiRequest, @Param('documentId') documentId: string) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.getLatestJob(await this.resolveActor(request), documentId)
    );
  }

  @Get('documents/:documentId/chunks')
  async listDocumentChunks(@Req() request: KnowledgeApiRequest, @Param('documentId') documentId: string) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.listChunks(await this.resolveActor(request), documentId)
    );
  }

  @Post('documents/:documentId/reprocess')
  async reprocessDocument(@Req() request: KnowledgeApiRequest, @Param('documentId') documentId: string) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.reprocessDocument(await this.resolveActor(request), documentId)
    );
  }

  @Delete('documents/:documentId')
  async deleteDocument(@Req() request: KnowledgeApiRequest, @Param('documentId') documentId: string) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.deleteDocument(await this.resolveActor(request), documentId)
    );
  }

  @Get('embedding-models')
  listEmbeddingModels() {
    return this.documents.listEmbeddingModels();
  }

  @Post('chat')
  async chat(
    @Req() request: KnowledgeApiRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response?: KnowledgeSseResponse
  ) {
    return this.handleKnowledgeErrors(async () => {
      const input = KnowledgeChatRequestSchema.parse(body) as KnowledgeChatRequest;
      const actor = await this.resolveActor(request);
      const normalized = normalizeKnowledgeChatRequest(input);
      const modelProfile = this.resolveModelProfile(input.model);
      if (input.stream) {
        if (!response) {
          throw new BadRequestException({
            code: 'knowledge_stream_response_required',
            message: 'SSE response is required'
          });
        }
        await this.streamChatResponse(response, actor, normalized, modelProfile);
        return undefined;
      }
      return this.rag.answer(actor, normalized, modelProfile);
    });
  }

  @Get('rag/model-profiles')
  async listRagModelProfiles(@Req() request: KnowledgeApiRequest) {
    await this.resolveActor(request);
    return { items: this.modelProfiles.listSummaries() };
  }

  @Get('conversations')
  async listConversations(@Req() request: KnowledgeApiRequest, @Query() query: PageQuery) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.listConversations(await this.resolveActor(request), query)
    );
  }

  @Get('conversations/:id/messages')
  async listConversationMessages(
    @Req() request: KnowledgeApiRequest,
    @Param('id') conversationId: string,
    @Query() query: PageQuery
  ) {
    return this.handleKnowledgeErrors(async () =>
      this.documents.listConversationMessages(await this.resolveActor(request), conversationId, query)
    );
  }

  @Post('messages/:messageId/feedback')
  async createFeedback(@Param('messageId') messageId: string, @Body() body: unknown): Promise<KnowledgeChatMessage> {
    return this.handleKnowledgeErrors(async () => {
      const updated = await this.documents.recordFeedback(
        messageId,
        CreateKnowledgeMessageFeedbackRequestSchema.parse(body)
      );
      return {
        id: updated.id,
        conversationId: updated.conversationId,
        role: updated.role,
        content: updated.content,
        citations: updated.citations,
        traceId: updated.traceId,
        feedback: updated.feedback,
        createdAt: updated.createdAt
      };
    });
  }

  private resolveModelProfile(model: string | undefined) {
    const profileId = model === 'knowledge-default' || model === 'knowledge-rag' ? undefined : model;
    try {
      return this.modelProfiles.resolveEnabled(profileId);
    } catch (error) {
      if (error instanceof Error && error.message === 'rag_model_profile_disabled') {
        throw new KnowledgeServiceError('rag_model_profile_disabled', 'RAG model profile is disabled.');
      }
      if (error instanceof Error && error.message === 'rag_model_profile_not_found') {
        throw new KnowledgeServiceError('rag_model_profile_not_found', 'RAG model profile was not found.');
      }
      throw error;
    }
  }

  private async resolveActor(request: KnowledgeApiRequest): Promise<KnowledgeActor> {
    const principalUserId = readPrincipalUserId(request.principal);
    if (principalUserId) {
      return { userId: principalUserId };
    }

    const token = readBearerToken(request.headers?.authorization);
    if (token && this.identityAuth) {
      const current = await this.identityAuth.me(token);
      return { userId: current.account.id };
    }

    throw new UnauthorizedException({
      code: 'auth_unauthorized',
      message: 'identity access token is required'
    });
  }

  private async handleKnowledgeErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toKnowledgeHttpException(error);
    }
  }

  private async streamChatResponse(
    response: KnowledgeSseResponse,
    actor: KnowledgeActor,
    request: ReturnType<typeof normalizeKnowledgeChatRequest>,
    modelProfile: ReturnType<KnowledgeApiController['resolveModelProfile']>
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    try {
      for await (const event of this.rag.stream(actor, request, modelProfile)) {
        response.write(toSseFrame(event));
      }
    } catch (error) {
      response.write(toSseFrame(toSseErrorEvent(error)));
    } finally {
      response.end();
    }
  }
}

function readPrincipalUserId(principal: unknown): string | undefined {
  if (typeof principal !== 'object' || principal === null) {
    return undefined;
  }
  if ('userId' in principal && typeof principal.userId === 'string') {
    return principal.userId;
  }
  if ('sub' in principal && typeof principal.sub === 'string') {
    return principal.sub;
  }
  return undefined;
}

function readBearerToken(authorization: string | string[] | undefined): string | undefined {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!value?.startsWith('Bearer ')) {
    return undefined;
  }
  return value.slice('Bearer '.length).trim() || undefined;
}

function toKnowledgeHttpException(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new BadRequestException({ code: 'validation_error', message: '请求参数不合法', details: error.issues });
  }
  if (error instanceof KnowledgeServiceError) {
    if (error.code === 'knowledge_permission_denied' || error.code === 'knowledge_upload_permission_denied') {
      return new ForbiddenException({ code: error.code, message: error.message });
    }
    if (
      error.code === 'knowledge_chat_message_required' ||
      error.code === 'knowledge_upload_invalid_type' ||
      error.code === 'knowledge_upload_too_large' ||
      error.code === 'knowledge_upload_not_found' ||
      error.code === 'knowledge_chat_message_not_found' ||
      error.code === 'rag_model_profile_disabled' ||
      error.code === 'rag_model_profile_not_found'
    ) {
      return new BadRequestException({ code: error.code, message: error.message });
    }
  }
  return error;
}

function toSseFrame(event: KnowledgeRagStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function toSseErrorEvent(error: unknown): KnowledgeRagStreamEvent {
  return {
    type: 'rag.error',
    runId: 'unknown',
    error: {
      code: toRagErrorCode(error),
      message: getErrorMessage(error)
    }
  };
}

function toRagErrorCode(error: unknown): KnowledgeRagErrorCode {
  if (error instanceof KnowledgeServiceError && isRagErrorCode(error.code)) {
    return error.code;
  }
  return 'unknown';
}

function isRagErrorCode(value: string): value is KnowledgeRagErrorCode {
  return (
    value === 'knowledge_chat_failed' ||
    value === 'knowledge_permission_denied' ||
    value === 'rag_model_profile_disabled' ||
    value === 'rag_model_profile_not_found'
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Knowledge chat stream failed.';
}
