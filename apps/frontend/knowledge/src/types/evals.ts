import type { ApiErrorResponse, ID, ISODateTime } from './common';
import type { Citation } from './chat';

export type EvalDifficulty = 'easy' | 'medium' | 'hard';
export type EvalRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface EvalDataset {
  id: ID;
  workspaceId: ID;
  name: string;
  description?: string;
  tags: string[];
  caseCount: number;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EvalCase {
  id: ID;
  datasetId: ID;
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds: ID[];
  expectedChunkIds: ID[];
  tags: string[];
  difficulty: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface CreateEvalDatasetRequest {
  name: string;
  description?: string;
  tags?: string[];
}

export interface CreateEvalCaseRequest {
  question: string;
  expectedAnswer?: string;
  expectedDocumentIds?: ID[];
  expectedChunkIds?: ID[];
  tags?: string[];
  difficulty?: EvalDifficulty;
  sourceTraceId?: ID;
  metadata?: Record<string, unknown>;
}

export interface EvalReportSummary {
  totalScore?: number;
  retrievalScore?: number;
  generationScore?: number;
  citationScore?: number;
  regressionDelta?: number;
}

export interface EvalRun {
  id: ID;
  workspaceId: ID;
  datasetId: ID;
  knowledgeBaseIds: ID[];
  status: EvalRunStatus;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  modelConfigId?: ID;
  caseCount: number;
  completedCaseCount: number;
  failedCaseCount: number;
  summary?: EvalReportSummary;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdBy: ID;
  createdAt: ISODateTime;
}

export interface EvalRunComparison {
  baselineRunId: ID;
  candidateRunId: ID;
  totalScoreDelta: number;
  retrievalScoreDelta: number;
  generationScoreDelta: number;
  perMetricDelta: Record<string, number>;
}

export interface CreateEvalRunRequest {
  datasetId: ID;
  knowledgeBaseIds: ID[];
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  modelConfigId?: ID;
}

export interface RetrievalMetrics {
  recallAtK?: number;
  precisionAtK?: number;
  mrr?: number;
  ndcg?: number;
}

export interface GenerationMetrics {
  faithfulness?: number;
  answerRelevance?: number;
  citationAccuracy?: number;
  hallucinationRisk?: number;
}

export interface JudgeResult {
  score: number;
  reason: string;
  labels?: string[];
}

export type EvalFailureCategory =
  | 'not_retrieved'
  | 'ranked_too_low'
  | 'context_truncated'
  | 'unsupported_citation'
  | 'hallucination'
  | 'irrelevant_answer'
  | 'prompt_failure'
  | 'provider_error';

export interface EvalCaseResult {
  id: ID;
  runId: ID;
  caseId: ID;
  status: 'succeeded' | 'failed';
  actualAnswer?: string;
  citations: Citation[];
  traceId?: ID;
  retrievalMetrics?: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  judgeResult?: JudgeResult;
  failureCategory?: EvalFailureCategory;
  error?: ApiErrorResponse;
}
