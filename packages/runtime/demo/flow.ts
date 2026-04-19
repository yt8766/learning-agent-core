import { buildRuntimeCenterProjection, buildRuntimeCenterSummaryProjection } from '../src/index.js';

const tasks = [
  {
    id: 'task-runtime-demo',
    goal: 'Investigate runtime approvals',
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T01:00:00.000Z',
    status: 'running',
    sessionId: 'session-runtime-demo',
    currentMinistry: 'gongbu',
    currentWorker: 'gongbu-code',
    approvals: []
  }
];

const summary = buildRuntimeCenterSummaryProjection({
  tasks,
  sessions: [],
  pendingApprovals: [{ id: 'approval-runtime-demo' }],
  filteredRecentRuns: tasks,
  getMinistryDisplayName: ministry => (ministry === 'gongbu' ? '工部' : ministry)
});

const projection = buildRuntimeCenterProjection({
  profile: 'balanced',
  policy: {
    approvalMode: 'balanced',
    skillInstallMode: 'manual',
    learningMode: 'controlled',
    sourcePolicyMode: 'controlled-first',
    budget: { stepBudget: 8, retryBudget: 1, sourceBudget: 4 }
  },
  tasks,
  sessions: [],
  pendingApprovals: [{ id: 'approval-runtime-demo' }],
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
  backgroundWorkerSlots: new Map([
    [
      'slot-runtime-demo',
      {
        taskId: 'task-runtime-demo',
        startedAt: '2026-04-19T01:00:00.000Z'
      }
    ]
  ]),
  filteredRecentRuns: tasks,
  getCheckpoint: () =>
    ({
      streamStatus: {
        nodeLabel: '工部',
        detail: '处理中',
        progressPercent: 60
      }
    }) as never,
  getMinistryDisplayName: ministry => (ministry === 'gongbu' ? '工部' : ministry),
  getSpecialistDisplayName: ({ domain }) => domain,
  deriveRecentAgentErrors: () => [],
  listSubgraphDescriptors: () => [{ id: 'chat.graph' }],
  listWorkflowVersions: () => [{ workflowId: 'chat', version: 'v1' }]
});

console.log(
  JSON.stringify(
    {
      activeTaskCount: summary.activeTaskCount,
      pendingApprovalCount: summary.pendingApprovalCount,
      activeMinistries: projection.activeMinistries
    },
    null,
    2
  )
);
