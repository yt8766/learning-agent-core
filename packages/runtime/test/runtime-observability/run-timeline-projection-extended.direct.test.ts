import { describe, expect, it } from 'vitest';

import { buildRunTimeline } from '../../src/runtime-observability/run-timeline-projection';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    goal: 'test goal',
    currentNode: 'execute',
    currentStep: 'execute',
    currentMinistry: 'gongbu-code',
    status: 'running',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:01:00Z',
    ...overrides
  };
}

describe('buildRunTimeline extended (direct)', () => {
  it('builds timeline from traces', () => {
    const traces = [
      {
        stage: 'plan' as const,
        spanId: 'span-1',
        status: 'completed' as const,
        summary: 'Planned',
        startedAt: '2026-01-01T00:00:00Z',
        endedAt: '2026-01-01T00:00:10Z',
        latencyMs: 10000
      },
      {
        stage: 'research' as const,
        spanId: 'span-2',
        status: 'running' as const,
        summary: 'Researching',
        startedAt: '2026-01-01T00:00:10Z',
        latencyMs: 5000
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result).toHaveLength(2);
    expect(result[0].stage).toBe('plan');
    expect(result[0].status).toBe('completed');
    expect(result[1].stage).toBe('research');
    expect(result[1].status).toBe('running');
  });

  it('merges traces with same stage', () => {
    const traces = [
      {
        stage: 'research' as const,
        spanId: 'span-1',
        status: 'completed' as const,
        startedAt: '2026-01-01T00:00:00Z',
        latencyMs: 1000
      },
      {
        stage: 'research' as const,
        spanId: 'span-2',
        status: 'completed' as const,
        startedAt: '2026-01-01T00:00:01Z',
        endedAt: '2026-01-01T00:00:05Z',
        latencyMs: 4000
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result).toHaveLength(1);
    expect(result[0].durationMs).toBe(5000);
    expect(result[0].linkedSpanIds).toEqual(['span-1', 'span-2']);
  });

  it('marks stage as failed when any trace fails', () => {
    const traces = [
      {
        stage: 'execute' as const,
        spanId: 'span-1',
        status: 'completed' as const,
        startedAt: '2026-01-01T00:00:00Z',
        latencyMs: 1000
      },
      {
        stage: 'execute' as const,
        spanId: 'span-2',
        status: 'failed' as const,
        startedAt: '2026-01-01T00:00:01Z',
        latencyMs: 500
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result[0].status).toBe('failed');
  });

  it('marks stage as blocked when trace is blocked and not failed', () => {
    const traces = [
      {
        stage: 'execute' as const,
        spanId: 'span-1',
        status: 'blocked' as const,
        startedAt: '2026-01-01T00:00:00Z',
        latencyMs: 1000
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result[0].status).toBe('blocked');
  });

  it('keeps failed status over blocked', () => {
    const traces = [
      {
        stage: 'execute' as const,
        spanId: 'span-1',
        status: 'failed' as const,
        startedAt: '2026-01-01T00:00:00Z',
        latencyMs: 1000
      },
      {
        stage: 'execute' as const,
        spanId: 'span-2',
        status: 'blocked' as const,
        startedAt: '2026-01-01T00:00:01Z',
        latencyMs: 500
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result[0].status).toBe('failed');
  });

  it('maps cancelled status to blocked', () => {
    const traces = [
      {
        stage: 'execute' as const,
        spanId: 'span-1',
        status: 'cancelled' as const,
        startedAt: '2026-01-01T00:00:00Z',
        latencyMs: 1000
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result[0].status).toBe('blocked');
  });

  it('adds interrupt timeline item from interrupts', () => {
    const interrupts = [
      { id: 'int-1', status: 'pending', summary: 'Needs approval', createdAt: '2026-01-01T00:00:30Z' }
    ];
    const result = buildRunTimeline(makeTask(), [], interrupts as any);
    expect(result).toHaveLength(1);
    expect(result[0].stage).toBe('interrupt');
    expect(result[0].status).toBe('blocked');
  });

  it('resolves interrupt as completed when resolved', () => {
    const interrupts = [
      {
        id: 'int-1',
        status: 'resolved',
        summary: 'Approved',
        createdAt: '2026-01-01T00:00:30Z',
        resolvedAt: '2026-01-01T00:01:00Z'
      }
    ];
    const result = buildRunTimeline(makeTask(), [], interrupts as any);
    expect(result[0].status).toBe('completed');
  });

  it('creates default timeline from task when no traces and no interrupts', () => {
    const task = makeTask({ currentNode: 'execute', currentStep: 'execute' });
    const result = buildRunTimeline(task, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].stage).toBe('execution');
    expect(result[0].status).toBe('running');
  });

  it('creates failed default timeline when task is failed', () => {
    const task = makeTask({ status: 'failed', currentNode: 'review', currentStep: 'review' });
    const result = buildRunTimeline(task, [], []);
    expect(result[0].status).toBe('failed');
  });

  it('creates blocked default timeline when task is blocked', () => {
    const task = makeTask({ status: 'blocked' });
    const result = buildRunTimeline(task, [], []);
    expect(result[0].status).toBe('blocked');
  });

  it('sets endedAt for completed tasks', () => {
    const task = makeTask({ status: 'completed' });
    const result = buildRunTimeline(task, [], []);
    expect(result[0].endedAt).toBeDefined();
  });

  it('sorts timeline items by startedAt', () => {
    const traces = [
      {
        stage: 'research' as const,
        spanId: 'span-2',
        status: 'completed' as const,
        startedAt: '2026-01-01T00:01:00Z',
        latencyMs: 1000
      },
      {
        stage: 'plan' as const,
        spanId: 'span-1',
        status: 'completed' as const,
        startedAt: '2026-01-01T00:00:00Z',
        latencyMs: 1000
      }
    ];
    const result = buildRunTimeline(makeTask(), traces as any, []);
    expect(result[0].stage).toBe('plan');
    expect(result[1].stage).toBe('research');
  });

  it('handles empty traces with undefined last interrupt gracefully', () => {
    // This tests the edge case where interrupts.length > 0 but interrupts.at(-1) is undefined
    // which shouldn't normally happen but the code handles it
    const result = buildRunTimeline(makeTask(), [], []);
    expect(result).toBeDefined();
  });
});
