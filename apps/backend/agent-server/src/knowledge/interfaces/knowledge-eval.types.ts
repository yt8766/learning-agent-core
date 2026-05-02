import type {
  KnowledgeEvalDatasetCaseRecord,
  KnowledgeEvalGenerationMetrics,
  KnowledgeEvalRetrievalMetrics
} from './knowledge-records.types';

export const KNOWLEDGE_EVAL_DEFAULT_TENANT_ID = 'ws_1';
export const KNOWLEDGE_EVAL_DEFAULT_CREATED_BY = 'user_demo';

export interface CreateKnowledgeEvalDatasetInput {
  tenantId?: string;
  name: string;
  tags?: string[];
  cases: KnowledgeEvalDatasetCaseInput[];
  createdBy?: string;
}

export interface KnowledgeEvalDatasetCaseInput {
  id?: string;
  question: string;
  expectedChunkIds?: string[];
  referenceAnswer?: string;
  metadata?: Record<string, unknown>;
}

export interface RunKnowledgeEvalDatasetInput {
  tenantId?: string;
  createdBy?: string;
  datasetId: string;
  knowledgeBaseId?: string;
}

export interface KnowledgeEvalRunnerAnswerInput {
  tenantId: string;
  knowledgeBaseId?: string;
  question: string;
}

export interface KnowledgeEvalRunnerAnswer {
  actualAnswer: string;
  retrievedChunkIds: string[];
  citations: Array<Record<string, unknown>>;
  traceId?: string;
}

export interface KnowledgeEvalRunner {
  answerCase(input: KnowledgeEvalRunnerAnswerInput): Promise<KnowledgeEvalRunnerAnswer>;
}

export interface KnowledgeEvalJudgeInput {
  case: KnowledgeEvalDatasetCaseRecord;
  actualAnswer: string;
  citations: Array<Record<string, unknown>>;
  retrievedChunkIds: string[];
}

export interface KnowledgeEvalJudge {
  judge(input: KnowledgeEvalJudgeInput): Promise<KnowledgeEvalGenerationMetrics>;
}

export interface KnowledgeEvalComparison {
  baselineRunId: string;
  candidateRunId: string;
  totalScoreDelta: number;
  retrievalScoreDelta: number;
  generationScoreDelta: number;
  perMetricDelta: Record<string, number>;
}

export interface KnowledgeEvalMetricBundle {
  retrievalMetrics: KnowledgeEvalRetrievalMetrics;
  generationMetrics: KnowledgeEvalGenerationMetrics;
}
