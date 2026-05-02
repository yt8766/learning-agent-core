import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { KnowledgeServiceError } from './knowledge.errors';
import type {
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  DocumentChunksResponse,
  DocumentProcessingJobRecord,
  KnowledgeDocumentRecord
} from './domain/knowledge-document.types';
import type { KnowledgeActor } from './knowledge.service';
import { KnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { OssStorageProvider } from './storage/oss-storage.provider';

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly worker: KnowledgeIngestionWorker,
    private readonly storage: OssStorageProvider
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
      currentStage: 'queued',
      stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
      createdAt: now,
      updatedAt: now
    };
    await this.repository.createJob(job);
    const completedJob = await this.worker.process(job);
    const completedDocument = await this.getDocument(actor, document.id);
    return { document: completedDocument, job: completedJob };
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
      ? [{ id: input.knowledgeBaseId }]
      : await this.repository.listBasesForUser(actor.userId);
    const items = (
      await Promise.all(
        bases.map(async base => {
          await this.assertCanView(actor.userId, base.id);
          return this.repository.listDocumentsForBase(base.id);
        })
      )
    )
      .flat()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: 20
    };
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
    await this.repository.updateDocument({
      ...document,
      status: 'queued',
      updatedAt: now
    });
    const job: DocumentProcessingJobRecord = {
      id: `job_${randomUUID()}`,
      documentId: document.id,
      status: 'queued',
      currentStage: 'queued',
      stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
      createdAt: now,
      updatedAt: now
    };
    await this.repository.createJob(job);
    const completedJob = await this.worker.process(job);
    const completedDocument = await this.getDocument(actor, document.id);
    return { document: completedDocument, job: completedJob };
  }

  async deleteDocument(actor: KnowledgeActor, documentId: string): Promise<{ ok: true }> {
    const document = await this.getDocument(actor, documentId);
    await this.repository.deleteDocument(document.id);
    await this.storage.deleteObject(document.objectKey).catch(() => undefined);
    return { ok: true };
  }

  private async assertCanView(userId: string, baseId: string): Promise<void> {
    const member = await this.repository.findMember(baseId, userId);
    if (!member) {
      throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
    }
  }
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}
