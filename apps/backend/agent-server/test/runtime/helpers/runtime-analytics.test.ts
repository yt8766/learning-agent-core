import { describe, expect, it } from 'vitest';

import {
  buildModelHeatmap,
  buildTraceAnalytics,
  summarizeUsageAnalytics
} from '../../../src/runtime/helpers/runtime-analytics';

describe('runtime-analytics', () => {
  it('会汇总 usage analytics', () => {
    const analytics = summarizeUsageAnalytics([
      {
        id: 'task-1',
        goal: 'review code',
        currentMinistry: 'gongbu',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:10:00.000Z',
        llmUsage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
          measuredCallCount: 1,
          estimatedCallCount: 0,
          updatedAt: '2026-03-27T09:10:00.000Z',
          models: [
            {
              model: 'glm-5',
              totalTokens: 300,
              callCount: 1,
              costUsd: 0.6,
              costCny: 4.32,
              pricingSource: 'provider'
            }
          ]
        }
      } as any
    ]);

    expect(analytics.totalEstimatedTokens).toBe(300);
    expect(analytics.providerMeasuredCostUsd).toBe(0.6);
    expect(analytics.daily).toEqual(expect.arrayContaining([expect.objectContaining({ runs: 1, tokens: 300 })]));
  });

  it('会生成六部模型热力图', () => {
    const heatmap = buildModelHeatmap([
      {
        id: 'task-1',
        status: 'completed',
        currentMinistry: 'hubu',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:10:00.000Z',
        retryCount: 1,
        llmUsage: { models: [{ costUsd: 0.2 }] },
        modelRoute: [{ ministry: 'hubu', selectedModel: 'glm-5' }]
      } as any
    ]);

    expect(heatmap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ministry: 'hubu-search',
          model: 'glm-5',
          successRate: 1
        })
      ])
    );
  });

  it('会生成关键路径和 fallback/revise 摘要', () => {
    const analytics = buildTraceAnalytics([
      { node: 'route', at: '2026-03-27T09:00:00.000Z', summary: 'route', spanId: '1', latencyMs: 50, role: 'lead' },
      {
        node: 'research',
        at: '2026-03-27T09:00:01.000Z',
        summary: 'research',
        spanId: '2',
        parentSpanId: '1',
        latencyMs: 120,
        role: 'support'
      },
      {
        node: 'manager_replan',
        at: '2026-03-27T09:00:02.000Z',
        summary: 'retry requested',
        spanId: '3',
        parentSpanId: '2',
        latencyMs: 30,
        revisionCount: 1,
        isFallback: true,
        role: 'ministry'
      }
    ]);

    expect(analytics.criticalPaths[0]).toEqual(
      expect.objectContaining({
        pathLabel: 'route -> research -> manager_replan',
        totalLatencyMs: 200
      })
    );
    expect(analytics.fallbackSpans).toEqual(['manager_replan']);
    expect(analytics.reviseSpans).toEqual(['manager_replan']);
    expect(analytics.slowestSpan).toEqual({ node: 'research', latencyMs: 120 });
  });
});
