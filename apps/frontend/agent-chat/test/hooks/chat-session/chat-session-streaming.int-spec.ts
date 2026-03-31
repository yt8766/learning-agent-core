import { describe, expect, it, vi } from 'vitest';

import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import { createChatSessionActions } from '@/hooks/chat-session/use-chat-session-actions';
import { syncCheckpointFromStreamEvent } from '@/hooks/chat-session/chat-session-stream';
import { syncMessageFromEvent, syncSessionFromEvent } from '@/hooks/chat-session/chat-session-events';

const appendMessageMock = vi.fn();
const getCheckpointMock = vi.fn();

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
  listEvents: vi.fn(),
  listMessages: vi.fn(),
  listSessions: vi.fn(),
  recoverSession: vi.fn(),
  rejectSession: vi.fn(),
  updateSession: vi.fn()
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function applySetter<T>(current: T, next: T | ((value: T) => T)) {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next;
}

describe('chat-session streaming integration', () => {
  it('keeps the assistant reply in one message from optimistic send through token, delta, and final event reconciliation', async () => {
    const deferred = createDeferred<ChatMessageRecord>();
    appendMessageMock.mockReset();
    appendMessageMock.mockReturnValue(deferred.promise);
    getCheckpointMock.mockReset();
    getCheckpointMock.mockResolvedValue(undefined);

    let activeSessionId = 'session-1';
    let draft = '分析这个产品规划';
    let error = '';
    let loading = false;
    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '产品规划分析',
        status: 'idle',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [];
    let events: ChatEventRecord[] = [];
    let checkpoint: ChatCheckpointRecord | undefined;

    const actions = createChatSessionActions({
      activeSessionId,
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

    const sendPromise = actions.sendMessage({
      display: '分析这个产品规划',
      payload: '/browse 分析这个产品规划'
    });

    deferred.resolve({
      id: 'user-msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: '/browse 分析这个产品规划',
      createdAt: '2026-03-28T00:00:01.000Z'
    });
    await sendPromise;

    expect(error).toBe('');
    expect(loading).toBe(false);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: ''
    });
    expect(checkpoint?.thinkState?.loading).toBe(true);

    const assistantTokenEvent: ChatEventRecord = {
      id: 'evt-token-1',
      sessionId: 'session-1',
      type: 'assistant_token',
      at: '2026-03-28T00:00:02.000Z',
      payload: {
        messageId: messages[1]?.id,
        content: '先收紧目标，',
        taskId: 'task-1',
        from: 'manager'
      }
    };

    messages = syncMessageFromEvent(messages, assistantTokenEvent);
    sessions = syncSessionFromEvent(sessions, assistantTokenEvent);
    checkpoint = syncCheckpointFromStreamEvent(checkpoint, assistantTokenEvent);
    events = [...events, assistantTokenEvent];

    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: '先收紧目标，'
    });
    expect(sessions[0]?.status).toBe('running');
    expect(checkpoint?.thinkState?.loading).toBe(true);
    expect(checkpoint?.graphState?.status).toBe('running');

    const assistantDeltaEvent: ChatEventRecord = {
      id: 'evt-delta-1',
      sessionId: 'session-1',
      type: 'final_response_delta',
      at: '2026-03-28T00:00:02.500Z',
      payload: {
        messageId: messages[1]?.id,
        content: '再补验证顺序。',
        taskId: 'task-1',
        from: 'manager'
      }
    };

    messages = syncMessageFromEvent(messages, assistantDeltaEvent);
    sessions = syncSessionFromEvent(sessions, assistantDeltaEvent);
    checkpoint = syncCheckpointFromStreamEvent(checkpoint, assistantDeltaEvent);
    events = [...events, assistantDeltaEvent];

    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: '先收紧目标，再补验证顺序。'
    });
    expect(sessions[0]?.status).toBe('running');
    expect(checkpoint?.graphState?.status).toBe('running');

    const assistantMessageEvent: ChatEventRecord = {
      id: 'evt-final-1',
      sessionId: 'session-1',
      type: 'assistant_message',
      at: '2026-03-28T00:00:03.000Z',
      payload: {
        messageId: messages[1]?.id,
        content: '先收紧目标，再补验证顺序，并明确第一步实现。',
        taskId: 'task-1',
        from: 'manager'
      }
    };

    messages = syncMessageFromEvent(messages, assistantMessageEvent);
    sessions = syncSessionFromEvent(sessions, assistantMessageEvent);
    checkpoint = syncCheckpointFromStreamEvent(checkpoint, assistantMessageEvent);
    events = [...events, assistantMessageEvent];

    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: '先收紧目标，再补验证顺序，并明确第一步实现。'
    });
    expect(sessions[0]?.status).toBe('completed');
    expect(checkpoint?.graphState?.status).toBe('running');
    expect(checkpoint?.thinkState?.loading).toBe(true);
    expect(events.map(event => event.type)).toEqual(['assistant_token', 'final_response_delta', 'assistant_message']);
  });
});
