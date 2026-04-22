import type { RuntimeStateSnapshot } from '@agent/memory';

import { summarizeAndPersistEvalHistory, summarizeAndPersistUsageAnalytics } from './runtime-metrics-store';
import type { ProviderAuditSyncResult } from './provider-audit';

interface RuntimeMetricsRefreshTaskLike {
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

export interface RuntimeMetricsRefreshContext {
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  };
  orchestrator: {
    listTasks: () => RuntimeMetricsRefreshTaskLike[];
  };
  fetchProviderUsageAudit: (days: number) => Promise<ProviderAuditSyncResult>;
}

export async function refreshMetricsSnapshots(ctx: RuntimeMetricsRefreshContext, days = 30) {
  const tasks = ctx.orchestrator.listTasks();
  const runtime = await summarizeAndPersistUsageAnalytics({
    runtimeStateRepository: ctx.runtimeStateRepository,
    tasks,
    days,
    fetchProviderUsageAudit: (auditDays: number) => ctx.fetchProviderUsageAudit(auditDays)
  });
  const evals = await summarizeAndPersistEvalHistory({
    runtimeStateRepository: ctx.runtimeStateRepository,
    tasks,
    days
  });

  return {
    days,
    refreshedAt: new Date().toISOString(),
    runtime: {
      historyDays: runtime.historyDays,
      persistedDailyHistoryCount: runtime.persistedDailyHistory.length,
      recentUsageAuditCount: runtime.recentUsageAudit.length
    },
    evals: {
      historyDays: evals.historyDays,
      persistedDailyHistoryCount: evals.persistedDailyHistory.length,
      recentRunsCount: evals.recentRuns.length
    }
  };
}
