import { describe, expect, it } from 'vitest';

import { KnowledgeFrontendMvpController } from '../../src/knowledge/knowledge-frontend-mvp.controller';

describe('KnowledgeFrontendMvpController', () => {
  const controller = new KnowledgeFrontendMvpController();

  it('serves frontend dashboard, documents, observability and eval list endpoints', () => {
    expect(controller.getDashboardOverview()).toMatchObject({
      activeAlertCount: expect.any(Number),
      recentEvalRuns: expect.any(Array),
      recentFailedJobs: expect.any(Array),
      recentLowScoreTraces: expect.any(Array),
      topMissingKnowledgeQuestions: expect.any(Array)
    });
    expect(controller.listDocuments()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.getObservabilityMetrics()).toMatchObject({
      stageLatency: expect.any(Array),
      traceCount: expect.any(Number)
    });
    expect(controller.listTraces()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.listEvalDatasets()).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.listEvalRuns()).toMatchObject({ items: expect.any(Array), page: 1 });
  });

  it('serves eval run details and comparisons for frontend workflows', () => {
    expect(controller.listEvalRunResults('run_1')).toMatchObject({ items: expect.any(Array), page: 1 });
    expect(controller.compareEvalRuns({ baselineRunId: 'run_1', candidateRunId: 'run_2' })).toEqual({
      baselineRunId: 'run_1',
      candidateRunId: 'run_2',
      generationScoreDelta: 0,
      perMetricDelta: {},
      retrievalScoreDelta: 0,
      totalScoreDelta: 0
    });
  });
});
