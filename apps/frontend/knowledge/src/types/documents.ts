import type { ID, ISODateTime } from './common';
import type {
  KnowledgeCreateDocumentFromUploadRequest as AgentCoreCreateDocumentFromUploadRequest,
  KnowledgeCreateDocumentFromUploadResponse as AgentCoreCreateDocumentFromUploadResponse,
  KnowledgeDocument as AgentCoreKnowledgeDocument,
  KnowledgeDocumentChunk as AgentCoreDocumentChunk,
  KnowledgeDocumentProcessingJob as AgentCoreDocumentProcessingJob,
  KnowledgeDocumentStatus as AgentCoreDocumentStatus,
  KnowledgeEmbeddingModelOption as CoreEmbeddingModelOption,
  KnowledgeUploadResult as AgentCoreKnowledgeUploadResult
} from '@agent/core';

export type CoreKnowledgeDocument = AgentCoreKnowledgeDocument;
export type CoreDocumentStatus = AgentCoreDocumentStatus;

export type DocumentSourceType =
  | 'user-upload'
  | 'web-url'
  | 'catalog-sync'
  | 'connector-sync'
  | 'workspace-docs'
  | 'repo-docs';

// UI view model for the current document lifecycle labels.
export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'parsing'
  | 'cleaning'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'disabled'
  | 'deprecated';

export type DocumentStatusCompat = DocumentStatus;

export type DocumentProcessingStage =
  | 'uploaded'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'queued'
  | 'upload_received'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'commit';

export type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'retrying';

export interface ProcessingErrorSummary {
  code: string;
  message: string;
  retryable?: boolean;
  stage?: DocumentProcessingStage;
}

// UI view model for the current document table. API responses should parse
// through CoreKnowledgeDocument before being adapted to this shape.
export interface KnowledgeDocument {
  id: ID;
  workspaceId: ID;
  knowledgeBaseId: ID;
  title: string;
  filename?: string;
  sourceType: DocumentSourceType;
  uri?: string;
  mimeType?: string;
  status: DocumentStatusCompat;
  version: string;
  chunkCount: number;
  embeddedChunkCount: number;
  tokenCount?: number;
  latestJobId?: ID;
  latestError?: ProcessingErrorSummary;
  metadata?: Record<string, unknown>;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type KnowledgeDocumentCompat = KnowledgeDocument;

// UI view model for the current processing stage timeline.
export interface DocumentProcessingStageRecord {
  stage: DocumentProcessingStage;
  status: ProcessingJobStatus;
  latencyMs?: number;
  error?: ProcessingErrorSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
}

export type DocumentProcessingStageRecordCompat = DocumentProcessingStageRecord;

// UI view model for the current processing job detail.
export interface DocumentProcessingJob {
  id: ID;
  documentId: ID;
  status: ProcessingJobStatus;
  stage?: DocumentProcessingStage;
  currentStage?: DocumentProcessingStage;
  stages: DocumentProcessingStageRecord[];
  progress?: {
    percent: number;
    processedChunks?: number;
    totalChunks?: number;
  };
  error?: ProcessingErrorSummary;
  attempts?: number;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export type DocumentProcessingJobCompat = DocumentProcessingJob;

// UI view model for the current upload result shape.
export interface KnowledgeUploadResult {
  uploadId: ID;
  knowledgeBaseId: ID;
  filename: string;
  size: number;
  contentType: 'text/markdown' | 'text/plain';
  objectKey: string;
  ossUrl: string;
  uploadedAt: ISODateTime;
}

export type KnowledgeUploadResultCompat = KnowledgeUploadResult;

export interface CreateDocumentFromUploadRequest {
  filename: string;
  objectKey: string;
  uploadId: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentFromUploadResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface UploadKnowledgeFileRequest {
  knowledgeBaseId: ID;
  file: File;
}

export interface UploadDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface UploadDocumentRequest {
  file: File;
  knowledgeBaseId: ID;
  embeddingModelId?: ID;
  metadata?: Record<string, unknown>;
}

export interface ReprocessDocumentResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
}

export interface DeleteDocumentResponse {
  ok: true;
}

// UI view model for the current chunk state labels.
export type ChunkStatus = 'ready' | 'failed' | 'disabled' | 'deprecated';
export type ChunkStatusCompat = ChunkStatus;

// UI view model for the current chunk table.
export interface DocumentChunk {
  id: ID;
  documentId: ID;
  knowledgeBaseId: ID;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  status: ChunkStatusCompat;
  embeddingModel?: string;
  embeddingStatus?: 'missing' | 'ready' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DocumentChunkCompat = DocumentChunk;

// API contract aliases retained for callers that need the parsed core shape.
export type CoreDocumentProcessingJob = AgentCoreDocumentProcessingJob;
export type CoreKnowledgeUploadResult = AgentCoreKnowledgeUploadResult;
export type CoreCreateDocumentFromUploadRequest = AgentCoreCreateDocumentFromUploadRequest;
export type CoreCreateDocumentFromUploadResponse = AgentCoreCreateDocumentFromUploadResponse;
export type CoreDocumentChunk = AgentCoreDocumentChunk;
export type EmbeddingModelOption = CoreEmbeddingModelOption;

export interface DocumentChunksResponse {
  items: DocumentChunk[];
  total: number;
}
