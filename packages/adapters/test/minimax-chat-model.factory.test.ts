import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatOpenAIMock = vi.fn();

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: chatOpenAIMock
}));

describe('createMiniMaxChatModel', () => {
  beforeEach(() => {
    chatOpenAIMock.mockReset();
    chatOpenAIMock.mockImplementation(function ChatOpenAITestDouble(this: unknown, options: unknown) {
      return { __options: options };
    });
  });

  it('uses only MiniMax-compatible chat settings when constructing the model', async () => {
    const { createMiniMaxChatModel } = await import('../src/minimax/chat/minimax-chat-model.factory');

    const model = createMiniMaxChatModel({
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
      baseUrl: 'https://example.test/minimax/v1',
      streamUsage: false,
      thinking: false,
      temperature: 0.2,
      maxTokens: 1200
    });

    expect(model).toEqual({
      __options: expect.objectContaining({
        model: 'MiniMax-M2.7',
        apiKey: 'test-key',
        streamUsage: false,
        maxTokens: undefined,
        temperature: undefined,
        configuration: { baseURL: 'https://example.test/minimax/v1' },
        modelKwargs: { max_completion_tokens: 1200 }
      })
    });
    expect(chatOpenAIMock).toHaveBeenCalledTimes(1);
    expect(chatOpenAIMock.mock.calls[0]?.[0]).not.toHaveProperty('thinking');
  });

  it('caps MiniMax max_completion_tokens at 2048 and omits invalid values', async () => {
    const { createMiniMaxChatModel } = await import('../src/minimax/chat/minimax-chat-model.factory');

    createMiniMaxChatModel({ model: 'MiniMax-M2.7', apiKey: 'test-key', maxTokens: 9000 });
    createMiniMaxChatModel({ model: 'MiniMax-M2.7', apiKey: 'test-key', maxTokens: 0 });

    expect(chatOpenAIMock.mock.calls[0]?.[0]).toMatchObject({
      modelKwargs: { max_completion_tokens: 2048 }
    });
    expect(chatOpenAIMock.mock.calls[1]?.[0]).toMatchObject({
      modelKwargs: {}
    });
  });
});
