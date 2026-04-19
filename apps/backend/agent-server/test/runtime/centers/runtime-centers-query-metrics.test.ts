import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadEvalsCenterMetrics,
  loadRuntimeUsageAnalytics
} from '../../../src/runtime/centers/runtime-centers-query-metrics';
import {
  readPersistedEvalHistory,
  readPersistedUsageAnalytics,
  summarizeAndPersistEvalHistory,
  summarizeAndPersistUsageAnalytics
} from '@agent/runtime';

vi.mock('@agent/runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/runtime')>();
  return {
    ...actual,
    readPersistedUsageAnalytics: vi.fn(),
    summarizeAndPersistUsageAnalytics: vi.fn(),
    readPersistedEvalHistory: vi.fn(),
    summarizeAndPersistEvalHistory: vi.fn()
  };
});

describe('runtime-centers-query-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to live usage aggregation when the persisted usage snapshot is empty', async () => {
    vi.mocked(readPersistedUsageAnalytics).mockResolvedValueOnce({
      persistedDailyHistory: [],
      recentUsageAudit: [],
      providerBillingDailyHistory: [],
      models: [],
      alerts: [],
      totalEstimatedTokens: 0
    } as any);
    vi.mocked(summarizeAndPersistUsageAnalytics).mockResolvedValueOnce({
      persistedDailyHistory: [{ day: '2026-04-19', tokens: 10 }],
      recentUsageAudit: [{ taskId: 'task-1' }],
      providerBillingDailyHistory: [{ day: '2026-04-19', totalTokens: 10 }],
      models: [{ model: 'glm-5' }],
      alerts: [],
      totalEstimatedTokens: 10
    } as any);

    const result = await loadRuntimeUsageAnalytics(
      {
        runtimeStateRepository: { load: vi.fn(async () => ({})), save: vi.fn(async () => undefined) },
        fetchProviderUsageAudit: vi.fn(async () => ({ daily: [] })),
        orchestrator: {}
      } as any,
      [{ id: 'task-1' }],
      30,
      { metricsMode: 'snapshot-preferred' }
    );

    expect(readPersistedUsageAnalytics).toHaveBeenCalledTimes(1);
    expect(summarizeAndPersistUsageAnalytics).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ totalEstimatedTokens: 10 }));
  });

  it('keeps persisted usage aggregation when snapshot data is present', async () => {
    vi.mocked(readPersistedUsageAnalytics).mockResolvedValueOnce({
      persistedDailyHistory: [{ day: '2026-04-19', tokens: 10 }],
      recentUsageAudit: [{ taskId: 'task-1' }],
      providerBillingDailyHistory: [],
      models: [{ model: 'glm-5' }],
      alerts: [],
      totalEstimatedTokens: 10
    } as any);

    const result = await loadRuntimeUsageAnalytics(
      {
        runtimeStateRepository: { load: vi.fn(async () => ({})), save: vi.fn(async () => undefined) },
        fetchProviderUsageAudit: vi.fn(async () => ({ daily: [] })),
        orchestrator: {}
      } as any,
      [{ id: 'task-1' }],
      30,
      { metricsMode: 'snapshot-preferred' }
    );

    expect(summarizeAndPersistUsageAnalytics).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ totalEstimatedTokens: 10 }));
  });

  it('falls back to live eval aggregation when the persisted eval snapshot is empty', async () => {
    vi.mocked(readPersistedEvalHistory).mockResolvedValueOnce({
      persistedDailyHistory: [],
      recentRuns: [],
      scenarios: []
    } as any);
    vi.mocked(summarizeAndPersistEvalHistory).mockResolvedValueOnce({
      persistedDailyHistory: [{ day: '2026-04-19', runCount: 1 }],
      recentRuns: [{ taskId: 'task-1' }],
      scenarios: [{ scenarioId: 'runtime-smoke' }]
    } as any);

    const result = await loadEvalsCenterMetrics(
      {
        runtimeStateRepository: { load: vi.fn(async () => ({})), save: vi.fn(async () => undefined) },
        orchestrator: { listTasks: vi.fn(() => [{ id: 'task-1' }]) }
      } as any,
      30,
      { metricsMode: 'snapshot-preferred' }
    );

    expect(readPersistedEvalHistory).toHaveBeenCalledTimes(1);
    expect(summarizeAndPersistEvalHistory).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        recentRuns: [expect.objectContaining({ taskId: 'task-1' })]
      })
    );
  });
});
