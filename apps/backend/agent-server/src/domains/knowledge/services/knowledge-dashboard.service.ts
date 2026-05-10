import type { KnowledgeDashboardOverview } from '@agent/core';

export class KnowledgeDashboardService {
  async getOverview(): Promise<KnowledgeDashboardOverview> {
    return {
      activeAlertCount: 0,
      averageLatencyMs: 0,
      documentCount: 0,
      failedDocumentCount: 0,
      knowledgeBaseCount: 0,
      latestEvalScore: null,
      negativeFeedbackRate: 0,
      noAnswerRate: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      readyDocumentCount: 0,
      recentEvalRuns: [],
      recentFailedJobs: [],
      recentLowScoreTraces: [],
      todayQuestionCount: 0,
      topMissingKnowledgeQuestions: []
    };
  }
}
