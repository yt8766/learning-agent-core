import type { DocumentProcessingJob } from './documents';
import type { EvalRun } from './evals';
import type { RagTrace } from './observability';

export interface DashboardOverview {
  knowledgeBaseCount: number;
  documentCount: number;
  readyDocumentCount: number;
  failedDocumentCount: number;
  todayQuestionCount: number;
  averageLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  errorRate?: number;
  noAnswerRate?: number;
  negativeFeedbackRate?: number;
  latestEvalScore?: number;
  activeAlertCount: number;
  recentFailedJobs: DocumentProcessingJob[];
  recentLowScoreTraces: RagTrace[];
  recentEvalRuns: EvalRun[];
  topMissingKnowledgeQuestions: string[];
}
