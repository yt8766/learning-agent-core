import { describe, expect, it } from 'vitest';

import { buildRunTimeline } from '../src/runtime-observability/run-timeline-projection';
import { resolveRunStage } from '../src/runtime-observability/run-stage-semantics';

describe('run-timeline-projection', () => {
  describe('resolveRunStage', () => {
    it('returns direct stage when valid', () => {
      expect(resolveRunStage({ stage: 'research' })).toBe('research');
      expect(resolveRunStage({ stage: 'execution' })).toBe('execution');
      expect(resolveRunStage({ stage: 'review' })).toBe('review');
      expect(resolveRunStage({ stage: 'plan' })).toBe('plan');
      expect(resolveRunStage({ stage: 'route' })).toBe('route');
      expect(resolveRunStage({ stage: 'delivery' })).toBe('delivery');
      expect(resolveRunStage({ stage: 'interrupt' })).toBe('interrupt');
      expect(resolveRunStage({ stage: 'recover' })).toBe('recover');
      expect(resolveRunStage({ stage: 'learning' })).toBe('learning');
    });

    it('falls back to keyword matching on currentNode', () => {
      expect(resolveRunStage({ currentNode: 'approval_gate' })).toBe('interrupt');
      expect(resolveRunStage({ currentNode: 'research_phase' })).toBe('research');
      expect(resolveRunStage({ currentNode: 'execute_tool' })).toBe('execution');
      expect(resolveRunStage({ currentNode: 'review_node' })).toBe('review');
    });

    it('falls back to currentStep keyword matching', () => {
      expect(resolveRunStage({ currentStep: 'hubu-search' })).toBe('research');
      expect(resolveRunStage({ currentStep: 'gongbu-code' })).toBe('execution');
    });

    it('falls back to currentMinistry keyword matching', () => {
      expect(resolveRunStage({ currentMinistry: 'hubu-search' })).toBe('research');
      expect(resolveRunStage({ currentMinistry: 'gongbu-code' })).toBe('execution');
      expect(resolveRunStage({ currentMinistry: 'xingbu-review' })).toBe('review');
    });

    it('returns execution as default when nothing matches', () => {
      expect(resolveRunStage({})).toBe('execution');
    });
  });

  describe('buildRunTimeline', () => {
    const makeTask = (overrides = {}) =>
      ({
        id: 'task-1',
        goal: 'test goal',
        status: 'running',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T01:00:00.000Z',
        ...overrides
      }) as any;

    it('builds timeline from traces', () => {
      const traces = [
        {
          stage: 'research' as const,
          status: 'completed' as const,
          summary: 'Research done',
          spanId: 'span-1',
          startedAt: '2026-04-16T00:00:00.000Z',
          endedAt: '2026-04-16T00:10:00.000Z',
          latencyMs: 600000
        },
        {
          stage: 'execution' as const,
          status: 'completed' as const,
          summary: 'Exec done',
          spanId: 'span-2',
          startedAt: '2026-04-16T00:10:00.000Z',
          endedAt: '2026-04-16T00:20:00.000Z',
          latencyMs: 600000
        }
      ];

      const timeline = buildRunTimeline(makeTask(), traces, []);
      expect(timeline).toHaveLength(2);
      expect(timeline[0].stage).toBe('research');
      expect(timeline[0].status).toBe('completed');
      expect(timeline[0].title).toBe('户部研究');
      expect(timeline[1].stage).toBe('execution');
    });

    it('merges duplicate stage traces', () => {
      const traces = [
        {
          stage: 'execution' as const,
          status: 'completed' as const,
          summary: 'First exec',
          spanId: 'span-1',
          startedAt: '2026-04-16T00:00:00.000Z',
          endedAt: '2026-04-16T00:05:00.000Z',
          latencyMs: 300000
        },
        {
          stage: 'execution' as const,
          status: 'failed' as const,
          summary: 'Second exec failed',
          spanId: 'span-2',
          startedAt: '2026-04-16T00:05:00.000Z',
          endedAt: '2026-04-16T00:10:00.000Z',
          latencyMs: 300000
        }
      ];

      const timeline = buildRunTimeline(makeTask(), traces, []);
      expect(timeline).toHaveLength(1);
      expect(timeline[0].status).toBe('failed');
      expect(timeline[0].durationMs).toBe(600000);
      expect(timeline[0].linkedSpanIds).toEqual(['span-1', 'span-2']);
    });

    it('adds interrupt item when interrupts present', () => {
      const traces = [
        {
          stage: 'execution' as const,
          status: 'completed' as const,
          summary: 'Done',
          spanId: 'span-1',
          startedAt: '2026-04-16T00:00:00.000Z',
          endedAt: '2026-04-16T00:10:00.000Z',
          latencyMs: 600000
        }
      ];
      const interrupts = [
        {
          id: 'int-1',
          status: 'resolved',
          summary: 'Approval resolved',
          createdAt: '2026-04-16T00:05:00.000Z',
          resolvedAt: '2026-04-16T00:08:00.000Z'
        }
      ];

      const timeline = buildRunTimeline(makeTask(), traces, interrupts as any);
      expect(timeline).toHaveLength(2);
      const interruptItem = timeline.find(t => t.stage === 'interrupt');
      expect(interruptItem).toBeDefined();
      expect(interruptItem!.status).toBe('completed');
    });

    it('marks pending interrupt as blocked', () => {
      const interrupts = [
        {
          id: 'int-1',
          status: 'pending',
          summary: 'Waiting',
          createdAt: '2026-04-16T00:00:00.000Z'
        }
      ];

      const timeline = buildRunTimeline(makeTask(), [], interrupts as any);
      const interruptItem = timeline.find(t => t.stage === 'interrupt');
      expect(interruptItem!.status).toBe('blocked');
    });

    it('builds fallback timeline from task when no traces', () => {
      const task = makeTask({
        currentNode: 'research',
        currentStep: 'research',
        currentMinistry: 'hubu-search'
      });

      const timeline = buildRunTimeline(task, [], []);
      expect(timeline).toHaveLength(1);
      expect(timeline[0].stage).toBe('research');
      expect(timeline[0].title).toBe('户部研究');
    });

    it('handles failed task status in fallback', () => {
      const task = makeTask({ status: 'failed' });
      const timeline = buildRunTimeline(task, [], []);
      expect(timeline[0].status).toBe('failed');
    });

    it('handles completed task status in fallback', () => {
      const task = makeTask({ status: 'completed' });
      const timeline = buildRunTimeline(task, [], []);
      expect(timeline[0].endedAt).toBeDefined();
    });

    it('sorts timeline items by startedAt', () => {
      const traces = [
        {
          stage: 'execution' as const,
          status: 'completed' as const,
          summary: 'Exec',
          spanId: 'span-1',
          startedAt: '2026-04-16T00:10:00.000Z',
          endedAt: '2026-04-16T00:15:00.000Z',
          latencyMs: 300000
        },
        {
          stage: 'research' as const,
          status: 'completed' as const,
          summary: 'Research',
          spanId: 'span-2',
          startedAt: '2026-04-16T00:00:00.000Z',
          endedAt: '2026-04-16T00:10:00.000Z',
          latencyMs: 600000
        }
      ];

      const timeline = buildRunTimeline(makeTask(), traces, []);
      expect(timeline[0].stage).toBe('research');
      expect(timeline[1].stage).toBe('execution');
    });

    it('handles blocked trace status correctly in merge', () => {
      const traces = [
        {
          stage: 'execution' as const,
          status: 'completed' as const,
          summary: 'First',
          spanId: 'span-1',
          startedAt: '2026-04-16T00:00:00.000Z',
          latencyMs: 100
        },
        {
          stage: 'execution' as const,
          status: 'blocked' as const,
          summary: 'Blocked',
          spanId: 'span-2',
          startedAt: '2026-04-16T00:01:00.000Z',
          latencyMs: 200
        }
      ];

      const timeline = buildRunTimeline(makeTask(), traces, []);
      expect(timeline[0].status).toBe('blocked');
    });
  });
});
