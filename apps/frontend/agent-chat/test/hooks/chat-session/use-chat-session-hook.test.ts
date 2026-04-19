import { beforeEach, describe, expect, it, vi } from 'vitest';

type EffectSlot = {
  deps?: unknown[];
  callback: () => void | (() => void);
  cleanup?: (() => void) | undefined;
};

function createReactHookHarness(initialState: Record<number, unknown> = {}, initialRefs: Record<number, unknown> = {}) {
  const stateSlots: unknown[] = [];
  const refSlots: Array<{ current: unknown }> = [];
  const effectSlots: EffectSlot[] = [];
  let stateCursor = 0;
  let refCursor = 0;
  let memoCursor = 0;
  let effectCursor = 0;
  let pendingEffects: number[] = [];

  const reactModule = {
    useState<T>(initial: T | (() => T)) {
      const index = stateCursor++;
      if (!(index in stateSlots)) {
        stateSlots[index] =
          index in initialState
            ? initialState[index]
            : typeof initial === 'function'
              ? (initial as () => T)()
              : initial;
      }
      const setState = (next: T | ((value: T) => T)) => {
        const current = stateSlots[index] as T;
        stateSlots[index] = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      };
      return [stateSlots[index] as T, setState] as const;
    },
    useRef<T>(initial: T) {
      const index = refCursor++;
      if (!(index in refSlots)) {
        refSlots[index] = { current: index in initialRefs ? initialRefs[index] : initial };
      }
      return refSlots[index] as { current: T };
    },
    useMemo<T>(factory: () => T) {
      memoCursor += 1;
      return factory();
    },
    useEffect(callback: () => void | (() => void), deps?: unknown[]) {
      const index = effectCursor++;
      const previous = effectSlots[index];
      const changed =
        !previous ||
        !deps ||
        !previous.deps ||
        deps.length !== previous.deps.length ||
        deps.some((value, depIndex) => value !== previous.deps?.[depIndex]);
      effectSlots[index] = {
        ...previous,
        deps,
        callback
      };
      if (changed) {
        pendingEffects.push(index);
      }
    }
  };

  async function runEffects() {
    const nextEffects = [...pendingEffects];
    pendingEffects = [];
    for (const effectIndex of nextEffects) {
      effectSlots[effectIndex]?.cleanup?.();
      const cleanup = effectSlots[effectIndex]?.callback();
      effectSlots[effectIndex].cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    }
    await Promise.resolve();
    await Promise.resolve();
  }

  function render<T>(hook: () => T) {
    stateCursor = 0;
    refCursor = 0;
    memoCursor = 0;
    effectCursor = 0;
    pendingEffects = [];
    return hook();
  }

  function unmount() {
    effectSlots.forEach(slot => slot?.cleanup?.());
  }

  return { reactModule, stateSlots, refSlots, render, runEffects, unmount };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function activateChatSessionMock(options: {
  activeSessionId: string;
  pendingInitialSessionId?: string;
  pendingInitialMessageContent?: string;
  isDisposed: () => boolean;
  plan: {
    shouldSelectSession: boolean;
    shouldRefreshDetail: boolean;
    shouldOpenStreamImmediately: boolean;
  };
  selectSession: (sessionId: string) => Promise<unknown>;
  hydrateSessionSnapshot: (sessionId: string, forceRefresh: boolean) => Promise<{ status?: string } | undefined>;
  createSessionStream: (sessionId: string) => unknown;
  bindStream: (stream: unknown, sessionId: string) => void;
  startSessionPolling: (sessionId: string, mode: 'checkpoint' | 'detail') => void;
  stopSessionPolling: (sessionId?: string) => void;
  clearStreamReconnectSession: () => void;
  insertPendingUserMessage: (sessionId: string, content: string) => void;
  appendMessage: (sessionId: string, content: string) => Promise<unknown>;
  clearPendingInitialMessage: () => void;
  clearPendingUser: (sessionId: string) => void;
  mergeOrAppendMessage: (messages: unknown[], nextMessage: unknown) => unknown[];
  setMessages: (next: (current: unknown[]) => unknown[]) => void;
  markSessionStatus: (sessionId: string, status: 'running' | 'idle') => void;
}) {
  if (options.plan.shouldOpenStreamImmediately) {
    options.clearStreamReconnectSession();
    options.startSessionPolling(options.activeSessionId, 'checkpoint');
    const stream = options.createSessionStream(options.activeSessionId);
    options.bindStream(stream, options.activeSessionId);
    return { stream };
  }

  let detail: { status?: string } | undefined;
  if (options.plan.shouldSelectSession) {
    await options.selectSession(options.activeSessionId);
    if (options.isDisposed()) {
      return;
    }
  }
  if (options.plan.shouldRefreshDetail) {
    detail = await options.hydrateSessionSnapshot(options.activeSessionId, true);
  }
  if (options.isDisposed()) {
    return;
  }

  const hasPendingInitialMessage = options.pendingInitialSessionId === options.activeSessionId;
  const shouldOpenStream = hasPendingInitialMessage || detail?.status === 'running';
  if (!shouldOpenStream) {
    options.stopSessionPolling(options.activeSessionId);
    return;
  }

  options.startSessionPolling(options.activeSessionId, 'checkpoint');
  const stream = options.createSessionStream(options.activeSessionId);
  options.bindStream(stream, options.activeSessionId);

  if (hasPendingInitialMessage && options.pendingInitialMessageContent) {
    options.clearPendingInitialMessage();
    options.insertPendingUserMessage(options.activeSessionId, options.pendingInitialMessageContent);
    const nextUserMessage = await options.appendMessage(options.activeSessionId, options.pendingInitialMessageContent);
    if (options.isDisposed()) {
      return { stream };
    }
    options.clearPendingUser(options.activeSessionId);
    options.setMessages(current => options.mergeOrAppendMessage(current, nextUserMessage));
    options.markSessionStatus(options.activeSessionId, 'running');
  }

  return { stream };
}

function bindChatSessionStreamMock(options: {
  stream: {
    close: () => void;
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onerror?: () => void;
  };
  sessionId: string;
  isDisposed: () => boolean;
  streamState: {
    intentionalClose: boolean;
    idleTimer: ReturnType<typeof setTimeout> | null;
    hasAssistantContent?: boolean;
  };
  checkpointRef: { current: unknown };
  clearPendingUser: (sessionId: string) => void;
  reconcileFinalSnapshot: (sessionId: string) => Promise<void>;
  refreshCheckpointOnly: (sessionId: string) => Promise<{ graphState?: { status?: string } } | undefined>;
  deriveSessionStatusFromCheckpoint: (checkpoint?: { graphState?: { status?: string } }) => string | undefined;
  shouldIgnoreStaleTerminalStreamEvent: (checkpoint: unknown, event: { type: string }) => boolean;
  isAssistantContentEvent: (type: string) => boolean;
  syncCheckpointFromStreamEvent: (checkpoint: unknown, event: { type: string }) => unknown;
  mergeEvent: (events: unknown[], event: unknown) => unknown[];
  syncMessageFromEvent: (messages: unknown[], event: unknown) => unknown[];
  syncProcessMessageFromEvent: (messages: unknown[], event: unknown) => unknown[];
  syncSessionFromEvent: (sessions: unknown[], event: unknown) => unknown[];
  checkpointRefreshEventTypes: Set<string>;
  shouldStopStreamingForEvent: (type: string) => boolean;
  shouldStartDetailPollingAfterStreamError: (input: {
    isDisposed: boolean;
    detailStatus?: string;
    hasAssistantContent?: boolean;
  }) => boolean;
  shouldShowStreamFallbackError: (input: {
    isDisposed: boolean;
    detailStatus?: string;
    hasAssistantContent?: boolean;
  }) => boolean;
  shouldStartDetailPollingAfterIdleClose: (detailStatus?: string) => boolean;
  setCheckpoint: (next: (current: unknown) => unknown) => void;
  setEvents: (next: (current: unknown[]) => unknown[]) => void;
  setMessages: (next: (current: unknown[]) => unknown[]) => void;
  setSessions: (next: (current: unknown[]) => unknown[]) => void;
  setError: (value: string) => void;
  startSessionPolling: (sessionId: string, mode: 'checkpoint' | 'detail') => void;
  stopSessionPolling: (sessionId?: string) => void;
  scheduleCheckpointRefresh: () => void;
  streamIdleTimeoutMs: number;
}) {
  const clearIdleCloseTimer = () => {
    if (options.streamState.idleTimer) {
      clearTimeout(options.streamState.idleTimer);
      options.streamState.idleTimer = null;
    }
  };

  const resetIdleCloseTimer = () => {
    clearIdleCloseTimer();
    options.streamState.idleTimer = setTimeout(() => {
      if (options.isDisposed()) {
        return;
      }
      options.streamState.intentionalClose = true;
      options.stream.close();
      options.scheduleCheckpointRefresh();
      void options.refreshCheckpointOnly(options.sessionId).then(nextCheckpoint => {
        if (options.isDisposed()) {
          return;
        }
        const detailStatus = nextCheckpoint ? options.deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
        if (options.shouldStartDetailPollingAfterIdleClose(detailStatus)) {
          options.startSessionPolling(options.sessionId, 'checkpoint');
        } else {
          if (detailStatus) {
            void options.reconcileFinalSnapshot(options.sessionId);
          }
          options.stopSessionPolling(options.sessionId);
        }
      });
    }, options.streamIdleTimeoutMs);
  };

  options.stream.onopen = () => {
    if (options.isDisposed()) {
      return;
    }
    resetIdleCloseTimer();
    options.setError('');
    options.stopSessionPolling(options.sessionId);
    options.scheduleCheckpointRefresh();
  };

  options.stream.onmessage = raw => {
    if (options.isDisposed()) {
      return;
    }
    resetIdleCloseTimer();
    const nextEvent = JSON.parse(raw.data) as { sessionId: string; type: string };
    if (options.shouldIgnoreStaleTerminalStreamEvent(options.checkpointRef.current, nextEvent)) {
      return;
    }
    if (nextEvent.type === 'user_message') {
      options.clearPendingUser(nextEvent.sessionId);
    }
    if (options.isAssistantContentEvent(nextEvent.type)) {
      options.streamState.hasAssistantContent = true;
    }
    options.setCheckpoint(current => options.syncCheckpointFromStreamEvent(current, nextEvent));
    options.setEvents(current => options.mergeEvent(current, nextEvent));
    options.setMessages(current =>
      options.syncProcessMessageFromEvent(options.syncMessageFromEvent(current, nextEvent), nextEvent)
    );
    options.setSessions(current => options.syncSessionFromEvent(current, nextEvent));
    if (options.checkpointRefreshEventTypes.has(nextEvent.type)) {
      options.scheduleCheckpointRefresh();
    }
    if (['final_response_completed', 'session_finished', 'session_failed'].includes(nextEvent.type)) {
      void globalThis.setTimeout(() => {
        void options.reconcileFinalSnapshot(nextEvent.sessionId);
      }, 220);
    }
    if (options.shouldStopStreamingForEvent(nextEvent.type)) {
      options.streamState.intentionalClose = true;
      clearIdleCloseTimer();
      options.stream.close();
      options.stopSessionPolling(nextEvent.sessionId);
    }
  };

  options.stream.onerror = () => {
    if (options.isDisposed()) {
      return;
    }
    clearIdleCloseTimer();
    options.stream.close();
    options.scheduleCheckpointRefresh();
    void options.refreshCheckpointOnly(options.sessionId).then(nextCheckpoint => {
      if (options.isDisposed()) {
        return;
      }
      const detailStatus = nextCheckpoint ? options.deriveSessionStatusFromCheckpoint(nextCheckpoint) : undefined;
      if (
        options.shouldStartDetailPollingAfterStreamError({
          isDisposed: options.isDisposed(),
          detailStatus,
          hasAssistantContent: options.streamState.hasAssistantContent
        })
      ) {
        options.startSessionPolling(options.sessionId, 'checkpoint');
        if (
          options.shouldShowStreamFallbackError({
            isDisposed: options.isDisposed(),
            detailStatus,
            hasAssistantContent: options.streamState.hasAssistantContent
          })
        ) {
          options.setError('聊天流已断开，当前改用运行态兜底同步。请确认后端 /api/chat/stream 可达。');
        }
        return;
      }
      if (detailStatus && detailStatus !== 'running') {
        void options.reconcileFinalSnapshot(options.sessionId);
      }
      options.stopSessionPolling(options.sessionId);
    });
  };
}

describe('use-chat-session hook coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('bootstraps empty sessions and then creates a new session', async () => {
    const harness = createReactHookHarness();
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '给我一个起步建议',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();
    harness.stateSlots[0] = [];

    harness.render(() => useChatSession());
    await harness.runEffects();

    expect(actions.refreshSessions).toHaveBeenCalledTimes(1);
    expect(actions.createNewSession).toHaveBeenCalledTimes(1);
    expect(harness.stateSlots[5]).toBe('给我一个起步建议');
  });

  it('selects the latest session when bootstrapped with history but no active session', async () => {
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-older',
          title: 'Older',
          status: 'completed',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        },
        {
          id: 'session-latest',
          title: 'Latest',
          status: 'idle',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z'
        }
      ]
    });
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();
    harness.stateSlots[0] = [...(harness.stateSlots[0] as unknown[])];

    harness.render(() => useChatSession());
    await harness.runEffects();

    expect(actions.createNewSession).not.toHaveBeenCalled();
    expect(harness.stateSlots[1]).toBe('session-latest');
  });

  it('keeps the current active session when it already exists in the list', async () => {
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: 'Current',
          status: 'running',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        },
        {
          id: 'session-2',
          title: 'Other',
          status: 'idle',
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();
    harness.render(() => useChatSession());
    await harness.runEffects();

    expect(harness.stateSlots[1]).toBe('session-1');
    expect(actions.createNewSession).not.toHaveBeenCalled();
  });

  it('does not finish bootstrap side effects after the hook has been disposed', async () => {
    let resolveRefreshSessions!: () => void;
    const refreshSessions = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveRefreshSessions = resolve;
        })
    );
    const harness = createReactHookHarness();
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshSessions,
      createNewSession: vi.fn().mockResolvedValue(undefined),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    harness.unmount();
    resolveRefreshSessions();
    await flushAsyncWork();

    harness.render(() => useChatSession());
    await harness.runEffects();

    expect(actions.createNewSession).not.toHaveBeenCalled();
  });

  it('handles stream open, stream errors, terminal events, and cleanup', async () => {
    const close = vi.fn();
    const stream = {
      close,
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const createSessionStream = vi.fn(() => stream);
    const refreshCheckpointOnly = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'running' }
      })
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'completed' }
      });
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly,
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };

    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream,
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set(['assistant_message']),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: true
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: { graphState?: { status?: string } }) => checkpoint?.graphState?.status
      ),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn((type: string) => type === 'assistant_message'),
      mergeEvent: vi.fn((events: unknown[], nextEvent: unknown) => [...events, nextEvent]),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => true),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => true),
      shouldStopStreamingForEvent: vi.fn((type: string) => type === 'session_finished'),
      syncCheckpointFromStreamEvent: vi.fn(
        (checkpoint: Record<string, unknown> | undefined, nextEvent: { type: string }) => ({
          ...(checkpoint ?? {}),
          graphState: { status: nextEvent.type === 'session_finished' ? 'completed' : 'running' }
        })
      ),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: 'Current',
          status: 'running',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        }
      ],
      1: 'session-1',
      4: {
        sessionId: 'session-1',
        graphState: { status: 'running' }
      }
    });
    const queryClient = {
      fetchQuery: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();

    expect(createSessionStream).toHaveBeenCalledWith('session-1');
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2500);

    stream.onopen?.();
    await vi.advanceTimersByTimeAsync(220);
    expect(refreshCheckpointOnly).toHaveBeenCalledWith();

    stream.onerror?.();
    await flushAsyncWork();
    expect(refreshCheckpointOnly).toHaveBeenCalledWith('session-1');
    expect(harness.stateSlots[6]).toBe('聊天流已断开，当前改用运行态兜底同步。请确认后端 /api/chat/stream 可达。');

    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-finished',
        sessionId: 'session-1',
        type: 'session_finished'
      })
    });
    await vi.advanceTimersByTimeAsync(220);

    expect(close).toHaveBeenCalled();
    expect(actions.reconcileFinalSnapshot).toHaveBeenCalledWith('session-1');

    harness.unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('ignores stale stream events, queues checkpoint refresh, and skips callbacks after disposal', async () => {
    const close = vi.fn();
    const stream = {
      close,
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const refreshCheckpointOnly = vi.fn().mockResolvedValue({
      sessionId: 'session-1',
      graphState: { status: 'running' }
    });
    const shouldIgnoreStaleTerminalStreamEvent = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const harness = createReactHookHarness(
      {
        0: [
          {
            id: 'session-1',
            title: 'Current',
            status: 'running',
            createdAt: '2026-04-01T09:00:00.000Z',
            updatedAt: '2026-04-01T09:00:00.000Z'
          }
        ],
        1: 'session-1',
        2: [],
        3: [],
        4: {
          sessionId: 'session-1',
          graphState: { status: 'running' }
        }
      },
      {
        2: true,
        6: 'other-session',
        7: 'checkpoint',
        10: { 'session-1': 'pending-user' }
      }
    );
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly,
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(() => stream),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set(['assistant_message']),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: true
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: { graphState?: { status?: string } }) => checkpoint?.graphState?.status
      ),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn((type: string) => type === 'assistant_message'),
      mergeEvent: vi.fn((events: unknown[], nextEvent: unknown) => [...events, nextEvent]),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent,
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn(
        (checkpoint: Record<string, unknown> | undefined, nextEvent: { type: string }) => ({
          ...(checkpoint ?? {}),
          graphState: { status: nextEvent.type === 'assistant_message' ? 'running' : 'idle' }
        })
      ),
      syncMessageFromEvent: vi.fn((messages: unknown[], nextEvent: { type: string }) => [...messages, nextEvent.type]),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn((sessionId: string | undefined, pollingSessionId: string) =>
        Boolean(sessionId && pollingSessionId && pollingSessionId !== sessionId)
      )
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();

    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-stale',
        sessionId: 'session-1',
        type: 'session_finished'
      })
    });
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-user',
        sessionId: 'session-1',
        type: 'user_message'
      })
    });
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-assistant',
        sessionId: 'session-1',
        type: 'assistant_message'
      })
    });

    await vi.advanceTimersByTimeAsync(220);
    expect(actions.clearPendingUser).toHaveBeenCalledWith('session-1');
    expect(harness.stateSlots[3]).toEqual([
      { id: 'evt-user', sessionId: 'session-1', type: 'user_message' },
      { id: 'evt-assistant', sessionId: 'session-1', type: 'assistant_message' }
    ]);
    expect(harness.refSlots[3]?.current).toBe(true);

    const clearIntervalCallCountBeforeUnmount = clearIntervalSpy.mock.calls.length;
    harness.refSlots[5]!.current = setInterval(() => undefined, 1000);
    harness.refSlots[6]!.current = 'other-session';
    harness.unmount();
    stream.onopen?.();
    stream.onerror?.();
    stream.onmessage?.({
      data: JSON.stringify({
        id: 'evt-after-dispose',
        sessionId: 'session-1',
        type: 'assistant_message'
      })
    });

    expect(clearIntervalSpy.mock.calls.length).toBe(clearIntervalCallCountBeforeUnmount);
    expect(refreshCheckpointOnly).not.toHaveBeenCalledWith('session-1');
  });

  it('hydrates an existing session before opening the stream and sends the pending initial message', async () => {
    const close = vi.fn();
    const stream = {
      close,
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const createSessionStream = vi.fn(() => stream);
    const selectSession = vi.fn().mockResolvedValue(undefined);
    const appendMessage = vi.fn().mockResolvedValue({
      id: 'message-1',
      sessionId: 'session-1',
      role: 'user',
      content: '首条消息',
      createdAt: '2026-04-01T12:00:00.000Z'
    });
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn().mockResolvedValue({ status: 'running' }),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const harness = createReactHookHarness(
      {
        0: [
          {
            id: 'session-1',
            title: 'Current',
            status: 'idle',
            createdAt: '2026-04-01T09:00:00.000Z',
            updatedAt: '2026-04-01T09:00:00.000Z'
          }
        ],
        1: 'session-1',
        2: [],
        4: {
          sessionId: 'session-1',
          graphState: { status: 'idle' }
        }
      },
      {
        9: {
          sessionId: 'session-1',
          content: '首条消息'
        }
      }
    );
    const queryClient = {
      fetchQuery: vi.fn(async ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn())
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage,
      createSessionStream,
      selectSession
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: { graphState?: { status?: string } }) => checkpoint?.graphState?.status
      ),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[], nextMessage: unknown) => [...messages, nextMessage]),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(selectSession).toHaveBeenCalledWith('session-1');
    expect(actions.hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', true);
    expect(createSessionStream).toHaveBeenCalledWith('session-1');
    expect(actions.insertPendingUserMessage).toHaveBeenCalledWith('session-1', '首条消息');
    expect(appendMessage).toHaveBeenCalledWith('session-1', '首条消息');
    expect(actions.clearPendingUser).toHaveBeenCalledWith('session-1');
    expect(actions.markSessionStatus).toHaveBeenCalledWith('session-1', 'running');
    expect(harness.refSlots[9]?.current).toBeNull();
    expect(harness.stateSlots[2]).toEqual([
      {
        id: 'message-1',
        sessionId: 'session-1',
        role: 'user',
        content: '首条消息',
        createdAt: '2026-04-01T12:00:00.000Z'
      }
    ]);
  });

  it('skips stream startup when hydrated detail is already terminal', async () => {
    const createSessionStream = vi.fn();
    const selectSession = vi.fn().mockResolvedValue(undefined);
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn().mockResolvedValue({ status: 'completed' }),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: 'Current',
          status: 'idle',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const queryClient = {
      fetchQuery: vi.fn(async ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn())
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream,
      selectSession
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: { graphState?: { status?: string } }) => checkpoint?.graphState?.status
      ),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(selectSession).toHaveBeenCalledWith('session-1');
    expect(actions.hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', true);
    expect(createSessionStream).not.toHaveBeenCalled();
  });

  it('marks the session idle and surfaces activation failures', async () => {
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn().mockRejectedValue(new Error('hydrate failed')),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: 'Current',
          status: 'running',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const queryClient = {
      fetchQuery: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(),
      selectSession: vi.fn().mockResolvedValue(undefined)
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(actions.clearPendingSessionMessages).toHaveBeenCalledWith('session-1');
    expect(actions.markSessionStatus).toHaveBeenCalledWith('session-1', 'idle');
    expect(harness.stateSlots[6]).toBe('hydrate failed');
  });

  it('finalizes after idle stream close when the checkpoint is already terminal', async () => {
    const close = vi.fn();
    const stream = {
      close,
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly: vi.fn().mockResolvedValue({
        sessionId: 'session-1',
        graphState: { status: 'completed' }
      }),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: 'Current',
          status: 'running',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const queryClient = {
      fetchQuery: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(() => stream),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 20,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: true
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: { graphState?: { status?: string } }) => checkpoint?.graphState?.status
      ),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();

    stream.onopen?.();
    await vi.advanceTimersByTimeAsync(20);
    await flushAsyncWork();

    expect(close).toHaveBeenCalled();
    expect(actions.refreshCheckpointOnly).toHaveBeenCalledWith('session-1');

    harness.unmount();
  });

  it('queues a second checkpoint refresh while one refresh is already in flight', async () => {
    const deferred = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>(nextResolve => {
        resolve = nextResolve;
      });
      return { promise, resolve };
    })();
    const stream = {
      close: vi.fn(),
      onopen: undefined as (() => void) | undefined,
      onmessage: undefined as ((event: { data: string }) => void) | undefined,
      onerror: undefined as (() => void) | undefined
    };
    const refreshCheckpointOnly = vi
      .fn()
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'running' }
      });
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly,
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: 'Current',
          status: 'running',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const queryClient = {
      fetchQuery: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(() => stream),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: true
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(
        (checkpoint?: { graphState?: { status?: string } }) => checkpoint?.graphState?.status
      ),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(activateChatSessionMock),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn(() => false)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');
    harness.render(() => useChatSession());
    await harness.runEffects();

    stream.onopen?.();
    await vi.advanceTimersByTimeAsync(220);
    stream.onopen?.();
    await vi.advanceTimersByTimeAsync(220);
    deferred.resolve();
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(220);

    expect(refreshCheckpointOnly).toHaveBeenCalledTimes(2);
    expect(harness.refSlots[3]?.current).toBe(false);
  });

  it('guards polling setup for empty and duplicate sessions', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const timerHandle = setInterval(() => undefined, 1000);
    const harness = createReactHookHarness(
      {
        0: [
          {
            id: 'session-1',
            title: 'Current',
            status: 'running',
            createdAt: '2026-04-01T09:00:00.000Z',
            updatedAt: '2026-04-01T09:00:00.000Z'
          }
        ],
        1: 'session-1'
      },
      {
        5: timerHandle,
        6: 'session-1',
        7: 'checkpoint'
      }
    );
    const actions = {
      refreshSessions: vi.fn().mockResolvedValue(undefined),
      createNewSession: vi.fn().mockResolvedValue(undefined),
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly: vi.fn().mockResolvedValue(undefined),
      reconcileFinalSnapshot: vi.fn().mockResolvedValue(undefined),
      clearPendingUser: vi.fn(),
      clearPendingSessionMessages: vi.fn(),
      markSessionStatus: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      refreshSessionDetail: vi.fn(),
      sendMessage: vi.fn(),
      updateApproval: vi.fn(),
      updatePlanInterrupt: vi.fn(),
      allowApprovalAndApprove: vi.fn(),
      installSuggestedSkill: vi.fn(),
      submitLearningConfirmation: vi.fn(),
      recoverActiveSession: vi.fn(),
      cancelActiveSession: vi.fn(),
      renameSessionById: vi.fn(),
      deleteSessionById: vi.fn(),
      deleteActiveSession: vi.fn()
    };
    const queryClient = {
      fetchQuery: vi.fn()
    };

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSessionStream: vi.fn(),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => actions
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      CHECKPOINT_REFRESH_EVENT_TYPES: new Set<string>(),
      STARTER_PROMPT: '起步提示',
      STREAM_IDLE_TIMEOUT_MS: 1000,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      isAssistantContentEvent: vi.fn(() => false),
      mergeEvent: vi.fn((events: unknown[]) => events),
      mergeOrAppendMessage: vi.fn((messages: unknown[]) => messages),
      shouldIgnoreStaleTerminalStreamEvent: vi.fn(() => false),
      shouldShowStreamFallbackError: vi.fn(() => false),
      shouldStartDetailPollingAfterIdleClose: vi.fn(() => false),
      shouldStartDetailPollingAfterStreamError: vi.fn(() => false),
      shouldStopStreamingForEvent: vi.fn(() => false),
      syncCheckpointFromStreamEvent: vi.fn((checkpoint: unknown) => checkpoint),
      syncMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncProcessMessageFromEvent: vi.fn((messages: unknown[]) => messages),
      syncSessionFromEvent: vi.fn((sessions: unknown[]) => sessions),
      activateChatSession: vi.fn(
        async (options: { startSessionPolling: (sessionId: string, mode: 'checkpoint' | 'detail') => void }) => {
          options.startSessionPolling('', 'checkpoint');
          options.startSessionPolling('session-1', 'checkpoint');
        }
      ),
      bindChatSessionStream: vi.fn(bindChatSessionStreamMock),
      createSessionPollingRunner: vi.fn((options: { mode: 'checkpoint' | 'detail'; sessionId: string }) => () => {
        void options;
      }),
      shouldSkipStopSessionPolling: vi.fn((sessionId: string | undefined, pollingSessionId: string) =>
        Boolean(sessionId && pollingSessionId && pollingSessionId !== sessionId)
      )
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');
    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 2500);
    clearInterval(timerHandle);
  });
});
