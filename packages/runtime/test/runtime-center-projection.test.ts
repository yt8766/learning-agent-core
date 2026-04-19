import { describe, expect, it } from 'vitest';

import {
  buildRuntimeCenterProjection,
  buildRuntimeCenterSummaryProjection,
  toCritiqueStyleReviewOutcome,
  type RuntimeCenterTaskLike
} from '../src/runtime/runtime-center-projection';

describe('runtime-center-projection', () => {
  it('builds a runtime center summary projection with derived active ministries', () => {
    const tasks: RuntimeCenterTaskLike[] = [
      {
        id: 'task-1',
        goal: 'Diagnose runtime issue',
        createdAt: '2026-04-19T00:00:00.000Z',
        updatedAt: '2026-04-19T01:00:00.000Z',
        status: 'running',
        currentMinistry: 'gongbu',
        currentWorker: 'gongbu-code',
        approvals: []
      }
    ];

    const summary = buildRuntimeCenterSummaryProjection({
      tasks,
      sessions: [],
      pendingApprovals: [{ id: 'approval-1' }],
      filteredRecentRuns: tasks,
      getMinistryDisplayName: ministry => (ministry === 'gongbu' ? '工部' : ministry)
    });

    expect(summary.activeTaskCount).toBe(1);
    expect(summary.pendingApprovalCount).toBe(1);
    expect(summary.activeMinistries).toEqual(['工部']);
    expect(summary.recentRuns).toEqual(tasks);
  });

  it('builds a runtime center projection using injected display helpers', () => {
    const tasks: RuntimeCenterTaskLike[] = [
      {
        id: 'task-1',
        goal: 'Investigate provider timeout',
        context: 'Need runtime audit',
        createdAt: '2026-04-19T00:00:00.000Z',
        updatedAt: '2026-04-19T01:00:00.000Z',
        status: 'running',
        sessionId: 'session-1',
        currentMinistry: 'gongbu',
        currentWorker: 'gongbu-code',
        plannerStrategy: {
          mode: 'rich-candidates',
          summary: '多个候选官方 Agent，可先并行研究后再收敛。',
          leadDomain: 'technical-architecture',
          requiredCapabilities: ['specialist.technical-architecture'],
          preferredAgentId: 'official.coder',
          candidateAgentIds: ['official.coder', 'official.reviewer'],
          candidateCount: 2,
          gapDetected: false,
          updatedAt: '2026-04-19T01:00:00.000Z'
        },
        executionPlan: {
          strategyCounselors: ['safety'],
          executionMinistries: ['gongbu']
        },
        externalSources: [{ sourceType: 'diagnosis_result' }],
        approvals: []
      }
    ];

    const result = buildRuntimeCenterProjection({
      profile: 'balanced',
      policy: {
        approvalMode: 'balanced',
        skillInstallMode: 'manual',
        learningMode: 'controlled',
        sourcePolicyMode: 'controlled-first',
        budget: { stepBudget: 10, retryBudget: 2, sourceBudget: 5 }
      },
      tasks,
      sessions: [],
      pendingApprovals: [],
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
        alerts: [],
        providerBillingStatus: {
          status: 'disabled',
          provider: 'unknown',
          source: 'unconfigured'
        }
      },
      backgroundWorkerPoolSize: 2,
      backgroundWorkerSlots: new Map([['slot-1', { taskId: 'task-1', startedAt: '2026-04-19T01:00:00.000Z' }]]),
      filteredRecentRuns: tasks,
      getCheckpoint: sessionId =>
        sessionId === 'session-1'
          ? ({
              streamStatus: { nodeLabel: '文书科', detail: '压缩上下文', progressPercent: 45 }
            } as any)
          : undefined,
      getMinistryDisplayName: ministry => (ministry === 'gongbu' ? '工部' : ministry),
      getSpecialistDisplayName: ({ domain }) => (domain === 'safety' ? '礼部审校' : domain),
      deriveRecentAgentErrors: input => input.map(task => ({ taskId: task.id })),
      listSubgraphDescriptors: () => [{ id: 'subgraph-1' }],
      listWorkflowVersions: () => [{ workflowId: 'chat', version: 'v1' }]
    });

    expect(result.activeMinistries).toEqual(['工部']);
    expect(result.strategyCounselors).toEqual([
      {
        taskId: 'task-1',
        goal: 'Investigate provider timeout',
        counselors: [{ id: 'safety', displayName: '礼部审校' }]
      }
    ]);
    expect(result.plannerStrategies).toEqual([
      {
        taskId: 'task-1',
        goal: 'Investigate provider timeout',
        strategy: {
          mode: 'rich-candidates',
          summary: '多个候选官方 Agent，可先并行研究后再收敛。',
          leadDomain: 'technical-architecture',
          requiredCapabilities: ['specialist.technical-architecture'],
          preferredAgentId: 'official.coder',
          candidateAgentIds: ['official.coder', 'official.reviewer'],
          candidateCount: 2,
          gapDetected: false,
          updatedAt: '2026-04-19T01:00:00.000Z'
        }
      }
    ]);
    expect(result.recentAgentErrors).toEqual([{ taskId: 'task-1' }]);
    expect(result.subgraphs).toEqual([{ id: 'subgraph-1' }]);
    expect(result.workflowVersions).toEqual([{ workflowId: 'chat', version: 'v1' }]);
  });

  it('normalizes legacy governance review outcomes to critique-style values', () => {
    expect(toCritiqueStyleReviewOutcome({ decision: 'blocked', summary: 'blocked' })).toEqual({
      decision: 'block',
      summary: 'blocked'
    });
    expect(toCritiqueStyleReviewOutcome({ decision: 'approved', summary: 'approved' })).toEqual({
      decision: 'pass',
      summary: 'approved'
    });
  });
});
