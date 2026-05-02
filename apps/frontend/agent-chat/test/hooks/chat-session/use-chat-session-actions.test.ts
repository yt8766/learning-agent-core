import { describe, expect, it, vi } from 'vitest';
import {
  cancelSession as cancelSessionApi,
  recoverSession as recoverSessionApi,
  respondInterrupt as respondInterruptApi
} from '@/api/chat-api';

import { createChatSessionActions } from '@/hooks/chat-session/use-chat-session-actions';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

const appendMessageMock = vi.fn();
const listMessagesMock = vi.fn();
const listEventsMock = vi.fn();
const getCheckpointMock = vi.fn();
const installRemoteSkillMock = vi.fn();
const submitMessageFeedbackMock = vi.fn();

vi.mock('../../../src/api/chat-api', () => ({
  allowApprovalCapability: vi.fn(),
  allowApprovalConnector: vi.fn(),
  appendMessage: (...args: unknown[]) => appendMessageMock(...args),
  approveSession: vi.fn(),
  cancelSession: vi.fn(),
  confirmLearning: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getCheckpoint: (...args: unknown[]) => getCheckpointMock(...args),
  getRemoteSkillInstallReceipt: vi.fn(),
  installRemoteSkill: (...args: unknown[]) => installRemoteSkillMock(...args),
  listEvents: (...args: unknown[]) => listEventsMock(...args),
  listMessages: (...args: unknown[]) => listMessagesMock(...args),
  listSessions: vi.fn(),
  recoverSession: vi.fn(),
  rejectSession: vi.fn(),
  respondInterrupt: vi.fn(),
  submitMessageFeedback: (...args: unknown[]) => submitMessageFeedbackMock(...args),
  updateSession: vi.fn()
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function applySetter<T>(current: T, next: T | ((value: T) => T)) {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next;
}

function createMissingSessionError(sessionId: string) {
  return {
    isAxiosError: true,
    response: {
      status: 404,
      data: {
        message: `Session ${sessionId} not found`
      }
    },
    message: 'Request failed with status code 404'
  };
}

describe('use-chat-session-actions optimistic sending', () => {
  it('clears a stale session when detail refresh hits session not found', async () => {
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockRejectedValue(createMissingSessionError('session-1'));
    listEventsMock.mockResolvedValue([]);
    getCheckpointMock.mockResolvedValue(undefined);
    const listSessionsApi = await import('@/api/chat-api');
    vi.mocked(listSessionsApi.listSessions).mockResolvedValue([]);

    let activeSessionId = 'session-1';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'idle',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [
      {
        id: 'm1',
        sessionId: 'session-1',
        role: 'user',
        content: 'hello',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let events: ChatEventRecord[] = [{ sessionId: 'session-1', type: 'user_message' } as ChatEventRecord];
    let checkpoint: ChatCheckpointRecord | undefined = {
      sessionId: 'session-1',
      taskId: 'task-1',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'idle' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:01.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft: '',
      setDraft: vi.fn(),
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.refreshSessionDetail('session-1', false);

    expect(activeSessionId).toBe('');
    expect(sessions).toEqual([]);
    expect(messages).toEqual([]);
    expect(events).toEqual([]);
    expect(checkpoint).toBeUndefined();
    expect(error).toContain('当前会话已失效');
    expect(loading).toBe(false);
  });

  it('shows user message, assistant placeholder, and thinking state immediately after send', async () => {
    const deferred = createDeferred<ChatMessageRecord>();
    appendMessageMock.mockReset();
    appendMessageMock.mockReturnValue(deferred.promise);
    getCheckpointMock.mockReset();
    getCheckpointMock.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-1',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'running' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:01.000Z'
    } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord);

    let activeSessionId = 'session-1';
    let draft = '原始草稿';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'idle',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;
    const reconnectRequests: string[] = [];
    const pendingInitialMessage = { current: null as { sessionId: string; content: string } | null };
    const pendingUserIds = { current: {} as Record<string, string> };
    const pendingAssistantIds = { current: {} as Record<string, string> };
    const optimisticThinkingStartedAt = { current: {} as Record<string, string> };

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: sessionId => {
        reconnectRequests.push(sessionId);
      },
      pendingInitialMessage,
      pendingUserIds,
      pendingAssistantIds,
      optimisticThinkingStartedAt
    });

    const sendPromise = actions.sendMessage({
      display: '这个产品规划怎么样',
      payload: '/browse 这个产品规划怎么样',
      modelId: 'minimax/MiniMax-M2.7'
    });

    expect(reconnectRequests).toEqual(['session-1']);
    expect(draft).toBe('');
    expect(error).toBe('');
    expect(loading).toBe(true);
    expect(sessions[0]?.status).toBe('running');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      sessionId: 'session-1',
      role: 'user',
      content: '这个产品规划怎么样'
    });
    expect(messages[1]).toMatchObject({
      sessionId: 'session-1',
      role: 'assistant',
      content: ''
    });
    expect(checkpoint?.sessionId).toBe('session-1');
    expect(checkpoint?.graphState?.status).toBe('running');
    expect(checkpoint?.thinkState?.title).toBe('正在准备回复');
    expect(checkpoint?.thinkState?.loading).toBe(true);
    expect(checkpoint?.graphState?.currentStep).toBe('drafting_reply');

    deferred.resolve({
      id: 'chat_msg_user_1',
      sessionId: 'session-1',
      role: 'user',
      content: '/browse 这个产品规划怎么样',
      createdAt: '2026-03-28T00:00:01.000Z'
    });
    await sendPromise;

    expect(events).toEqual([]);
    expect(appendMessageMock).toHaveBeenCalledWith('session-1', '/browse 这个产品规划怎么样', {
      modelId: 'minimax/MiniMax-M2.7'
    });
    expect(messages.some(message => message.id === 'chat_msg_user_1')).toBe(true);
    expect(getCheckpointMock).toHaveBeenCalledWith('session-1');
  });

  it('keeps optimistic thinking when checkpoint refresh returns the previous completed turn', async () => {
    const deferred = createDeferred<ChatMessageRecord>();
    appendMessageMock.mockReset();
    appendMessageMock.mockReturnValue(deferred.promise);
    getCheckpointMock.mockReset();
    getCheckpointMock.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-prev',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'completed' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:01.000Z'
    } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord);

    let activeSessionId = 'session-1';
    let draft = '继续一下';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'completed',
        currentTaskId: 'task-prev',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:01.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [
      {
        id: 'assistant-prev',
        sessionId: 'session-1',
        role: 'assistant',
        content: '上一轮已经回答完了',
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined = {
      sessionId: 'session-1',
      taskId: 'task-prev',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'completed' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:01.000Z'
    };
    const pendingInitialMessage = { current: null as { sessionId: string; content: string } | null };
    const pendingUserIds = { current: {} as Record<string, string> };
    const pendingAssistantIds = { current: {} as Record<string, string> };
    const optimisticThinkingStartedAt = { current: {} as Record<string, string> };

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage,
      pendingUserIds,
      pendingAssistantIds,
      optimisticThinkingStartedAt
    });

    const sendPromise = actions.sendMessage('我们刚刚聊了什么');

    deferred.resolve({
      id: 'chat_msg_user_2',
      sessionId: 'session-1',
      role: 'user',
      content: '我们刚刚聊了什么',
      createdAt: new Date().toISOString()
    });
    await sendPromise;

    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(sessions[0]?.status).toBe('running');
    expect(checkpoint?.taskId).toBe('optimistic_session-1');
    expect(checkpoint?.graphState?.status).toBe('running');
    expect(checkpoint?.thinkState?.loading).toBe(true);
    expect(messages.some(message => message.id === 'pending_assistant_session-1')).toBe(true);
    expect(events).toEqual([]);
  });

  it('keeps existing thread history while appending optimistic placeholders for the next turn', async () => {
    const deferred = createDeferred<ChatMessageRecord>();
    appendMessageMock.mockReset();
    appendMessageMock.mockReturnValue(deferred.promise);
    getCheckpointMock.mockReset();
    getCheckpointMock.mockResolvedValue(undefined);

    let activeSessionId = 'session-1';
    let draft = '继续一下';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'completed',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:01.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [
      {
        id: 'assistant-prev',
        sessionId: 'session-1',
        role: 'assistant',
        content: '上一轮已经回答完了',
        createdAt: '2026-03-28T00:00:01.000Z'
      }
    ];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    const sendPromise = actions.sendMessage('继续给我下一步实现建议');

    expect(messages.map(message => message.id)).toEqual([
      'assistant-prev',
      'pending_user_session-1',
      'pending_assistant_session-1'
    ]);
    expect(error).toBe('');
    expect(loading).toBe(true);

    deferred.resolve({
      id: 'chat_msg_user_2',
      sessionId: 'session-1',
      role: 'user',
      content: '继续给我下一步实现建议',
      createdAt: '2026-03-28T00:00:02.000Z'
    });
    await sendPromise;
  });

  it('keeps streamed assistant content visible when detail refresh arrives before final assistant message is persisted', async () => {
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([
      {
        id: 'user-msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: '继续分析这个问题',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([
      {
        id: 'evt-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-03-28T00:00:01.000Z',
        payload: {
          messageId: 'assistant-msg-1',
          content: '这是流式正文',
          taskId: 'task-1',
          from: 'manager'
        }
      },
      {
        id: 'evt-delta-1',
        sessionId: 'session-1',
        type: 'final_response_delta',
        at: '2026-03-28T00:00:02.000Z',
        payload: {
          messageId: 'assistant-msg-1',
          content: '，还在继续补充',
          taskId: 'task-1',
          from: 'manager'
        }
      }
    ] satisfies ChatEventRecord[]);
    getCheckpointMock.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-1',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      pendingApprovals: [],
      agentStates: [],
      graphState: { status: 'running' },
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:02.000Z'
    } as ChatCheckpointRecord);

    let activeSessionId = 'session-1';
    let draft = '';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [
      {
        id: 'user-msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: '继续分析这个问题',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.refreshSessionDetail('session-1', false);

    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'assistant-msg-1',
          role: 'assistant',
          content: '这是流式正文，还在继续补充'
        })
      ])
    );
  });

  it('submits plan-question answers through the interrupt resume API', async () => {
    vi.mocked(respondInterruptApi).mockResolvedValue({
      id: 'session-1',
      title: '计划会话',
      status: 'running',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:02.000Z'
    } as ChatSessionRecord);
    listMessagesMock.mockResolvedValue([]);
    listEventsMock.mockResolvedValue([]);
    getCheckpointMock.mockResolvedValue(undefined);

    let activeSessionId = 'session-1';
    let draft = '';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '计划会话',
        status: 'waiting_interrupt',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.updatePlanInterrupt({
      action: 'input',
      interruptId: 'interrupt-plan-1',
      answers: [{ questionId: 'delivery_mode', optionId: 'plan_only', freeform: '先只给我方案' }]
    });

    expect(respondInterruptApi).toHaveBeenCalledWith('session-1', {
      endpoint: 'approve',
      intent: 'plan_question',
      interrupt: {
        interruptId: 'interrupt-plan-1',
        action: 'input',
        payload: {
          answers: [{ questionId: 'delivery_mode', optionId: 'plan_only', freeform: '先只给我方案' }],
          interactionKind: 'plan-question'
        }
      }
    });
    expect(error).toBe('');
    expect(loading).toBe(false);
  });

  it('keeps message merging isolated to the refreshed session', async () => {
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([
      {
        id: 'server-msg-2',
        sessionId: 'session-2',
        role: 'assistant',
        content: '这是会话 2 的内容',
        createdAt: '2026-03-28T00:00:02.000Z'
      }
    ] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([] satisfies ChatEventRecord[]);
    getCheckpointMock.mockResolvedValue(undefined);

    let activeSessionId = 'session-2';
    let draft = '';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'completed',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'session-2',
        title: '会话 2',
        status: 'idle',
        createdAt: '2026-03-28T00:00:01.000Z',
        updatedAt: '2026-03-28T00:00:01.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [
      {
        id: 'server-msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是会话 1 的内容',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[1],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.refreshSessionDetail('session-2', false);

    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(events).toEqual([]);
    expect(checkpoint).toBeUndefined();
    expect(messages).toEqual([
      {
        id: 'server-msg-2',
        sessionId: 'session-2',
        role: 'assistant',
        content: '这是会话 2 的内容',
        createdAt: '2026-03-28T00:00:02.000Z'
      }
    ]);
    expect(messages.some(message => message.sessionId === 'session-1')).toBe(false);
    expect(sessions).toHaveLength(2);
  });

  it('preserves newer streamed assistant replies when detail refresh returns a stale snapshot', async () => {
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([
      {
        id: 'user-msg-2',
        sessionId: 'session-1',
        role: 'user',
        content: '第二轮问题',
        createdAt: '2026-03-28T00:00:02.000Z'
      }
    ] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([
      {
        id: 'evt-token-2',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-03-28T00:00:03.000Z',
        payload: {
          messageId: 'assistant-msg-2',
          content: '这是第二轮回复',
          taskId: 'task-2',
          from: 'manager'
        }
      },
      {
        id: 'evt-finished-2',
        sessionId: 'session-1',
        type: 'session_finished',
        at: '2026-03-28T00:00:03.100Z',
        payload: {
          taskId: 'task-2'
        }
      }
    ] satisfies ChatEventRecord[]);
    getCheckpointMock.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-2',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'completed' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:02.000Z',
      updatedAt: '2026-03-28T00:00:03.100Z'
    } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord);

    let activeSessionId = 'session-1';
    let draft = '';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [
      {
        id: 'user-msg-2',
        sessionId: 'session-1',
        role: 'user',
        content: '第二轮问题',
        createdAt: '2026-03-28T00:00:02.000Z'
      },
      {
        id: 'assistant-msg-2',
        sessionId: 'session-1',
        role: 'assistant',
        content: '这是第二轮回复，已经完整流完了。',
        taskId: 'task-2',
        linkedAgent: 'manager',
        createdAt: '2026-03-28T00:00:03.500Z'
      }
    ];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.refreshSessionDetail('session-1', false);

    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'assistant-msg-2',
          role: 'assistant',
          content: '这是第二轮回复，已经完整流完了。'
        })
      ])
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'evt-token-2',
          type: 'assistant_token'
        }),
        expect.objectContaining({
          id: 'evt-finished-2',
          type: 'session_finished'
        })
      ])
    );
    expect(checkpoint?.graphState?.status).toBe('completed');
  });

  it('does not let stale detail refresh regress a newer local checkpoint', async () => {
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([] satisfies ChatEventRecord[]);
    getCheckpointMock.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-3',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'running', currentStep: 'drafting_reply' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:04.000Z',
      updatedAt: '2026-03-28T00:00:04.000Z'
    } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord);

    let activeSessionId = 'session-1';
    let draft = '';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:04.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined = {
      sessionId: 'session-1',
      taskId: 'task-3',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'completed', currentStep: 'final_response' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:04.000Z',
      updatedAt: '2026-03-28T00:00:05.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId,
      activeSession: sessions[0],
      checkpoint,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: next => {
        events = applySetter(events, next);
      },
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: next => {
        activeSessionId = applySetter(activeSessionId, next);
      },
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.refreshSessionDetail('session-1', false);

    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(checkpoint?.graphState?.status).toBe('completed');
  });

  it('does not call cancel API when the active run is already cancelled', async () => {
    const cancelSessionMock = vi.mocked(cancelSessionApi);
    cancelSessionMock.mockReset();

    let error = '';
    let loading = false;
    const activeSession: ChatSessionRecord = {
      id: 'session-1',
      title: '会话 1',
      status: 'cancelled',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession,
      checkpoint: undefined,
      draft: '',
      setDraft: vi.fn(),
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: vi.fn(),
      setMessages: vi.fn(),
      setEvents: vi.fn(),
      setCheckpoint: vi.fn(),
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.cancelActiveSession();

    expect(cancelSessionMock).not.toHaveBeenCalled();
    expect(error).toBe('当前这轮已经终止，无需重复操作。');
    expect(loading).toBe(false);
  });

  it('does not call cancel API when the active session is idle without a task', async () => {
    const cancelSessionMock = vi.mocked(cancelSessionApi);
    cancelSessionMock.mockReset();

    let error = '';
    const activeSession: ChatSessionRecord = {
      id: 'session-1',
      title: '会话 1',
      status: 'idle',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession,
      checkpoint: undefined,
      draft: '',
      setDraft: vi.fn(),
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: vi.fn(),
      setSessions: vi.fn(),
      setMessages: vi.fn(),
      setEvents: vi.fn(),
      setCheckpoint: vi.fn(),
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.cancelActiveSession();

    expect(cancelSessionMock).not.toHaveBeenCalled();
    expect(error).toBe('当前没有可终止的运行中的任务。');
  });

  it('applies cancelled status and clears thinking state immediately after cancel succeeds', async () => {
    const cancelSessionMock = vi.mocked(cancelSessionApi);
    cancelSessionMock.mockReset();
    cancelSessionMock.mockResolvedValue({
      id: 'session-1',
      title: '会话 1',
      status: 'cancelled',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:02.000Z'
    } as ChatSessionRecord);
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([] satisfies ChatEventRecord[]);
    getCheckpointMock.mockResolvedValue(undefined);

    let error = '';
    let loading = false;
    let messages: ChatMessageRecord[] = [];
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let checkpoint: ChatCheckpointRecord | undefined = {
      sessionId: 'session-1',
      taskId: 'task-1',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      pendingApprovals: [],
      agentStates: [],
      graphState: {
        status: 'running',
        currentStep: 'executing'
      },
      thinkState: {
        messageId: 'assistant-1',
        title: '正在思考',
        content: '处理中',
        thinkingDurationMs: 120,
        loading: true,
        blink: true
      },
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: sessions[0],
      checkpoint,
      draft: '',
      setDraft: vi.fn(),
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: vi.fn(),
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.cancelActiveSession('用户终止');

    expect(cancelSessionMock).toHaveBeenCalledWith('session-1', '用户终止');
    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(sessions[0]?.status).toBe('cancelled');
    expect(checkpoint?.graphState?.status).toBe('cancelled');
    expect(checkpoint?.graphState?.currentStep).toBe('cancelled');
    expect(checkpoint?.thinkState).toBeUndefined();
    expect(messages).toEqual([
      expect.objectContaining({
        role: 'system',
        content: '本轮已终止：用户终止',
        card: expect.objectContaining({
          type: 'control_notice',
          tone: 'warning',
          label: '本轮已终止'
        })
      })
    ]);
  });

  it('does not call recover API when the active run is already processing', async () => {
    const recoverSessionMock = vi.mocked(recoverSessionApi);
    recoverSessionMock.mockReset();

    let error = '';
    const activeSession: ChatSessionRecord = {
      id: 'session-1',
      title: '会话 1',
      status: 'running',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession,
      checkpoint: undefined,
      draft: '',
      setDraft: vi.fn(),
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: vi.fn(),
      setSessions: vi.fn(),
      setMessages: vi.fn(),
      setEvents: vi.fn(),
      setCheckpoint: vi.fn(),
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.recoverActiveSession();

    expect(recoverSessionMock).not.toHaveBeenCalled();
    expect(error).toBe('当前这轮已经在处理中，无需重复恢复。');
  });

  it('applies running status and reconnects stream immediately after recover succeeds', async () => {
    const recoverSessionMock = vi.mocked(recoverSessionApi);
    recoverSessionMock.mockReset();
    recoverSessionMock.mockResolvedValue({
      id: 'session-1',
      title: '会话 1',
      status: 'idle',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:03.000Z'
    } as ChatSessionRecord);
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([] satisfies ChatEventRecord[]);
    getCheckpointMock.mockResolvedValue(undefined);

    let error = '';
    let loading = false;
    let messages: ChatMessageRecord[] = [];
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'cancelled',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let checkpoint: ChatCheckpointRecord | undefined = {
      sessionId: 'session-1',
      taskId: 'task-1',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      pendingApprovals: [],
      agentStates: [],
      graphState: {
        status: 'cancelled',
        currentStep: 'cancelled'
      },
      thinkState: undefined,
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };
    const reconnectRequests: string[] = [];

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: sessions[0],
      checkpoint,
      draft: '',
      setDraft: vi.fn(),
      setError: next => {
        error = applySetter(error, next);
      },
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: vi.fn(),
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: sessionId => {
        reconnectRequests.push(sessionId);
      },
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.recoverActiveSession();

    expect(recoverSessionMock).toHaveBeenCalledWith('session-1');
    expect(reconnectRequests).toEqual(['session-1']);
    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(sessions[0]?.status).toBe('running');
    expect(checkpoint?.graphState?.status).toBe('running');
    expect(checkpoint?.thinkState).toEqual(
      expect.objectContaining({
        title: '正在恢复执行',
        loading: true
      })
    );
    expect(messages).toEqual([
      expect.objectContaining({
        role: 'system',
        content: '已恢复执行',
        card: expect.objectContaining({
          type: 'control_notice',
          tone: 'success',
          label: '已恢复执行'
        })
      })
    ]);
  });

  it('insert immediate install copy when remote skill install starts directly', async () => {
    installRemoteSkillMock.mockReset();
    installRemoteSkillMock.mockResolvedValue({
      id: 'receipt-1',
      status: 'approved',
      phase: 'installing',
      result: 'running_npx_skills_add'
    } as any);
    (globalThis as any).window = {
      setTimeout: vi.fn()
    };

    let loading = false;
    let messages: ChatMessageRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: {
        id: 'session-1',
        title: '会话 1',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      checkpoint,
      draft: '',
      setDraft: vi.fn(),
      setError: vi.fn(),
      setLoading: next => {
        loading = applySetter(loading, next);
      },
      setSessions: vi.fn(),
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: vi.fn(),
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.installSuggestedSkill({
      id: 'remote:vercel-labs/skills:find-skills',
      kind: 'remote-skill',
      displayName: 'find-skills',
      summary: '安装后继续',
      score: 0.9,
      availability: 'installable-remote',
      reason: '需要补齐能力',
      requiredCapabilities: [],
      repo: 'vercel-labs/skills',
      skillName: 'find-skills',
      triggerReason: 'capability_gap_detected'
    } as any);

    expect(loading).toBe(false);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: '已开始安装 Skill：find-skills'
        })
      ])
    );
  });

  it('retries final snapshot reconcile once when the first terminal refresh is still running', async () => {
    vi.useFakeTimers();
    listMessagesMock.mockReset();
    listEventsMock.mockReset();
    getCheckpointMock.mockReset();
    listMessagesMock.mockResolvedValue([] satisfies ChatMessageRecord[]);
    listEventsMock.mockResolvedValue([] satisfies ChatEventRecord[]);
    getCheckpointMock
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        taskId: 'task-1',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: { status: 'running' },
        pendingApprovals: [],
        agentStates: [],
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:01.000Z'
      } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord)
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        taskId: 'task-1',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: { status: 'completed' },
        pendingApprovals: [],
        agentStates: [],
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:02.000Z'
      } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord);

    let checkpoint: ChatCheckpointRecord | undefined;
    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: {
        id: 'session-1',
        title: '会话 1',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      checkpoint,
      draft: '',
      setDraft: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setSessions: vi.fn(),
      setMessages: vi.fn(),
      setEvents: vi.fn(),
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    const reconcilePromise = actions.reconcileFinalSnapshot('session-1');
    await vi.runAllTimersAsync();
    const detail = await reconcilePromise;

    expect(getCheckpointMock).toHaveBeenCalledTimes(2);
    expect(detail?.status).toBe('completed');
    expect(checkpoint?.graphState?.status).toBe('completed');
    vi.useRealTimers();
  });

  it('refreshCheckpointOnly keeps a newer local terminal checkpoint when the fetched checkpoint is stale', async () => {
    getCheckpointMock.mockReset();
    getCheckpointMock.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-4',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'running', currentStep: 'drafting_reply' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:04.000Z',
      updatedAt: '2026-03-28T00:00:04.000Z'
    } satisfies Partial<ChatCheckpointRecord> as ChatCheckpointRecord);

    let checkpoint: ChatCheckpointRecord | undefined = {
      sessionId: 'session-1',
      taskId: 'task-4',
      learningCursor: 0,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      graphState: { status: 'completed', currentStep: 'final_response' },
      pendingApprovals: [],
      agentStates: [],
      createdAt: '2026-03-28T00:00:04.000Z',
      updatedAt: '2026-03-28T00:00:05.000Z'
    };

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: {
        id: 'session-1',
        title: '会话 1',
        status: 'completed',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:05.000Z'
      },
      checkpoint,
      draft: '',
      setDraft: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setSessions: vi.fn(),
      setMessages: vi.fn(),
      setEvents: vi.fn(),
      setCheckpoint: next => {
        checkpoint = applySetter(checkpoint, next);
      },
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    const refreshed = await actions.refreshCheckpointOnly('session-1');

    expect(refreshed?.graphState?.status).toBe('completed');
    expect(checkpoint?.graphState?.status).toBe('completed');
  });

  it('regenerates an assistant response by resending the closest prior user message', async () => {
    appendMessageMock.mockReset();
    getCheckpointMock.mockReset();
    appendMessageMock.mockResolvedValue({
      id: 'user-msg-regenerated',
      sessionId: 'session-1',
      role: 'user',
      content: '请解释容器和镜像',
      createdAt: '2026-05-03T00:00:03.000Z'
    } satisfies ChatMessageRecord);
    getCheckpointMock.mockResolvedValue(undefined);

    let draft = '';
    let messages: ChatMessageRecord[] = [
      {
        id: 'user-msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: '请解释容器和镜像',
        createdAt: '2026-05-03T00:00:00.000Z'
      },
      {
        id: 'assistant-msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '镜像是模板，容器是实例。',
        createdAt: '2026-05-03T00:00:01.000Z'
      }
    ];
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '会话 1',
        status: 'completed',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:01.000Z'
      }
    ];

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: sessions[0],
      messages,
      checkpoint: undefined,
      draft,
      setDraft: next => {
        draft = applySetter(draft, next);
      },
      setError: vi.fn(),
      setLoading: vi.fn(),
      setSessions: next => {
        sessions = applySetter(sessions, next);
      },
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: vi.fn(),
      setCheckpoint: vi.fn(),
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.regenerateMessage(messages[1]);

    expect(appendMessageMock).toHaveBeenCalledWith('session-1', '请解释容器和镜像', {
      modelId: undefined
    });
    expect(messages.some(message => message.id === 'assistant-msg-1')).toBe(true);
    expect(messages.some(message => message.id === 'pending_assistant_session-1')).toBe(true);
  });

  it('submits feedback and replaces the matching message with the API response', async () => {
    submitMessageFeedbackMock.mockReset();
    submitMessageFeedbackMock.mockResolvedValue({
      id: 'assistant-msg-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '镜像是模板，容器是实例。',
      feedback: {
        rating: 'helpful',
        updatedAt: '2026-05-03T00:00:02.000Z'
      },
      createdAt: '2026-05-03T00:00:01.000Z'
    } satisfies ChatMessageRecord);

    let messages: ChatMessageRecord[] = [
      {
        id: 'assistant-msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '镜像是模板，容器是实例。',
        createdAt: '2026-05-03T00:00:01.000Z'
      }
    ];

    const actions = createChatSessionActions({
      activeSessionId: 'session-1',
      activeSession: {
        id: 'session-1',
        title: '会话 1',
        status: 'completed',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:01.000Z'
      },
      checkpoint: undefined,
      draft: '',
      setDraft: vi.fn(),
      setError: vi.fn(),
      setLoading: vi.fn(),
      setSessions: vi.fn(),
      setMessages: next => {
        messages = applySetter(messages, next);
      },
      setEvents: vi.fn(),
      setCheckpoint: vi.fn(),
      setActiveSessionId: vi.fn(),
      requestStreamReconnect: vi.fn(),
      pendingInitialMessage: { current: null },
      pendingUserIds: { current: {} },
      pendingAssistantIds: { current: {} },
      optimisticThinkingStartedAt: { current: {} }
    });

    await actions.submitMessageFeedback(messages[0], { rating: 'helpful' });

    expect(submitMessageFeedbackMock).toHaveBeenCalledWith('session-1', 'assistant-msg-1', {
      rating: 'helpful'
    });
    expect(messages[0]?.feedback).toEqual({
      rating: 'helpful',
      updatedAt: '2026-05-03T00:00:02.000Z'
    });
  });
});
