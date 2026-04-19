import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildPlatformConsole, buildPlatformConsoleShell } from '../../../src/runtime/helpers/runtime-platform-console';

describe('runtime-platform-console build helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds platform console with fallbacks and checkpoint aggregation', async () => {
    const context = {
      skillRegistry: {
        list: vi.fn(async () => {
          throw new Error('skills unavailable');
        })
      },
      orchestrator: {
        listRules: vi.fn(async () => {
          throw new Error('rules unavailable');
        }),
        listTasks: vi.fn(() => [{ id: 'task-1' }])
      },
      sessionCoordinator: {
        listSessions: vi.fn(() => [
          { id: 'session-1', title: 'runtime', updatedAt: '2026-04-01T00:00:00.000Z' } as any
        ]),
        getCheckpoint: vi.fn((sessionId: string) =>
          sessionId === 'session-1' ? ({ sessionId, taskId: 'task-1' } as any) : undefined
        )
      },
      getRuntimeCenter: vi.fn(async (_days?: number, filters?: Record<string, unknown>) => ({
        scope: 'runtime',
        filters
      })),
      getRuntimeCenterSummary: vi.fn(async (_days?: number, filters?: Record<string, unknown>) => ({
        scope: 'runtime-summary',
        filters
      })),
      getApprovalsCenter: vi.fn((filters?: Record<string, unknown>) => ({ scope: 'approvals', filters })),
      getLearningCenter: vi.fn(async () => {
        throw new Error('learning unavailable');
      }),
      getEvalsCenter: vi.fn(async () => ({ scope: 'evals' })),
      getEvalsCenterSummary: vi.fn(async () => ({ scope: 'evals-summary' })),
      getEvidenceCenter: vi.fn(async () => ({ scope: 'evidence' })),
      getConnectorsCenter: vi.fn(async () => {
        throw new Error('connectors unavailable');
      }),
      getSkillSourcesCenter: vi.fn(async () => {
        throw new Error('sources unavailable');
      }),
      getCompanyAgentsCenter: vi.fn(() => {
        throw new Error('agents unavailable');
      })
    };
    const consoleRecord = await buildPlatformConsole(context, 14, {
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider-billing',
      runtimeExecutionMode: 'plan',
      runtimeInteractionKind: 'plan-question',
      approvalsExecutionMode: 'execute',
      approvalsInteractionKind: 'approval'
    });

    expect(consoleRecord.runtime).toEqual(
      expect.objectContaining({
        scope: 'runtime',
        filters: expect.objectContaining({
          status: 'running',
          executionMode: 'plan',
          interactionKind: 'plan-question',
          metricsMode: 'snapshot-preferred'
        })
      })
    );
    expect(consoleRecord.approvals).toEqual(
      expect.objectContaining({
        scope: 'approvals',
        filters: {
          executionMode: 'execute',
          interactionKind: 'approval'
        }
      })
    );
    expect(consoleRecord.skills).toEqual([]);
    expect(consoleRecord.rules).toEqual([]);
    expect(consoleRecord.learning).toEqual(
      expect.objectContaining({
        totalCandidates: 0,
        pendingCandidates: 0
      })
    );
    expect(consoleRecord.skillSources).toEqual({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    });
    expect(consoleRecord.connectors).toEqual([]);
    expect(consoleRecord.companyAgents).toEqual([]);
    expect(consoleRecord.tasks).toEqual([{ id: 'task-1' }]);
    expect(consoleRecord.checkpoints).toEqual([
      expect.objectContaining({
        checkpoint: expect.objectContaining({ taskId: 'task-1' })
      })
    ]);
    expect(consoleRecord.diagnostics).toEqual(
      expect.objectContaining({
        cacheStatus: 'miss',
        generatedAt: expect.any(String),
        timingsMs: expect.objectContaining({
          total: expect.any(Number),
          runtime: expect.any(Number),
          approvals: expect.any(Number),
          evals: expect.any(Number),
          tasks: expect.any(Number),
          checkpoints: expect.any(Number)
        })
      })
    );
    expect(consoleRecord.evals).toEqual(expect.objectContaining({ scope: 'evals' }));
    expect(context.getEvalsCenter).toHaveBeenCalledWith(14, {
      metricsMode: 'snapshot-preferred'
    });
  });

  it('degrades to fallbacks when heavyweight center loaders exceed the platform console timeout budget', async () => {
    vi.useFakeTimers();
    const context = {
      skillRegistry: {
        list: vi.fn(async () => [])
      },
      orchestrator: {
        listRules: vi.fn(async () => []),
        listTasks: vi.fn(() => [])
      },
      sessionCoordinator: {
        listSessions: vi.fn(() => []),
        getCheckpoint: vi.fn(() => undefined)
      },
      getRuntimeCenter: vi.fn(
        () =>
          new Promise(() => {
            // Intentionally never resolves: platform console should timebox and degrade.
          })
      ),
      getRuntimeCenterSummary: vi.fn(
        () =>
          new Promise(() => {
            // Intentionally never resolves: platform console should timebox and degrade.
          })
      ),
      getApprovalsCenter: vi.fn(() => []),
      getLearningCenter: vi.fn(
        () =>
          new Promise(() => {
            // Intentionally never resolves: platform console should timebox and degrade.
          })
      ),
      getEvalsCenter: vi.fn(async () => ({
        dailyTrend: [],
        persistedDailyHistory: [],
        recentRuns: [],
        promptRegression: { suites: [] }
      })),
      getEvalsCenterSummary: vi.fn(async () => ({
        dailyTrend: [],
        persistedDailyHistory: [],
        recentRuns: [],
        scenarioTrends: [],
        scenarios: [],
        scenarioCount: 0,
        runCount: 0,
        overallPassRate: 0
      })),
      getEvidenceCenter: vi.fn(
        () =>
          new Promise(() => {
            // Intentionally never resolves: platform console should timebox and degrade.
          })
      ),
      getConnectorsCenter: vi.fn(async () => []),
      getSkillSourcesCenter: vi.fn(async () => ({
        sources: [],
        manifests: [],
        installed: [],
        receipts: []
      })),
      getCompanyAgentsCenter: vi.fn(() => [])
    };

    const request = buildPlatformConsole(context, 30);
    await vi.advanceTimersByTimeAsync(5_500);

    await expect(request).resolves.toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({
          recentRuns: [],
          taskCount: 0,
          activeTaskCount: 0,
          usageAnalytics: expect.objectContaining({
            daily: [],
            persistedDailyHistory: []
          })
        }),
        learning: expect.objectContaining({
          totalCandidates: 0,
          pendingCandidates: 0
        }),
        evidence: {
          totalEvidenceCount: 0,
          recentEvidence: []
        }
      })
    );
  });

  it('builds a shell record without loading evidence, connectors, skill sources, or company agents details', async () => {
    const context = {
      skillRegistry: {
        list: vi.fn(async () => [])
      },
      orchestrator: {
        listRules: vi.fn(async () => []),
        listTasks: vi.fn(() => [])
      },
      sessionCoordinator: {
        listSessions: vi.fn(() => []),
        getCheckpoint: vi.fn(() => undefined)
      },
      getRuntimeCenter: vi.fn(async () => ({ recentRuns: [], activeTaskCount: 1 })),
      getRuntimeCenterSummary: vi.fn(async () => ({
        recentRuns: [{ id: 'task-runtime-summary' }],
        activeTaskCount: 1,
        taskCount: 1,
        queueDepth: 0,
        blockedRunCount: 0,
        pendingApprovalCount: 0,
        sessionCount: 0,
        activeSessionCount: 0,
        activeMinistries: [],
        activeWorkers: [],
        usageAnalytics: {
          totalEstimatedPromptTokens: 0,
          totalEstimatedCompletionTokens: 0,
          totalEstimatedTokens: 0,
          totalEstimatedCostUsd: 0,
          totalEstimatedCostCny: 0,
          providerMeasuredCostUsd: 0,
          providerMeasuredCostCny: 0,
          estimatedFallbackCostUsd: 0,
          estimatedFallbackCostCny: 0,
          measuredRunCount: 0,
          estimatedRunCount: 0,
          daily: [],
          models: [],
          budgetPolicy: {
            dailyTokenWarning: 100_000,
            dailyCostCnyWarning: 5,
            totalCostCnyWarning: 20
          },
          persistedDailyHistory: [],
          recentUsageAudit: [],
          alerts: []
        },
        recentGovernanceAudit: [],
        approvalScopePolicies: [],
        streamMonitor: [],
        thoughtGraphs: [],
        modelHeatmap: [],
        imperialChain: [],
        strategyCounselors: [],
        executionSpans: [],
        interruptLedger: [],
        libuScorecards: [],
        governanceScorecards: [],
        shiluAdjustments: [],
        recentAgentErrors: [],
        tools: {
          totalTools: 0,
          familyCount: 0,
          blockedToolCount: 0,
          approvalRequiredCount: 0,
          mcpBackedCount: 0,
          governanceToolCount: 0,
          families: [],
          recentUsage: [],
          blockedReasons: []
        }
      })),
      getApprovalsCenter: vi.fn(() => []),
      getLearningCenter: vi.fn(async () => ({
        totalCandidates: 1,
        pendingCandidates: 0,
        confirmedCandidates: 1,
        candidates: []
      })),
      getLearningCenterSummary: vi.fn(async () => ({
        totalCandidates: 1,
        pendingCandidates: 0,
        confirmedCandidates: 1,
        learningQueueSummary: { total: 0, queued: 0, processing: 0, blocked: 0, completed: 0 },
        candidates: [],
        recentJobs: [],
        localSkillSuggestions: [],
        recentSkillGovernance: [],
        recentGovernanceReports: [],
        capabilityTrustProfiles: [],
        ministryGovernanceProfiles: [],
        workerGovernanceProfiles: [],
        specialistGovernanceProfiles: [],
        ministryScorecards: [],
        budgetEfficiencyWarnings: [],
        learningQueue: [],
        counselorSelectorConfigs: [],
        recentQuarantinedMemories: [],
        recentCrossCheckEvidence: [],
        quarantineCategoryStats: {},
        quarantineRestoreSuggestions: [],
        memoryResolutionCandidates: []
      })),
      getEvalsCenter: vi.fn(async () => ({ dailyTrend: [], persistedDailyHistory: [], recentRuns: [] })),
      getEvalsCenterSummary: vi.fn(async () => ({
        dailyTrend: [],
        persistedDailyHistory: [],
        recentRuns: [],
        scenarioTrends: [],
        scenarios: [],
        scenarioCount: 0,
        runCount: 0,
        overallPassRate: 0
      })),
      getEvidenceCenter: vi.fn(async () => [{ id: 'evidence-1' }]),
      getConnectorsCenter: vi.fn(async () => [{ id: 'connector-1' }]),
      getSkillSourcesCenter: vi.fn(async () => ({
        sources: [{ id: 'source-1' }],
        manifests: [{ id: 'manifest-1' }],
        installed: [{ skillId: 'skill-1' }],
        receipts: [{ id: 'receipt-1' }]
      })),
      getCompanyAgentsCenter: vi.fn(() => [{ id: 'agent-1' }])
    };

    const shell = await buildPlatformConsoleShell(context, 30);

    expect(shell.runtime.recentRuns).toEqual([{ id: 'task-runtime-summary' }]);
    expect(shell.evidence).toEqual([]);
    expect(shell.connectors).toEqual([]);
    expect(shell.skillSources).toEqual({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    });
    expect(shell.companyAgents).toEqual([]);
    expect(context.getRuntimeCenterSummary).toHaveBeenCalled();
    expect(context.getRuntimeCenter).not.toHaveBeenCalled();
    expect(context.getLearningCenterSummary).toHaveBeenCalled();
    expect(context.getEvalsCenterSummary).toHaveBeenCalled();
    expect(context.getEvalsCenter).not.toHaveBeenCalled();
    expect(context.getLearningCenter).not.toHaveBeenCalled();
    expect(context.getEvidenceCenter).not.toHaveBeenCalled();
    expect(context.getConnectorsCenter).not.toHaveBeenCalled();
    expect(context.getSkillSourcesCenter).not.toHaveBeenCalled();
    expect(context.getCompanyAgentsCenter).not.toHaveBeenCalled();
  });
});
