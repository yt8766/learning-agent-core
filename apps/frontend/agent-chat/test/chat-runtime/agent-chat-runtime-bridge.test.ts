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
    const api = {
      listSessions: vi.fn().mockResolvedValue([existingSession]),
      selectSession: vi.fn().mockResolvedValue(existingSession),
      createSession: vi.fn().mockResolvedValue(createdSession),
      listMessages: vi.fn(),
      listEvents: vi.fn(),
      getCheckpoint: vi.fn(),
      appendMessage: vi.fn(),
      createSessionStream: vi.fn()
    };

    const actions = createAgentChatActions({ api });
    const conversations = await actions.listConversations();
    const selected = await actions.ensureSession(buildAgentChatConversationKey(existingSession.id), '忽略这句');
    const created = await actions.ensureSession('', '生成部署计划');

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      key: 'session:session-existing',
      label: '已有会话'
    });
    expect(api.selectSession).toHaveBeenCalledWith('session-existing');
    expect(api.createSession).toHaveBeenCalledWith('生成部署计划');
    expect(selected.id).toBe('session-existing');
    expect(created.id).toBe('session-created');
  });

  it('starts a stream and folds assistant text plus runtime meta into patch callbacks', async () => {
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
      ensureSession,
      createSessionStream,
      bindStream
    });
    const chunks: Array<{ content: string; thinkLoading?: boolean; responseStepCount: number }> = [];
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
            responseStepCount: chunk.message.meta?.responseSteps?.length ?? 0
          });
        }
      }
    );

    expect(ensureSession).toHaveBeenCalledWith('session:session-stream', '生成部署计划');
    expect(createSessionStream).toHaveBeenCalledWith('session-stream');
    expect(bindStream).toHaveBeenCalledTimes(1);
    expect(placeholderSessionId).toBe('session-stream');
    expect(chunks).toEqual([
      {
        content: '先整理部署目标。',
        thinkLoading: undefined,
        responseStepCount: 0
      },
      {
        content: '先整理部署目标。',
        thinkLoading: true,
        responseStepCount: 1
      }
    ]);
  });
});
