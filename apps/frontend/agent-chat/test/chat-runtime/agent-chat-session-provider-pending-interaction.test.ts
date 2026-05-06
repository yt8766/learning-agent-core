import { describe, expect, it, vi } from 'vitest';

import { createAgentChatSessionProvider } from '@/chat-runtime/agent-chat-session-provider';

describe('AgentChatSessionProvider pending interaction replies', () => {
  it('does not open a new run stream after a natural-language approval reply is handled', async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      handledAs: 'pending_interaction_reply',
      message: {
        id: 'interaction_reply_1',
        sessionId: 'session-1',
        role: 'user',
        content: '确认推送',
        createdAt: '2026-05-05T10:00:00.000Z'
      },
      interactionResolution: {
        interactionId: 'interaction-1',
        intent: {
          interactionId: 'interaction-1',
          action: 'approve',
          confidence: 0.98,
          normalizedText: '确认推送'
        }
      }
    });
    const createSessionStream = vi.fn();
    const bindStream = vi.fn();
    const onChunk = vi.fn();
    const provider = createAgentChatSessionProvider({
      appendMessage,
      bindStream,
      createSessionStream,
      ensureSession: vi.fn().mockResolvedValue({
        id: 'session-1',
        title: '部署计划',
        status: 'waiting_approval',
        createdAt: '2026-05-05T10:00:00.000Z',
        updatedAt: '2026-05-05T10:00:00.000Z'
      })
    });

    const result = await provider.sendMessage(
      {
        conversationKey: 'session:session-1',
        messages: [{ role: 'user', content: '确认推送' }]
      },
      { onChunk }
    );

    expect(createSessionStream).not.toHaveBeenCalled();
    expect(bindStream).not.toHaveBeenCalled();
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        message: expect.objectContaining({
          role: 'assistant',
          content: '已收到确认，正在继续原运行。'
        })
      })
    );
    expect(result.message.content).toBe('已收到确认，正在继续原运行。');
  });
});
