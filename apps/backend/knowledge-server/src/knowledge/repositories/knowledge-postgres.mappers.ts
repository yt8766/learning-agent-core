import type { KnowledgeBase, KnowledgeBaseMember, KnowledgeBaseMemberRole } from '@agent/core';

import type {
  DocumentChunkRecord,
  DocumentProcessingJobRecord,
  KnowledgeChatConversationRecord,
  KnowledgeChatMessageRecord,
  KnowledgeDocumentRecord
} from '../domain/knowledge-document.types';
import type { KnowledgeUploadContentType, KnowledgeUploadRecord } from '../domain/knowledge-upload.types';

export function mapBase(row: Record<string, unknown>): KnowledgeBase {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    createdByUserId: String(row.created_by_user_id),
    status: row.status as KnowledgeBase['status'],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function mapMember(row: Record<string, unknown>): KnowledgeBaseMember {
  return {
    knowledgeBaseId: String(row.knowledge_base_id),
    userId: String(row.user_id),
    role: row.role as KnowledgeBaseMemberRole,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function mapUpload(row: Record<string, unknown>): KnowledgeUploadRecord {
  return {
    uploadId: String(row.upload_id),
    knowledgeBaseId: String(row.knowledge_base_id),
    filename: String(row.filename),
    size: Number(row.size_bytes),
    contentType: row.content_type as KnowledgeUploadContentType,
    objectKey: String(row.object_key),
    ossUrl: String(row.oss_url),
    uploadedByUserId: String(row.uploaded_by_user_id),
    uploadedAt: toIsoString(row.uploaded_at)
  };
}

export function mapDocument(row: Record<string, unknown>): KnowledgeDocumentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    knowledgeBaseId: String(row.knowledge_base_id),
    uploadId: String(row.upload_id),
    objectKey: String(row.object_key),
    filename: String(row.filename),
    title: String(row.title),
    sourceType: 'user-upload',
    status: row.status as KnowledgeDocumentRecord['status'],
    version: String(row.version),
    chunkCount: Number(row.chunk_count),
    embeddedChunkCount: Number(row.embedded_chunk_count),
    createdBy: String(row.created_by),
    metadata: parseJsonObject(row.metadata),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function mapJob(row: Record<string, unknown>): DocumentProcessingJobRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    status: row.status as DocumentProcessingJobRecord['status'],
    stage: row.stage as DocumentProcessingJobRecord['stage'],
    currentStage: row.current_stage as DocumentProcessingJobRecord['currentStage'],
    stages: Array.isArray(row.stages) ? (row.stages as DocumentProcessingJobRecord['stages']) : [],
    progress: parseJobProgress(row.progress),
    error: parseJobError(row.error),
    errorCode: row.error_code ? String(row.error_code) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    attempts: Number(row.attempts ?? 1),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function mapChunk(row: Record<string, unknown>): DocumentChunkRecord {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    ordinal: Number(row.ordinal),
    content: String(row.content),
    tokenCount: Number(row.token_count),
    embeddingStatus: row.embedding_status as DocumentChunkRecord['embeddingStatus'],
    vectorIndexStatus: row.vector_index_status as DocumentChunkRecord['vectorIndexStatus'],
    keywordIndexStatus: row.keyword_index_status as DocumentChunkRecord['keywordIndexStatus'],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function mapChatConversation(row: Record<string, unknown>): KnowledgeChatConversationRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    activeModelProfileId: String(row.active_model_profile_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export function mapChatMessage(row: Record<string, unknown>): KnowledgeChatMessageRecord {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    userId: String(row.user_id),
    role: row.role as KnowledgeChatMessageRecord['role'],
    content: String(row.content),
    modelProfileId: row.model_profile_id ? String(row.model_profile_id) : undefined,
    traceId: row.trace_id ? String(row.trace_id) : undefined,
    citations: parseJson(row.citations, []) as KnowledgeChatMessageRecord['citations'],
    route: parseJson(row.route, undefined) as KnowledgeChatMessageRecord['route'],
    diagnostics: parseJson(row.diagnostics, undefined) as KnowledgeChatMessageRecord['diagnostics'],
    feedback: parseJson(row.feedback, undefined) as KnowledgeChatMessageRecord['feedback'],
    createdAt: toIsoString(row.created_at)
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseJson<T>(value: unknown, fallback: T): unknown | T {
  if (!value) {
    return fallback;
  }
  return typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
}

function parseJobProgress(value: unknown): DocumentProcessingJobRecord['progress'] {
  const parsed = parseJsonObject(value);
  const percent = Number(parsed.percent ?? 0);
  return {
    percent: Number.isFinite(percent) ? percent : 0,
    ...(parsed.processedChunks === undefined ? {} : { processedChunks: Number(parsed.processedChunks) }),
    ...(parsed.totalChunks === undefined ? {} : { totalChunks: Number(parsed.totalChunks) })
  };
}

function parseJobError(value: unknown): DocumentProcessingJobRecord['error'] {
  const parsed = parseJsonObject(value);
  if (!parsed.code || !parsed.message || !parsed.stage) {
    return undefined;
  }
  return {
    code: String(parsed.code),
    message: String(parsed.message),
    retryable: Boolean(parsed.retryable),
    stage: parsed.stage as DocumentProcessingJobRecord['stage']
  };
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
