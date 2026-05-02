import { describe, expect, it } from 'vitest';

import {
  buildCriticalPathSummary,
  buildTraceView,
  buildTraceWaterfallRows
} from '@/pages/runtime-overview/components/runtime-queue-section';

describe('runtime-queue-section trace view', () => {
  it('会根据 parentSpanId 计算层级并补充父节点名称', () => {
    const traces = buildTraceView([
      {
        node: 'route',
        at: '2026-03-28T10:00:00.000Z',
        summary: '吏部完成路由。',
        spanId: 'span-route',
        role: 'ministry',
        status: 'success',
        latencyMs: 42
      },
      {
        node: 'research',
        at: '2026-03-28T10:00:01.000Z',
        summary: '户部开始检索。',
        spanId: 'span-research',
        parentSpanId: 'span-route',
        role: 'support',
        specialistId: 'growth-marketing',
        status: 'success',
        latencyMs: 128
      },
      {
        node: 'review',
        at: '2026-03-28T10:00:02.000Z',
        summary: '刑部终审。',
        spanId: 'span-review',
        parentSpanId: 'span-research',
        role: 'ministry',
        status: 'success',
        latencyMs: 256,
        isFallback: true,
        fallbackReason: 'provider_timeout'
      }
    ]);

    expect(traces).toEqual([
      expect.objectContaining({
        node: 'route',
        depth: 0,
        parentNode: undefined
      }),
      expect.objectContaining({
        node: 'research',
        depth: 1,
        parentNode: 'route'
      }),
      expect.objectContaining({
        node: 'review',
        depth: 2,
        parentNode: 'research',
        isFallback: true,
        fallbackReason: 'provider_timeout'
      })
    ]);
  });

  it('会生成瀑布视图所需的偏移和宽度', () => {
    const rows = buildTraceWaterfallRows([
      {
        node: 'route',
        at: '2026-03-28T10:00:00.000Z',
        summary: '吏部完成路由。',
        spanId: 'span-route',
        role: 'ministry',
        latencyMs: 40
      },
      {
        node: 'review',
        at: '2026-03-28T10:00:02.000Z',
        summary: '刑部完成复审。',
        spanId: 'span-review',
        parentSpanId: 'span-route',
        role: 'support',
        latencyMs: 200
      }
    ]);

    expect(rows[0]).toEqual(
      expect.objectContaining({
        chainLabel: 'root',
        offsetPercent: 0
      })
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        chainLabel: 'depth 1'
      })
    );
    expect(rows[1]?.widthPercent ?? 0).toBeGreaterThan(rows[0]?.widthPercent ?? 0);
  });

  it('会生成关键路径摘要', () => {
    const summary = buildCriticalPathSummary([
      {
        node: 'route',
        at: '2026-03-28T10:00:00.000Z',
        summary: '吏部完成路由。',
        spanId: 'span-route',
        role: 'ministry',
        latencyMs: 40
      },
      {
        node: 'research',
        at: '2026-03-28T10:00:01.000Z',
        summary: '户部开始检索。',
        spanId: 'span-research',
        parentSpanId: 'span-route',
        role: 'support',
        latencyMs: 120
      },
      {
        node: 'review',
        at: '2026-03-28T10:00:02.000Z',
        summary: '刑部复审。',
        spanId: 'span-review',
        parentSpanId: 'span-research',
        role: 'ministry',
        latencyMs: 260,
        isFallback: true
      }
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        pathLabel: 'route -> research -> review',
        totalLatencyMs: 420,
        slowestNode: 'review',
        fallbackNodes: ['review']
      })
    );
  });
});
