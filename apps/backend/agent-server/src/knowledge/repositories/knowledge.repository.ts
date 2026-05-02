import type {
  KnowledgeBaseRecord,
  KnowledgeChatMessageRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEvalDatasetRecord,
  KnowledgeEvalResultRecord,
  KnowledgeEvalRunRecord,
  KnowledgeTraceRecord
} from '../interfaces/knowledge-records.types';

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');

export interface KnowledgeRepositoryListResult<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface KnowledgeTenantQuery {
  tenantId: string;
}

export interface KnowledgeDocumentQuery extends KnowledgeTenantQuery {
  knowledgeBaseId: string;
}

export interface KnowledgeChunkQuery extends KnowledgeTenantQuery {
  documentId?: string;
  knowledgeBaseId?: string;
}

export interface KnowledgeChatMessageQuery extends KnowledgeTenantQuery {
  conversationId: string;
}

export interface KnowledgeEvalRunQuery extends KnowledgeTenantQuery {
  datasetId?: string;
}

export interface KnowledgeEvalDatasetDetailQuery extends KnowledgeTenantQuery {
  id: string;
}

export interface KnowledgeEvalRunDetailQuery extends KnowledgeTenantQuery {
  id: string;
}

export interface KnowledgeEvalResultQuery extends KnowledgeTenantQuery {
  runId: string;
}

export interface KnowledgeTraceQuery extends KnowledgeTenantQuery {
  knowledgeBaseId?: string;
  operation?: string;
  status?: KnowledgeTraceRecord['status'];
}

export interface KnowledgeTraceDetailQuery extends KnowledgeTenantQuery {
  id: string;
}

export interface KnowledgeRepository {
  createKnowledgeBase(record: KnowledgeBaseRecord): Promise<KnowledgeBaseRecord>;
  listKnowledgeBases(query: KnowledgeTenantQuery): Promise<KnowledgeRepositoryListResult<KnowledgeBaseRecord>>;

  createDocument(record: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord>;
  listDocuments(query: KnowledgeDocumentQuery): Promise<KnowledgeRepositoryListResult<KnowledgeDocumentRecord>>;

  createChunk(record: KnowledgeChunkRecord): Promise<KnowledgeChunkRecord>;
  listChunks(query: KnowledgeChunkQuery): Promise<KnowledgeRepositoryListResult<KnowledgeChunkRecord>>;

  createChatMessage(record: KnowledgeChatMessageRecord): Promise<KnowledgeChatMessageRecord>;
  listChatMessages(
    query: KnowledgeChatMessageQuery
  ): Promise<KnowledgeRepositoryListResult<KnowledgeChatMessageRecord>>;

  createEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord>;
  listEvalRuns(query: KnowledgeEvalRunQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalRunRecord>>;
  getEvalRun(query: KnowledgeEvalRunDetailQuery): Promise<KnowledgeEvalRunRecord | undefined>;
  updateEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord>;

  createEvalDataset(record: KnowledgeEvalDatasetRecord): Promise<KnowledgeEvalDatasetRecord>;
  listEvalDatasets(query: KnowledgeTenantQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalDatasetRecord>>;
  getEvalDataset(query: KnowledgeEvalDatasetDetailQuery): Promise<KnowledgeEvalDatasetRecord | undefined>;

  createEvalResult(record: KnowledgeEvalResultRecord): Promise<KnowledgeEvalResultRecord>;
  listEvalResults(query: KnowledgeEvalResultQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalResultRecord>>;

  createTrace(record: KnowledgeTraceRecord): Promise<KnowledgeTraceRecord>;
  listTraces(query: KnowledgeTraceQuery): Promise<KnowledgeRepositoryListResult<KnowledgeTraceRecord>>;
  getTrace(query: KnowledgeTraceDetailQuery): Promise<KnowledgeTraceRecord | undefined>;
}
