import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { KnowledgeServiceError } from './knowledge.errors';
import type {
  DocumentChunkRecord,
  DocumentProcessingJobRecord,
  KnowledgeDocumentRecord,
  KnowledgeJobStage
} from './domain/knowledge-document.types';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from './runtime/knowledge-sdk-runtime.provider';
import type { OssStorageProvider } from './storage/oss-storage.provider';

@Injectable()
export class KnowledgeIngestionWorker {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly storage: OssStorageProvider,
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue = disabledSdkRuntime()
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
    await this.repository.updateJob({
      ...job,
      status: 'running',
      currentStage: 'parse',
      updatedAt: now,
      stages: [{ stage: 'parse', status: 'running', startedAt: now }]
    });

    const chunks = splitIntoChunks(object.body.toString('utf8')).map((content, index): DocumentChunkRecord => {
      const timestamp = new Date().toISOString();
      return {
        id: `chunk_${randomUUID()}`,
        documentId: document.id,
        ordinal: index,
        content,
        tokenCount: countTokens(content),
        embeddingStatus: this.sdkRuntime.enabled ? 'pending' : 'succeeded',
        vectorIndexStatus: this.sdkRuntime.enabled ? 'pending' : 'succeeded',
        keywordIndexStatus: 'succeeded',
        createdAt: timestamp,
        updatedAt: timestamp
      };
    });

    if (this.sdkRuntime.enabled) {
      return this.processWithSdkRuntime({ job, document, chunks, startedAt: now });
    }

    await this.repository.saveChunks(document.id, chunks);
    await this.repository.updateDocument({
      ...document,
      status: 'ready',
      chunkCount: chunks.length,
      embeddedChunkCount: chunks.length,
      updatedAt: new Date().toISOString()
    });

    const completedAt = new Date().toISOString();
    return this.repository.updateJob({
      ...job,
      status: 'succeeded',
      currentStage: 'commit',
      updatedAt: completedAt,
      stages: [
        { stage: 'parse', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'chunk', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'embed', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'index_vector', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'index_keyword', status: 'succeeded', startedAt: now, completedAt },
        { stage: 'commit', status: 'succeeded', startedAt: now, completedAt }
      ]
    });
  }

  private async processWithSdkRuntime(input: {
    job: DocumentProcessingJobRecord;
    document: KnowledgeDocumentRecord;
    chunks: DocumentChunkRecord[];
    startedAt: string;
  }): Promise<DocumentProcessingJobRecord> {
    const { job, document, chunks, startedAt } = input;
    let embeddings: number[][];

    try {
      embeddings = await this.embedChunks(chunks);
      assertEmbeddingCount(chunks, embeddings);
    } catch (error) {
      await this.failIngestion({ job, document, chunks, stage: 'embed', error });
      throw toIngestionError('embed', error);
    }

    const embeddedChunks = chunks.map(chunk => ({
      ...chunk,
      embeddingStatus: 'succeeded' as const,
      updatedAt: new Date().toISOString()
    }));

    try {
      const upsertResult = await this.sdkRuntime.runtime.vectorStore.upsert({
        records: embeddedChunks.map((chunk, index) => ({
          id: chunk.id,
          embedding: embeddings[index],
          content: chunk.content,
          metadata: createVectorMetadata(document, chunk)
        }))
      });
      assertVectorUpsertCount(embeddedChunks, upsertResult.upsertedCount);
    } catch (error) {
      await this.failIngestion({ job, document, chunks: embeddedChunks, stage: 'index_vector', error });
      throw toIngestionError('index_vector', error);
    }

    const indexedChunks = embeddedChunks.map(chunk => ({
      ...chunk,
      vectorIndexStatus: 'succeeded' as const,
      updatedAt: new Date().toISOString()
    }));

    await this.repository.saveChunks(document.id, indexedChunks);
    await this.repository.updateDocument({
      ...document,
      status: 'ready',
      chunkCount: indexedChunks.length,
      embeddedChunkCount: indexedChunks.length,
      updatedAt: new Date().toISOString()
    });

    const completedAt = new Date().toISOString();
    return this.repository.updateJob({
      ...job,
      status: 'succeeded',
      currentStage: 'commit',
      updatedAt: completedAt,
      stages: [
        { stage: 'parse', status: 'succeeded', startedAt, completedAt },
        { stage: 'chunk', status: 'succeeded', startedAt, completedAt },
        { stage: 'embed', status: 'succeeded', startedAt, completedAt },
        { stage: 'index_vector', status: 'succeeded', startedAt, completedAt },
        { stage: 'index_keyword', status: 'succeeded', startedAt, completedAt },
        { stage: 'commit', status: 'succeeded', startedAt, completedAt }
      ]
    });
  }

  private async embedChunks(chunks: DocumentChunkRecord[]): Promise<number[][]> {
    if (chunks.length === 0) {
      throw new Error('document has no non-empty chunks to embed');
    }

    const result = await this.sdkRuntime.runtime.embeddingProvider.embedBatch({
      texts: chunks.map(chunk => chunk.content)
    });
    return result.embeddings;
  }

  private async failIngestion(input: {
    job: DocumentProcessingJobRecord;
    document: KnowledgeDocumentRecord;
    chunks: DocumentChunkRecord[];
    stage: Extract<KnowledgeJobStage, 'embed' | 'index_vector'>;
    error: unknown;
  }): Promise<void> {
    const failedAt = new Date().toISOString();
    const errorCode = getStageErrorCode(input.stage);
    const errorMessage = getErrorMessage(input.error);
    const failedChunks = input.chunks.map(chunk => ({
      ...chunk,
      embeddingStatus: input.stage === 'embed' ? ('failed' as const) : chunk.embeddingStatus,
      vectorIndexStatus: input.stage === 'index_vector' ? ('failed' as const) : chunk.vectorIndexStatus,
      updatedAt: failedAt
    }));

    await this.repository.saveChunks(input.document.id, failedChunks);
    await this.repository.updateDocument({
      ...input.document,
      status: 'failed',
      chunkCount: failedChunks.length,
      embeddedChunkCount: countEmbeddedChunks(failedChunks),
      updatedAt: failedAt
    });
    await this.repository.updateJob({
      ...input.job,
      status: 'failed',
      currentStage: input.stage,
      errorCode,
      errorMessage,
      updatedAt: failedAt,
      stages: [
        { stage: 'parse', status: 'succeeded', startedAt: input.job.updatedAt, completedAt: failedAt },
        { stage: 'chunk', status: 'succeeded', startedAt: input.job.updatedAt, completedAt: failedAt },
        ...(input.stage === 'index_vector'
          ? [
              {
                stage: 'embed' as const,
                status: 'succeeded' as const,
                startedAt: input.job.updatedAt,
                completedAt: failedAt
              }
            ]
          : []),
        {
          stage: input.stage,
          status: 'failed',
          startedAt: input.job.updatedAt,
          completedAt: failedAt,
          errorCode,
          message: errorMessage
        }
      ]
    });
  }
}

function splitIntoChunks(content: string): string[] {
  const chunks = content
    .split(/\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks : [content.trim()].filter(Boolean);
}

function countTokens(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function createVectorMetadata(document: KnowledgeDocumentRecord, chunk: DocumentChunkRecord): Record<string, unknown> {
  return {
    tenantId: document.workspaceId,
    knowledgeBaseId: document.knowledgeBaseId,
    documentId: document.id,
    ordinal: chunk.ordinal,
    title: document.title,
    filename: document.filename,
    ...readDocumentTags(document)
  };
}

function assertEmbeddingCount(chunks: DocumentChunkRecord[], embeddings: number[][]): void {
  if (embeddings.length !== chunks.length) {
    throw new Error(`embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
  }
}

function assertVectorUpsertCount(chunks: DocumentChunkRecord[], upsertedCount: number): void {
  if (upsertedCount !== chunks.length) {
    throw new Error(`vector upsert count mismatch: expected ${chunks.length}, got ${upsertedCount}`);
  }
}

function countEmbeddedChunks(chunks: DocumentChunkRecord[]): number {
  return chunks.filter(chunk => chunk.embeddingStatus === 'succeeded').length;
}

function readDocumentTags(document: KnowledgeDocumentRecord): { tags?: string[] } {
  const tags = document.metadata.tags;
  return Array.isArray(tags) && tags.every(tag => typeof tag === 'string') ? { tags } : {};
}

function toIngestionError(
  stage: Extract<KnowledgeJobStage, 'embed' | 'index_vector'>,
  error: unknown
): KnowledgeServiceError {
  return new KnowledgeServiceError(getStageErrorCode(stage), getErrorMessage(error));
}

function getStageErrorCode(stage: Extract<KnowledgeJobStage, 'embed' | 'index_vector'>) {
  return stage === 'embed' ? 'knowledge_embedding_failed' : 'knowledge_index_failed';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function disabledSdkRuntime(): KnowledgeSdkRuntimeProviderValue {
  return {
    enabled: false,
    reason: 'missing_env',
    missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
    runtime: null
  };
}
