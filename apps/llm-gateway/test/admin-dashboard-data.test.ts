import { describe, expect, it } from 'vitest';
import { summarizeDashboard } from '../src/admin/admin-dashboard-data.js';

describe('admin dashboard data', () => {
  it('summarizes requests, tokens, cost, failures, and latency', () => {
    const summary = summarizeDashboard([
      { status: 'success', totalTokens: 10, estimatedCost: 0.01, latencyMs: 100 },
      { status: 'error', totalTokens: 5, estimatedCost: 0.02, latencyMs: 300 }
    ]);

    expect(summary.requestCount).toBe(2);
    expect(summary.totalTokens).toBe(15);
    expect(summary.estimatedCost).toBe(0.03);
    expect(summary.failureRate).toBe(0.5);
    expect(summary.averageLatencyMs).toBe(200);
  });

  it('returns zero summary for an empty log list', () => {
    expect(summarizeDashboard([])).toEqual({
      requestCount: 0,
      totalTokens: 0,
      estimatedCost: 0,
      failureRate: 0,
      averageLatencyMs: 0
    });
  });
});
