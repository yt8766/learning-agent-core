import type { KnowledgeDashboardOverview } from '@agent/core';
import type { DocumentProcessingJob } from './documents';
import type { EvalRun } from './evals';
import type { RagTrace } from './observability';

export type CoreDashboardOverview = KnowledgeDashboardOverview;

// UI view model for the current dashboard cards. API responses should parse
// through CoreDashboardOverview before being adapted to this shape.
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
