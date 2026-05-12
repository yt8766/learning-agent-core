import type { ApiErrorResponse, ForbiddenRawProjectionKeys, ID, ISODateTime } from './common';
import type { Citation, TokenUsage } from './chat';
import type {
  KnowledgeObservabilityMetrics,
  KnowledgeObservabilityStageLatency,
  KnowledgeRagTrace,
  KnowledgeRagTraceDetail,
  KnowledgeRagTraceSpan,
  KnowledgeRagTraceStatus,
  KnowledgeRetrievalSnapshot
} from '@agent/core';

export type CoreObservabilityMetrics = KnowledgeObservabilityMetrics;
export type CoreRagTrace = KnowledgeRagTrace;
export type CoreRagTraceDetail = KnowledgeRagTraceDetail;
export type CoreRagTraceSpan = KnowledgeRagTraceSpan;
export type CoreRetrievalSnapshot = KnowledgeRetrievalSnapshot;
export type CoreStageLatencyMetric = KnowledgeObservabilityStageLatency;
export type CoreTraceStatus = KnowledgeRagTraceStatus;

export type TraceStatus = KnowledgeRagTraceStatus | 'running' | 'canceled';

export type TraceSpanStage =
  | 'query_rewrite'
  | 'embedding'
  | 'keyword_search'
  | 'vector_search'
  | 'hybrid_merge'
  | 'rerank'
  | 'context_assembly'
  | 'generation'
  | 'citation_check'
  | 'eval_judge'
  | (string & {});

export interface RetrievalHitPreview {
  chunkId: ID;
  documentId: ID;
  title: string;
  contentPreview: string;
  score?: number;
  rank: number;
}

// UI view model for the richer trace hit preview not present in the API contract.
export interface RetrievalSnapshotViewModel {
  rewrittenQuery?: string;
  vectorHits: RetrievalHitPreview[];
  keywordHits: RetrievalHitPreview[];
  mergedHits: RetrievalHitPreview[];
  rerankedHits: RetrievalHitPreview[];
  selectedChunks: RetrievalHitPreview[];
}

export type TraceSpanPayloadScalar = string | number | boolean | null;

export type TraceSpanPayloadData = Record<string, TraceSpanPayloadScalar | string[] | number[]> &
  ForbiddenRawProjectionKeys;

export interface TraceSpanPayloadSummary {
  summary?: string;
  data?: TraceSpanPayloadData;
  itemIds?: ID[];
}

// UI view model for the current stage latency chart.
export interface StageLatencyMetric {
  stage: TraceSpanStage;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export type StageLatencyMetricCompat = StageLatencyMetric;

// UI view model for the current observability metrics cards. API responses
// should parse through CoreObservabilityMetrics before being adapted here.
export interface ObservabilityMetrics {
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
  stageLatency: StageLatencyMetricCompat[];
}

export type ObservabilityMetricsCompat = ObservabilityMetrics;

// UI view model for the current trace list.
export interface RagTrace {
  id: ID;
  workspaceId: ID;
  conversationId?: ID;
  messageId?: ID;
  knowledgeBaseIds: ID[];
  question: string;
  answer?: string;
  status: TraceStatus;
  latencyMs?: number;
  hitCount?: number;
  citationCount?: number;
  feedbackRating?: 'positive' | 'negative';
  createdBy?: ID;
  createdAt: ISODateTime;
}

export type RagTraceCompat = RagTrace;

// UI view model for the current trace span detail.
export interface RagTraceSpan {
  id: ID;
  traceId: ID;
  stage: TraceSpanStage;
  name: string;
  status: TraceStatus;
  latencyMs?: number;
  input?: TraceSpanPayloadSummary;
  output?: TraceSpanPayloadSummary;
  error?: ApiErrorResponse;
  startedAt?: ISODateTime;
  endedAt?: ISODateTime;
}

export type RagTraceSpanCompat = RagTraceSpan;

// UI view model for the current trace detail.
export interface RagTraceDetail extends RagTrace {
  spans: RagTraceSpan[];
  citations: Citation[];
  retrievalSnapshot?: RetrievalSnapshotViewModel;
  usage?: TokenUsage;
}

export type RagTraceDetailCompat = RagTraceDetail;
