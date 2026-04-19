import type { ExecutionTrace, RunTraceSpanRecord, RunSpanStatus } from '@agent/core';

import { resolveRunStage } from './run-stage-semantics';

function mapExecutionTraceStatus(status?: ExecutionTrace['status']): RunSpanStatus {
  switch (status) {
    case 'success':
      return 'completed';
    case 'running':
      return 'started';
    case 'rejected':
      return 'blocked';
    case 'failed':
      return 'failed';
    case 'timeout':
      return 'failed';
    default:
      return 'started';
  }
}

export function buildRunTraceSpans(trace: ExecutionTrace[] | undefined): RunTraceSpanRecord[] {
  return (trace ?? []).map((entry, index) => {
    const attributes = entry.data
      ? (Object.fromEntries(
          Object.entries(entry.data).filter(
            ([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value)
          )
        ) as Record<string, string | number | boolean | null>)
      : undefined;

    return {
      spanId: entry.spanId ?? entry.traceId ?? `${entry.node}-${index}`,
      parentSpanId: entry.parentSpanId,
      node: entry.node,
      stage: resolveRunStage({
        node: entry.node,
        summary: entry.summary
      }),
      role: entry.role,
      specialistId: entry.specialistId,
      status: mapExecutionTraceStatus(entry.status),
      summary: entry.summary,
      startedAt: entry.at,
      latencyMs: entry.latencyMs,
      modelUsed: entry.modelUsed,
      tokenUsage: entry.tokenUsage
        ? {
            promptTokens: entry.tokenUsage.prompt,
            completionTokens: entry.tokenUsage.completion,
            totalTokens: entry.tokenUsage.total
          }
        : undefined,
      isFallback: entry.isFallback,
      fallbackReason: entry.fallbackReason,
      attributes
    };
  });
}
