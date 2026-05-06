import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 20_000 });

type EffectSlot = {
  deps?: unknown[];
  callback: () => void | (() => void);
  cleanup?: (() => void) | undefined;
};

function createReactHookHarness(initialState: Record<number, unknown> = {}) {
  const stateSlots: unknown[] = [];
  const refSlots: Array<{ current: unknown }> = [];
  const effectSlots: EffectSlot[] = [];
  let stateCursor = 0;
  let refCursor = 0;
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
        refSlots[index] = { current: initial };
      }
      return refSlots[index] as { current: T };
    },
    useMemo<T>(factory: () => T) {
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
    effectCursor = 0;
    pendingEffects = [];
    return hook();
  }

  return {
    reactModule,
    render,
    runEffects,
    stateSlots
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('useChatSession x-sdk facade migration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reads visible messages from useXChat instead of the legacy local message state', async () => {
    const harness = createReactHookHarness({
      0: [],
      1: 'session-1',
      2: [
        {
          id: 'legacy-msg',
          sessionId: 'session-1',
          role: 'assistant',
          content: '旧 state 消息',
          createdAt: '2026-05-04T10:00:00.000Z'
        }
      ]
    });
    const useXChatCalls: Array<Record<string, unknown>> = [];
    const useXConversationsCalls: Array<Record<string, unknown>> = [];
    const xMessages = [
      {
        id: 'x-msg-1',
        status: 'success' as const,
        message: {
          id: 'x-msg-1',
          sessionId: 'session-1',
          role: 'assistant' as const,
          content: '来自 x-sdk 的消息',
          createdAt: '2026-05-04T10:00:01.000Z'
        }
      }
    ];

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => ({ fetchQuery: vi.fn() })
    }));
    vi.doMock('@ant-design/x-sdk', () => ({
      useXChat: (options: Record<string, unknown>) => {
        useXChatCalls.push(options);
        return {
          messages: xMessages,
          setMessages: vi.fn(),
          onRequest: vi.fn(),
          queueRequest: vi.fn(),
          abort: vi.fn(),
          isRequesting: false
        };
      },
      useXConversations: (options: Record<string, unknown>) => {
        useXConversationsCalls.push(options);
        return {
          conversations: [],
          activeConversationKey: 'session:session-1',
          setActiveConversationKey: vi.fn(),
          addConversation: vi.fn(),
          removeConversation: vi.fn(),
          setConversation: vi.fn(),
          getConversation: vi.fn(),
          setConversations: vi.fn(),
          getMessages: vi.fn()
        };
      }
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSession: vi.fn(),
      createSessionStream: vi.fn(),
      getCheckpoint: vi.fn(),
      listEvents: vi.fn(),
      listMessages: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => ({
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
        clearPendingUser: vi.fn(),
        insertPendingUserMessage: vi.fn(),
        reconcileFinalSnapshot: vi.fn(),
        refreshCheckpointOnly: vi.fn(),
        hydrateSessionSnapshot: vi.fn(),
        markSessionStatus: vi.fn(),
        renameSessionById: vi.fn(),
        deleteSessionById: vi.fn(),
        deleteActiveSession: vi.fn(),
        regenerateMessage: vi.fn(),
        submitMessageFeedback: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-stream-manager', () => ({
      useChatSessionStreamManager: () => ({
        checkpointRefreshTimer: { current: null },
        setChatActions: vi.fn(),
        scheduleCheckpointRefresh: vi.fn(),
        startSessionPolling: vi.fn(),
        stopSessionPolling: vi.fn(),
        bindStream: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      STARTER_PROMPT: '起步提示',
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      activateChatSession: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--')
    }));
    vi.doMock('@/chat-runtime/agent-chat-session-provider', () => ({
      createAgentChatSessionProvider: vi.fn(() => ({ mock: 'provider' }))
    }));
    vi.doMock('@/utils/agent-tool-execution-api', () => ({
      getAgentToolGovernanceProjection: vi.fn().mockResolvedValue(undefined)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    const result = harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(useXConversationsCalls).not.toHaveLength(0);
    expect(useXChatCalls).not.toHaveLength(0);
    expect(result.messages.map(message => message.content)).toEqual(['来自 x-sdk 的消息']);
  });

  it('routes sendMessage through useXChat request instead of the legacy action sender', async () => {
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: '部署计划',
          status: 'running',
          createdAt: '2026-05-04T10:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const onRequest = vi.fn();
    const legacySendMessage = vi.fn();

    const queryClient = { fetchQuery: vi.fn() };
    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@ant-design/x-sdk', () => ({
      useXChat: () => ({
        messages: [],
        setMessages: vi.fn(),
        onRequest,
        queueRequest: vi.fn(),
        abort: vi.fn(),
        isRequesting: false
      }),
      useXConversations: () => ({
        conversations: [],
        activeConversationKey: 'session:session-1',
        setActiveConversationKey: vi.fn(),
        addConversation: vi.fn(),
        removeConversation: vi.fn(),
        setConversation: vi.fn(),
        getConversation: vi.fn(),
        setConversations: vi.fn(),
        getMessages: vi.fn()
      })
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSession: vi.fn(),
      createSessionStream: vi.fn(),
      getCheckpoint: vi.fn(),
      listEvents: vi.fn(),
      listMessages: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => ({
        refreshSessions: vi.fn().mockResolvedValue(undefined),
        createNewSession: vi.fn().mockResolvedValue(undefined),
        refreshSessionDetail: vi.fn(),
        sendMessage: legacySendMessage,
        updateApproval: vi.fn(),
        updatePlanInterrupt: vi.fn(),
        allowApprovalAndApprove: vi.fn(),
        installSuggestedSkill: vi.fn(),
        submitLearningConfirmation: vi.fn(),
        recoverActiveSession: vi.fn(),
        cancelActiveSession: vi.fn(),
        clearPendingSessionMessages: vi.fn(),
        clearPendingUser: vi.fn(),
        insertPendingUserMessage: vi.fn(),
        reconcileFinalSnapshot: vi.fn(),
        refreshCheckpointOnly: vi.fn(),
        hydrateSessionSnapshot: vi.fn(),
        markSessionStatus: vi.fn(),
        renameSessionById: vi.fn(),
        deleteSessionById: vi.fn(),
        deleteActiveSession: vi.fn(),
        regenerateMessage: vi.fn(),
        submitMessageFeedback: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-stream-manager', () => ({
      useChatSessionStreamManager: () => ({
        checkpointRefreshTimer: { current: null },
        setChatActions: vi.fn(),
        scheduleCheckpointRefresh: vi.fn(),
        startSessionPolling: vi.fn(),
        stopSessionPolling: vi.fn(),
        bindStream: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      STARTER_PROMPT: '起步提示',
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      activateChatSession: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--')
    }));
    vi.doMock('@/chat-runtime/agent-chat-session-provider', () => ({
      createAgentChatSessionProvider: vi.fn(() => ({ mock: 'provider' }))
    }));
    vi.doMock('@/utils/agent-tool-execution-api', () => ({
      getAgentToolGovernanceProjection: vi.fn().mockResolvedValue(undefined)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');
    const result = harness.render(() => useChatSession());

    await result.sendMessage({
      display: '继续部署',
      payload: '继续部署',
      modelId: 'claude-opus-4'
    });

    expect(onRequest).toHaveBeenCalledWith({
      conversationKey: 'session:session-1',
      messages: [{ role: 'user', content: '继续部署', modelId: 'claude-opus-4' }]
    });
    expect(legacySendMessage).not.toHaveBeenCalled();
  });

  it('defers conversation store synchronization until effects run after compat session updates', async () => {
    const harness = createReactHookHarness({
      0: [],
      1: ''
    });
    const setConversations = vi.fn();
    const setActiveConversationKey = vi.fn();
    let sessionProviderOptions:
      | {
          onSessionResolved?: (session: {
            id: string;
            title: string;
            status: string;
            createdAt: string;
            updatedAt: string;
          }) => void;
        }
      | undefined;

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => ({ fetchQuery: vi.fn() })
    }));
    vi.doMock('@ant-design/x-sdk', () => ({
      useXChat: () => ({
        messages: [],
        setMessages: vi.fn(),
        onRequest: vi.fn(),
        queueRequest: vi.fn(),
        abort: vi.fn(),
        isRequesting: false
      }),
      useXConversations: () => ({
        conversations: [],
        activeConversationKey: '',
        setActiveConversationKey,
        addConversation: vi.fn(),
        removeConversation: vi.fn(),
        setConversation: vi.fn(),
        getConversation: vi.fn(),
        setConversations,
        getMessages: vi.fn()
      })
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSession: vi.fn(),
      createSessionStream: vi.fn(),
      getCheckpoint: vi.fn(),
      listEvents: vi.fn(),
      listMessages: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => ({
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
        clearPendingUser: vi.fn(),
        insertPendingUserMessage: vi.fn(),
        reconcileFinalSnapshot: vi.fn(),
        refreshCheckpointOnly: vi.fn(),
        hydrateSessionSnapshot: vi.fn(),
        markSessionStatus: vi.fn(),
        renameSessionById: vi.fn(),
        deleteSessionById: vi.fn(),
        deleteActiveSession: vi.fn(),
        regenerateMessage: vi.fn(),
        submitMessageFeedback: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-stream-manager', () => ({
      useChatSessionStreamManager: () => ({
        checkpointRefreshTimer: { current: null },
        setChatActions: vi.fn(),
        scheduleCheckpointRefresh: vi.fn(),
        startSessionPolling: vi.fn(),
        stopSessionPolling: vi.fn(),
        bindStream: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      STARTER_PROMPT: '起步提示',
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      activateChatSession: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--')
    }));
    vi.doMock('@/chat-runtime/agent-chat-session-provider', () => ({
      createAgentChatSessionProvider: vi.fn((options: typeof sessionProviderOptions) => {
        sessionProviderOptions = options;
        return { mock: 'provider' };
      })
    }));
    vi.doMock('@/utils/agent-tool-execution-api', () => ({
      getAgentToolGovernanceProjection: vi.fn().mockResolvedValue(undefined)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    setConversations.mockClear();
    setActiveConversationKey.mockClear();

    sessionProviderOptions?.onSessionResolved?.({
      id: 'session-1',
      title: '部署计划',
      status: 'running',
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z'
    });

    expect(setConversations).not.toHaveBeenCalled();
    expect(setActiveConversationKey).not.toHaveBeenCalled();

    harness.render(() => useChatSession());
    await harness.runEffects();

    expect(setConversations).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'session:session-1',
        label: '部署计划'
      })
    ]);
    expect(setActiveConversationKey).toHaveBeenCalledWith('session:session-1');
  });

  it('synchronizes compat message updates directly into x-chat without waiting for effects', async () => {
    const harness = createReactHookHarness({
      0: [],
      1: ''
    });
    const setConversations = vi.fn();
    const setActiveConversationKey = vi.fn();
    const setMessages = vi.fn();
    let xMessages = [
      {
        id: 'local-user-1',
        status: 'success' as const,
        message: {
          id: 'local-user-1',
          sessionId: '',
          role: 'user' as const,
          content: '继续部署',
          createdAt: '2026-05-04T10:00:00.000Z'
        }
      },
      {
        id: 'assistant-loading-1',
        status: 'loading' as const,
        message: {
          id: 'assistant-loading-1',
          sessionId: '',
          role: 'assistant' as const,
          content: '',
          createdAt: '2026-05-04T10:00:01.000Z'
        }
      }
    ];
    let sessionProviderOptions:
      | {
          onSessionResolved?: (session: {
            id: string;
            title: string;
            status: string;
            createdAt: string;
            updatedAt: string;
          }) => void;
        }
      | undefined;

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => ({ fetchQuery: vi.fn() })
    }));
    vi.doMock('@ant-design/x-sdk', () => ({
      useXChat: () => ({
        messages: xMessages,
        setMessages: (next: typeof xMessages | ((current: typeof xMessages) => typeof xMessages)) => {
          setMessages(next);
          xMessages = typeof next === 'function' ? next(xMessages) : next;
          return true;
        },
        onRequest: vi.fn(),
        queueRequest: vi.fn(),
        abort: vi.fn(),
        isRequesting: false
      }),
      useXConversations: () => ({
        conversations: [],
        activeConversationKey: '',
        setActiveConversationKey,
        addConversation: vi.fn(),
        removeConversation: vi.fn(),
        setConversation: vi.fn(),
        getConversation: vi.fn(),
        setConversations,
        getMessages: vi.fn()
      })
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSession: vi.fn(),
      createSessionStream: vi.fn(),
      getCheckpoint: vi.fn(),
      listEvents: vi.fn(),
      listMessages: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => ({
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
        clearPendingUser: vi.fn(),
        insertPendingUserMessage: vi.fn(),
        reconcileFinalSnapshot: vi.fn(),
        refreshCheckpointOnly: vi.fn(),
        hydrateSessionSnapshot: vi.fn(),
        markSessionStatus: vi.fn(),
        renameSessionById: vi.fn(),
        deleteSessionById: vi.fn(),
        deleteActiveSession: vi.fn(),
        regenerateMessage: vi.fn(),
        submitMessageFeedback: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-stream-manager', () => ({
      useChatSessionStreamManager: () => ({
        checkpointRefreshTimer: { current: null },
        setChatActions: vi.fn(),
        scheduleCheckpointRefresh: vi.fn(),
        startSessionPolling: vi.fn(),
        stopSessionPolling: vi.fn(),
        bindStream: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      STARTER_PROMPT: '起步提示',
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      })),
      activateChatSession: vi.fn(),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--')
    }));
    vi.doMock('@/chat-runtime/agent-chat-session-provider', () => ({
      createAgentChatSessionProvider: vi.fn((options: typeof sessionProviderOptions) => {
        sessionProviderOptions = options;
        return { mock: 'provider' };
      })
    }));
    vi.doMock('@/utils/agent-tool-execution-api', () => ({
      getAgentToolGovernanceProjection: vi.fn().mockResolvedValue(undefined)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    setMessages.mockClear();

    sessionProviderOptions?.onSessionResolved?.({
      id: 'session-1',
      title: '部署计划',
      status: 'running',
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z'
    });

    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(xMessages.map(info => info.message.sessionId)).toEqual(['session-1', 'session-1']);

    setMessages.mockClear();

    sessionProviderOptions?.onSessionResolved?.({
      id: 'session-1',
      title: '部署计划',
      status: 'running',
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z'
    });

    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(xMessages.map(info => info.message.sessionId)).toEqual(['session-1', 'session-1']);
  });

  it('does not start the legacy activation stream while the x-sdk request stream is already active', async () => {
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: '部署计划',
          status: 'running',
          createdAt: '2026-05-04T10:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const activateChatSession = vi.fn();

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => ({ fetchQuery: vi.fn() })
    }));
    vi.doMock('@ant-design/x-sdk', () => ({
      useXChat: () => ({
        messages: [],
        setMessages: vi.fn(),
        onRequest: vi.fn(),
        queueRequest: vi.fn(),
        abort: vi.fn(),
        isRequesting: true
      }),
      useXConversations: () => ({
        conversations: [],
        activeConversationKey: 'session:session-1',
        setActiveConversationKey: vi.fn(),
        addConversation: vi.fn(),
        removeConversation: vi.fn(),
        setConversation: vi.fn(),
        getConversation: vi.fn(),
        setConversations: vi.fn(),
        getMessages: vi.fn()
      })
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSession: vi.fn(),
      createSessionStream: vi.fn(),
      getCheckpoint: vi.fn(),
      listEvents: vi.fn(),
      listMessages: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => ({
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
        clearPendingUser: vi.fn(),
        insertPendingUserMessage: vi.fn(),
        reconcileFinalSnapshot: vi.fn(),
        refreshCheckpointOnly: vi.fn(),
        hydrateSessionSnapshot: vi.fn(),
        markSessionStatus: vi.fn(),
        renameSessionById: vi.fn(),
        deleteSessionById: vi.fn(),
        deleteActiveSession: vi.fn(),
        regenerateMessage: vi.fn(),
        submitMessageFeedback: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-stream-manager', () => ({
      useChatSessionStreamManager: () => ({
        checkpointRefreshTimer: { current: null },
        setChatActions: vi.fn(),
        scheduleCheckpointRefresh: vi.fn(),
        startSessionPolling: vi.fn(),
        stopSessionPolling: vi.fn(),
        bindStream: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      STARTER_PROMPT: '起步提示',
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: true
      })),
      activateChatSession,
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--')
    }));
    vi.doMock('@/chat-runtime/agent-chat-session-provider', () => ({
      createAgentChatSessionProvider: vi.fn(() => ({ mock: 'provider' }))
    }));
    vi.doMock('@/utils/agent-tool-execution-api', () => ({
      getAgentToolGovernanceProjection: vi.fn().mockResolvedValue(undefined)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(activateChatSession).not.toHaveBeenCalled();
  });

  it('does not reactivate the same session on a pure rerender when action and manager objects are recreated', async () => {
    const harness = createReactHookHarness({
      0: [
        {
          id: 'session-1',
          title: '部署计划',
          status: 'running',
          createdAt: '2026-05-04T10:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z'
        }
      ],
      1: 'session-1'
    });
    const activateChatSession = vi.fn().mockResolvedValue(undefined);

    const queryClient = { fetchQuery: vi.fn() };
    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient
    }));
    vi.doMock('@ant-design/x-sdk', () => ({
      useXChat: () => ({
        messages: [],
        setMessages: vi.fn(),
        onRequest: vi.fn(),
        queueRequest: vi.fn(),
        abort: vi.fn(),
        isRequesting: false
      }),
      useXConversations: () => ({
        conversations: [],
        activeConversationKey: 'session:session-1',
        setActiveConversationKey: vi.fn(),
        addConversation: vi.fn(),
        removeConversation: vi.fn(),
        setConversation: vi.fn(),
        getConversation: vi.fn(),
        setConversations: vi.fn(),
        getMessages: vi.fn()
      })
    }));
    vi.doMock('@/api/chat-api', () => ({
      appendMessage: vi.fn(),
      createSession: vi.fn(),
      createSessionStream: vi.fn(),
      getCheckpoint: vi.fn(),
      listEvents: vi.fn(),
      listMessages: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      selectSession: vi.fn()
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-actions', () => ({
      createChatSessionActions: () => ({
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
        clearPendingUser: vi.fn(),
        insertPendingUserMessage: vi.fn(),
        reconcileFinalSnapshot: vi.fn(),
        refreshCheckpointOnly: vi.fn(),
        hydrateSessionSnapshot: vi.fn(),
        markSessionStatus: vi.fn(),
        renameSessionById: vi.fn(),
        deleteSessionById: vi.fn(),
        deleteActiveSession: vi.fn(),
        regenerateMessage: vi.fn(),
        submitMessageFeedback: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/use-chat-session-stream-manager', () => ({
      useChatSessionStreamManager: () => ({
        checkpointRefreshTimer: { current: null },
        setChatActions: vi.fn(),
        scheduleCheckpointRefresh: vi.fn(),
        startSessionPolling: vi.fn(),
        stopSessionPolling: vi.fn(),
        bindStream: vi.fn()
      })
    }));
    vi.doMock('@/hooks/chat-session/chat-session-helpers', () => ({
      STARTER_PROMPT: '起步提示',
      activateChatSession,
      buildSessionActivationPlan: vi.fn(() => ({
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      })),
      formatSessionTime: vi.fn((value?: string) => value ?? '--'),
      getMessageRoleLabel: vi.fn((value?: string) => value ?? '--'),
      getSessionStatusLabel: vi.fn((value?: string) => value ?? '--'),
      mergeOrAppendMessage: vi.fn((messages, nextMessage) => [...messages, nextMessage])
    }));
    vi.doMock('@/chat-runtime/agent-chat-session-provider', () => ({
      createAgentChatSessionProvider: vi.fn(() => ({ mock: 'provider' }))
    }));
    vi.doMock('@/utils/agent-tool-execution-api', () => ({
      getAgentToolGovernanceProjection: vi.fn().mockResolvedValue(undefined)
    }));

    const { useChatSession } = await import('@/hooks/use-chat-session');

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    harness.render(() => useChatSession());
    await harness.runEffects();
    await flushAsyncWork();

    expect(activateChatSession).toHaveBeenCalledTimes(1);
  });
});
