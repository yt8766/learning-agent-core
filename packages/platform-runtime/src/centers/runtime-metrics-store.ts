import { evaluateBenchmarks } from '@agent/evals';
import { RuntimeStateSnapshot } from '@agent/memory';

import { summarizeProviderBilling } from './provider-audit';
import type { ProviderAuditSyncResult } from './provider-audit';
import { formatDay, roundCurrency, summarizeUsageAnalytics } from './runtime-analytics';

interface RuntimeMetricsTaskLike {
  id: string;
  goal: string;
  skillId?: string;
  createdAt: string;
  updatedAt: string;
  approvals: Array<{
    decision?: string;
  }>;
  trace: Array<{
    node?: string;
    summary?: string;
  }>;
  reusedMemories?: unknown[];
  externalSources?: Array<{
    sourceType?: string;
    summary?: string;
  }>;
  messages?: Array<{
    content?: string;
  }>;
  result?: string;
  plan?: {
    summary?: string;
  };
  currentMinistry?: string;
  status?: string;
  retryCount?: number;
  modelRoute?: Array<{
    ministry?: string;
    selectedModel?: string;
  }>;
  llmUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens: number;
    measuredCallCount?: number;
    estimatedCallCount?: number;
    updatedAt: string;
    models: Array<{
      model: string;
      totalTokens: number;
      costUsd?: number;
      costCny?: number;
      pricingSource?: 'provider' | 'estimated';
      callCount: number;
    }>;
  };
}

type UsageHistoryPoint = NonNullable<RuntimeStateSnapshot['usageHistory']>[number];
type EvalHistoryPoint = NonNullable<RuntimeStateSnapshot['evalHistory']>[number];
type UsageAuditRecord = NonNullable<RuntimeStateSnapshot['usageAudit']>[number];

export async function readPersistedUsageAnalytics(input: {
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
  };
  tasks: RuntimeMetricsTaskLike[];
  days: number;
  filters?: { model?: string; pricingSource?: string };
}) {
  const analytics = summarizeUsageAnalytics(input.tasks);
  const snapshot = await input.runtimeStateRepository.load();
  const modelFilter = input.filters?.model;
  const pricingSourceFilter = input.filters?.pricingSource;
  const persistedHistory = (snapshot.usageHistory ?? []).slice(-30);
  const persistedAudit = (snapshot.usageAudit ?? []).slice(0, 50);
  const windowedHistory = persistedHistory.slice(-Math.max(1, input.days));
  const filteredAudit = persistedAudit
    .filter(item => !modelFilter || item.modelBreakdown.some(model => model.model === modelFilter))
    .filter(
      item =>
        !pricingSourceFilter ||
        item.modelBreakdown.some(model => (model.pricingSource ?? 'estimated') === pricingSourceFilter)
    );
  const filteredModels = analytics.models.filter(
    item =>
      (!modelFilter || item.model === modelFilter) &&
      (!pricingSourceFilter ||
        filteredAudit.some(audit =>
          audit.modelBreakdown.some(
            breakdown =>
              breakdown.model === item.model && (breakdown.pricingSource ?? 'estimated') === pricingSourceFilter
          )
        ))
  );

  const providerBillingStatus: ProviderAuditSyncResult = {
    status: 'configured',
    provider: 'snapshot',
    source: 'snapshot-read',
    message: 'using persisted provider billing snapshot',
    daily: []
  };

  return {
    ...analytics,
    models: filteredModels,
    historyDays: persistedHistory.length,
    historyRange:
      persistedHistory.length > 0
        ? {
            earliestDay: persistedHistory[0]?.day,
            latestDay: persistedHistory[persistedHistory.length - 1]?.day
          }
        : undefined,
    persistedDailyHistory: windowedHistory,
    recentUsageAudit: filteredAudit.slice(0, 10),
    providerBillingStatus,
    providerBillingDailyHistory: providerBillingStatus.daily,
    providerBillingTotals: summarizeProviderBilling(providerBillingStatus.daily)
  };
}

export async function summarizeAndPersistUsageAnalytics(input: {
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  };
  tasks: RuntimeMetricsTaskLike[];
  days: number;
  filters?: { model?: string; pricingSource?: string };
  fetchProviderUsageAudit: (days: number) => Promise<ProviderAuditSyncResult>;
}) {
  const analytics = summarizeUsageAnalytics(input.tasks);
  const providerBillingStatus = await input.fetchProviderUsageAudit(input.days);
  const snapshot = await input.runtimeStateRepository.load();
  const currentByDay = new Map<string, UsageHistoryPoint>(
    (snapshot.usageHistory ?? []).map(item => [item.day, item] as const)
  );
  for (const point of analytics.daily) {
    currentByDay.set(point.day, {
      ...point,
      measuredRunCount: analytics.measuredRunCount,
      estimatedRunCount: analytics.estimatedRunCount,
      updatedAt: new Date().toISOString()
    });
  }
  const mergedHistory: UsageHistoryPoint[] = Array.from(currentByDay.values())
    .sort((left, right) => left.day.localeCompare(right.day))
    .slice(-30);
  const currentAuditByTask = new Map<string, UsageAuditRecord>(
    (snapshot.usageAudit ?? []).map(item => [item.taskId, item] as const)
  );
  for (const task of input.tasks) {
    if (!task.llmUsage) {
      continue;
    }
    currentAuditByTask.set(task.id, {
      taskId: task.id,
      day: formatDay(task.updatedAt ?? task.createdAt),
      modelBreakdown: task.llmUsage.models.map(item => ({
        model: item.model,
        totalTokens: item.totalTokens,
        costUsd: item.costUsd ?? 0,
        costCny: item.costCny ?? 0,
        pricingSource: item.pricingSource,
        callCount: item.callCount
      })),
      totalTokens: task.llmUsage.totalTokens,
      totalCostUsd: roundCurrency(task.llmUsage.models.reduce((sum, item) => sum + (item.costUsd ?? 0), 0)),
      totalCostCny: roundCurrency(task.llmUsage.models.reduce((sum, item) => sum + (item.costCny ?? 0), 0)),
      measuredCallCount: task.llmUsage.measuredCallCount ?? 0,
      estimatedCallCount: task.llmUsage.estimatedCallCount ?? 0,
      updatedAt: task.llmUsage.updatedAt
    });
  }
  const mergedAudit: UsageAuditRecord[] = Array.from(currentAuditByTask.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 50);
  await input.runtimeStateRepository.save({
    ...snapshot,
    usageHistory: mergedHistory,
    usageAudit: mergedAudit
  });
  const modelFilter = input.filters?.model;
  const pricingSourceFilter = input.filters?.pricingSource;
  const windowedHistory = mergedHistory.slice(-Math.max(1, input.days));
  const filteredAudit = mergedAudit
    .filter(item => !modelFilter || item.modelBreakdown.some(model => model.model === modelFilter))
    .filter(
      item =>
        !pricingSourceFilter ||
        item.modelBreakdown.some(model => (model.pricingSource ?? 'estimated') === pricingSourceFilter)
    );
  const filteredModels = analytics.models.filter(
    item =>
      (!modelFilter || item.model === modelFilter) &&
      (!pricingSourceFilter ||
        filteredAudit.some(audit =>
          audit.modelBreakdown.some(
            breakdown =>
              breakdown.model === item.model && (breakdown.pricingSource ?? 'estimated') === pricingSourceFilter
          )
        ))
  );

  return {
    ...analytics,
    models: filteredModels,
    historyDays: mergedHistory.length,
    historyRange:
      mergedHistory.length > 0
        ? {
            earliestDay: mergedHistory[0]?.day,
            latestDay: mergedHistory[mergedHistory.length - 1]?.day
          }
        : undefined,
    persistedDailyHistory: windowedHistory,
    recentUsageAudit: filteredAudit.slice(0, 10),
    providerBillingStatus,
    providerBillingDailyHistory: providerBillingStatus.daily,
    providerBillingTotals: summarizeProviderBilling(providerBillingStatus.daily)
  };
}

export async function readPersistedEvalHistory(input: {
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
  };
  tasks: RuntimeMetricsTaskLike[];
  days: number;
  filters?: { scenarioId?: string; outcome?: string };
}) {
  const evals = evaluateBenchmarks(input.tasks);
  const snapshot = await input.runtimeStateRepository.load();
  const persistedHistory = (snapshot.evalHistory ?? []).slice(-30);
  const windowedHistory = persistedHistory.slice(-Math.max(1, input.days));
  const filteredRecentRuns = evals.recentRuns.filter(
    run =>
      (!input.filters?.scenarioId || run.scenarioIds.includes(input.filters.scenarioId)) &&
      (!input.filters?.outcome || (input.filters.outcome === 'pass' ? run.success : !run.success))
  );
  const filteredScenarios = evals.scenarios.filter(
    scenario => !input.filters?.scenarioId || scenario.scenarioId === input.filters.scenarioId
  );

  return {
    ...evals,
    scenarios: filteredScenarios,
    recentRuns: filteredRecentRuns,
    historyDays: persistedHistory.length,
    historyRange:
      persistedHistory.length > 0
        ? {
            earliestDay: persistedHistory[0]?.day,
            latestDay: persistedHistory[persistedHistory.length - 1]?.day
          }
        : undefined,
    persistedDailyHistory: windowedHistory
  };
}

export async function summarizeAndPersistEvalHistory(input: {
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  };
  tasks: RuntimeMetricsTaskLike[];
  days: number;
  filters?: { scenarioId?: string; outcome?: string };
}) {
  const evals = evaluateBenchmarks(input.tasks);
  const snapshot = await input.runtimeStateRepository.load();
  const currentByDay = new Map<string, EvalHistoryPoint>(
    (snapshot.evalHistory ?? []).map(item => [item.day, item] as const)
  );
  for (const point of evals.dailyTrend) {
    currentByDay.set(point.day, {
      ...point,
      scenarioCount: evals.scenarioCount,
      overallPassRate: evals.overallPassRate,
      updatedAt: new Date().toISOString()
    });
  }
  const mergedHistory: EvalHistoryPoint[] = Array.from(currentByDay.values())
    .sort((left, right) => left.day.localeCompare(right.day))
    .slice(-30);
  await input.runtimeStateRepository.save({
    ...snapshot,
    evalHistory: mergedHistory
  });
  const windowedHistory = mergedHistory.slice(-Math.max(1, input.days));
  const filteredRecentRuns = evals.recentRuns.filter(
    run =>
      (!input.filters?.scenarioId || run.scenarioIds.includes(input.filters.scenarioId)) &&
      (!input.filters?.outcome || (input.filters.outcome === 'pass' ? run.success : !run.success))
  );
  const filteredScenarios = evals.scenarios.filter(
    scenario => !input.filters?.scenarioId || scenario.scenarioId === input.filters.scenarioId
  );

  return {
    ...evals,
    scenarios: filteredScenarios,
    recentRuns: filteredRecentRuns,
    historyDays: mergedHistory.length,
    historyRange:
      mergedHistory.length > 0
        ? {
            earliestDay: mergedHistory[0]?.day,
            latestDay: mergedHistory[mergedHistory.length - 1]?.day
          }
        : undefined,
    persistedDailyHistory: windowedHistory
  };
}
