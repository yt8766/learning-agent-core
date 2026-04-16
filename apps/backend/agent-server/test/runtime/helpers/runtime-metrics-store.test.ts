import { describe, expect, it, vi } from 'vitest';

import { ProviderAuditSyncResult } from '../../../src/runtime/helpers/provider-audit';
import {
  summarizeAndPersistEvalHistory,
  summarizeAndPersistUsageAnalytics
} from '../../../src/modules/runtime-metrics/services/runtime-metrics-store';

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
});
