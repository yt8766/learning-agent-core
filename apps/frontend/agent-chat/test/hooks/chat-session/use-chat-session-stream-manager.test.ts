import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createRefSlot<T>(initial: T): { current: T } {
  return { current: initial };
}

describe('useChatSessionStreamManager', () => {
  let refSlots: Array<{ current: unknown }>;
  let refCursor: number;

  beforeEach(() => {
    vi.useFakeTimers();
    refSlots = [];
    refCursor = 0;

    vi.doMock('react', () => ({
      useRef<T>(initial: T) {
        const index = refCursor++;
        if (!(index in refSlots)) {
          refSlots[index] = createRefSlot(initial);
        }
        return refSlots[index] as { current: T };
      }
    }));

    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set(['assistant_message']),
      STREAM_IDLE_TIMEOUT_MS: 1000,
      bindChatSessionStream: vi.fn(),
      createSessionPollingRunner: vi.fn(() => () => undefined),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      isAssistantContentEvent: vi.fn(),
      mergeEvent: vi.fn(),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(),
      shouldShowStreamFallbackError: vi.fn(),
      shouldSkipStopSessionPolling: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(),
      shouldStartDetailPollingAfterStreamError: vi.fn(),
      shouldStopStreamingForEvent: vi.fn(),
      syncCheckpointFromStreamEvent: vi.fn(),
      syncMessageFromEvent: vi.fn(),
      syncProcessMessageFromEvent: vi.fn(),
      syncSessionFromEvent: vi.fn()
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('allocates 7 refs in the correct order', async () => {
    const { useChatSessionStreamManager } = await import('@/hooks/chat-session/use-chat-session-stream-manager');
    const deps = {
      setCheckpoint: vi.fn(),
      setEvents: vi.fn(),
      setMessages: vi.fn(),
      setSessions: vi.fn(),
      setError: vi.fn(),
      checkpointRef: createRefSlot(undefined)
    };

    useChatSessionStreamManager(deps);

    expect(refSlots).toHaveLength(7);
    // checkpointRefreshTimer, checkpointRefreshInFlight, checkpointRefreshQueued
    expect(refSlots[0]!.current).toBeNull();
    expect(refSlots[1]!.current).toBe(false);
    expect(refSlots[2]!.current).toBe(false);
    // sessionDetailPollTimer, pollingSessionRef, pollingModeRef
    expect(refSlots[3]!.current).toBeNull();
    expect(refSlots[4]!.current).toBe('');
    expect(refSlots[5]!.current).toBe('');
    // chatActionsRef
    expect(refSlots[6]!.current).toBeNull();
  });

  it('schedules and flushes a checkpoint refresh via chatActionsRef', async () => {
    const { useChatSessionStreamManager } = await import('@/hooks/chat-session/use-chat-session-stream-manager');
    const deps = {
      setCheckpoint: vi.fn(),
      setEvents: vi.fn(),
      setMessages: vi.fn(),
      setSessions: vi.fn(),
      setError: vi.fn(),
      checkpointRef: createRefSlot(undefined)
    };

    const manager = useChatSessionStreamManager(deps);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue({ sessionId: 's1' });
    manager.setChatActions({
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn(),
      refreshCheckpointOnly,
      hydrateSessionSnapshot: vi.fn()
    });

    manager.scheduleCheckpointRefresh();
    expect(refreshCheckpointOnly).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(220);
    expect(refreshCheckpointOnly).toHaveBeenCalledTimes(1);
  });

  it('queues checkpoint refresh when one is already in flight', async () => {
    const { useChatSessionStreamManager } = await import('@/hooks/chat-session/use-chat-session-stream-manager');
    const deps = {
      setCheckpoint: vi.fn(),
      setEvents: vi.fn(),
      setMessages: vi.fn(),
      setSessions: vi.fn(),
      setError: vi.fn(),
      checkpointRef: createRefSlot(undefined)
    };

    const manager = useChatSessionStreamManager(deps);

    let resolveFirst!: () => void;
    const firstPromise = new Promise<void>(resolve => {
      resolveFirst = resolve;
    });
    const refreshCheckpointOnly = vi.fn().mockReturnValueOnce(firstPromise).mockResolvedValue(undefined);
    manager.setChatActions({
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn(),
      refreshCheckpointOnly,
      hydrateSessionSnapshot: vi.fn()
    });

    // Trigger first flush
    manager.scheduleCheckpointRefresh();
    await vi.advanceTimersByTimeAsync(220);
    expect(refreshCheckpointOnly).toHaveBeenCalledTimes(1);

    // While first is in flight, trigger another
    manager.scheduleCheckpointRefresh();
    await vi.advanceTimersByTimeAsync(220);
    // checkpointRefreshQueued should be true
    expect(refSlots[2]!.current).toBe(true);

    // Resolve first → queued flush fires
    resolveFirst();
    await vi.advanceTimersByTimeAsync(220);
    expect(refreshCheckpointOnly).toHaveBeenCalledTimes(2);
    expect(refSlots[2]!.current).toBe(false);
  });

  it('starts and stops session polling', async () => {
    const { useChatSessionStreamManager } = await import('@/hooks/chat-session/use-chat-session-stream-manager');
    const deps = {
      setCheckpoint: vi.fn(),
      setEvents: vi.fn(),
      setMessages: vi.fn(),
      setSessions: vi.fn(),
      setError: vi.fn(),
      checkpointRef: createRefSlot(undefined)
    };
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const manager = useChatSessionStreamManager(deps);
    manager.setChatActions({
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn(),
      refreshCheckpointOnly: vi.fn(),
      hydrateSessionSnapshot: vi.fn()
    });

    manager.startSessionPolling('session-1', 'checkpoint');
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(refSlots[4]!.current).toBe('session-1');
    expect(refSlots[5]!.current).toBe('checkpoint');

    manager.stopSessionPolling();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(refSlots[4]!.current).toBe('');
    expect(refSlots[5]!.current).toBe('');

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('skips polling start for empty sessionId', async () => {
    const { useChatSessionStreamManager } = await import('@/hooks/chat-session/use-chat-session-stream-manager');
    const deps = {
      setCheckpoint: vi.fn(),
      setEvents: vi.fn(),
      setMessages: vi.fn(),
      setSessions: vi.fn(),
      setError: vi.fn(),
      checkpointRef: createRefSlot(undefined)
    };
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const manager = useChatSessionStreamManager(deps);
    manager.startSessionPolling('', 'checkpoint');
    expect(setIntervalSpy).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });
});
