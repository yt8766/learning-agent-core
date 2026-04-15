import type { ToolDefinition } from '@agent/shared';

export interface ExecutionStepRecord<TInput = Record<string, unknown>, TResult = unknown> {
  id: string;
  toolName: string;
  ministry?: string;
  source?: string;
  inputPreview?: TInput;
  streamingEligible: boolean;
  expectedSideEffect: 'none' | 'workspace-write' | 'external-side-effect' | 'governance';
  tool: Pick<
    ToolDefinition,
    'name' | 'isReadOnly' | 'isConcurrencySafe' | 'isDestructive' | 'supportsStreamingDispatch'
  >;
  run: () => Promise<TResult>;
}

export interface StreamingExecutionTask<T> {
  id: string;
  tool: Pick<
    ToolDefinition,
    'name' | 'isReadOnly' | 'isConcurrencySafe' | 'isDestructive' | 'supportsStreamingDispatch'
  >;
  run: () => Promise<T>;
}

export interface StreamingExecutionEvent<T> {
  type: 'tool_stream_detected' | 'tool_stream_dispatched' | 'tool_stream_completed';
  taskId: string;
  toolName: string;
  scheduling: 'concurrent' | 'serial';
  result?: T;
}

export class StreamingToolScheduler {
  async *run<T>(
    tasks: StreamingExecutionTask<T>[],
    options?: {
      shouldContinue?: () => boolean;
      beforeDispatch?: (task: StreamingExecutionTask<T>) => Promise<boolean> | boolean;
    }
  ): AsyncGenerator<StreamingExecutionEvent<T>, T[]> {
    const results: T[] = [];
    const concurrentTasks: StreamingExecutionTask<T>[] = [];

    for (const task of tasks) {
      if (options?.shouldContinue && !options.shouldContinue()) {
        break;
      }
      const scheduling = resolveScheduling(task.tool);
      yield {
        type: 'tool_stream_detected',
        taskId: task.id,
        toolName: task.tool.name,
        scheduling
      };
      if (scheduling === 'concurrent') {
        concurrentTasks.push(task);
        continue;
      }
      if (options?.beforeDispatch) {
        const allowed = await options.beforeDispatch(task);
        if (!allowed) {
          continue;
        }
      }

      yield {
        type: 'tool_stream_dispatched',
        taskId: task.id,
        toolName: task.tool.name,
        scheduling
      };
      const result = await task.run();
      results.push(result);
      yield {
        type: 'tool_stream_completed',
        taskId: task.id,
        toolName: task.tool.name,
        scheduling,
        result
      };
    }

    if (concurrentTasks.length > 0) {
      for (const task of concurrentTasks) {
        if (options?.shouldContinue && !options.shouldContinue()) {
          break;
        }
        if (options?.beforeDispatch) {
          const allowed = await options.beforeDispatch(task);
          if (!allowed) {
            continue;
          }
        }
        yield {
          type: 'tool_stream_dispatched',
          taskId: task.id,
          toolName: task.tool.name,
          scheduling: 'concurrent'
        };
      }
      const settled = await Promise.all(
        concurrentTasks.map(async task => ({
          task,
          result: await task.run()
        }))
      );
      for (const item of settled) {
        results.push(item.result);
        yield {
          type: 'tool_stream_completed',
          taskId: item.task.id,
          toolName: item.task.tool.name,
          scheduling: 'concurrent',
          result: item.result
        };
      }
    }

    return results;
  }
}

export class StreamingExecutionCoordinator {
  constructor(private readonly scheduler = new StreamingToolScheduler()) {}

  async run<T>(
    steps: ExecutionStepRecord<Record<string, unknown>, T>[],
    options?: {
      shouldContinue?: () => boolean;
      allowStep?: (step: ExecutionStepRecord<Record<string, unknown>, T>) => Promise<boolean> | boolean;
    }
  ): Promise<{
    results: T[];
    events: StreamingExecutionEvent<T>[];
    cancelled: boolean;
  }> {
    const tasks: StreamingExecutionTask<T>[] = steps.map(step => ({
      id: step.id,
      tool: step.tool,
      run: step.run
    }));
    const events: StreamingExecutionEvent<T>[] = [];
    const stream = this.scheduler.run(tasks, {
      shouldContinue: options?.shouldContinue,
      beforeDispatch: async task => {
        const step = steps.find(item => item.id === task.id);
        if (!step) {
          return true;
        }
        return options?.allowStep ? await options.allowStep(step) : true;
      }
    });
    for await (const event of stream) {
      events.push(event);
    }
    return {
      results: events
        .filter(
          (event): event is StreamingExecutionEvent<T> & { result: T } =>
            event.type === 'tool_stream_completed' && 'result' in event && event.result !== undefined
        )
        .map(event => event.result),
      events,
      cancelled: Boolean(options?.shouldContinue && !options.shouldContinue())
    };
  }

  async runReadonlyBatch<T>(tasks: StreamingExecutionTask<T>[]): Promise<{
    results: T[];
    events: StreamingExecutionEvent<T>[];
  }> {
    const outcome = await this.run(
      tasks.map(task => ({
        id: task.id,
        toolName: task.tool.name,
        streamingEligible: true,
        expectedSideEffect: 'none',
        tool: task.tool,
        run: task.run
      }))
    );
    return { results: outcome.results, events: outcome.events };
  }
}

export function resolveScheduling(
  tool: Pick<ToolDefinition, 'isReadOnly' | 'isConcurrencySafe' | 'isDestructive' | 'supportsStreamingDispatch'>
): 'concurrent' | 'serial' {
  if (tool.isDestructive) {
    return 'serial';
  }
  return tool.isReadOnly && tool.isConcurrencySafe && tool.supportsStreamingDispatch ? 'concurrent' : 'serial';
}
