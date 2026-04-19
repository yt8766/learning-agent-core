import { describe, expect, it, vi } from 'vitest';

import { ProviderAuditSyncResult } from '../../../src/runtime/helpers/provider-audit';
import {
  readPersistedEvalHistory,
  readPersistedUsageAnalytics,
  summarizeAndPersistEvalHistory,
  summarizeAndPersistUsageAnalytics
} from '@agent/runtime';

describe('runtime-metrics-store', () => {
  it('会持久化 usage analytics', async () => {
    let snapshot: any = { usageHistory: [], usageAudit: [] };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async next => {
        snapshot = next;
      })
    };

    const result = await summarizeAndPersistUsageAnalytics({
      runtimeStateRepository,
      tasks: [
        {
          id: 'task-1',
          goal: 'review code',
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:10:00.000Z',
          llmUsage: {
            totalTokens: 300,
            promptTokens: 100,
            completionTokens: 200,
            measuredCallCount: 1,
            estimatedCallCount: 0,
            updatedAt: '2026-03-27T09:10:00.000Z',
            models: [
              { model: 'glm-5', totalTokens: 300, callCount: 1, costUsd: 0.6, costCny: 4.32, pricingSource: 'provider' }
            ]
          }
        } as any
      ],
      days: 7,
      fetchProviderUsageAudit: vi.fn(
        async (): Promise<ProviderAuditSyncResult> => ({
          status: 'configured',
          provider: 'zhipu',
          source: 'test',
          daily: []
        })
      )
    });

    expect(snapshot.usageHistory).toHaveLength(1);
    expect(snapshot.usageAudit).toHaveLength(1);
    expect(result.totalEstimatedTokens).toBe(300);
  });

  it('会持久化 eval history', async () => {
    let snapshot: any = { evalHistory: [] };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async next => {
        snapshot = next;
      })
    };

    const result = await summarizeAndPersistEvalHistory({
      runtimeStateRepository,
      tasks: [
        {
          id: 'task-1',
          goal: 'review code',
          skillId: 'review',
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:10:00.000Z',
          trace: [{ node: 'review' }],
          approvals: [],
          externalSources: [],
          reusedMemories: []
        } as any
      ],
      days: 7
    });

    expect(snapshot.evalHistory).toHaveLength(1);
    expect(result.historyDays).toBe(1);
  });

  it('会优先读取已持久化的 usage analytics 快照而不触发保存', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({
        usageHistory: [
          {
            day: '2026-03-27',
            tokens: 300,
            costUsd: 0.6,
            costCny: 4.32,
            runs: 1,
            updatedAt: '2026-03-27T09:10:00.000Z'
          }
        ],
        usageAudit: [
          {
            taskId: 'task-1',
            day: '2026-03-27',
            totalTokens: 300,
            totalCostUsd: 0.6,
            totalCostCny: 4.32,
            measuredCallCount: 1,
            estimatedCallCount: 0,
            updatedAt: '2026-03-27T09:10:00.000Z',
            modelBreakdown: [
              {
                model: 'glm-5',
                totalTokens: 300,
                costUsd: 0.6,
                costCny: 4.32,
                pricingSource: 'provider',
                callCount: 1
              }
            ]
          }
        ]
      })),
      save: vi.fn(async () => undefined)
    };

    const result = await readPersistedUsageAnalytics({
      runtimeStateRepository,
      tasks: [
        {
          id: 'task-1',
          goal: 'review code',
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:10:00.000Z',
          llmUsage: {
            totalTokens: 300,
            promptTokens: 100,
            completionTokens: 200,
            measuredCallCount: 1,
            estimatedCallCount: 0,
            updatedAt: '2026-03-27T09:10:00.000Z',
            models: [
              { model: 'glm-5', totalTokens: 300, callCount: 1, costUsd: 0.6, costCny: 4.32, pricingSource: 'provider' }
            ]
          }
        } as any
      ],
      days: 7,
      filters: {
        model: 'glm-5',
        pricingSource: 'provider'
      }
    });

    expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    expect(result.persistedDailyHistory).toEqual([
      expect.objectContaining({
        day: '2026-03-27',
        tokens: 300
      })
    ]);
    expect(result.recentUsageAudit).toEqual([
      expect.objectContaining({
        taskId: 'task-1'
      })
    ]);
    expect(result.providerBillingStatus).toEqual(
      expect.objectContaining({
        status: 'configured',
        source: 'snapshot-read'
      })
    );
  });

  it('会优先读取已持久化的 eval history 快照而不触发保存', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({
        evalHistory: [
          {
            day: '2026-03-27',
            runCount: 1,
            passCount: 1,
            passRate: 100,
            scenarioCount: 1,
            overallPassRate: 100,
            updatedAt: '2026-03-27T09:10:00.000Z'
          }
        ]
      })),
      save: vi.fn(async () => undefined)
    };

    const result = await readPersistedEvalHistory({
      runtimeStateRepository,
      tasks: [
        {
          id: 'task-1',
          goal: 'review code',
          skillId: 'review',
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:10:00.000Z',
          trace: [{ node: 'review' }],
          approvals: [],
          externalSources: [],
          reusedMemories: []
        } as any
      ],
      days: 7
    });

    expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    expect(result.persistedDailyHistory).toEqual([
      expect.objectContaining({
        day: '2026-03-27',
        runCount: 1,
        passCount: 1
      })
    ]);
    expect(result.historyDays).toBe(1);
  });
});
