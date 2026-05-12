import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/chat-session/chat-session-formatters', () => ({
  LOCAL_USER_EPHEMERAL_SLUG: 'local-ephemeral'
}));

vi.mock('@/utils/agent-chat-debug', () => ({
  debugAgentChat: vi.fn(),
  summarizeDebugEvent: vi.fn(() => 'event'),
  summarizeDebugMessage: vi.fn(() => 'message')
}));

vi.mock('@/chat-runtime/agent-chat-conversations', () => ({
  parseAgentChatConversationKey: vi.fn((key: string) => (key ? key : undefined))
}));

import {
  createAgentChatSessionProvider,
  type AgentChatSessionProviderDeps,
  type AgentChatSessionProviderHooks
} from '@/chat-runtime/agent-chat-session-provider';

function createMockDeps(overrides: Partial<AgentChatSessionProviderDeps> = {}): AgentChatSessionProviderDeps {
  return {
    appendMessage: vi.fn().mockResolvedValue({}),
    bindStream: vi.fn(),
    createSessionStream: vi.fn(() => ({ close: vi.fn() }) as unknown as EventSource),
    ensureSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Test Session',
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    onSessionResolved: vi.fn(),
    ...overrides
  };
}

describe('createAgentChatSessionProvider', () => {
  it('creates a provider instance', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);

    expect(provider).toBeDefined();
  });

  it('transformParams returns conversationKey and messages', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);

    const result = provider.transformParams({
      conversationKey: 'conv-1',
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(result.conversationKey).toBe('conv-1');
    expect(result.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('transformParams uses defaults for missing fields', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);

    const result = provider.transformParams({});

    expect(result.conversationKey).toBe('');
    expect(result.messages).toEqual([]);
  });

  it('transformLocalMessage creates a user message record', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);

    const result = provider.transformLocalMessage({
      conversationKey: 'session-1',
      messages: [{ role: 'user', content: 'test message' }]
    });

    expect(result.role).toBe('user');
    expect(result.content).toBe('test message');
    expect(result.sessionId).toBe('session-1');
    expect(result.id).toContain('local-ephemeral');
  });

  it('transformMessage returns chunk message when available', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);
    const message = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'assistant' as const,
      content: 'response',
      createdAt: new Date().toISOString()
    };

    const result = provider.transformMessage({ chunk: { message, sessionId: 'session-1' } });

    expect(result).toBe(message);
  });

  it('transformMessage returns originMessage when chunk is undefined', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);
    const origin = {
      id: 'msg-origin',
      sessionId: 'session-1',
      role: 'assistant' as const,
      content: 'origin',
      createdAt: new Date().toISOString()
    };

    const result = provider.transformMessage({ originMessage: origin });

    expect(result).toBe(origin);
  });

  it('transformMessage creates empty assistant message when nothing provided', () => {
    const deps = createMockDeps();
    const provider = createAgentChatSessionProvider(deps);

    const result = provider.transformMessage({});

    expect(result.role).toBe('assistant');
    expect(result.content).toBe('');
  });

  it('sendMessage resolves with a chunk after stream completes', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'Hello', messageId: 'msg-1' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = {
      onChunk: vi.fn(),
      onDone: vi.fn()
    };

    const result = await provider.sendMessage(
      {
        conversationKey: 'session-1',
        messages: [{ role: 'user', content: 'Hi' }]
      },
      hooks
    );

    expect(result.sessionId).toBe('session-1');
    expect(hooks.onChunk).toHaveBeenCalled();
    expect(hooks.onDone).toHaveBeenCalled();
  });

  it('sendMessage creates a new session when no conversationKey', async () => {
    const ensureSession = vi.fn().mockResolvedValue({
      id: 'new-session',
      title: 'New',
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onDone();
    });
    const deps = createMockDeps({ ensureSession, bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    await provider.sendMessage({ conversationKey: '', messages: [{ role: 'user', content: 'test' }] }, hooks);

    expect(ensureSession).toHaveBeenCalledWith(undefined, 'test');
  });

  it('sendMessage calls onError when stream errors', async () => {
    const error = new Error('stream failed');
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onError?.(error);
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = {
      onChunk: vi.fn(),
      onError: vi.fn()
    };

    await expect(
      provider.sendMessage({ conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] }, hooks)
    ).rejects.toThrow('stream failed');

    expect(hooks.onError).toHaveBeenCalledWith(error);
  });

  it('sendMessage handles appendMessage returning pending_interaction_reply with approve', async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        intent: { action: 'approve' }
      }
    });
    const deps = createMockDeps({ appendMessage });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = {
      onChunk: vi.fn(),
      onDone: vi.fn()
    };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'confirm' }] },
      hooks
    );

    expect(result.message.content).toContain('已收到确认');
    expect(hooks.onDone).toHaveBeenCalled();
  });

  it('sendMessage handles pending_interaction_reply with reject action', async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        intent: { action: 'reject' }
      }
    });
    const deps = createMockDeps({ appendMessage });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn(), onDone: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'cancel' }] },
      hooks
    );

    expect(result.message.content).toContain('已取消这次执行');
  });

  it('sendMessage handles pending_interaction_reply with feedback action', async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        intent: { action: 'feedback' }
      }
    });
    const deps = createMockDeps({ appendMessage });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn(), onDone: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'fix this' }] },
      hooks
    );

    expect(result.message.content).toContain('已收到反馈');
  });

  it('sendMessage handles pending_interaction_reply with unknown action', async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        intent: { action: 'something_else' }
      }
    });
    const deps = createMockDeps({ appendMessage });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn(), onDone: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'hmm' }] },
      hooks
    );

    expect(result.message.content).toContain('还需要更明确的确认');
  });

  it('sendMessage folds assistant_message events by replacing content', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_message',
        sessionId: 'session-1',
        payload: { content: 'Final message', messageId: 'msg-final' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('Final message');
    expect(result.message.id).toBe('msg-final');
  });

  it('sendMessage appends assistant_token delta content', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'Hello', messageId: 'msg-1' }
      } as any);
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: ' world', messageId: 'msg-1' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('Hello world');
  });

  it('sendMessage ignores non-assistant events', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'thinking_start',
        sessionId: 'session-1',
        payload: {}
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('');
  });

  it('sendMessage handles assistant_token with empty content', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: '', messageId: 'msg-1' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('');
  });

  it('sendMessage handles assistant_token without messageId', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'Hello' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('Hello');
  });

  it('sendMessage handles final_response_delta events', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'final_response_delta',
        sessionId: 'session-1',
        payload: { content: 'Final delta', messageId: 'msg-1' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('Final delta');
  });

  it('sendMessage handles pending_interaction_reply with missing interactionResolution', async () => {
    const appendMessage = vi.fn().mockResolvedValue({
      handledAs: 'pending_interaction_reply'
    });
    const deps = createMockDeps({ appendMessage });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn(), onDone: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'test' }] },
      hooks
    );

    expect(result.message.content).toContain('还需要更明确的确认');
  });

  it('sendMessage handles appendMessage returning non-pending result', async () => {
    const appendMessage = vi.fn().mockResolvedValue({ handledAs: 'new_run' });
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onDone();
    });
    const deps = createMockDeps({ appendMessage, bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn(), onDone: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'test' }] },
      hooks
    );

    expect(result.sessionId).toBe('session-1');
  });

  it('sendMessage handles content that starts with current content', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'Hello', messageId: 'msg-1' }
      } as any);
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'Hello World', messageId: 'msg-1' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('Hello World');
  });

  it('sendMessage handles content that ends with current content', async () => {
    const bindStream: AgentChatSessionProviderDeps['bindStream'] = vi.fn((_stream, _sessionId, handlers) => {
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'Hello World', messageId: 'msg-1' }
      } as any);
      handlers.onEvent({
        type: 'assistant_token',
        sessionId: 'session-1',
        payload: { content: 'World', messageId: 'msg-1' }
      } as any);
      handlers.onDone();
    });
    const deps = createMockDeps({ bindStream });
    const provider = createAgentChatSessionProvider(deps);
    const hooks: AgentChatSessionProviderHooks = { onChunk: vi.fn() };

    const result = await provider.sendMessage(
      { conversationKey: 'session-1', messages: [{ role: 'user', content: 'Hi' }] },
      hooks
    );

    expect(result.message.content).toBe('Hello World');
  });
});
