import { Inject, Injectable } from '@nestjs/common';
import {
  FixedWindowChunker,
  runKnowledgeIndexing,
  StructuredTextChunker,
  type Chunker,
  type KnowledgeChunk
} from '@agent/knowledge';

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
      chunker: selectKnowledgeIngestionChunker({
        contentType: object.contentType,
        filename: document.filename,
        mode: process.env.KNOWLEDGE_INGESTION_CHUNKER
      }),
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
    let ingestionResult: {
      chunks: DocumentChunkRecord[];
      vectorRecords?: IngestionVectorRecord[];
      embeddedChunkCount: number;
    };

    try {
      ingestionResult = await this.preparePersistedChunks(document, chunks, now);
      await this.repository.saveChunks(document.id, ingestionResult.chunks);
      if (ingestionResult.vectorRecords) {
        const upsertResult = await this.sdkRuntime.runtime.vectorStore.upsert({
          records: ingestionResult.vectorRecords
        });
        validateVectorUpsertResult(upsertResult, ingestionResult.vectorRecords.length);
        ingestionResult = {
          ...ingestionResult,
          chunks: ingestionResult.chunks.map(chunk => ({
            ...chunk,
            vectorIndexStatus: 'succeeded',
            updatedAt: now
          }))
        };
        await this.repository.saveChunks(document.id, ingestionResult.chunks);
      }
    } catch (error) {
      return this.markIngestionFailed({ document, job, chunks, error });
    }

    const updatedAt = new Date().toISOString();
    await this.repository.updateDocument({
      ...document,
      status: 'ready',
      chunkCount: ingestionResult.chunks.length,
      embeddedChunkCount: ingestionResult.embeddedChunkCount,
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
  ): Promise<{ chunks: DocumentChunkRecord[]; vectorRecords?: IngestionVectorRecord[]; embeddedChunkCount: number }> {
    if (!this.sdkRuntime.enabled) {
      return {
        embeddedChunkCount: 0,
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
    const embeddingVectors = validateEmbeddingBatch(embeddingResults, chunks.length);

    return {
      embeddedChunkCount: embeddingVectors.length,
      chunks: chunks.map(chunk => ({
        ...chunk,
        embeddingStatus: 'succeeded',
        vectorIndexStatus: 'pending',
        updatedAt: now
      })),
      vectorRecords: chunks.map((chunk, index) => ({
        id: chunk.id,
        documentId: document.id,
        chunkId: chunk.id,
        content: chunk.content,
        embedding: embeddingVectors[index] ?? [],
        metadata: {
          ...(chunk.metadata ?? {}),
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

    const failure = toIngestionFailure(input.error);
    return this.repository.updateJob({
      ...input.job,
      status: 'failed',
      stage: 'failed',
      currentStage: failure.currentStage,
      progress: { percent: 100, processedChunks: failedChunks.length, totalChunks: failedChunks.length },
      errorCode: failure.code,
      errorMessage: failure.message,
      error: {
        code: failure.code,
        message: failure.message,
        retryable: true,
        stage: failure.stage
      },
      stages: [
        ...input.job.stages,
        {
          stage: failure.currentStage,
          status: 'failed',
          startedAt: updatedAt,
          completedAt: updatedAt,
          message: failure.message
        }
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
    [key: string]: unknown;
    tenantId: string;
    knowledgeBaseId: string;
    documentId: string;
    title: string;
    filename: string;
    ordinal: number;
    tokenCount: number;
  };
}

function selectKnowledgeIngestionChunker(input: { contentType?: string; filename: string; mode?: string }): Chunker {
  const mode = normalizeKnowledgeIngestionChunkerMode(input.mode);
  if (mode === 'fixed') {
    return new FixedWindowChunker();
  }
  if (mode === 'structured' || isStructuredTextDocument(input)) {
    return new StructuredTextChunker();
  }
  return new FixedWindowChunker();
}

function normalizeKnowledgeIngestionChunkerMode(value: string | undefined): 'auto' | 'fixed' | 'structured' {
  if (value === 'fixed' || value === 'structured') {
    return value;
  }
  return 'auto';
}

function isStructuredTextDocument(input: { contentType?: string; filename: string }): boolean {
  const contentType = input.contentType?.toLowerCase() ?? '';
  if (contentType.includes('markdown') || contentType.startsWith('text/')) {
    return true;
  }

  return /\.(?:md|mdx|markdown|txt|text)$/i.test(input.filename);
}

function normalizeEmbeddingVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(readEmbeddingDimension);
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'embedding' in value &&
    Array.isArray((value as { embedding: unknown }).embedding)
  ) {
    return (value as { embedding: unknown[] }).embedding.map(readEmbeddingDimension);
  }
  return [];
}

function readEmbeddingDimension(value: unknown, index: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new KnowledgeIngestionQualityGateError(`Embedding contains a non-finite value at dimension ${index}.`, {
      code: 'knowledge_ingestion_embedding_invalid',
      currentStage: 'embed',
      stage: 'embedding'
    });
  }
  return value;
}

function validateEmbeddingBatch(
  embeddingResults: { embeddings?: unknown; dimensions?: unknown },
  expectedCount: number
): number[][] {
  const rawEmbeddings = Array.isArray(embeddingResults.embeddings) ? embeddingResults.embeddings : [];
  if (rawEmbeddings.length !== expectedCount) {
    throw new KnowledgeIngestionQualityGateError(
      `embedBatch returned ${rawEmbeddings.length} embeddings for ${expectedCount} chunks.`,
      {
        code: 'knowledge_ingestion_embedding_invalid',
        currentStage: 'embed',
        stage: 'embedding'
      }
    );
  }

  const vectors = rawEmbeddings.map(normalizeEmbeddingVector);
  const expectedDimensions = readExpectedEmbeddingDimensions(embeddingResults.dimensions, vectors);

  vectors.forEach((vector, index) => {
    if (vector.length === 0) {
      throw new KnowledgeIngestionQualityGateError(`Embedding ${index} is empty.`, {
        code: 'knowledge_ingestion_embedding_invalid',
        currentStage: 'embed',
        stage: 'embedding'
      });
    }
    if (vector.length !== expectedDimensions) {
      throw new KnowledgeIngestionQualityGateError(
        `Embedding ${index} has ${vector.length} dimensions, expected ${expectedDimensions}.`,
        {
          code: 'knowledge_ingestion_embedding_invalid',
          currentStage: 'embed',
          stage: 'embedding'
        }
      );
    }
  });

  return vectors;
}

function readExpectedEmbeddingDimensions(dimensions: unknown, vectors: number[][]): number {
  if (typeof dimensions === 'number' && Number.isInteger(dimensions) && dimensions > 0) {
    return dimensions;
  }
  return vectors[0]?.length ?? 0;
}

function validateVectorUpsertResult(upsertResult: unknown, expectedCount: number): void {
  const upsertedCount =
    typeof upsertResult === 'object' &&
    upsertResult !== null &&
    'upsertedCount' in upsertResult &&
    typeof (upsertResult as { upsertedCount: unknown }).upsertedCount === 'number' &&
    Number.isInteger((upsertResult as { upsertedCount: number }).upsertedCount)
      ? (upsertResult as { upsertedCount: number }).upsertedCount
      : undefined;

  if (upsertedCount === undefined) {
    throw new KnowledgeIngestionQualityGateError(`Vector upsert count is unknown for ${expectedCount} records.`, {
      code: 'knowledge_ingestion_vector_upsert_unconfirmed',
      currentStage: 'index_vector',
      stage: 'indexing'
    });
  }
  if (upsertedCount !== expectedCount) {
    throw new KnowledgeIngestionQualityGateError(
      `Vector upsert wrote ${upsertedCount} records, expected ${expectedCount}.`,
      {
        code: 'knowledge_ingestion_vector_upsert_unconfirmed',
        currentStage: 'index_vector',
        stage: 'indexing'
      }
    );
  }
}

function toIngestionFailure(error: unknown): {
  code: string;
  message: string;
  currentStage: 'embed' | 'index_vector';
  stage: 'embedding' | 'indexing';
} {
  if (error instanceof KnowledgeIngestionQualityGateError) {
    return {
      code: error.code,
      message: error.message,
      currentStage: error.currentStage,
      stage: error.stage
    };
  }
  return {
    code: 'knowledge_ingestion_index_failed',
    message: error instanceof Error ? error.message : 'Knowledge ingestion failed.',
    currentStage: 'index_vector',
    stage: 'indexing'
  };
}

class KnowledgeIngestionQualityGateError extends Error {
  readonly code: string;
  readonly currentStage: 'embed' | 'index_vector';
  readonly stage: 'embedding' | 'indexing';

  constructor(
    message: string,
    input: { code: string; currentStage: 'embed' | 'index_vector'; stage: 'embedding' | 'indexing' }
  ) {
    super(message);
    this.name = 'KnowledgeIngestionQualityGateError';
    this.code = input.code;
    this.currentStage = input.currentStage;
    this.stage = input.stage;
  }
}
