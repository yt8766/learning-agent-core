import type { KnowledgeTraceStatus } from './knowledge-records.types';

export interface KnowledgeObservabilityQuery {
  tenantId: string;
  knowledgeBaseId?: string;
}

export interface KnowledgeTraceDetailQuery extends KnowledgeObservabilityQuery {
  id: string;
}

export interface KnowledgeStageLatencyMetric {
  stage: string;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export interface KnowledgeObservabilityMetricsDto {
  traceCount: number;
  questionCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  timeoutRate: number;
  noAnswerRate: number;
  negativeFeedbackRate: number;
  citationClickRate: number;
  stageLatency: KnowledgeStageLatencyMetric[];
}

export interface KnowledgeTraceListItemDto {
  id: string;
  workspaceId: string;
  conversationId?: string;
  messageId?: string;
  knowledgeBaseIds: string[];
  question: string;
  answer?: string;
  status: KnowledgeTraceStatus;
  latencyMs?: number;
  hitCount: number;
  citationCount: number;
  createdBy?: string;
  createdAt: string;
}

export interface KnowledgeTraceSpanDto {
  id: string;
  traceId: string;
  stage: string;
  name: string;
  status: KnowledgeTraceStatus;
  latencyMs?: number;
  startedAt?: string;
  endedAt?: string;
}

export interface KnowledgeTraceCitationDto {
  id: string;
  documentId: string;
  chunkId: string;
  title: string;
  quote: string;
  text?: string;
  contentPreview?: string;
  score?: number;
  rank?: number;
  metadata?: {
    title?: string;
    sourceUri?: string;
    tags?: string[];
  };
}

export interface KnowledgeRetrievalHitPreviewDto {
  chunkId: string;
  documentId: string;
  title: string;
  contentPreview: string;
  score?: number;
  rank: number;
}

export interface KnowledgeRetrievalSnapshotDto {
  vectorHits: KnowledgeRetrievalHitPreviewDto[];
  keywordHits: KnowledgeRetrievalHitPreviewDto[];
  mergedHits: KnowledgeRetrievalHitPreviewDto[];
  rerankedHits: KnowledgeRetrievalHitPreviewDto[];
  selectedChunks: KnowledgeRetrievalHitPreviewDto[];
}

export interface KnowledgeTraceDetailDto extends KnowledgeTraceListItemDto {
  spans: KnowledgeTraceSpanDto[];
  citations: KnowledgeTraceCitationDto[];
  retrievalSnapshot?: KnowledgeRetrievalSnapshotDto;
}

export interface KnowledgePageDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
