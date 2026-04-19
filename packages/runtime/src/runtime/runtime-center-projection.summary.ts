import type { BuildRuntimeCenterSummaryProjectionInput } from './runtime-center-projection.types';

export function buildRuntimeCenterSummaryProjection(input: BuildRuntimeCenterSummaryProjectionInput) {
  const activeTasks = input.tasks.filter(task =>
    ['queued', 'running', 'waiting_approval', 'blocked'].includes(String(task.status))
  );
  const activeMinistries = Array.from(
    new Set(
      activeTasks
        .map(task => input.getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry)
        .filter(Boolean)
    )
  ) as string[];
  const activeWorkers = Array.from(new Set(activeTasks.map(task => task.currentWorker).filter(Boolean))) as string[];

  return {
    taskCount: input.tasks.length,
    activeTaskCount: activeTasks.length,
    queueDepth: input.tasks.filter(task => String(task.status) === 'queued').length,
    blockedRunCount: input.tasks.filter(task => String(task.status) === 'blocked').length,
    pendingApprovalCount: input.pendingApprovals.length,
    sessionCount: input.sessions.length,
    activeSessionCount: input.sessions.filter(session =>
      ['running', 'waiting_approval', 'waiting_learning_confirmation'].includes(String(session.status))
    ).length,
    activeMinistries,
    activeWorkers,
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
    recentGovernanceAudit: [],
    approvalScopePolicies: [],
    streamMonitor: [],
    diagnosisEvidenceCount: 0,
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
    },
    recentRuns: input.filteredRecentRuns
  };
}
