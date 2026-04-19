import { beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshMetricsSnapshots } from '../src/runtime/runtime-metrics-refresh';

describe('runtime-metrics-refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T09:30:00.000Z'));
  });

  it('persists usage and eval snapshots without dropping either history slice', async () => {
    let snapshot = {
      usageHistory: [],
      usageAudit: [],
      evalHistory: []
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async nextSnapshot => {
        snapshot = nextSnapshot;
      })
    };

    const refreshed = await refreshMetricsSnapshots(
      {
        runtimeStateRepository: runtimeStateRepository as any,
        orchestrator: {
          listTasks: () => [
            {
              id: 'task-1',
              goal: 'Run qa flow',
              skillId: 'qa',
              createdAt: '2026-04-18T10:00:00.000Z',
              updatedAt: '2026-04-19T08:00:00.000Z',
              approvals: [],
              trace: [{ node: 'execute', summary: 'qa completed' }],
              llmUsage: {
                totalTokens: 120,
                measuredCallCount: 1,
                estimatedCallCount: 0,
                updatedAt: '2026-04-19T08:00:00.000Z',
                models: [
                  {
                    model: 'gpt-5.4',
                    totalTokens: 120,
                    costUsd: 0.12,
                    costCny: 0.86,
                    pricingSource: 'provider',
                    callCount: 1
                  }
                ]
              }
            }
          ]
        },
        fetchProviderUsageAudit: vi.fn(async () => ({
          status: 'configured',
          provider: 'openai',
          source: 'test',
          message: 'ok',
          daily: []
        }))
      },
      14
    );

    expect(refreshed).toEqual(
      expect.objectContaining({
        days: 14,
        refreshedAt: '2026-04-19T09:30:00.000Z',
        runtime: expect.objectContaining({
          historyDays: 1,
          persistedDailyHistoryCount: 1,
          recentUsageAuditCount: 1
        }),
        evals: expect.objectContaining({
          historyDays: 1,
          persistedDailyHistoryCount: 1,
          recentRunsCount: 1
        })
      })
    );
    expect(snapshot.usageHistory).toHaveLength(1);
    expect(snapshot.evalHistory).toHaveLength(1);
    expect(snapshot.usageAudit).toHaveLength(1);
    expect(runtimeStateRepository.save).toHaveBeenCalledTimes(2);
  });
});
