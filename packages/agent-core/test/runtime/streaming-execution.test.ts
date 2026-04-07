import { describe, expect, it, vi } from 'vitest';

import {
  resolveScheduling,
  StreamingExecutionCoordinator,
  StreamingToolScheduler
} from '../../src/runtime/streaming-execution';

describe('StreamingToolScheduler', () => {
  it('runs readonly concurrency-safe tasks as concurrent work', async () => {
    const scheduler = new StreamingToolScheduler();
    const stream = scheduler.run([
      {
        id: 'read-a',
        tool: {
          name: 'read_local_file',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => 'A'
      },
      {
        id: 'read-b',
        tool: {
          name: 'search_in_files',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => 'B'
      }
    ]);

    const events: string[] = [];
    for await (const event of stream) {
      events.push(`${event.type}:${event.toolName}:${event.scheduling}`);
    }

    expect(events).toContain('tool_stream_detected:read_local_file:concurrent');
    expect(events).toContain('tool_stream_completed:search_in_files:concurrent');
  });

  it('forces destructive or write tasks into serial scheduling', () => {
    expect(
      resolveScheduling({
        isReadOnly: false,
        isConcurrencySafe: true,
        isDestructive: false,
        supportsStreamingDispatch: true
      })
    ).toBe('serial');
    expect(
      resolveScheduling({
        isReadOnly: true,
        isConcurrencySafe: true,
        isDestructive: true,
        supportsStreamingDispatch: true
      })
    ).toBe('serial');
    expect(
      resolveScheduling({
        isReadOnly: true,
        isConcurrencySafe: true,
        isDestructive: false,
        supportsStreamingDispatch: false
      })
    ).toBe('serial');
  });

  it('skips blocked tasks and stops when shouldContinue flips to false', async () => {
    const scheduler = new StreamingToolScheduler();
    const beforeDispatch = vi.fn(async task => task.id !== 'skip-me');
    let continueChecks = 0;
    const shouldContinue = vi.fn(() => {
      continueChecks += 1;
      return continueChecks < 4;
    });

    const stream = scheduler.run(
      [
        {
          id: 'serial-a',
          tool: {
            name: 'write_file',
            isReadOnly: false,
            isConcurrencySafe: false,
            isDestructive: false,
            supportsStreamingDispatch: false
          },
          run: async () => 'serial-a'
        },
        {
          id: 'skip-me',
          tool: {
            name: 'search_in_files',
            isReadOnly: true,
            isConcurrencySafe: true,
            isDestructive: false,
            supportsStreamingDispatch: true
          },
          run: async () => 'skip-me'
        },
        {
          id: 'concurrent-b',
          tool: {
            name: 'read_local_file',
            isReadOnly: true,
            isConcurrencySafe: true,
            isDestructive: false,
            supportsStreamingDispatch: true
          },
          run: async () => 'concurrent-b'
        },
        {
          id: 'never-reached',
          tool: {
            name: 'read_remote_file',
            isReadOnly: true,
            isConcurrencySafe: true,
            isDestructive: false,
            supportsStreamingDispatch: true
          },
          run: async () => 'never-reached'
        }
      ],
      { shouldContinue, beforeDispatch }
    );

    const events: string[] = [];
    const results: string[] = [];
    for await (const event of stream) {
      events.push(`${event.type}:${event.taskId}:${event.scheduling}`);
      if (event.result) {
        results.push(event.result);
      }
    }

    expect(beforeDispatch).toHaveBeenCalledTimes(1);
    expect(beforeDispatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'serial-a' }));
    expect(events).toContain('tool_stream_detected:serial-a:serial');
    expect(events).toContain('tool_stream_completed:serial-a:serial');
    expect(events).toContain('tool_stream_detected:skip-me:concurrent');
    expect(events).not.toContain('tool_stream_dispatched:skip-me:concurrent');
    expect(events).not.toContain('tool_stream_detected:never-reached:concurrent');
    expect(results).toEqual(['serial-a', 'skip-me', 'concurrent-b']);
  });

  it('collects coordinator events, respects allowStep, and reports cancellation state', async () => {
    const coordinator = new StreamingExecutionCoordinator();
    const allowStep = vi.fn(async step => step.id !== 'blocked-step');
    let continueChecks = 0;
    const shouldContinue = vi.fn(() => {
      continueChecks += 1;
      return continueChecks < 10;
    });

    const outcome = await coordinator.run(
      [
        {
          id: 'serial-step',
          toolName: 'write_file',
          streamingEligible: false,
          expectedSideEffect: 'workspace-write',
          tool: {
            name: 'write_file',
            isReadOnly: false,
            isConcurrencySafe: false,
            isDestructive: false,
            supportsStreamingDispatch: false
          },
          run: async () => 'serial-result'
        },
        {
          id: 'blocked-step',
          toolName: 'search_in_files',
          streamingEligible: true,
          expectedSideEffect: 'none',
          tool: {
            name: 'search_in_files',
            isReadOnly: true,
            isConcurrencySafe: true,
            isDestructive: false,
            supportsStreamingDispatch: true
          },
          run: async () => 'blocked-result'
        },
        {
          id: 'concurrent-step',
          toolName: 'read_file',
          streamingEligible: true,
          expectedSideEffect: 'none',
          tool: {
            name: 'read_file',
            isReadOnly: true,
            isConcurrencySafe: true,
            isDestructive: false,
            supportsStreamingDispatch: true
          },
          run: async () => 'concurrent-result'
        }
      ],
      { shouldContinue, allowStep }
    );

    expect(allowStep).toHaveBeenCalledWith(expect.objectContaining({ id: 'serial-step' }));
    expect(allowStep).toHaveBeenCalledWith(expect.objectContaining({ id: 'blocked-step' }));
    expect(allowStep).toHaveBeenCalledWith(expect.objectContaining({ id: 'concurrent-step' }));
    expect(outcome.results).toEqual(['serial-result', 'blocked-result', 'concurrent-result']);
    expect(outcome.events.map(event => `${event.type}:${event.taskId}`)).toEqual(
      expect.arrayContaining([
        'tool_stream_detected:serial-step',
        'tool_stream_completed:serial-step',
        'tool_stream_detected:blocked-step',
        'tool_stream_detected:concurrent-step',
        'tool_stream_dispatched:concurrent-step',
        'tool_stream_completed:blocked-step',
        'tool_stream_completed:concurrent-step'
      ])
    );
    expect(outcome.cancelled).toBe(false);
  });

  it('supports readonly batch execution through the coordinator wrapper', async () => {
    const coordinator = new StreamingExecutionCoordinator();

    const outcome = await coordinator.runReadonlyBatch([
      {
        id: 'readonly-a',
        tool: {
          name: 'read_file',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => 'A'
      },
      {
        id: 'readonly-b',
        tool: {
          name: 'read_docs',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: true
        },
        run: async () => 'B'
      }
    ]);

    expect(outcome.results).toEqual(['A', 'B']);
    expect(outcome.events.filter(event => event.type === 'tool_stream_completed')).toHaveLength(2);
  });
});
