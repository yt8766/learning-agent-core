import { describe, expect, it, vi } from 'vitest';

import { KnowledgeProjectionsController } from '../../src/api/knowledge/knowledge-projections.controller';

describe('KnowledgeProjectionsController', () => {
  const validDataset = {
    id: 'ds-1',
    name: 'Test Dataset',
    description: 'A test dataset',
    caseCount: 0,
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z'
  };

  const validCase = {
    id: 'case-1',
    datasetId: 'ds-1',
    question: 'What is AI?',
    expectedAnswer: 'Artificial intelligence.',
    expectedChunkIds: ['chunk-1'],
    metadata: {},
    createdAt: '2026-05-10T00:00:00.000Z'
  };

  const validRun = {
    id: 'run-1',
    datasetId: 'ds-1',
    knowledgeBaseIds: ['kb-1'],
    status: 'completed' as const,
    caseCount: 1,
    completedCaseCount: 1,
    failedCaseCount: 0,
    createdBy: 'user-1',
    workspaceId: 'ws-1',
    createdAt: '2026-05-10T00:00:00.000Z'
  };

  const validCaseResult = {
    id: 'result-1',
    runId: 'run-1',
    caseId: 'case-1',
    question: 'What is AI?',
    actualAnswer: 'AI is artificial intelligence.',
    status: 'passed' as const,
    score: 0.9,
    latencyMs: 100,
    retrievedChunkIds: ['chunk-1'],
    createdAt: '2026-05-10T00:00:00.000Z'
  };

  const createController = () => {
    const evalService = {
      compareRuns: vi.fn().mockReturnValue({
        baselineRunId: 'run-1',
        candidateRunId: 'run-2',
        totalScoreDelta: 0.1,
        retrievalScoreDelta: 0.05,
        generationScoreDelta: 0.05,
        perMetricDelta: {}
      })
    };
    const validFlow = {
      id: 'flow-1',
      name: 'Test Flow',
      description: '',
      version: 1,
      status: 'draft' as const,
      nodes: [],
      edges: [],
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z'
    };
    const agentFlowService = {
      listFlows: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
      saveFlow: vi.fn().mockResolvedValue({ flow: validFlow }),
      updateFlow: vi.fn().mockResolvedValue({ flow: { ...validFlow, name: 'Updated Flow' } }),
      runFlow: vi.fn().mockResolvedValue({
        runId: 'run-flow-1',
        flowId: 'flow-1',
        status: 'completed',
        output: { answer: 'Done', knowledgeBaseIds: [] },
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z'
      })
    };
    const dashboard = {
      getOverview: vi.fn().mockResolvedValue({
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
      })
    };
    const observability = {
      getMetrics: vi.fn().mockResolvedValue({
        averageLatencyMs: 0,
        citationClickRate: 0,
        errorRate: 0,
        negativeFeedbackRate: 0,
        noAnswerRate: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        questionCount: 0,
        stageLatency: [],
        timeoutRate: 0,
        traceCount: 0
      }),
      listTraces: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
      getTrace: vi.fn().mockResolvedValue({
        id: 'trace-1',
        question: 'What is AI?',
        answer: 'AI is artificial intelligence.',
        status: 'succeeded',
        knowledgeBaseIds: [],
        workspaceId: 'default',
        createdAt: '2026-05-10T00:00:00.000Z',
        spans: [],
        citations: []
      })
    };

    const controller = new KnowledgeProjectionsController(
      evalService as never,
      agentFlowService as never,
      dashboard as never,
      observability as never
    );
    return { controller, evalService, agentFlowService, dashboard, observability };
  };

  describe('getDashboardOverview', () => {
    it('returns parsed dashboard overview', async () => {
      const { controller } = createController();

      const result = await controller.getDashboardOverview();

      expect(result).toBeDefined();
      expect(result.documentCount).toBe(0);
    });
  });

  describe('getObservabilityMetrics', () => {
    it('returns parsed observability metrics', async () => {
      const { controller } = createController();

      const result = await controller.getObservabilityMetrics();

      expect(result).toBeDefined();
      expect(result.questionCount).toBe(0);
    });
  });

  describe('listObservabilityTraces', () => {
    it('returns parsed trace page', async () => {
      const { controller } = createController();

      const result = await controller.listObservabilityTraces();

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });
  });

  describe('getObservabilityTrace', () => {
    it('returns parsed trace detail', async () => {
      const { controller } = createController();

      const result = await controller.getObservabilityTrace('trace-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('trace-1');
    });
  });

  describe('listEvalDatasets', () => {
    it('returns default empty page when service has no listDatasets', async () => {
      const { controller } = createController();

      const result = await controller.listEvalDatasets();

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });

    it('delegates to service.listDatasets when available', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).listDatasets = vi.fn().mockResolvedValue({
        items: [validDataset],
        page: 1,
        pageSize: 20,
        total: 1
      });

      const result = await controller.listEvalDatasets();

      expect(result.items).toHaveLength(1);
    });

    it('rejects invalid service listDatasets response shape', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).listDatasets = vi.fn().mockResolvedValue({
        items: [{ id: 'ds-1' }],
        page: 1,
        pageSize: 20,
        total: 1
      });

      await expect(controller.listEvalDatasets()).rejects.toThrow();
    });
  });

  describe('createEvalDataset', () => {
    it('delegates to service.createDataset when available', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).createDataset = vi.fn().mockResolvedValue(validDataset);

      const result = await controller.createEvalDataset({ name: 'Test Dataset' });

      expect(result.id).toBe('ds-1');
    });

    it('rejects invalid service createDataset response shape', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).createDataset = vi.fn().mockResolvedValue({
        id: 'ds-1',
        name: 'Test Dataset'
      });

      await expect(controller.createEvalDataset({ name: 'Test Dataset' })).rejects.toThrow();
    });

    it('parses body as dataset schema when createDataset not available', async () => {
      const { controller } = createController();

      const result = await controller.createEvalDataset(validDataset);

      expect(result).toBeDefined();
      expect(result.id).toBe('ds-1');
    });
  });

  describe('listEvalCases', () => {
    it('returns default empty page when service has no listCases', async () => {
      const { controller } = createController();

      const result = await controller.listEvalCases('ds-1');

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });

    it('delegates to service.listCases when available', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).listCases = vi.fn().mockResolvedValue({
        items: [validCase],
        page: 1,
        pageSize: 20,
        total: 1
      });

      const result = await controller.listEvalCases('ds-1');

      expect(result.items).toHaveLength(1);
    });
  });

  describe('createEvalCase', () => {
    it('delegates to service.createCase when available', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).createCase = vi.fn().mockResolvedValue(validCase);

      const result = await controller.createEvalCase('ds-1', { question: 'What is AI?' });

      expect(result.id).toBe('case-1');
    });
  });

  describe('listEvalRuns', () => {
    it('returns default empty page when service has no listRuns', async () => {
      const { controller } = createController();

      const result = await controller.listEvalRuns();

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });
  });

  describe('createEvalRun', () => {
    it('delegates to service.createRun when available', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).createRun = vi.fn().mockResolvedValue(validRun);

      const result = await controller.createEvalRun({ datasetId: 'ds-1' });

      expect(result.id).toBe('run-1');
    });
  });

  describe('listEvalRunResults', () => {
    it('returns default empty page when service has no listRunResults', async () => {
      const { controller } = createController();

      const result = await controller.listEvalRunResults('run-1');

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });

    it('parses run results as case result page when service is available', async () => {
      const { controller, evalService } = createController();
      (evalService as unknown as Record<string, unknown>).listRunResults = vi.fn().mockResolvedValue({
        items: [validCaseResult],
        page: 1,
        pageSize: 20,
        total: 1
      });

      const result = await controller.listEvalRunResults('run-1');

      expect(result.items[0]).toMatchObject({ id: 'result-1', caseId: 'case-1' });
    });
  });

  describe('compareEvalRuns', () => {
    it('returns comparison result with metrics', async () => {
      const { controller, evalService } = createController();

      const result = await controller.compareEvalRuns({ baselineRunId: 'run-1', candidateRunId: 'run-2' });

      expect(result).toBeDefined();
      expect(evalService.compareRuns).toHaveBeenCalledWith({ baselineRunId: 'run-1', candidateRunId: 'run-2' });
    });
  });

  describe('listAgentFlows', () => {
    it('returns parsed agent flow list', async () => {
      const { controller } = createController();

      const result = await controller.listAgentFlows();

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
    });
  });

  describe('saveAgentFlow', () => {
    it('delegates to agentFlowService.saveFlow', async () => {
      const { controller, agentFlowService } = createController();

      const flowInput = {
        flow: {
          id: 'flow-1',
          name: 'Test Flow',
          description: '',
          version: 1,
          status: 'draft',
          nodes: [],
          edges: [],
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z'
        }
      };
      await controller.saveAgentFlow(flowInput);

      expect(agentFlowService.saveFlow).toHaveBeenCalledWith(flowInput);
    });
  });

  describe('updateAgentFlow', () => {
    it('delegates to agentFlowService.updateFlow', async () => {
      const { controller, agentFlowService } = createController();

      const flowInput = {
        flow: {
          id: 'flow-1',
          name: 'Updated Flow',
          description: '',
          version: 1,
          status: 'draft',
          nodes: [],
          edges: [],
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z'
        }
      };
      await controller.updateAgentFlow('flow-1', flowInput);

      expect(agentFlowService.updateFlow).toHaveBeenCalledWith('flow-1', flowInput);
    });
  });

  describe('runAgentFlow', () => {
    it('delegates to agentFlowService.runFlow', async () => {
      const { controller, agentFlowService } = createController();

      await controller.runAgentFlow('flow-1', { input: { knowledgeBaseIds: [] } });

      expect(agentFlowService.runFlow).toHaveBeenCalledWith('flow-1', { input: { knowledgeBaseIds: [] } });
    });
  });
});
