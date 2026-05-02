export type KnowledgeDocumentStatus = 'queued' | 'processing' | 'ready' | 'failed';
export type KnowledgeDocumentSourceType = 'user-upload';
export type KnowledgeJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type KnowledgeJobStage =
  | 'queued'
  | 'parse'
  | 'clean'
  | 'chunk'
  | 'embed'
  | 'index_vector'
  | 'index_keyword'
  | 'commit';
export type KnowledgeChunkStageStatus = 'pending' | 'succeeded' | 'failed';

export interface KnowledgeDocumentRecord {
  id: string;
  workspaceId: string;
  knowledgeBaseId: string;
  uploadId: string;
  objectKey: string;
  filename: string;
  title: string;
  sourceType: KnowledgeDocumentSourceType;
  status: KnowledgeDocumentStatus;
  version: string;
  chunkCount: number;
  embeddedChunkCount: number;
  createdBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentProcessingJobStageRecord {
  stage: KnowledgeJobStage;
  status: KnowledgeJobStatus;
  startedAt: string;
  completedAt?: string;
  errorCode?: string;
  message?: string;
}

export interface DocumentProcessingJobRecord {
  id: string;
  documentId: string;
  status: KnowledgeJobStatus;
  currentStage: KnowledgeJobStage;
  stages: DocumentProcessingJobStageRecord[];
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkRecord {
  id: string;
  documentId: string;
  ordinal: number;
  content: string;
  tokenCount: number;
  embeddingStatus: KnowledgeChunkStageStatus;
  vectorIndexStatus: KnowledgeChunkStageStatus;
  keywordIndexStatus: KnowledgeChunkStageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentFromUploadRequest {
  uploadId: string;
  objectKey: string;
  filename: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentFromUploadResponse {
  document: KnowledgeDocumentRecord;
  job: DocumentProcessingJobRecord;
}

export interface DocumentChunksResponse {
  items: DocumentChunkRecord[];
  total: number;
}
