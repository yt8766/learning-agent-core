import { describe, expect, it, vi } from 'vitest';

import { createAgentChatActions } from '@/chat-runtime/agent-chat-actions';
import {
  buildAgentChatConversationKey,
  parseAgentChatConversationKey,
  toAgentChatConversationData
} from '@/chat-runtime/agent-chat-conversations';
import { createAgentChatProvider } from '@/chat-runtime/agent-chat-provider';
import type { ChatEventRecord, ChatSessionRecord } from '@/types/chat';

function createSession(overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id: 'session-1',
    title: '部署计划',
    status: 'running',
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
    ...overrides
  };
}

describe('agent chat runtime bridge', () => {
  it('builds x-sdk conversation data and parses the persisted session key', () => {
    const conversation = toAgentChatConversationData(
      createSession({
        id: 'session-42',
        status: 'waiting_approval',
        title: '审批中的部署计划'
      })
    );

    expect(conversation).toMatchObject({
      key: 'session:session-42',
      label: '审批中的部署计划',
      status: 'waiting_approval'
    });
    expect(buildAgentChatConversationKey('session-42')).toBe('session:session-42');
    expect(parseAgentChatConversationKey('session:session-42')).toBe('session-42');
    expect(parseAgentChatConversationKey('')).toBeUndefined();
  });

  it('lists conversations and ensures either an existing or a new session', async () => {
    const existingSession = createSession({ id: 'session-existing', title: '已有会话', status: 'completed' });
    const createdSession = createSession({ id: 'session-created', title: '新会话', status: 'running' });
    const messages = [
      {
        id: 'msg-1',
        sessionId: existingSession.id,
        role: 'user',
        content: '你好',
        createdAt: '2026-05-04T10:00:00.000Z'
      }
    ];
    const events = [
      {
        id: 'evt-1',
        sessionId: existingSession.id,
        type: 'assistant_message',
        at: '2026-05-04T10:00:01.000Z',
        payload: { messageId: 'msg-2', content: '收到' }
      }
    ];
    const checkpoint = { sessionId: existingSession.id, updatedAt: '2026-05-04T10:00:02.000Z' };
    const stream = { source: 'stream' } as unknown as EventSource;
    const appendedMessage = {
      id: 'msg-append-1',
      sessionId: existingSession.id,
      role: 'user',
      content: '继续生成部署计划',
      createdAt: '2026-05-04T10:01:00.000Z'
    };
    const api = {
      listSessions: vi.fn().mockResolvedValue([existingSession]),
      selectSession: vi.fn().mockResolvedValue(existingSession),
      createSession: vi.fn().mockResolvedValue(createdSession),
      listMessages: vi.fn().mockResolvedValue(messages),
      listEvents: vi.fn().mockResolvedValue(events),
      getCheckpoint: vi.fn().mockResolvedValue(checkpoint),
      appendMessage: vi.fn().mockResolvedValue(appendedMessage),
      createSessionStream: vi.fn().mockReturnValue(stream)
    };

    const actions = createAgentChatActions({ api });
    const conversations = await actions.listConversations();
    const selected = await actions.ensureSession(buildAgentChatConversationKey(existingSession.id), '忽略这句');
    const created = await actions.ensureSession('', '生成部署计划');
    const listedMessages = await actions.listMessages(existingSession.id);
    const listedEvents = await actions.listEvents(existingSession.id);
    const loadedCheckpoint = await actions.getCheckpoint(existingSession.id);
    const nextUserMessage = await actions.appendMessage(existingSession.id, '继续生成部署计划');
    const nextStream = actions.createSessionStream(existingSession.id);

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      key: 'session:session-existing',
      label: '已有会话'
    });
    expect(api.selectSession).toHaveBeenCalledWith('session-existing');
    expect(api.createSession).toHaveBeenCalledWith('生成部署计划');
    expect(selected.id).toBe('session-existing');
    expect(created.id).toBe('session-created');
    expect(api.listMessages).toHaveBeenCalledWith('session-existing');
    expect(api.listEvents).toHaveBeenCalledWith('session-existing');
    expect(api.getCheckpoint).toHaveBeenCalledWith('session-existing');
    expect(api.appendMessage).toHaveBeenCalledWith('session-existing', '继续生成部署计划', undefined);
    expect(api.createSessionStream).toHaveBeenCalledWith('session-existing');
    expect(listedMessages).toBe(messages);
    expect(listedEvents).toBe(events);
    expect(loadedCheckpoint).toBe(checkpoint);
    expect(nextUserMessage).toBe(appendedMessage);
    expect(nextStream).toBe(stream);
  });

  it('starts a follow-up stream, submits the user turn, and folds assistant text plus runtime meta into patch callbacks', async () => {
    const session = createSession({ id: 'session-stream', title: '部署计划', status: 'running' });
    const stream = {} as EventSource;
    const events: ChatEventRecord[] = [
      {
        id: 'evt-1',
        sessionId: session.id,
        type: 'assistant_token',
        at: '2026-05-04T10:00:01.000Z',
        payload: {
          messageId: 'direct_reply_task-1',
          content: '先整理部署目标。'
        }
      },
      {
        id: 'evt-2',
        sessionId: session.id,
        type: 'checkpoint.updated',
        at: '2026-05-04T10:00:02.000Z',
        payload: {
          thinkState: {
            loading: true,
            messageId: 'direct_reply_task-1',
            thinkingDurationMs: 1200
          },
          thoughtChain: [{ id: 'thought-1', title: '检查现有工作流' }],
          responseSteps: [{ id: 'step-1', label: 'Read deployment docs' }]
        }
      }
    ];
    const ensureSession = vi.fn().mockResolvedValue(session);
    const appendMessage = vi.fn().mockResolvedValue({
      id: 'msg-user-2',
      sessionId: session.id,
      role: 'user',
      content: '生成部署计划',
      createdAt: '2026-05-04T10:00:00.500Z'
    });
    const createSessionStream = vi.fn().mockReturnValue(stream);
    const bindStream = vi.fn(
      (_: EventSource, handlers: { onEvent: (event: ChatEventRecord) => void; onDone: () => void }) => {
        for (const event of events) {
          handlers.onEvent(event);
        }
        handlers.onDone();
      }
    );

    const provider = createAgentChatProvider({
      appendMessage,
      ensureSession,
      createSessionStream,
      bindStream
    });
    const chunks: Array<{
      content: string;
      thinkLoading?: boolean;
      responseStepCount: number;
      thoughtChainTitles: string[];
    }> = [];
    let placeholderSessionId = '';

    await provider.sendMessage(
      {
        conversationKey: buildAgentChatConversationKey(session.id),
        messages: [{ role: 'user', content: '生成部署计划' }]
      },
      {
        onAssistantPlaceholder: info => {
          placeholderSessionId = info.sessionId;
        },
        onChunk: chunk => {
          chunks.push({
            content: chunk.message.content,
            thinkLoading: chunk.message.meta?.think?.loading,
            responseStepCount: chunk.message.meta?.responseSteps?.length ?? 0,
            thoughtChainTitles: (chunk.message.meta?.thoughtChain ?? []).map(item => item.title)
          });
        }
      }
    );

    expect(ensureSession).toHaveBeenCalledWith('session:session-stream', '生成部署计划');
    expect(appendMessage).toHaveBeenCalledWith('session-stream', '生成部署计划');
    expect(createSessionStream).toHaveBeenCalledWith('session-stream');
    expect(bindStream).toHaveBeenCalledTimes(1);
    expect(placeholderSessionId).toBe('session-stream');
    expect(chunks).toEqual([
      {
        content: '先整理部署目标。',
        thinkLoading: undefined,
        responseStepCount: 0,
        thoughtChainTitles: []
      },
      {
        content: '先整理部署目标。',
        thinkLoading: true,
        responseStepCount: 1,
        thoughtChainTitles: ['检查现有工作流']
      }
    ]);
  });

  it('does not append a second message when opening a brand-new session stream', async () => {
    const createdSession = createSession({ id: 'session-created', title: '新会话', status: 'running' });
    const appendMessage = vi.fn();
    const ensureSession = vi.fn().mockResolvedValue(createdSession);
    const createSessionStream = vi.fn().mockReturnValue({} as EventSource);
    const bindStream = vi.fn((_: EventSource, handlers: { onDone: () => void }) => {
      handlers.onDone();
    });

    const provider = createAgentChatProvider({
      appendMessage,
      ensureSession,
      createSessionStream,
      bindStream
    });

    await provider.sendMessage(
      {
        conversationKey: '',
        messages: [{ role: 'user', content: '第一次发起会话' }]
      },
      {
        onChunk: () => undefined
      }
    );

    expect(ensureSession).toHaveBeenCalledWith('', '第一次发起会话');
    expect(appendMessage).not.toHaveBeenCalled();
    expect(createSessionStream).toHaveBeenCalledWith('session-created');
  });
});
