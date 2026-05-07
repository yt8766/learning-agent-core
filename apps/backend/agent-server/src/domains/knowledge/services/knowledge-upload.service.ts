import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { KnowledgeServiceError } from './knowledge-service.error';
import type {
  KnowledgeUploadContentType,
  KnowledgeUploadRecord,
  KnowledgeUploadResult,
  UploadedKnowledgeFile
} from '../domain/knowledge-upload.types';
import { KnowledgeUploadContentTypeSchema } from '../domain/knowledge-upload.schemas';
import { KNOWLEDGE_REPOSITORY } from '../knowledge-domain.tokens';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { InMemoryOssStorageProvider } from '../storage/in-memory-oss-storage.provider';
import type { OssStorageProvider } from '../storage/oss-storage.provider';
import type { KnowledgeActor } from './knowledge-base.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Injectable()
export class KnowledgeUploadService {
  private readonly logger = new Logger(KnowledgeUploadService.name);

  constructor(
    @Optional()
    @Inject(KNOWLEDGE_REPOSITORY)
    private readonly repository: KnowledgeRepository,
    @Optional()
    @Inject(InMemoryOssStorageProvider)
    private readonly storage: OssStorageProvider
  ) {}

  async uploadFile(actor: KnowledgeActor, baseId: string, file: UploadedKnowledgeFile): Promise<KnowledgeUploadResult> {
    await this.assertCanWrite(actor.userId, baseId);
    const filename = normalizeUploadedFilename(file.originalname);
    const contentType = inferContentType(filename, file.mimetype);
    if (!contentType) {
      throw new KnowledgeServiceError('knowledge_upload_invalid_type', '仅支持 Markdown 或 TXT 文件');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new KnowledgeServiceError('knowledge_upload_too_large', '文件大小超过限制');
    }

    const uploadId = `upload_${randomUUID()}`;
    const objectKey = `knowledge/${baseId}/${uploadId}/${sanitizeFilename(filename)}`;
    const stored = await this.storage.putObject({
      objectKey,
      body: file.buffer,
      contentType,
      metadata: {
        knowledgeBaseId: baseId,
        uploadId,
        filename,
        uploadedByUserId: actor.userId
      }
    });

    const uploadedAt = new Date().toISOString();
    const record: KnowledgeUploadRecord = {
      uploadId,
      knowledgeBaseId: baseId,
      filename,
      size: file.size,
      contentType,
      objectKey: stored.objectKey,
      ossUrl: stored.ossUrl,
      uploadedByUserId: actor.userId,
      uploadedAt
    };
    await this.repository.saveUpload(record);
    this.logger.log(`Knowledge upload stored: baseId=${baseId} objectKey=${stored.objectKey} ossUrl=${stored.ossUrl}`);
    return toUploadResult(record);
  }

  private async assertCanWrite(userId: string, baseId: string): Promise<void> {
    const member = await this.repository.findMember(baseId, userId);
    if (!member) {
      throw new KnowledgeServiceError('knowledge_upload_permission_denied', '无权上传到该知识库');
    }
  }
}

function inferContentType(filename: string, mimetype: string): KnowledgeUploadContentType | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return mimetype === 'application/pdf' ? undefined : KnowledgeUploadContentTypeSchema.parse('text/markdown');
  }
  if (lower.endsWith('.txt')) {
    return mimetype === 'application/pdf' ? undefined : KnowledgeUploadContentTypeSchema.parse('text/plain');
  }
  return undefined;
}

function normalizeUploadedFilename(filename: string): string {
  if (!looksLikeLatin1Mojibake(filename)) {
    return filename;
  }
  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? filename : decoded;
}

function looksLikeLatin1Mojibake(value: string): boolean {
  return /[ÃÂÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßà-ÿ]/.test(value);
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toUploadResult(record: KnowledgeUploadRecord): KnowledgeUploadResult {
  return {
    uploadId: record.uploadId,
    knowledgeBaseId: record.knowledgeBaseId,
    filename: record.filename,
    size: record.size,
    contentType: record.contentType,
    objectKey: record.objectKey,
    ossUrl: record.ossUrl,
    uploadedAt: record.uploadedAt
  };
}
