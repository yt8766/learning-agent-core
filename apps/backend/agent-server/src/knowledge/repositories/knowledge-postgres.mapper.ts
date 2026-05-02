import type {
  KnowledgeBaseRecord,
  KnowledgeChatMessageRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEvalDatasetCaseRecord,
  KnowledgeEvalDatasetRecord,
  KnowledgeEvalGenerationMetrics,
  KnowledgeEvalResultRecord,
  KnowledgeEvalRetrievalMetrics,
  KnowledgeEvalRunRecord,
  KnowledgeEvalRunSummary,
  KnowledgeTraceRecord
} from '../interfaces/knowledge-records.types';

type JsonObject = Record<string, unknown>;

export interface KnowledgeBaseRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  visibility: KnowledgeBaseRecord['visibility'];
  status: KnowledgeBaseRecord['status'];
  tags: string[] | null;
  metadata?: JsonObject | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentRow {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  title: string;
  status: KnowledgeDocumentRecord['status'];
  source_uri: string | null;
  mime_type: string | null;
  metadata: JsonObject | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkRow {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  document_id: string;
  text: string;
  ordinal: number | null;
  token_count: number | null;
  embedding: number[] | string | null;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChatMessageRow {
  id: string;
  tenant_id: string;
  conversation_id: string;
  role: KnowledgeChatMessageRecord['role'];
  content: string;
  knowledge_base_id: string | null;
  citations: Array<JsonObject> | null;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEvalDatasetRow {
  id: string;
  tenant_id: string;
  name: string;
  tags: string[] | null;
  cases: KnowledgeEvalDatasetCaseRecord[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEvalRunRow {
  id: string;
  tenant_id: string;
  dataset_id: string;
  knowledge_base_id: string | null;
  status: KnowledgeEvalRunRecord['status'];
  metrics: Record<string, number> | null;
  summary: KnowledgeEvalRunSummary | null;
  created_by: string | null;
  error_message: string | null;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEvalResultRow {
  id: string;
  tenant_id: string;
  run_id: string;
  case_id: string;
  status: KnowledgeEvalResultRecord['status'];
  question: string;
  actual_answer: string;
  retrieved_chunk_ids: string[] | null;
  citations: Array<JsonObject> | null;
  retrieval_metrics: KnowledgeEvalRetrievalMetrics;
  generation_metrics: KnowledgeEvalGenerationMetrics;
  trace_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeTraceRow {
  id: string;
  tenant_id: string;
  operation: string;
  status: KnowledgeTraceRecord['status'];
  knowledge_base_ids: string[] | null;
  conversation_id: string | null;
  message_id: string | null;
  latency_ms: number | null;
  spans: Array<JsonObject> | null;
  metadata: JsonObject | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function mapKnowledgeBaseRow(row: KnowledgeBaseRow): KnowledgeBaseRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    visibility: row.visibility,
    status: row.status,
    tags: row.tags ?? [],
    createdBy: row.created_by,
    ...(row.description ? { description: row.description } : {}),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapDocumentRow(row: KnowledgeDocumentRow): KnowledgeDocumentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    knowledgeBaseId: row.knowledge_base_id,
    title: row.title,
    status: row.status,
    ...(row.source_uri ? { sourceUri: row.source_uri } : {}),
    ...(row.mime_type ? { mimeType: row.mime_type } : {}),
    metadata: row.metadata ?? {},
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapChunkRow(row: KnowledgeChunkRow): KnowledgeChunkRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    knowledgeBaseId: row.knowledge_base_id,
    documentId: row.document_id,
    text: row.text,
    ...(row.ordinal === null ? {} : { ordinal: row.ordinal }),
    ...(row.token_count === null ? {} : { tokenCount: row.token_count }),
    ...(row.embedding ? { embedding: mapEmbedding(row.embedding) } : {}),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapChatMessageRow(row: KnowledgeChatMessageRow): KnowledgeChatMessageRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    ...(row.knowledge_base_id ? { knowledgeBaseId: row.knowledge_base_id } : {}),
    citations: row.citations ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapEvalDatasetRow(row: KnowledgeEvalDatasetRow): KnowledgeEvalDatasetRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    tags: row.tags ?? [],
    cases: row.cases ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapEvalRunRow(row: KnowledgeEvalRunRow): KnowledgeEvalRunRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    datasetId: row.dataset_id,
    status: row.status,
    ...(row.knowledge_base_id ? { knowledgeBaseId: row.knowledge_base_id } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    summary: (row.summary ?? {}) as KnowledgeEvalRunSummary,
    metrics: row.metrics ?? {},
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapEvalResultRow(row: KnowledgeEvalResultRow): KnowledgeEvalResultRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    runId: row.run_id,
    caseId: row.case_id,
    status: row.status,
    question: row.question,
    actualAnswer: row.actual_answer,
    retrievedChunkIds: row.retrieved_chunk_ids ?? [],
    citations: row.citations ?? [],
    retrievalMetrics: row.retrieval_metrics,
    generationMetrics: row.generation_metrics,
    ...(row.trace_id ? { traceId: row.trace_id } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTraceRow(row: KnowledgeTraceRow): KnowledgeTraceRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    operation: row.operation,
    status: row.status,
    knowledgeBaseIds: row.knowledge_base_ids ?? [],
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    ...(row.message_id ? { messageId: row.message_id } : {}),
    ...(row.latency_ms === null ? {} : { latencyMs: row.latency_ms }),
    spans: row.spans ?? [],
    metadata: row.metadata ?? {},
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEmbedding(value: number[] | string): number[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(part => Number(part.trim()))
    .filter(value => Number.isFinite(value));
}

function hasObjectValues<T extends object>(value: T | null | undefined): value is T {
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}
