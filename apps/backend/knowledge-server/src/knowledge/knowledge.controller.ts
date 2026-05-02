import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  type KnowledgeBase,
  type KnowledgeBaseMembersResponse,
  type KnowledgeBasesListResponse
} from '@agent/core';

import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { KnowledgeAuthUser } from '../auth/auth-token-verifier';
import type {
  CreateDocumentFromUploadResponse,
  DocumentChunksResponse,
  DocumentProcessingJobRecord,
  KnowledgeDocumentRecord
} from './domain/knowledge-document.types';
import { CreateDocumentFromUploadRequestSchema } from './domain/knowledge-document.schemas';
import type { KnowledgeUploadResult, UploadedKnowledgeFile } from './domain/knowledge-upload.types';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeUploadService } from './knowledge-upload.service';

@UseGuards(AuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(KnowledgeUploadService) private readonly uploads?: KnowledgeUploadService,
    @Inject(KnowledgeDocumentService) private readonly documents?: KnowledgeDocumentService
  ) {}

  @Get('bases')
  listBases(@AuthUser() user: KnowledgeAuthUser): Promise<KnowledgeBasesListResponse> {
    return this.knowledge.listBases(user);
  }

  @Post('bases')
  createBase(@AuthUser() user: KnowledgeAuthUser, @Body() body: unknown): Promise<KnowledgeBase> {
    return this.knowledge.createBase(user, KnowledgeBaseCreateRequestSchema.parse(body));
  }

  @Get('bases/:baseId/members')
  listMembers(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('baseId') baseId: string
  ): Promise<KnowledgeBaseMembersResponse> {
    return this.knowledge.listMembers(user, baseId);
  }

  @Post('bases/:baseId/members')
  addMember(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('baseId') baseId: string,
    @Body() body: unknown
  ): Promise<KnowledgeBaseMembersResponse['members'][number]> {
    return this.knowledge.addMember(user, baseId, KnowledgeBaseMemberCreateRequestSchema.parse(body));
  }

  @Post('bases/:baseId/uploads')
  @UseInterceptors(FileInterceptor('file'))
  uploadKnowledgeFile(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('baseId') baseId: string,
    @UploadedFile() file: UploadedKnowledgeFile
  ): Promise<KnowledgeUploadResult> {
    return this.requireUploads().uploadFile(user, baseId, file);
  }

  @Post('bases/:baseId/documents')
  createDocumentFromUpload(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('baseId') baseId: string,
    @Body() body: unknown
  ): Promise<CreateDocumentFromUploadResponse> {
    return this.requireDocuments().createFromUpload(user, baseId, CreateDocumentFromUploadRequestSchema.parse(body));
  }

  @Get('documents/:documentId')
  getDocument(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('documentId') documentId: string
  ): Promise<KnowledgeDocumentRecord> {
    return this.requireDocuments().getDocument(user, documentId);
  }

  @Get('documents/:documentId/jobs/latest')
  getLatestDocumentJob(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('documentId') documentId: string
  ): Promise<DocumentProcessingJobRecord> {
    return this.requireDocuments().getLatestJob(user, documentId);
  }

  @Get('documents/:documentId/chunks')
  listDocumentChunks(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('documentId') documentId: string
  ): Promise<DocumentChunksResponse> {
    return this.requireDocuments().listChunks(user, documentId);
  }

  @Post('documents/:documentId/reprocess')
  reprocessDocument(
    @AuthUser() user: KnowledgeAuthUser,
    @Param('documentId') documentId: string
  ): Promise<CreateDocumentFromUploadResponse> {
    return this.requireDocuments().reprocessDocument(user, documentId);
  }

  @Delete('documents/:documentId')
  deleteDocument(@AuthUser() user: KnowledgeAuthUser, @Param('documentId') documentId: string): Promise<{ ok: true }> {
    return this.requireDocuments().deleteDocument(user, documentId);
  }

  private requireUploads(): KnowledgeUploadService {
    if (!this.uploads) {
      throw new Error('KnowledgeUploadService is not configured');
    }
    return this.uploads;
  }

  private requireDocuments(): KnowledgeDocumentService {
    if (!this.documents) {
      throw new Error('KnowledgeDocumentService is not configured');
    }
    return this.documents;
  }
}
