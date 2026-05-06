import type { ID, ISODateTime } from './common';

export type DocumentSourceType =
  | 'user-upload'
  | 'web-url'
  | 'catalog-sync'
  | 'connector-sync'
  | 'workspace-docs'
  | 'repo-docs';

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

export interface KnowledgeDocument {
  id: ID;
  workspaceId: ID;
  knowledgeBaseId: ID;
  title: string;
  filename?: string;
  sourceType: DocumentSourceType;
  uri?: string;
  mimeType?: string;
  status: DocumentStatus;
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

export interface DocumentProcessingStageRecord {
  stage: DocumentProcessingStage;
  status: ProcessingJobStatus;
  latencyMs?: number;
  error?: ProcessingErrorSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
}

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

export interface UploadKnowledgeFileRequest {
  knowledgeBaseId: ID;
  file: File;
}

export interface CreateDocumentFromUploadRequest {
  uploadId: ID;
  objectKey: string;
  filename: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentFromUploadResponse {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
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

export type ChunkStatus = 'ready' | 'failed' | 'disabled' | 'deprecated';

export interface DocumentChunk {
  id: ID;
  documentId: ID;
  knowledgeBaseId: ID;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  status: ChunkStatus;
  embeddingModel?: string;
  embeddingStatus?: 'missing' | 'ready' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DocumentChunksResponse {
  items: DocumentChunk[];
  total: number;
}
