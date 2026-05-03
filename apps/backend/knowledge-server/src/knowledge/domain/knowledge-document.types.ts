import type { KnowledgeRagAnswer } from '@agent/knowledge';
import type { z } from 'zod';

import type {
  DocumentProcessingJobErrorSchema,
  DocumentProcessingJobProgressSchema,
  DocumentProcessingStageSchema,
  DocumentProcessingStatusSchema,
  CreateKnowledgeChatMessageRecordInputSchema,
  KnowledgeChatConversationRecordSchema,
  KnowledgeChatMessageRecordSchema,
  RagModelProfileSchema,
  RagModelProfileSummarySchema
} from './knowledge-document.schemas';

export type KnowledgeDocumentStatus = 'queued' | 'processing' | 'ready' | 'failed';
export type KnowledgeDocumentSourceType = 'user-upload';
export type DocumentProcessingStage = z.infer<typeof DocumentProcessingStageSchema>;
export type DocumentProcessingStatus = z.infer<typeof DocumentProcessingStatusSchema>;
export type DocumentProcessingJobProgress = z.infer<typeof DocumentProcessingJobProgressSchema>;
export type DocumentProcessingJobError = z.infer<typeof DocumentProcessingJobErrorSchema>;
export type RagModelProfile = z.infer<typeof RagModelProfileSchema>;
export type RagModelProfileSummary = z.infer<typeof RagModelProfileSummarySchema>;
export type KnowledgeChatConversationRecord = z.infer<typeof KnowledgeChatConversationRecordSchema>;
export type KnowledgeChatMessageRecord = z.infer<typeof KnowledgeChatMessageRecordSchema>;
export type CreateKnowledgeChatMessageRecordInput = z.infer<typeof CreateKnowledgeChatMessageRecordInputSchema>;
export type KnowledgeJobStatus = DocumentProcessingStatus;
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
  stage: DocumentProcessingStage;
  currentStage: KnowledgeJobStage;
  stages: DocumentProcessingJobStageRecord[];
  progress: DocumentProcessingJobProgress;
  error?: DocumentProcessingJobError;
  errorCode?: string;
  errorMessage?: string;
  attempts: number;
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

export type OpenAIChatMessageRole = 'developer' | 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIChatTextContentPart {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

export interface OpenAIChatMessage {
  role: OpenAIChatMessageRole;
  content: string | OpenAIChatTextContentPart[];
  [key: string]: unknown;
}

export interface KnowledgeChatMetadata {
  conversationId?: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[] | string;
  mentions?: KnowledgeChatMention[];
  debug?: boolean | string;
  [key: string]: unknown;
}

export interface KnowledgeChatMention {
  type: 'knowledge_base';
  id?: string;
  label?: string;
  [key: string]: unknown;
}

export interface KnowledgeChatRequest {
  model?: string;
  messages?: OpenAIChatMessage[];
  metadata?: KnowledgeChatMetadata;
  stream?: boolean;
  conversationId?: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  message?: string;
  retrievalConfigId?: string;
  promptTemplateId?: string;
  debug?: boolean;
}

export interface KnowledgeChatCitation {
  id: string;
  documentId: string;
  chunkId: string;
  title: string;
  quote: string;
  score: number;
}

export interface KnowledgeChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: KnowledgeChatCitation[];
  traceId?: string;
  feedback?: {
    rating: 'positive' | 'negative';
    category?:
      | 'helpful'
      | 'not_helpful'
      | 'wrong_citation'
      | 'hallucination'
      | 'missing_knowledge'
      | 'too_slow'
      | 'unsafe'
      | 'other';
    comment?: string;
  };
  createdAt: string;
}

export interface KnowledgeChatResponse {
  conversationId: string;
  userMessage: KnowledgeChatMessage;
  assistantMessage: KnowledgeChatMessage;
  answer: string;
  citations: KnowledgeChatCitation[];
  route?: KnowledgeRagAnswer['route'];
  diagnostics?: KnowledgeRagAnswer['diagnostics'];
  usage?: KnowledgeRagAnswer['usage'];
  traceId: string;
}

export interface KnowledgeEmbeddingModelOption {
  id: string;
  label: string;
  provider: string;
  status: 'available' | 'unconfigured';
}

export interface KnowledgeEmbeddingModelsResponse {
  items: KnowledgeEmbeddingModelOption[];
}
