import type { TaskRecord } from './core';

export interface RuntimeCenterRecord {
  runtimeProfile?: 'platform' | 'company' | 'personal' | 'cli';
  policy?: {
    approvalMode: 'strict' | 'balanced' | 'auto';
    skillInstallMode: 'manual' | 'low-risk-auto';
    learningMode: 'controlled' | 'aggressive';
    sourcePolicyMode: 'internal-only' | 'controlled-first' | 'open-web-allowed';
    budget: {
      stepBudget: number;
      retryBudget: number;
      sourceBudget: number;
    };
  };
  taskCount: number;
  activeTaskCount: number;
  backgroundRunCount?: number;
  foregroundRunCount?: number;
  leasedBackgroundRunCount?: number;
  staleLeaseCount?: number;
  workerPoolSize?: number;
  activeWorkerSlotCount?: number;
  availableWorkerSlotCount?: number;
  activeWorkerSlots?: Array<{
    slotId: string;
    taskId: string;
    startedAt: string;
  }>;
  queueDepth: number;
  blockedRunCount: number;
  budgetExceededCount?: number;
  pendingApprovalCount: number;
  sessionCount: number;
  activeSessionCount: number;
  activeMinistries: string[];
  activeWorkers: string[];
  subgraphs?: Array<{
    id: 'research' | 'execution' | 'review' | 'skill-install' | 'background-runner';
    displayName: string;
    description: string;
    owner: string;
    entryNodes: string[];
  }>;
  workflowVersions?: Array<{
    workflowId: string;
    version: string;
    status: 'draft' | 'published' | 'active' | 'deprecated';
    updatedAt: string;
    changelog?: string[];
  }>;
  appliedFilters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
  };
  usageAnalytics: {
    totalEstimatedPromptTokens: number;
    totalEstimatedCompletionTokens: number;
    totalEstimatedTokens: number;
    totalEstimatedCostUsd: number;
    totalEstimatedCostCny: number;
    providerMeasuredCostUsd: number;
    providerMeasuredCostCny: number;
    estimatedFallbackCostUsd: number;
    estimatedFallbackCostCny: number;
    measuredRunCount: number;
    estimatedRunCount: number;
    daily: Array<{
      day: string;
      tokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
      overBudget?: boolean;
    }>;
    models: Array<{
      model: string;
      tokens: number;
      costUsd: number;
      costCny: number;
      runCount: number;
    }>;
    budgetPolicy: {
      dailyTokenWarning: number;
      dailyCostCnyWarning: number;
      totalCostCnyWarning: number;
    };
    historyDays?: number;
    historyRange?: {
      earliestDay?: string;
      latestDay?: string;
    };
    persistedDailyHistory?: Array<{
      day: string;
      tokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
      overBudget?: boolean;
      measuredRunCount?: number;
      estimatedRunCount?: number;
      updatedAt: string;
    }>;
    providerBillingStatus?: {
      status: 'disabled' | 'configured' | 'synced' | 'error';
      provider: string;
      source: string;
      syncedAt?: string;
      message?: string;
    };
    providerBillingDailyHistory?: Array<{
      day: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
    }>;
    providerBillingTotals?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      runs: number;
    };
    recentUsageAudit?: Array<{
      taskId: string;
      day: string;
      totalTokens: number;
      totalCostUsd: number;
      totalCostCny: number;
      measuredCallCount: number;
      estimatedCallCount: number;
      updatedAt: string;
      modelBreakdown: Array<{
        model: string;
        totalTokens: number;
        costUsd: number;
        costCny: number;
        pricingSource?: 'provider' | 'estimated';
        callCount: number;
      }>;
    }>;
    alerts: Array<{
      level: 'info' | 'warning' | 'critical';
      title: string;
      description: string;
    }>;
  };
  recentGovernanceAudit?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    scope: 'skill-source' | 'company-worker' | 'skill-install' | 'connector';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  recentRuns: TaskRecord[];
}
