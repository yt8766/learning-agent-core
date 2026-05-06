export type KnowledgeDocumentStatus =
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

export type KnowledgeEvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export type KnowledgeEvalCaseStatus = 'succeeded' | 'failed' | 'canceled';

export type KnowledgeTraceStatus = 'running' | 'succeeded' | 'failed' | 'canceled';

export interface KnowledgeRecordBase {
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseRecord extends KnowledgeRecordBase {
  id: string;
  name: string;
  visibility: 'private' | 'workspace' | 'public';
  status: 'active' | 'disabled' | 'archived';
  tags: string[];
  createdBy: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocumentRecord extends KnowledgeRecordBase {
  id: string;
  knowledgeBaseId: string;
  title: string;
  status: KnowledgeDocumentStatus;
  sourceUri?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

export interface KnowledgeChunkRecord extends KnowledgeRecordBase {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  text: string;
  ordinal?: number;
  tokenCount?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeChatMessageRecord extends KnowledgeRecordBase {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  knowledgeBaseId?: string;
  citations?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEvalDatasetCaseRecord {
  id: string;
  question: string;
  expectedChunkIds: string[];
  referenceAnswer: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEvalDatasetRecord extends KnowledgeRecordBase {
  id: string;
  name: string;
  tags: string[];
  cases: KnowledgeEvalDatasetCaseRecord[];
  createdBy: string;
}

export interface KnowledgeEvalRetrievalMetrics {
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  ndcg: number;
}

export interface KnowledgeEvalGenerationMetrics {
  faithfulness: number;
  answerRelevance: number;
  citationAccuracy: number;
}

export interface KnowledgeEvalRunSummary {
  caseCount: number;
  completedCaseCount: number;
  failedCaseCount: number;
  totalScore: number;
  retrievalScore: number;
  generationScore: number;
}

export interface KnowledgeEvalRunRecord extends KnowledgeRecordBase {
  id: string;
  datasetId: string;
  status: KnowledgeEvalRunStatus;
  knowledgeBaseId?: string;
  createdBy?: string;
  summary?: KnowledgeEvalRunSummary;
  metrics?: Record<string, number>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEvalResultRecord extends KnowledgeRecordBase {
  id: string;
  runId: string;
  caseId: string;
  status: KnowledgeEvalCaseStatus;
  question: string;
  actualAnswer: string;
  retrievedChunkIds: string[];
  citations: Array<Record<string, unknown>>;
  retrievalMetrics: KnowledgeEvalRetrievalMetrics;
  generationMetrics: KnowledgeEvalGenerationMetrics;
  traceId?: string;
  errorMessage?: string;
}

export interface KnowledgeTraceRecord extends KnowledgeRecordBase {
  id: string;
  operation: string;
  status: KnowledgeTraceStatus;
  knowledgeBaseIds: string[];
  conversationId?: string;
  messageId?: string;
  latencyMs?: number;
  spans?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}
