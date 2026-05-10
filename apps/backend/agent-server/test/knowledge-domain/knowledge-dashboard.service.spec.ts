import { describe, expect, it } from 'vitest';

import { KnowledgeDashboardOverviewSchema } from '@agent/core';
import { KnowledgeDashboardService } from '../../src/domains/knowledge/services/knowledge-dashboard.service';

describe('KnowledgeDashboardService', () => {
  it('returns an overview that parses with KnowledgeDashboardOverviewSchema', async () => {
    const service = new KnowledgeDashboardService();
    const overview = await service.getOverview();

    expect(() => KnowledgeDashboardOverviewSchema.parse(overview)).not.toThrow();
  });

  it('returns zero/empty defaults for all fields', async () => {
    const service = new KnowledgeDashboardService();
    const overview = await service.getOverview();

    expect(overview.activeAlertCount).toBe(0);
    expect(overview.averageLatencyMs).toBe(0);
    expect(overview.documentCount).toBe(0);
    expect(overview.failedDocumentCount).toBe(0);
    expect(overview.knowledgeBaseCount).toBe(0);
    expect(overview.latestEvalScore).toBeNull();
    expect(overview.negativeFeedbackRate).toBe(0);
    expect(overview.noAnswerRate).toBe(0);
    expect(overview.p95LatencyMs).toBe(0);
    expect(overview.p99LatencyMs).toBe(0);
    expect(overview.readyDocumentCount).toBe(0);
    expect(overview.recentEvalRuns).toEqual([]);
    expect(overview.recentFailedJobs).toEqual([]);
    expect(overview.recentLowScoreTraces).toEqual([]);
    expect(overview.todayQuestionCount).toBe(0);
    expect(overview.topMissingKnowledgeQuestions).toEqual([]);
  });
});
