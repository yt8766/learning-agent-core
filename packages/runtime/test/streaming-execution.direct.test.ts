import { describe, expect, it } from 'vitest';

import {
  resolveScheduling,
  StreamingToolScheduler,
  StreamingExecutionCoordinator
} from '../src/runtime/streaming-execution';

function makeTool(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    ...overrides
  };
}

describe('streaming-execution (direct)', () => {
  describe('resolveScheduling', () => {
    it('returns serial for destructive tool', () => {
      expect(resolveScheduling(makeTool({ isDestructive: true }))).toBe('serial');
    });

    it('returns concurrent when readonly, concurrency-safe, and supports streaming', () => {
      expect(resolveScheduling(makeTool())).toBe('concurrent');
    });

    it('returns serial when not readonly', () => {
      expect(resolveScheduling(makeTool({ isReadOnly: false }))).toBe('serial');
    });

    it('returns serial when not concurrency-safe', () => {
      expect(resolveScheduling(makeTool({ isConcurrencySafe: false }))).toBe('serial');
    });

    it('returns serial when does not support streaming dispatch', () => {
      expect(resolveScheduling(makeTool({ supportsStreamingDispatch: false }))).toBe('serial');
    });
  });

  describe('StreamingToolScheduler', () => {
    it('runs serial task and yields events', async () => {
      const scheduler = new StreamingToolScheduler();
      const task = {
        id: 't1',
        tool: makeTool({ isConcurrencySafe: false }),
        run: async () => 'result-1'
      };

      const events: any[] = [];
      const stream = scheduler.run([task]);
      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('tool_stream_detected');
      expect(events[0].scheduling).toBe('serial');
      expect(events[1].type).toBe('tool_stream_dispatched');
      expect(events[2].type).toBe('tool_stream_completed');
      expect(events[2].result).toBe('result-1');
    });

    it('runs concurrent tasks and yields events', async () => {
      const scheduler = new StreamingToolScheduler();
      const tasks = [
        { id: 't1', tool: makeTool(), run: async () => 'r1' },
        { id: 't2', tool: makeTool(), run: async () => 'r2' }
      ];

      const events: any[] = [];
      const stream = scheduler.run(tasks);
      for await (const event of stream) {
        events.push(event);
      }

      // 2 detected + 2 dispatched + 2 completed = 6
      expect(events).toHaveLength(6);
      expect(events.filter(e => e.type === 'tool_stream_detected')).toHaveLength(2);
      expect(events.filter(e => e.type === 'tool_stream_dispatched')).toHaveLength(2);
      expect(events.filter(e => e.type === 'tool_stream_completed')).toHaveLength(2);
    });

    it('respects shouldContinue callback', async () => {
      const scheduler = new StreamingToolScheduler();
      let callCount = 0;
      const tasks = [
        {
          id: 't1',
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => {
            callCount++;
            return 'r1';
          }
        },
        {
          id: 't2',
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => {
            callCount++;
            return 'r2';
          }
        }
      ];

      const results: any[] = [];
      const stream = scheduler.run(tasks, { shouldContinue: () => callCount < 1 });
      for await (const event of stream) {
        if (event.type === 'tool_stream_completed') {
          results.push(event.result);
        }
      }

      expect(results).toHaveLength(1);
    });

    it('respects beforeDispatch callback for serial tasks', async () => {
      const scheduler = new StreamingToolScheduler();
      const tasks = [
        { id: 't1', tool: makeTool({ isConcurrencySafe: false }), run: async () => 'r1' },
        { id: 't2', tool: makeTool({ isConcurrencySafe: false }), run: async () => 'r2' }
      ];

      const results: any[] = [];
      const stream = scheduler.run(tasks, {
        beforeDispatch: task => task.id === 't1'
      });
      for await (const event of stream) {
        if (event.type === 'tool_stream_completed') {
          results.push(event.result);
        }
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('r1');
    });

    it('beforeDispatch for concurrent tasks filters dispatch events but all run via Promise.all', async () => {
      const scheduler = new StreamingToolScheduler();
      const tasks = [
        { id: 't1', tool: makeTool(), run: async () => 'r1' },
        { id: 't2', tool: makeTool(), run: async () => 'r2' }
      ];

      // For concurrent tasks, beforeDispatch filters dispatch events but
      // all tasks in concurrentTasks still run via Promise.all.
      // Only t1 gets a dispatch event, but both complete.
      const dispatched: string[] = [];
      const stream = scheduler.run(tasks, {
        beforeDispatch: task => {
          dispatched.push(task.id);
          return task.id === 't1';
        }
      });
      const events: any[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      const dispatchEvents = events.filter(e => e.type === 'tool_stream_dispatched');
      expect(dispatchEvents).toHaveLength(1);
      expect(dispatchEvents[0].taskId).toBe('t1');
      // Both tasks still complete since Promise.all runs all concurrentTasks
      const completedEvents = events.filter(e => e.type === 'tool_stream_completed');
      expect(completedEvents).toHaveLength(2);
    });

    it('returns empty results for empty tasks', async () => {
      const scheduler = new StreamingToolScheduler();
      const results: any[] = [];
      const stream = scheduler.run([]);
      for await (const event of stream) {
        results.push(event);
      }
      expect(results).toHaveLength(0);
    });
  });

  describe('StreamingExecutionCoordinator', () => {
    it('runs steps and collects results', async () => {
      const coordinator = new StreamingExecutionCoordinator();
      const steps = [
        {
          id: 's1',
          toolName: 't1',
          streamingEligible: true,
          expectedSideEffect: 'none' as const,
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => 42
        }
      ];

      const outcome = await coordinator.run(steps);
      expect(outcome.results).toEqual([42]);
      expect(outcome.cancelled).toBe(false);
      expect(outcome.events.length).toBeGreaterThan(0);
    });

    it('respects shouldContinue option', async () => {
      const coordinator = new StreamingExecutionCoordinator();
      const steps = [
        {
          id: 's1',
          toolName: 't1',
          streamingEligible: true,
          expectedSideEffect: 'none' as const,
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => 'r1'
        },
        {
          id: 's2',
          toolName: 't2',
          streamingEligible: true,
          expectedSideEffect: 'none' as const,
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => 'r2'
        }
      ];

      let callCount = 0;
      const outcome = await coordinator.run(steps, {
        shouldContinue: () => callCount++ < 1
      });
      expect(outcome.results).toHaveLength(1);
      expect(outcome.cancelled).toBe(true);
    });

    it('respects allowStep option', async () => {
      const coordinator = new StreamingExecutionCoordinator();
      const steps = [
        {
          id: 's1',
          toolName: 't1',
          streamingEligible: true,
          expectedSideEffect: 'none' as const,
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => 'r1'
        },
        {
          id: 's2',
          toolName: 't2',
          streamingEligible: true,
          expectedSideEffect: 'none' as const,
          tool: makeTool({ isConcurrencySafe: false }),
          run: async () => 'r2'
        }
      ];

      const outcome = await coordinator.run(steps, {
        allowStep: step => step.id === 's1'
      });
      expect(outcome.results).toEqual(['r1']);
    });

    it('runReadonlyBatch runs tasks and returns results', async () => {
      const coordinator = new StreamingExecutionCoordinator();
      const tasks = [
        { id: 't1', tool: makeTool(), run: async () => 'a' },
        { id: 't2', tool: makeTool(), run: async () => 'b' }
      ];

      const outcome = await coordinator.runReadonlyBatch(tasks);
      expect(outcome.results).toHaveLength(2);
      expect(outcome.events.length).toBeGreaterThan(0);
    });

    it('handles empty steps', async () => {
      const coordinator = new StreamingExecutionCoordinator();
      const outcome = await coordinator.run([]);
      expect(outcome.results).toEqual([]);
      expect(outcome.cancelled).toBe(false);
    });
  });
});
