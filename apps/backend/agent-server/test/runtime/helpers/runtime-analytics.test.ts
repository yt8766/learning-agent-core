import { describe, expect, it } from 'vitest';

import {
  buildModelHeatmap,
  buildTraceAnalytics,
  formatDay,
  roundCurrency,
  summarizeUsageAnalytics
} from '@agent/platform-runtime';

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

  it('covers estimated usage, alias normalization, budget alerts and invalid dates', () => {
    const analytics = summarizeUsageAnalytics([
      {
        id: 'task-over-budget',
        goal: 'a'.repeat(9000000),
        result: 'b'.repeat(1800000),
        status: 'completed',
        currentMinistry: 'libu',
        createdAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-20T09:10:00.000Z',
        externalSources: [{ summary: 'src' }],
        trace: [{ summary: 'revise requested' }],
        messages: [{ content: 'done' }],
        modelRoute: [{ selectedModel: 'glm-4.7-flashx' }, { selectedModel: 'glm-5' }, { selectedModel: 'glm-5' }]
      },
      {
        id: 'task-measured',
        goal: 'short goal',
        status: 'running',
        currentMinistry: 'xingubu-custom',
        createdAt: 'invalid-date',
        updatedAt: 'invalid-date',
        llmUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          measuredCallCount: 0,
          models: [{ model: '', totalTokens: 30, callCount: 2, pricingSource: 'estimated' }]
        }
      }
    ] as any);

    expect(analytics.measuredRunCount).toBe(0);
    expect(analytics.estimatedRunCount).toBe(2);
    expect(analytics.daily).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: '2026-03-20', overBudget: true }),
        expect.objectContaining({ day: 'unknown' })
      ])
    );
    expect(analytics.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: 'glm-5' }),
        expect.objectContaining({ model: 'glm-4.7-flashx' }),
        expect.objectContaining({ model: 'unknown', runCount: 2 })
      ])
    );
    expect(analytics.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'warning', title: expect.stringContaining('Daily token budget warning') }),
        expect.objectContaining({ level: 'warning', title: expect.stringContaining('Daily cost budget warning') }),
        expect.objectContaining({ level: 'critical', title: 'Total cost approaching budget limit' })
      ])
    );
    expect(formatDay('bad-date')).toBe('unknown');
    expect(roundCurrency(1.23456)).toBe(1.2346);
  });

  it('returns info alert and empty trace analytics when no thresholds are hit', () => {
    const analytics = summarizeUsageAnalytics([
      {
        id: 'task-small',
        goal: 'tiny',
        status: 'completed',
        currentMinistry: 'libu-docs',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:00:10.000Z',
        llmUsage: {
          promptTokens: 2,
          completionTokens: 2,
          totalTokens: 4,
          measuredCallCount: 1,
          models: [{ model: 'glm-4.6', totalTokens: 4, callCount: 1, costUsd: 0.001, pricingSource: 'provider' }]
        }
      }
    ] as any);

    const heatmap = buildModelHeatmap([
      {
        id: 'task-docs',
        status: 'running',
        currentMinistry: 'libu_docs',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:00:20.000Z',
        retryCount: 0,
        llmUsage: { models: [] },
        modelRoute: [{ ministry: 'libu_docs', selectedModel: 'glm-4.6' }]
      },
      {
        id: 'task-review',
        status: 'completed',
        currentMinistry: 'xingbu',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:00:30.000Z',
        retryCount: 2,
        llmUsage: { models: [{ costUsd: 0.4 }] },
        modelRoute: [{ ministry: 'xingbu', selectedModel: 'glm-5' }]
      }
    ] as any);

    expect(analytics.alerts).toEqual([
      expect.objectContaining({
        level: 'info',
        title: 'Budget status normal'
      })
    ]);
    expect(heatmap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ministry: 'libu-delivery',
          model: 'glm-4.6',
          successRate: 0,
          retryRate: 0
        }),
        expect.objectContaining({
          ministry: 'xingbu-review',
          model: 'glm-5',
          successRate: 1,
          retryRate: 2
        })
      ])
    );
    expect(buildTraceAnalytics([])).toEqual({
      criticalPaths: [],
      fallbackSpans: [],
      reviseSpans: [],
      roleLatencyBreakdown: [],
      slowestSpan: undefined
    });
  });
});
