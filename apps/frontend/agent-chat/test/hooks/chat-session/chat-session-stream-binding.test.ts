import { describe, expect, it, vi } from 'vitest';

import { bindChatSessionStream } from '@/hooks/chat-session/chat-session-stream-binding';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

function createState() {
  let checkpoint: ChatCheckpointRecord | undefined;
  let events: ChatEventRecord[] = [];
  let messages: ChatMessageRecord[] = [];
  let sessions: ChatSessionRecord[] = [];

  return {
    get checkpoint() {
      return checkpoint;
    },
    get events() {
      return events;
    },
    get messages() {
      return messages;
    },
    get sessions() {
      return sessions;
    },
    setCheckpoint(next: (current: ChatCheckpointRecord | undefined) => ChatCheckpointRecord | undefined) {
      checkpoint = next(checkpoint);
    },
    setEvents(next: (current: ChatEventRecord[]) => ChatEventRecord[]) {
      events = next(events);
    },
    setMessages(next: (current: ChatMessageRecord[]) => ChatMessageRecord[]) {
      messages = next(messages);
    },
    setSessions(next: (current: ChatSessionRecord[]) => ChatSessionRecord[]) {
      sessions = next(sessions);
    }
  };
}

describe('chat-session-stream-binding', () => {
  it('processes stream open/message/error/idle-close paths', async () => {
    vi.useFakeTimers();

    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const streamState = {
      intentionalClose: false,
      idleTimer: null as ReturnType<typeof setTimeout> | null,
      hasAssistantContent: false
    };
    const setError = vi.fn();
    const stopSessionPolling = vi.fn();
    const startSessionPolling = vi.fn();
    const scheduleCheckpointRefresh = vi.fn();
    const clearPendingUser = vi.fn();
    const reconcileFinalSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'running' }
      } as ChatCheckpointRecord)
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'completed' }
      } as ChatCheckpointRecord);
    const deriveSessionStatusFromCheckpoint = vi.fn(
      (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
    );
    const shouldIgnoreStaleTerminalStreamEvent = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const isDisposed = vi.fn(() => false);

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed,
      streamState,
      checkpointRef: { current: undefined },
      clearPendingUser,
      reconcileFinalSnapshot,
      refreshCheckpointOnly,
      deriveSessionStatusFromCheckpoint,
      shouldIgnoreStaleTerminalStreamEvent,
      isAssistantContentEvent: vi.fn((type: string) => type === 'assistant_message'),
      syncCheckpointFromStreamEvent: vi.fn(
        (_checkpoint, event: ChatEventRecord) =>
          ({
            sessionId: event.sessionId,
            graphState: { status: event.type === 'session_failed' ? 'failed' : 'running' }
          }) as ChatCheckpointRecord
      ),
      mergeEvent: vi.fn((events: ChatEventRecord[], event: ChatEventRecord) => [...events, event]),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[], event: ChatEventRecord) => [
        ...messages,
        {
          id: event.id,
          sessionId: event.sessionId,
          role: 'system' as const,
          content: event.type,
          createdAt: event.at
        }
      ]),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[], event: ChatEventRecord) => [
        ...sessions,
        {
          id: event.sessionId,
          title: event.type,
          status: 'running' as const,
          createdAt: event.at,
          updatedAt: event.at
        }
      ]),
      checkpointRefreshEventTypes: new Set(['assistant_message']),
      shouldStopStreamingForEvent: vi.fn((type: string) => type === 'session_failed'),
      shouldStartDetailPollingAfterStreamError: vi.fn(
        ({ detailStatus }: { detailStatus?: string }) => detailStatus === 'running'
      ),
      shouldShowStreamFallbackError: vi.fn(({ detailStatus }: { detailStatus?: string }) => detailStatus === 'running'),
      shouldStartDetailPollingAfterIdleClose: vi.fn((detailStatus?: string) => detailStatus === 'running'),
      setCheckpoint: state.setCheckpoint,
      setEvents: state.setEvents,
      setMessages: state.setMessages,
      setSessions: state.setSessions,
      setError,
      startSessionPolling,
      stopSessionPolling,
      scheduleCheckpointRefresh,
      streamIdleTimeoutMs: 20
    });

    stream.onopen?.();
    expect(setError).toHaveBeenCalledWith('');
    expect(stopSessionPolling).toHaveBeenCalledWith('session-1');
    expect(scheduleCheckpointRefresh).toHaveBeenCalled();

    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-stale',
        sessionId: 'session-1',
        type: 'session_finished',
        at: '2026-04-02T00:00:00.000Z'
      })
    });
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-user',
        sessionId: 'session-1',
        type: 'user_message',
        at: '2026-04-02T00:00:01.000Z'
      })
    });
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-assistant',
        sessionId: 'session-1',
        type: 'assistant_message',
        at: '2026-04-02T00:00:02.000Z'
      })
    });
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-failed',
        sessionId: 'session-1',
        type: 'session_failed',
        at: '2026-04-02T00:00:03.000Z'
      })
    });
    await vi.advanceTimersByTimeAsync(220);

    expect(clearPendingUser).toHaveBeenCalledWith('session-1');
    expect(streamState.hasAssistantContent).toBe(true);
    expect(state.events).toHaveLength(3);
    expect(stream.close).toHaveBeenCalled();
    expect(reconcileFinalSnapshot).toHaveBeenCalledWith('session-1');

    stream.onerror?.();
    await Promise.resolve();
    expect(startSessionPolling).toHaveBeenCalledWith('session-1', 'checkpoint');
    expect(setError).toHaveBeenCalledWith('聊天流已断开，当前改用运行态兜底同步。请确认后端 /api/chat/stream 可达。');

    stream.onopen?.();
    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    expect(refreshCheckpointOnly).toHaveBeenCalledWith('session-1');
    expect(stopSessionPolling).toHaveBeenCalledWith('session-1');
  });

  it('returns early when stream callbacks fire after disposal', async () => {
    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const setError = vi.fn();
    const stopSessionPolling = vi.fn();
    const startSessionPolling = vi.fn();
    const scheduleCheckpointRefresh = vi.fn();

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed: () => true,
      streamState: { intentionalClose: false, idleTimer: null },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[]) => events),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: state.setCheckpoint,
      setEvents: state.setEvents,
      setMessages: state.setMessages,
      setSessions: state.setSessions,
      setError,
      startSessionPolling,
      stopSessionPolling,
      scheduleCheckpointRefresh,
      streamIdleTimeoutMs: 20
    });

    stream.onopen?.();
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-1',
        sessionId: 'session-1',
        type: 'assistant_message',
        at: '2026-04-02T00:00:00.000Z'
      })
    });
    stream.onerror?.();

    expect(setError).not.toHaveBeenCalled();
    expect(stopSessionPolling).not.toHaveBeenCalled();
    expect(startSessionPolling).not.toHaveBeenCalled();
    expect(scheduleCheckpointRefresh).not.toHaveBeenCalled();
  });

  it('routes malformed stream event data through fallback handling without throwing', async () => {
    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const setError = vi.fn();
    const startSessionPolling = vi.fn();
    const scheduleCheckpointRefresh = vi.fn();
    const refreshCheckpointOnly = vi.fn().mockResolvedValue({
      sessionId: 'session-1',
      graphState: { status: 'running' }
    } as ChatCheckpointRecord);

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null, hasAssistantContent: false },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      refreshCheckpointOnly,
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
      ),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[]) => events),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => true),
      shouldShowStreamFallbackError: vi.fn(() => true),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: state.setCheckpoint,
      setEvents: state.setEvents,
      setMessages: state.setMessages,
      setSessions: state.setSessions,
      setError,
      startSessionPolling,
      stopSessionPolling: vi.fn(),
      scheduleCheckpointRefresh,
      streamIdleTimeoutMs: 20
    });

    expect(() => stream.onmessage?.({ data: '{malformed-json' })).not.toThrow();
    await Promise.resolve();

    expect(stream.close).toHaveBeenCalled();
    expect(scheduleCheckpointRefresh).toHaveBeenCalled();
    expect(refreshCheckpointOnly).toHaveBeenCalledWith('session-1');
    expect(startSessionPolling).toHaveBeenCalledWith('session-1', 'checkpoint');
    expect(setError).toHaveBeenCalledWith('聊天流已断开，当前改用运行态兜底同步。请确认后端 /api/chat/stream 可达。');
  });

  it('batches assistant token message updates into one frame to avoid markdown re-render storms', async () => {
    vi.useFakeTimers();

    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const setCheckpointSpy = vi.fn(state.setCheckpoint);
    const setEventsSpy = vi.fn(state.setEvents);
    const setMessagesSpy = vi.fn(state.setMessages);
    const setSessionsSpy = vi.fn(state.setSessions);
    const syncMessageFromEvent = vi.fn((messages: ChatMessageRecord[], event: ChatEventRecord) => [
      ...messages,
      {
        id: event.id,
        sessionId: event.sessionId,
        role: 'assistant' as const,
        content: String(event.payload?.content ?? ''),
        createdAt: event.at
      }
    ]);

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null, hasAssistantContent: false },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn((type: string) => type === 'assistant_token'),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[], event: ChatEventRecord) => [...events, event]),
      syncMessageFromEvent,
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: setCheckpointSpy,
      setEvents: setEventsSpy,
      setMessages: setMessagesSpy,
      setSessions: setSessionsSpy,
      setError: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: vi.fn(),
      scheduleCheckpointRefresh: vi.fn(),
      streamIdleTimeoutMs: 100
    });

    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { content: '你' },
        at: '2026-05-04T00:00:00.000Z'
      })
    });
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-token-2',
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { content: '好' },
        at: '2026-05-04T00:00:00.010Z'
      })
    });

    expect(setCheckpointSpy).not.toHaveBeenCalled();
    expect(setEventsSpy).not.toHaveBeenCalled();
    expect(setMessagesSpy).not.toHaveBeenCalled();
    expect(setSessionsSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(40);

    expect(setMessagesSpy).toHaveBeenCalledTimes(1);
    expect(setCheckpointSpy).not.toHaveBeenCalled();
    expect(setEventsSpy).not.toHaveBeenCalled();
    expect(setSessionsSpy).not.toHaveBeenCalled();
    expect(syncMessageFromEvent).toHaveBeenCalledTimes(2);
    expect(state.messages.map(message => message.content)).toEqual(['你', '好']);
  });

  it('can route assistant stream content to the x-sdk provider without also writing legacy assistant messages', async () => {
    vi.useFakeTimers();

    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const onStreamEvent = vi.fn();
    const syncMessageFromEvent = vi.fn((messages: ChatMessageRecord[], event: ChatEventRecord) => [
      ...messages,
      {
        id: event.id,
        sessionId: event.sessionId,
        role: 'assistant' as const,
        content: String(event.payload?.content ?? ''),
        createdAt: event.at
      }
    ]);

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null, hasAssistantContent: false },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn((type: string) => type === 'assistant_token'),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[], event: ChatEventRecord) => [...events, event]),
      syncMessageFromEvent,
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: state.setCheckpoint,
      setEvents: state.setEvents,
      setMessages: state.setMessages,
      setSessions: state.setSessions,
      setError: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: vi.fn(),
      scheduleCheckpointRefresh: vi.fn(),
      streamIdleTimeoutMs: 100,
      syncAssistantMessages: false,
      onStreamEvent
    });

    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { content: '你' },
        at: '2026-05-04T00:00:00.000Z'
      })
    });

    await vi.advanceTimersByTimeAsync(40);

    expect(onStreamEvent).toHaveBeenCalledTimes(1);
    expect(syncMessageFromEvent).not.toHaveBeenCalled();
    expect(state.messages).toEqual([]);
  });

  it('can let x-sdk own the local user message without also writing the streamed user echo', async () => {
    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const clearPendingUser = vi.fn();
    const syncMessageFromEvent = vi.fn((messages: ChatMessageRecord[], event: ChatEventRecord) => [
      ...messages,
      {
        id: String(event.payload?.messageId ?? event.id),
        sessionId: event.sessionId,
        role: 'user' as const,
        content: String(event.payload?.content ?? ''),
        createdAt: event.at
      }
    ]);

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null, hasAssistantContent: false },
      checkpointRef: { current: undefined },
      clearPendingUser,
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[], event: ChatEventRecord) => [...events, event]),
      syncMessageFromEvent,
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: state.setCheckpoint,
      setEvents: state.setEvents,
      setMessages: state.setMessages,
      setSessions: state.setSessions,
      setError: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: vi.fn(),
      scheduleCheckpointRefresh: vi.fn(),
      streamIdleTimeoutMs: 100,
      syncUserMessages: false
    });

    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-user-1',
        sessionId: 'session-1',
        type: 'user_message',
        payload: {
          messageId: 'server-user-1',
          content: '201和304的区别是什么'
        },
        at: '2026-05-05T00:00:00.000Z'
      })
    });

    expect(clearPendingUser).toHaveBeenCalledWith('session-1');
    expect(syncMessageFromEvent).not.toHaveBeenCalled();
    expect(state.messages).toEqual([]);
    expect(state.events.map(event => event.id)).toEqual(['evt-user-1']);
  });

  it('reconciles and stops on stream error without fallback polling when detail is terminal', async () => {
    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const state = createState();
    const setError = vi.fn();
    const stopSessionPolling = vi.fn();
    const startSessionPolling = vi.fn();
    const scheduleCheckpointRefresh = vi.fn();
    const reconcileFinalSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue({
      sessionId: 'session-1',
      graphState: { status: 'completed' }
    } as ChatCheckpointRecord);

    bindChatSessionStream({
      stream: stream as unknown as EventSource,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null, hasAssistantContent: true },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot,
      refreshCheckpointOnly,
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
      ),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[]) => events),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: state.setCheckpoint,
      setEvents: state.setEvents,
      setMessages: state.setMessages,
      setSessions: state.setSessions,
      setError,
      startSessionPolling,
      stopSessionPolling,
      scheduleCheckpointRefresh,
      streamIdleTimeoutMs: 20
    });

    stream.onerror?.();
    await Promise.resolve();

    expect(stream.close).toHaveBeenCalled();
    expect(scheduleCheckpointRefresh).toHaveBeenCalled();
    expect(startSessionPolling).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(reconcileFinalSnapshot).toHaveBeenCalledWith('session-1');
    expect(stopSessionPolling).toHaveBeenCalledWith('session-1');
  });

  it('handles idle close branches for restart, terminal reconcile, and disposed refresh resolution', async () => {
    vi.useFakeTimers();

    const createStream = () =>
      ({
        close: vi.fn(),
        onopen: undefined as (() => void) | undefined,
        onmessage: undefined as ((event: { data: string }) => void) | undefined,
        onerror: undefined as (() => void) | undefined
      }) as unknown as EventSource;

    const streamRestart = createStream();
    const restartState = createState();
    const startSessionPollingRestart = vi.fn();
    bindChatSessionStream({
      stream: streamRestart,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      refreshCheckpointOnly: vi.fn().mockResolvedValue({
        sessionId: 'session-1',
        graphState: { status: 'running' }
      } as ChatCheckpointRecord),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
      ),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[]) => events),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => true),
      setCheckpoint: restartState.setCheckpoint,
      setEvents: restartState.setEvents,
      setMessages: restartState.setMessages,
      setSessions: restartState.setSessions,
      setError: vi.fn(),
      startSessionPolling: startSessionPollingRestart,
      stopSessionPolling: vi.fn(),
      scheduleCheckpointRefresh: vi.fn(),
      streamIdleTimeoutMs: 20
    });
    (streamRestart as any).onopen?.();
    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    expect(startSessionPollingRestart).toHaveBeenCalledWith('session-1', 'checkpoint');

    const streamTerminal = createStream();
    const terminalState = createState();
    const reconcileFinalSnapshotTerminal = vi.fn().mockResolvedValue(undefined);
    const stopSessionPollingTerminal = vi.fn();
    bindChatSessionStream({
      stream: streamTerminal,
      sessionId: 'session-1',
      isDisposed: () => false,
      streamState: { intentionalClose: false, idleTimer: null },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: reconcileFinalSnapshotTerminal,
      refreshCheckpointOnly: vi.fn().mockResolvedValue({
        sessionId: 'session-1',
        graphState: { status: 'completed' }
      } as ChatCheckpointRecord),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
      ),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[]) => events),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: terminalState.setCheckpoint,
      setEvents: terminalState.setEvents,
      setMessages: terminalState.setMessages,
      setSessions: terminalState.setSessions,
      setError: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: stopSessionPollingTerminal,
      scheduleCheckpointRefresh: vi.fn(),
      streamIdleTimeoutMs: 20
    });
    (streamTerminal as any).onopen?.();
    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    expect(reconcileFinalSnapshotTerminal).toHaveBeenCalledWith('session-1');
    expect(stopSessionPollingTerminal).toHaveBeenCalledWith('session-1');

    let disposed = false;
    const streamDisposed = createStream();
    const disposedState = createState();
    const refreshCheckpointOnlyDisposed = vi.fn().mockImplementation(async () => {
      disposed = true;
      return {
        sessionId: 'session-1',
        graphState: { status: 'completed' }
      } as ChatCheckpointRecord;
    });
    const reconcileFinalSnapshotDisposed = vi.fn().mockResolvedValue(undefined);
    const stopSessionPollingDisposed = vi.fn();
    bindChatSessionStream({
      stream: streamDisposed,
      sessionId: 'session-1',
      isDisposed: () => disposed,
      streamState: { intentionalClose: false, idleTimer: null },
      checkpointRef: { current: undefined },
      clearPendingUser: vi.fn(),
      reconcileFinalSnapshot: reconcileFinalSnapshotDisposed,
      refreshCheckpointOnly: refreshCheckpointOnlyDisposed,
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
      ),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      isAssistantContentEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint?: ChatCheckpointRecord) => checkpoint),
      mergeEvent: vi.fn((events: ChatEventRecord[]) => events),
      syncMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: ChatMessageRecord[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: ChatSessionRecord[]) => sessions),
      checkpointRefreshEventTypes: new Set(),
      shouldStopStreamingForEvent: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      setCheckpoint: disposedState.setCheckpoint,
      setEvents: disposedState.setEvents,
      setMessages: disposedState.setMessages,
      setSessions: disposedState.setSessions,
      setError: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: stopSessionPollingDisposed,
      scheduleCheckpointRefresh: vi.fn(),
      streamIdleTimeoutMs: 20
    });
    (streamDisposed as any).onopen?.();
    const stopCallsAfterOpen = stopSessionPollingDisposed.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    expect(reconcileFinalSnapshotDisposed).not.toHaveBeenCalled();
    expect(stopSessionPollingDisposed.mock.calls.length).toBe(stopCallsAfterOpen);
  });
});
