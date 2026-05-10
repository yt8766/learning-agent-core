import { Inject, Injectable } from '@nestjs/common';
import { runKnowledgeIndexing, type KnowledgeChunk } from '@agent/knowledge';

import type {
  DocumentChunkRecord,
  DocumentProcessingJobRecord,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import { KNOWLEDGE_OSS_STORAGE, KNOWLEDGE_REPOSITORY, KNOWLEDGE_SDK_RUNTIME } from '../knowledge-domain.tokens';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { OssStorageProvider } from '../storage/oss-storage.provider';
import { mapSdkChunkToDocumentChunk } from './knowledge-ingestion-sdk.mapper';
import { KnowledgeServiceError } from './knowledge-service.error';

const DISABLED_SDK_RUNTIME: KnowledgeSdkRuntimeProviderValue = {
  enabled: false,
  reason: 'missing_env',
  missingEnv: [],
  runtime: null
};

@Injectable()
export class KnowledgeIngestionWorker {
  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repository: KnowledgeRepository,
    @Inject(KNOWLEDGE_OSS_STORAGE) private readonly storage: OssStorageProvider,
    @Inject(KNOWLEDGE_SDK_RUNTIME)
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue = DISABLED_SDK_RUNTIME
  ) {}

  async process(job: DocumentProcessingJobRecord): Promise<DocumentProcessingJobRecord> {
    const document = await this.repository.findDocument(job.documentId);
    if (!document) {
      throw new KnowledgeServiceError('knowledge_document_not_found', '文档不存在');
    }
    const object = await this.storage.getObject(document.objectKey);
    if (!object) {
      throw new KnowledgeServiceError('knowledge_upload_not_found', '上传文件不存在');
    }

    const now = new Date().toISOString();
    const sdkChunks: KnowledgeChunk[] = [];

    await runKnowledgeIndexing({
      loader: {
        load: async () => [
          {
            id: document.id,
            content: object.body.toString('utf8'),
            metadata: {
              sourceId: document.id,
              documentId: document.id,
              title: document.title,
              uri: document.objectKey,
              sourceType: document.sourceType,
              trustClass: 'internal',
              knowledgeBaseId: document.knowledgeBaseId
            }
          }
        ]
      },
      vectorIndex: { upsertKnowledge: async () => undefined },
      fulltextIndex: {
        upsertKnowledgeChunk: async chunk => {
          sdkChunks.push(chunk);
        }
      },
      sourceConfig: {
        sourceId: document.id,
        sourceType: document.sourceType,
        trustClass: 'internal'
      }
    });
    const chunks = sdkChunks.map(chunk => mapSdkChunkToDocumentChunk({ document, chunk, now }));
    let ingestionResult: { chunks: DocumentChunkRecord[]; vectorRecords?: IngestionVectorRecord[] };

    try {
      ingestionResult = await this.preparePersistedChunks(document, chunks, now);
      await this.repository.saveChunks(document.id, ingestionResult.chunks);
      if (ingestionResult.vectorRecords) {
        await this.sdkRuntime.runtime.vectorStore.upsert({ records: ingestionResult.vectorRecords });
      }
    } catch (error) {
      return this.markIngestionFailed({ document, job, chunks, error });
    }

    const updatedAt = new Date().toISOString();
    await this.repository.updateDocument({
      ...document,
      status: 'ready',
      chunkCount: ingestionResult.chunks.length,
      embeddedChunkCount: this.sdkRuntime.enabled ? ingestionResult.chunks.length : 0,
      updatedAt
    });

    return this.repository.updateJob({
      ...job,
      status: 'succeeded',
      stage: 'succeeded',
      currentStage: 'commit',
      progress: {
        percent: 100,
        processedChunks: ingestionResult.chunks.length,
        totalChunks: ingestionResult.chunks.length
      },
      updatedAt,
      stages: [
        ...job.stages,
        { stage: 'chunk', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt },
        { stage: 'embed', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt },
        { stage: 'index_vector', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt },
        { stage: 'commit', status: 'succeeded', startedAt: updatedAt, completedAt: updatedAt }
      ]
    });
  }

  private async preparePersistedChunks(
    document: { id: string; workspaceId: string; knowledgeBaseId: string; title: string; filename: string },
    chunks: DocumentChunkRecord[],
    now: string
  ): Promise<{ chunks: DocumentChunkRecord[]; vectorRecords?: IngestionVectorRecord[] }> {
    if (!this.sdkRuntime.enabled) {
      return {
        chunks: chunks.map(chunk => ({
          ...chunk,
          embeddingStatus: 'skipped',
          vectorIndexStatus: 'skipped',
          updatedAt: now
        }))
      };
    }

    const embeddingResults = await this.sdkRuntime.runtime.embeddingProvider.embedBatch({
      texts: chunks.map(chunk => chunk.content),
      metadata: { documentId: document.id, knowledgeBaseId: document.knowledgeBaseId }
    });
    const embeddingVectors = embeddingResults.embeddings.map(normalizeEmbeddingVector);

    return {
      chunks: chunks.map(chunk => ({
        ...chunk,
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'succeeded',
        updatedAt: now
      })),
      vectorRecords: chunks.map((chunk, index) => ({
        id: chunk.id,
        documentId: document.id,
        chunkId: chunk.id,
        content: chunk.content,
        embedding: embeddingVectors[index] ?? [],
        metadata: {
          tenantId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          title: document.title,
          filename: document.filename,
          ordinal: chunk.ordinal,
          tokenCount: chunk.tokenCount
        }
      }))
    };
  }

  private async markIngestionFailed(input: {
    document: KnowledgeDocumentRecord;
    job: DocumentProcessingJobRecord;
    chunks: DocumentChunkRecord[];
    error: unknown;
  }): Promise<DocumentProcessingJobRecord> {
    const updatedAt = new Date().toISOString();
    const failedChunks = input.chunks.map(chunk => ({
      ...chunk,
      embeddingStatus: 'failed' as const,
      vectorIndexStatus: 'failed' as const,
      updatedAt
    }));

    await this.repository.saveChunks(input.document.id, failedChunks);
    await this.repository.updateDocument({
      ...input.document,
      status: 'failed',
      chunkCount: failedChunks.length,
      embeddedChunkCount: 0,
      updatedAt
    });

    const message = errorMessage(input.error);
    return this.repository.updateJob({
      ...input.job,
      status: 'failed',
      stage: 'failed',
      currentStage: 'index_vector',
      progress: { percent: 100, processedChunks: failedChunks.length, totalChunks: failedChunks.length },
      errorCode: 'knowledge_ingestion_index_failed',
      errorMessage: message,
      error: {
        code: 'knowledge_ingestion_index_failed',
        message,
        retryable: true,
        stage: 'indexing'
      },
      stages: [
        ...input.job.stages,
        { stage: 'index_vector', status: 'failed', startedAt: updatedAt, completedAt: updatedAt, message }
      ],
      updatedAt
    });
  }
}

interface IngestionVectorRecord {
  id: string;
  documentId: string;
  chunkId: string;
  content: string;
  embedding: number[];
  metadata: {
    tenantId: string;
    knowledgeBaseId: string;
    documentId: string;
    title: string;
    filename: string;
    ordinal: number;
    tokenCount: number;
  };
}

function normalizeEmbeddingVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter(isFiniteNumber);
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'embedding' in value &&
    Array.isArray((value as { embedding: unknown }).embedding)
  ) {
    return (value as { embedding: unknown[] }).embedding.filter(isFiniteNumber);
  }
  return [];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Knowledge ingestion failed.';
}
