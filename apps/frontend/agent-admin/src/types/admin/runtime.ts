import type { TaskRecord } from './core';

export interface RuntimeCenterRecord {
  taskCount: number;
  activeTaskCount: number;
  queueDepth: number;
  blockedRunCount: number;
  budgetExceededCount?: number;
  pendingApprovalCount: number;
  sessionCount: number;
  activeSessionCount: number;
  activeMinistries: string[];
  activeWorkers: string[];
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
  recentRuns: TaskRecord[];
}
