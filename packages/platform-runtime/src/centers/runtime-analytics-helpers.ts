import type { ExecutionTrace } from '@agent/core';

export interface UsageAnalyticsTaskLike {
  id: string;
  goal: string;
  result?: string;
  createdAt: string;
  updatedAt: string;
  currentMinistry?: string;
  status?: string;
  retryCount?: number;
  plan?: {
    summary?: string;
  };
  externalSources?: Array<{
    summary?: string;
  }>;
  trace?: Array<{
    summary?: string;
  }>;
  messages?: Array<{
    content?: string;
  }>;
  llmUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    measuredCallCount?: number;
    estimatedCallCount?: number;
    models: Array<{
      model: string;
      totalTokens: number;
      costUsd?: number;
      callCount: number;
      pricingSource?: string;
    }>;
  };
  modelRoute?: Array<{
    ministry?: string;
    selectedModel?: string;
  }>;
}

export const MODEL_COST_PER_1K_TOKENS_USD: Record<string, number> = {
  'glm-5': 0.002,
  'glm-4.7-flashx': 0.0005,
  'glm-4.7': 0.001,
  'glm-4.6': 0.0012,
  default: 0.001
};

export const USAGE_BUDGET_POLICY = {
  dailyTokenWarning: 100_000,
  dailyCostCnyWarning: 5,
  totalCostCnyWarning: 20
};

export function estimateTokens(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

export function isReviseSpan(trace: ExecutionTrace) {
  return Boolean(
    (trace.revisionCount ?? 0) > 0 || /revise|replan|critique_guard|retry/i.test(`${trace.node} ${trace.summary}`)
  );
}

export function formatDay(value?: string): string {
  const date = value ? new Date(value) : new Date(0);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return date.toISOString().slice(0, 10);
}

export function roundCurrency(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function estimateModelCost(tokens: number, model: string): number {
  const rate = MODEL_COST_PER_1K_TOKENS_USD[model] ?? MODEL_COST_PER_1K_TOKENS_USD.default ?? 0.001;
  return (tokens / 1000) * rate;
}

export function buildUsageAlerts(input: {
  totalCostCny: number;
  totalTokens: number;
  daily: Array<{ day: string; tokens: number; costCny: number }>;
}) {
  const alerts: Array<{ level: 'info' | 'warning' | 'critical'; title: string; description: string }> = [];
  for (const day of input.daily) {
    if (day.tokens >= USAGE_BUDGET_POLICY.dailyTokenWarning) {
      alerts.push({
        level: 'warning',
        title: `Daily token budget warning: ${day.day}`,
        description: `Used ${day.tokens.toLocaleString()} tokens on ${day.day}, exceeding ${USAGE_BUDGET_POLICY.dailyTokenWarning.toLocaleString()}.`
      });
    }
    if (day.costCny >= USAGE_BUDGET_POLICY.dailyCostCnyWarning) {
      alerts.push({
        level: 'warning',
        title: `Daily cost budget warning: ${day.day}`,
        description: `Estimated cost on ${day.day} is RMB ${day.costCny.toFixed(2)}, exceeding RMB ${USAGE_BUDGET_POLICY.dailyCostCnyWarning.toFixed(2)}.`
      });
    }
  }
  if (input.totalCostCny >= USAGE_BUDGET_POLICY.totalCostCnyWarning) {
    alerts.push({
      level: 'critical',
      title: 'Total cost approaching budget limit',
      description: `Current estimated total cost is RMB ${input.totalCostCny.toFixed(2)}, exceeding RMB ${USAGE_BUDGET_POLICY.totalCostCnyWarning.toFixed(2)}.`
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      level: 'info',
      title: 'Budget status normal',
      description: `Current cumulative usage is ${input.totalTokens.toLocaleString()} tokens and no budget threshold has been triggered.`
    });
  }
  return alerts;
}

export function normalizeMinistryId(ministry?: string) {
  switch (ministry) {
    case 'libu-router':
    case 'libu':
      return 'libu-governance';
    case 'hubu':
      return 'hubu-search';
    case 'gongbu':
      return 'gongbu-code';
    case 'bingbu':
      return 'bingbu-ops';
    case 'xingbu':
      return 'xingbu-review';
    case 'libu-docs':
    case 'libu_docs':
      return 'libu-delivery';
    default:
      return ministry;
  }
}

export function buildModelHeatmap(tasks: UsageAnalyticsTaskLike[]) {
  return ['libu-governance', 'hubu-search', 'gongbu-code', 'bingbu-ops', 'xingbu-review', 'libu-delivery'].map(
    ministry => {
      const scopedTasks = tasks.filter(task => normalizeMinistryId(task.currentMinistry) === ministry);
      const successCount = scopedTasks.filter(task => task.status === 'completed').length;
      const retryCount = scopedTasks.reduce((sum, task) => sum + (task.retryCount ?? 0), 0);
      const costUsd = scopedTasks.reduce(
        (sum, task) => sum + (task.llmUsage?.models.reduce((modelSum, item) => modelSum + (item.costUsd ?? 0), 0) ?? 0),
        0
      );
      const latencyMs = scopedTasks.reduce((sum, task) => {
        const start = new Date(task.createdAt).getTime();
        const end = new Date(task.updatedAt).getTime();
        return sum + Math.max(0, end - start);
      }, 0);
      const model = scopedTasks
        .flatMap(task => task.modelRoute ?? [])
        .find(route => normalizeMinistryId(route.ministry) === ministry)?.selectedModel;
      return {
        ministry,
        model: model ?? 'N/A',
        successRate: scopedTasks.length ? successCount / scopedTasks.length : null,
        avgLatencyMs: scopedTasks.length ? Math.round(latencyMs / scopedTasks.length) : null,
        avgCostUsd: scopedTasks.length ? roundCurrency(costUsd / scopedTasks.length) : null,
        retryRate: scopedTasks.length ? retryCount / scopedTasks.length : null
      };
    }
  );
}
