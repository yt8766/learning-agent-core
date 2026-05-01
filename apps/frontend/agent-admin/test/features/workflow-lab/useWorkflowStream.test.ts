// apps/frontend/agent-admin/test/features/workflow-lab/useWorkflowStream.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactHarness = vi.hoisted(() => {
  type EffectSlot = {
    cleanup?: () => void;
    deps?: unknown[];
  };

  let stateSlots: unknown[] = [];
  let effectSlots: EffectSlot[] = [];
  let stateCursor = 0;
  let effectCursor = 0;
  let isRendering = false;

  function areDepsEqual(left: unknown[] | undefined, right: unknown[] | undefined) {
    if (!left || !right || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => Object.is(value, right[index]));
  }

  function resetCursors() {
    stateCursor = 0;
    effectCursor = 0;
  }

  return {
    reset() {
      stateSlots = [];
      effectSlots.forEach(slot => slot.cleanup?.());
      effectSlots = [];
      resetCursors();
    },
    beginRender() {
      isRendering = true;
      resetCursors();
    },
    endRender() {
      isRendering = false;
    },
    cleanup() {
      effectSlots.forEach(slot => slot.cleanup?.());
      effectSlots = [];
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      if (!isRendering) {
        throw new Error('useEffect called outside render');
      }

      const index = effectCursor;
      effectCursor += 1;

      const previousSlot = effectSlots[index];
      if (previousSlot && areDepsEqual(previousSlot.deps, deps)) {
        return;
      }

      previousSlot?.cleanup?.();
      const cleanup = effect() ?? undefined;
      effectSlots[index] = { cleanup, deps };
    },
    useState<T>(initialValue: T): [T, (value: T | ((previous: T) => T)) => void] {
      if (!isRendering) {
        throw new Error('useState called outside render');
      }

      const index = stateCursor;
      stateCursor += 1;

      if (stateSlots.length <= index) {
        stateSlots[index] = initialValue;
      }

      return [
        stateSlots[index] as T,
        value => {
          const previous = stateSlots[index] as T;
          stateSlots[index] = typeof value === 'function' ? (value as (previous: T) => T)(previous) : value;
        }
      ];
    }
  };
});

vi.mock('react', () => ({
  useEffect: reactHarness.useEffect,
  useState: reactHarness.useState
}));

import { useWorkflowStream } from '../../../src/features/workflow-lab/hooks/useWorkflowStream';

class MockEventSource {
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  readyState = 0;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;
  static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  close() {
    this.readyState = this.CLOSED;
  }

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    (this.listeners[type] ?? []).forEach(h => h(event));
  }

  emitError() {
    const event = new Event('error');
    this.onerror?.(event);
    (this.listeners.error ?? []).forEach(h => h(event as MessageEvent));
  }
}

function renderUseWorkflowStream(runId: string | null) {
  reactHarness.beginRender();
  const result = useWorkflowStream(runId);
  reactHarness.endRender();

  reactHarness.beginRender();
  const settledResult = useWorkflowStream(runId);
  reactHarness.endRender();

  return result.runStatus === settledResult.runStatus && result.nodes === settledResult.nodes ? result : settledResult;
}

describe('useWorkflowStream', () => {
  beforeEach(() => {
    reactHarness.reset();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  it('starts with empty nodes and idle status', () => {
    const result = renderUseWorkflowStream(null);
    expect(result.nodes).toEqual([]);
    expect(result.runStatus).toBe('idle');
  });

  it('appends nodes when node-complete events arrive', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    es.emit('node-complete', {
      nodeId: 'generateAudio',
      status: 'succeeded',
      durationMs: 12,
      input: {},
      output: {}
    });

    const result = renderUseWorkflowStream('run-123');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].nodeId).toBe('generateAudio');
    expect(result.nodes[0].inputSnapshot).toEqual({});
    expect(result.nodes[0].outputSnapshot).toEqual({});
  });

  it('preserves snapshot fields when stream events already use detail shape', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    es.emit('node-complete', {
      nodeId: 'assembleBundle',
      status: 'succeeded',
      durationMs: 8,
      inputSnapshot: { assetCount: 3 },
      outputSnapshot: { bundleId: 'bundle-1' }
    });

    const result = renderUseWorkflowStream('run-123');
    expect(result.nodes[0].inputSnapshot).toEqual({ assetCount: 3 });
    expect(result.nodes[0].outputSnapshot).toEqual({ bundleId: 'bundle-1' });
  });

  it('sets runStatus to "completed" on run-complete event', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    es.emit('run-complete', { runId: 'run-123', status: 'completed', totalMs: 100 });

    const result = renderUseWorkflowStream('run-123');
    expect(result.runStatus).toBe('completed');
  });

  it('sets runStatus to "failed" and closes the stream when run-complete is not completed', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    es.emit('run-complete', { runId: 'run-123', status: 'failed', totalMs: 100 });

    const result = renderUseWorkflowStream('run-123');
    expect(result.runStatus).toBe('failed');
    expect(es.readyState).toBe(es.CLOSED);
  });

  it('sets runStatus to "failed" and closes the stream on run-error events', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    es.emit('run-error', { runId: 'run-123', message: 'workflow failed' });

    const result = renderUseWorkflowStream('run-123');
    expect(result.runStatus).toBe('failed');
    expect(es.readyState).toBe(es.CLOSED);
  });

  it('sets runStatus to "failed" and closes the stream on EventSource errors', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    es.emitError();

    const result = renderUseWorkflowStream('run-123');
    expect(result.runStatus).toBe('failed');
    expect(es.readyState).toBe(es.CLOSED);
  });

  it('closes the previous stream and resets nodes when runId changes', () => {
    renderUseWorkflowStream('run-123');

    const firstStream = MockEventSource.instances[0];
    firstStream.emit('node-complete', {
      nodeId: 'generateAudio',
      status: 'succeeded',
      durationMs: 12,
      input: {},
      output: {}
    });

    const result = renderUseWorkflowStream('run-456');

    expect(firstStream.readyState).toBe(firstStream.CLOSED);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(result.nodes).toEqual([]);
    expect(result.runStatus).toBe('running');
  });

  it('closes the active stream and resets to idle when runId becomes null', () => {
    renderUseWorkflowStream('run-123');

    const es = MockEventSource.instances[0];
    const result = renderUseWorkflowStream(null);

    expect(es.readyState).toBe(es.CLOSED);
    expect(result.nodes).toEqual([]);
    expect(result.runStatus).toBe('idle');
  });

  it('closes EventSource on unmount', () => {
    renderUseWorkflowStream('run-abc');

    const es = MockEventSource.instances[0];
    reactHarness.cleanup();

    expect(es.readyState).toBe(es.CLOSED);
  });
});
