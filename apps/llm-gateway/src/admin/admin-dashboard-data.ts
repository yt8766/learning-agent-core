export interface DashboardLogSummaryInput {
  status: 'success' | 'error';
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
}

export interface DashboardSummary {
  requestCount: number;
  totalTokens: number;
  estimatedCost: number;
  failureRate: number;
  averageLatencyMs: number;
}

export function summarizeDashboard(logs: DashboardLogSummaryInput[]): DashboardSummary {
  const requestCount = logs.length;

  if (requestCount === 0) {
    return {
      requestCount: 0,
      totalTokens: 0,
      estimatedCost: 0,
      failureRate: 0,
      averageLatencyMs: 0
    };
  }

  const totals = logs.reduce(
    (summary, log) => ({
      totalTokens: summary.totalTokens + log.totalTokens,
      estimatedCost: summary.estimatedCost + log.estimatedCost,
      errorCount: summary.errorCount + (log.status === 'error' ? 1 : 0),
      latencyMs: summary.latencyMs + log.latencyMs
    }),
    {
      totalTokens: 0,
      estimatedCost: 0,
      errorCount: 0,
      latencyMs: 0
    }
  );

  return {
    requestCount,
    totalTokens: totals.totalTokens,
    estimatedCost: Number(totals.estimatedCost.toFixed(6)),
    failureRate: totals.errorCount / requestCount,
    averageLatencyMs: Math.round(totals.latencyMs / requestCount)
  };
}
