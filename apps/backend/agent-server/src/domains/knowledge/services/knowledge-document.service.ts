import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import type {
  KnowledgeChatConversationRecord,
  KnowledgeChatMessageFeedback,
  KnowledgeChatMessageRecord,
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  DocumentChunksResponse,
  DocumentProcessingJobRecord,
  KnowledgeEmbeddingModelsResponse,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import { KNOWLEDGE_OSS_STORAGE, KNOWLEDGE_REPOSITORY } from '../knowledge-domain.tokens';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { OssStorageProvider } from '../storage/oss-storage.provider';
import type { KnowledgeActor } from './knowledge-base.service';
import { KnowledgeIngestionQueue } from './knowledge-ingestion.queue';
import { KnowledgeServiceError } from './knowledge-service.error';

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repository: KnowledgeRepository,
    private readonly queue: KnowledgeIngestionQueue,
    @Inject(KNOWLEDGE_OSS_STORAGE) private readonly storage: OssStorageProvider
  ) {}

  async createFromUpload(
    actor: KnowledgeActor,
    baseId: string,
    input: CreateDocumentFromUploadRequest
  ): Promise<CreateDocumentFromUploadResponse> {
    await this.assertCanView(actor.userId, baseId);
    const upload = await this.repository.findUpload(input.uploadId);
    if (!upload || upload.knowledgeBaseId !== baseId || upload.objectKey !== input.objectKey) {
      throw new KnowledgeServiceError('knowledge_upload_not_found', '上传记录不存在');
    }

    const now = new Date().toISOString();
    const document: KnowledgeDocumentRecord = {
      id: `doc_${randomUUID()}`,
      workspaceId: 'default',
      knowledgeBaseId: baseId,
      uploadId: upload.uploadId,
      objectKey: upload.objectKey,
      filename: input.filename,
      title: input.title ?? stripExtension(input.filename),
      sourceType: 'user-upload',
      status: 'queued',
      version: 'v1',
      chunkCount: 0,
      embeddedChunkCount: 0,
      createdBy: actor.userId,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now
    };
    await this.repository.createDocument(document);

    const job: DocumentProcessingJobRecord = {
      id: `job_${randomUUID()}`,
      documentId: document.id,
      status: 'queued',
      stage: 'uploaded',
      currentStage: 'queued',
      stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
      progress: { percent: 0 },
      attempts: 1,
      createdAt: now,
      updatedAt: now
    };
    await this.repository.createJob(job);
    this.queue.enqueue(job);

    return { document, job };
  }

  async getDocument(actor: KnowledgeActor, documentId: string): Promise<KnowledgeDocumentRecord> {
    const document = await this.repository.findDocument(documentId);
    if (!document) {
      throw new KnowledgeServiceError('knowledge_document_not_found', '文档不存在');
    }
    await this.assertCanView(actor.userId, document.knowledgeBaseId);
    return document;
  }

  async listDocuments(
    actor: KnowledgeActor,
    input: { knowledgeBaseId?: string } = {}
  ): Promise<{ items: KnowledgeDocumentRecord[]; page: number; pageSize: number; total: number }> {
    const bases = input.knowledgeBaseId
      ? [await this.getVisibleBaseId(actor, input.knowledgeBaseId)]
      : (await this.repository.listBasesForUser(actor.userId)).map(base => base.id);
    const items = (await Promise.all(bases.map(base => this.repository.listDocumentsForBase(base.id))))
      .flat()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return { items, page: 1, pageSize: 20, total: items.length };
  }

  async getLatestJob(actor: KnowledgeActor, documentId: string): Promise<DocumentProcessingJobRecord> {
    const document = await this.getDocument(actor, documentId);
    const job = await this.repository.findLatestJobForDocument(document.id);
    if (!job) {
      throw new KnowledgeServiceError('knowledge_job_not_found', '文档处理任务不存在');
    }
    return job;
  }

  async listChunks(actor: KnowledgeActor, documentId: string): Promise<DocumentChunksResponse> {
    const document = await this.getDocument(actor, documentId);
    const items = await this.repository.listChunks(document.id);
    return { items, total: items.length };
  }

  async reprocessDocument(actor: KnowledgeActor, documentId: string): Promise<CreateDocumentFromUploadResponse> {
    const document = await this.getDocument(actor, documentId);
    const now = new Date().toISOString();
    const latestJob = await this.repository.findLatestJobForDocument(document.id);
    const job: DocumentProcessingJobRecord = {
      id: `job_${randomUUID()}`,
      documentId: document.id,
      status: 'queued',
      stage: 'uploaded',
      currentStage: 'queued',
      stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
      progress: { percent: 0 },
      attempts: (latestJob?.attempts ?? 0) + 1,
      createdAt: now,
      updatedAt: now
    };
    await this.repository.updateDocument({ ...document, status: 'queued', updatedAt: now });
    await this.repository.createJob(job);
    this.queue.enqueue(job);
    return { document: await this.getDocument(actor, document.id), job };
  }

  async deleteDocument(actor: KnowledgeActor, documentId: string): Promise<{ ok: true }> {
    const document = await this.getDocument(actor, documentId);
    await this.repository.deleteDocument(document.id);
    await this.storage.deleteObject(document.objectKey).catch(() => undefined);
    return { ok: true };
  }

  listEmbeddingModels(): KnowledgeEmbeddingModelsResponse {
    const id = process.env.KNOWLEDGE_EMBEDDING_MODEL ?? 'text-embedding-3-small';
    return {
      items: [
        {
          id,
          label: id,
          provider: 'openai-compatible',
          status: process.env.KNOWLEDGE_LLM_API_KEY ? 'available' : 'unconfigured'
        }
      ]
    };
  }

  async listConversations(
    actor: KnowledgeActor,
    query: PageQuery = {}
  ): Promise<PageResult<KnowledgeChatConversationRecord>> {
    return paginate(await this.repository.listChatConversationsForUser(actor.userId), normalizePageQuery(query));
  }

  async listConversationMessages(
    actor: KnowledgeActor,
    conversationId: string,
    query: PageQuery = {}
  ): Promise<PageResult<KnowledgeChatMessageRecord>> {
    return paginate(await this.repository.listChatMessages(conversationId, actor.userId), normalizePageQuery(query));
  }

  async recordFeedback(messageId: string, feedback: KnowledgeChatMessageFeedback): Promise<KnowledgeChatMessageRecord> {
    const updated = await this.repository.updateMessageFeedback(messageId, feedback);
    if (!updated) {
      throw new KnowledgeServiceError('knowledge_chat_message_not_found', '消息不存在');
    }
    return updated;
  }

  private async assertCanView(userId: string, baseId: string): Promise<void> {
    const base = await this.repository.findBase(baseId);
    if (!base) {
      throw new KnowledgeServiceError('knowledge_base_not_found', '知识库不存在');
    }
    const member = await this.repository.findMember(baseId, userId);
    if (!member) {
      throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
    }
  }

  private async getVisibleBaseId(actor: KnowledgeActor, baseId: string): Promise<{ id: string }> {
    await this.assertCanView(actor.userId, baseId);
    return { id: baseId };
  }
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

export interface PageQuery {
  page?: string | number;
  pageSize?: string | number;
}

interface PageInput {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function normalizePageQuery(query: PageQuery): PageInput {
  return {
    page: readPositiveInteger(query.page, 1),
    pageSize: Math.min(readPositiveInteger(query.pageSize, 20), 100)
  };
}

function paginate<T>(result: { items: T[]; total: number }, input: PageInput): PageResult<T> {
  const start = (input.page - 1) * input.pageSize;
  return {
    items: result.items.slice(start, start + input.pageSize),
    total: result.total,
    page: input.page,
    pageSize: input.pageSize
  };
}

function readPositiveInteger(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}
