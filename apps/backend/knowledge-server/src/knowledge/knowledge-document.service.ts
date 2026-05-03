import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { KnowledgeRagStreamEvent } from '@agent/knowledge';

import { normalizeChatRequest } from './knowledge-document-chat.helpers';
import { KnowledgeServiceError } from './knowledge.errors';
import type {
  CreateDocumentFromUploadRequest,
  CreateDocumentFromUploadResponse,
  DocumentChunksResponse,
  DocumentProcessingJobRecord,
  KnowledgeChatRequest,
  KnowledgeChatResponse,
  KnowledgeChatConversationRecord,
  KnowledgeChatMessageRecord,
  KnowledgeDocumentRecord,
  KnowledgeEmbeddingModelsResponse,
  RagModelProfileSummary
} from './domain/knowledge-document.types';
import type { KnowledgeActor } from './knowledge.service';
import { KnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import { KnowledgeRagService } from './knowledge-rag.service';
import { KnowledgeTraceService } from './knowledge-trace.service';
import { KnowledgeRagModelProfileService } from './rag/knowledge-rag-model-profile.service';
import type { KnowledgeSdkRuntimeProviderValue } from './runtime/knowledge-sdk-runtime.provider';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { OssStorageProvider } from './storage/oss-storage.provider';

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly worker: KnowledgeIngestionWorker,
    private readonly storage: OssStorageProvider,
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue = disabledSdkRuntime(),
    private readonly ragService: KnowledgeRagService = new KnowledgeRagService(
      repository,
      sdkRuntime,
      new KnowledgeTraceService()
    ),
    private readonly modelProfiles: KnowledgeRagModelProfileService = createDefaultRagModelProfileService()
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
    const completedJob = await this.worker.process(job);
    const completedDocument = await this.getDocument(actor, document.id);
    return { document: completedDocument, job: this.withProgress(completedJob, completedDocument) };
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
    return this.withProgress(job, document);
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
    const nextAttempt = (latestJob?.attempts ?? 0) + 1;
    await this.repository.updateDocument({
      ...document,
      status: 'queued',
      updatedAt: now
    });
    const job: DocumentProcessingJobRecord = {
      id: `job_${randomUUID()}`,
      documentId: document.id,
      status: 'queued',
      stage: 'uploaded',
      currentStage: 'queued',
      stages: [{ stage: 'queued', status: 'queued', startedAt: now }],
      progress: { percent: 0 },
      attempts: nextAttempt,
      createdAt: now,
      updatedAt: now
    };
    await this.repository.createJob(job);
    const completedJob = await this.worker.process(job);
    const completedDocument = await this.getDocument(actor, document.id);
    return { document: completedDocument, job: this.withProgress(completedJob, completedDocument) };
  }

  async chat(actor: KnowledgeActor, input: KnowledgeChatRequest): Promise<KnowledgeChatResponse> {
    const request = normalizeChatRequest(input);
    return this.ragService.answer(actor, request);
  }

  streamChat(actor: KnowledgeActor, input: KnowledgeChatRequest): AsyncIterable<KnowledgeRagStreamEvent> {
    const request = normalizeChatRequest(input);
    return this.ragService.stream(actor, request);
  }

  listEmbeddingModels(): KnowledgeEmbeddingModelsResponse {
    const id = process.env.KNOWLEDGE_EMBEDDING_MODEL ?? 'text-embedding-3-small';
    const provider = 'openai-compatible';
    const status = process.env.KNOWLEDGE_LLM_API_KEY ? 'available' : 'unconfigured';
    return {
      items: [
        {
          id,
          label: id,
          provider,
          status
        }
      ]
    };
  }

  listRagModelProfiles(actor: KnowledgeActor): { items: RagModelProfileSummary[] } {
    void actor;
    return { items: this.modelProfiles.listSummaries() };
  }

  async listConversations(
    actor: KnowledgeActor,
    query: PageQuery = {}
  ): Promise<{ items: KnowledgeChatConversationRecord[]; total: number }> {
    void query;
    return this.repository.listChatConversationsForUser(actor.userId);
  }

  async listConversationMessages(
    actor: KnowledgeActor,
    conversationId: string,
    query: PageQuery = {}
  ): Promise<{ items: KnowledgeChatMessageRecord[]; total: number }> {
    void query;
    return this.repository.listChatMessages(conversationId, actor.userId);
  }

  async deleteDocument(actor: KnowledgeActor, documentId: string): Promise<{ ok: true }> {
    const document = await this.getDocument(actor, documentId);
    await this.repository.deleteDocument(document.id);
    await this.storage.deleteObject(document.objectKey).catch(() => undefined);
    return { ok: true };
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

  private withProgress(
    job: DocumentProcessingJobRecord,
    document: KnowledgeDocumentRecord
  ): DocumentProcessingJobRecord {
    const totalChunks = document.chunkCount;
    const processedChunks = document.embeddedChunkCount;
    return {
      ...job,
      progress: {
        ...job.progress,
        percent:
          job.status === 'succeeded'
            ? 100
            : (job.progress.percent ?? deriveProgressPercent(job, processedChunks, totalChunks)),
        processedChunks: job.progress.processedChunks ?? processedChunks,
        totalChunks: job.progress.totalChunks ?? totalChunks
      }
    };
  }
}

export interface PageQuery {
  page?: string | number;
  pageSize?: string | number;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function deriveProgressPercent(job: DocumentProcessingJobRecord, processedChunks: number, totalChunks: number): number {
  if (job.status === 'succeeded') {
    return 100;
  }
  if (job.status === 'failed') {
    return Math.max(0, Math.min(99, Math.round((processedChunks / Math.max(totalChunks, 1)) * 100)));
  }
  if (totalChunks > 0) {
    return Math.max(1, Math.min(99, Math.round((processedChunks / totalChunks) * 100)));
  }
  return job.status === 'running' ? 10 : 0;
}

function disabledSdkRuntime(): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: false,
    reason: 'missing_env',
    missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
    runtime: null
  };
}

function createDefaultRagModelProfileService(): KnowledgeRagModelProfileService {
  return new KnowledgeRagModelProfileService({
    profiles: [
      {
        id: 'coding-pro',
        label: '用于编程',
        description: '更专业的回答与控制',
        useCase: 'coding',
        plannerModelId: readModelEnv('KNOWLEDGE_PLANNER_MODEL', readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat')),
        answerModelId: readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat'),
        embeddingModelId: readModelEnv('KNOWLEDGE_EMBEDDING_MODEL', 'knowledge-embedding'),
        enabled: true
      },
      {
        id: 'daily-balanced',
        label: '适合日常工作',
        description: '同样强大，技术细节更少',
        useCase: 'daily',
        plannerModelId: readModelEnv('KNOWLEDGE_PLANNER_MODEL', readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat')),
        answerModelId: readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat'),
        embeddingModelId: readModelEnv('KNOWLEDGE_EMBEDDING_MODEL', 'knowledge-embedding'),
        enabled: true
      }
    ]
  });
}

function readModelEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}
