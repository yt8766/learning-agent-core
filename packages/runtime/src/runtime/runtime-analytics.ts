import type { ExecutionTrace } from '@agent/core';

import {
  buildUsageAlerts,
  estimateModelCost,
  estimateTokens,
  formatDay,
  isReviseSpan,
  roundCurrency,
  USAGE_BUDGET_POLICY,
  type UsageAnalyticsTaskLike
} from './runtime-analytics-helpers';

export { buildModelHeatmap, formatDay, roundCurrency } from './runtime-analytics-helpers';

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
