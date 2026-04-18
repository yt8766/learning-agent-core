import type { ExecutionTrace } from '@agent/core';

interface UsageAnalyticsTaskLike {
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

const MODEL_COST_PER_1K_TOKENS_USD: Record<string, number> = {
  'glm-5': 0.002,
  'glm-4.7-flashx': 0.0005,
  'glm-4.7': 0.001,
  'glm-4.6': 0.0012,
  default: 0.001
};

const USAGE_BUDGET_POLICY = {
  dailyTokenWarning: 100_000,
  dailyCostCnyWarning: 5,
  totalCostCnyWarning: 20
};

export function summarizeUsageAnalytics(tasks: UsageAnalyticsTaskLike[]) {
  const daily = new Map<string, { tokens: number; costUsd: number; runs: number }>();
  const models = new Map<string, { tokens: number; costUsd: number; runCount: number }>();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let providerCostUsd = 0;
  let estimatedCostUsd = 0;
  let measuredRunCount = 0;
  let estimatedRunCount = 0;

  for (const task of tasks) {
    const usage = task.llmUsage;
    const promptTokens =
      usage?.promptTokens ??
      estimateTokens(
        [task.goal, task.plan?.summary, ...(task.externalSources ?? []).map(source => source.summary ?? '')].join(' ')
          .length
      );
    const completionTokens =
      usage?.completionTokens ??
      estimateTokens(
        [
          task.result ?? '',
          ...(task.trace ?? []).map(trace => trace.summary ?? ''),
          ...(task.messages ?? []).map(message => message.content ?? '')
        ].join(' ').length
      );
    const taskTokens = usage?.totalTokens ?? promptTokens + completionTokens;
    totalPromptTokens += promptTokens;
    totalCompletionTokens += completionTokens;
    if ((usage?.measuredCallCount ?? 0) > 0) {
      measuredRunCount += 1;
    } else {
      estimatedRunCount += 1;
    }

    const taskDay = formatDay(task.updatedAt ?? task.createdAt);
    let taskCostUsd = 0;
    if (usage?.models?.length) {
      for (const modelUsage of usage.models) {
        const normalizedModel = modelUsage.model || 'unknown';
        const modelCostUsd = modelUsage.costUsd ?? estimateModelCost(modelUsage.totalTokens, normalizedModel);
        taskCostUsd += modelCostUsd;
        if (modelUsage.pricingSource === 'provider') {
          providerCostUsd += modelCostUsd;
        } else {
          estimatedCostUsd += modelCostUsd;
        }
        const modelBucket = models.get(normalizedModel) ?? { tokens: 0, costUsd: 0, runCount: 0 };
        modelBucket.tokens += modelUsage.totalTokens;
        modelBucket.costUsd += modelCostUsd;
        modelBucket.runCount += modelUsage.callCount;
        models.set(normalizedModel, modelBucket);
      }
    } else {
      const allocatedModels = Array.from(
        new Set(
          (task.modelRoute ?? [])
            .map(route => route.selectedModel)
            .filter((m): m is string => typeof m === 'string' && m.length > 0)
        )
      );
      const modelList = allocatedModels.length > 0 ? allocatedModels : ['default'];
      const tokenShare = taskTokens / modelList.length;
      for (const model of modelList) {
        const normalizedModel = model || 'default';
        const modelCostUsd = estimateModelCost(tokenShare, normalizedModel);
        taskCostUsd += modelCostUsd;
        estimatedCostUsd += modelCostUsd;
        const modelBucket = models.get(normalizedModel) ?? { tokens: 0, costUsd: 0, runCount: 0 };
        modelBucket.tokens += Math.round(tokenShare);
        modelBucket.costUsd += modelCostUsd;
        modelBucket.runCount += 1;
        models.set(normalizedModel, modelBucket);
      }
    }

    totalCostUsd += taskCostUsd;
    const dayBucket = daily.get(taskDay) ?? { tokens: 0, costUsd: 0, runs: 0 };
    dayBucket.tokens += taskTokens;
    dayBucket.costUsd += taskCostUsd;
    dayBucket.runs += 1;
    daily.set(taskDay, dayBucket);
  }

  return {
    totalEstimatedPromptTokens: totalPromptTokens,
    totalEstimatedCompletionTokens: totalCompletionTokens,
    totalEstimatedTokens: totalPromptTokens + totalCompletionTokens,
    totalEstimatedCostUsd: roundCurrency(totalCostUsd),
    totalEstimatedCostCny: roundCurrency(totalCostUsd * 7.2),
    providerMeasuredCostUsd: roundCurrency(providerCostUsd),
    providerMeasuredCostCny: roundCurrency(providerCostUsd * 7.2),
    estimatedFallbackCostUsd: roundCurrency(estimatedCostUsd),
    estimatedFallbackCostCny: roundCurrency(estimatedCostUsd * 7.2),
    measuredRunCount,
    estimatedRunCount,
    daily: Array.from(daily.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(-7)
      .map(([day, bucket]) => ({
        day,
        tokens: bucket.tokens,
        costUsd: roundCurrency(bucket.costUsd),
        costCny: roundCurrency(bucket.costUsd * 7.2),
        runs: bucket.runs,
        overBudget:
          bucket.tokens >= USAGE_BUDGET_POLICY.dailyTokenWarning ||
          bucket.costUsd * 7.2 >= USAGE_BUDGET_POLICY.dailyCostCnyWarning
      })),
    models: Array.from(models.entries())
      .map(([model, bucket]) => ({
        model,
        tokens: bucket.tokens,
        costUsd: roundCurrency(bucket.costUsd),
        costCny: roundCurrency(bucket.costUsd * 7.2),
        runCount: bucket.runCount
      }))
      .sort((left, right) => right.tokens - left.tokens),
    budgetPolicy: { ...USAGE_BUDGET_POLICY },
    alerts: buildUsageAlerts({
      totalCostCny: roundCurrency(totalCostUsd * 7.2),
      totalTokens: totalPromptTokens + totalCompletionTokens,
      daily: Array.from(daily.entries())
        .sort((left, right) => left[0].localeCompare(right[0]))
        .slice(-7)
        .map(([day, bucket]) => ({ day, tokens: bucket.tokens, costCny: roundCurrency(bucket.costUsd * 7.2) }))
    })
  };
}

function normalizeMinistryId(ministry?: string) {
  // Legacy ministry aliases remain readable here, but analytics output is normalized to canonical ministry ids.
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

export function buildTraceAnalytics(traces: ExecutionTrace[]) {
  if (!traces.length) {
    return {
      criticalPaths: [],
      fallbackSpans: [],
      reviseSpans: [],
      roleLatencyBreakdown: [],
      slowestSpan: undefined
    };
  }

  const childrenByParent = new Map<string | undefined, ExecutionTrace[]>();
  for (const trace of traces) {
    const bucket = childrenByParent.get(trace.parentSpanId) ?? [];
    bucket.push(trace);
    childrenByParent.set(trace.parentSpanId, bucket);
  }

  const allPaths: Array<{
    pathLabel: string;
    totalLatencyMs: number;
    spanCount: number;
    fallbackNodes: string[];
    reviseNodes: string[];
  }> = [];

  function walk(trace: ExecutionTrace, chain: ExecutionTrace[], totalLatencyMs: number) {
    const nextChain = [...chain, trace];
    const nextLatency = totalLatencyMs + (trace.latencyMs ?? 0);
    const children = trace.spanId ? childrenByParent.get(trace.spanId) : undefined;
    if (!children?.length) {
      allPaths.push({
        pathLabel: nextChain.map(item => item.node).join(' -> '),
        totalLatencyMs: nextLatency,
        spanCount: nextChain.length,
        fallbackNodes: nextChain.filter(item => item.isFallback).map(item => item.node),
        reviseNodes: nextChain.filter(item => isReviseSpan(item)).map(item => item.node)
      });
      return;
    }
    for (const child of children) {
      walk(child, nextChain, nextLatency);
    }
  }

  for (const root of childrenByParent.get(undefined) ?? []) {
    walk(root, [], 0);
  }

  const slowest = [...traces].sort((left, right) => (right.latencyMs ?? 0) - (left.latencyMs ?? 0))[0];
  const roleBuckets = new Map<string, { totalLatencyMs: number; spanCount: number }>();
  for (const trace of traces) {
    const role = trace.role ?? 'unknown';
    const bucket = roleBuckets.get(role) ?? { totalLatencyMs: 0, spanCount: 0 };
    bucket.totalLatencyMs += trace.latencyMs ?? 0;
    bucket.spanCount += 1;
    roleBuckets.set(role, bucket);
  }

  return {
    criticalPaths: allPaths.sort((left, right) => right.totalLatencyMs - left.totalLatencyMs).slice(0, 3),
    fallbackSpans: traces.filter(trace => trace.isFallback).map(trace => trace.node),
    reviseSpans: traces.filter(trace => isReviseSpan(trace)).map(trace => trace.node),
    roleLatencyBreakdown: Array.from(roleBuckets.entries())
      .map(([role, bucket]) => ({
        role,
        totalLatencyMs: bucket.totalLatencyMs,
        spanCount: bucket.spanCount
      }))
      .sort((left, right) => right.totalLatencyMs - left.totalLatencyMs),
    slowestSpan: slowest
      ? {
          node: slowest.node,
          latencyMs: slowest.latencyMs ?? 0
        }
      : undefined
  };
}

function estimateTokens(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

function isReviseSpan(trace: ExecutionTrace) {
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

function estimateModelCost(tokens: number, model: string): number {
  const rate = MODEL_COST_PER_1K_TOKENS_USD[model] ?? MODEL_COST_PER_1K_TOKENS_USD.default;
  return (tokens / 1000) * rate;
}

function buildUsageAlerts(input: {
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
