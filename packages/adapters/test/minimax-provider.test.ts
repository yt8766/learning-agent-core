import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { MiniMaxProvider } from '@agent/adapters';

const createMiniMaxChatModelMock = vi.fn();
const normalizeModelBaseUrlMock = vi.fn((value: string) => value.replace(/\/$/, ''));

vi.mock('../src/minimax/chat/minimax-chat-model.factory', () => ({
  createMiniMaxChatModel: (options: unknown) => createMiniMaxChatModelMock(options)
}));

vi.mock('../src/shared/urls', () => ({
  normalizeModelBaseUrl: (value: string) => normalizeModelBaseUrlMock(value)
}));

describe('MiniMaxProvider', () => {
  beforeEach(() => {
    createMiniMaxChatModelMock.mockReset();
    normalizeModelBaseUrlMock.mockClear();
  });

  it('builds supported models from provider config', () => {
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      displayName: 'MiniMax',
      apiKey: 'minimax-key',
      baseUrl: 'https://api.minimaxi.com/v1',
      models: ['MiniMax-M2.7', 'M2-her'],
      roleModels: {
        manager: 'MiniMax-M2.7',
        research: 'MiniMax-M2.7',
        executor: 'MiniMax-M2.7',
        reviewer: 'MiniMax-M2.7'
      }
    });

    expect(provider.supportedModels()).toEqual([
      expect.objectContaining({
        id: 'MiniMax-M2.7',
        providerId: 'minimax',
        displayName: 'MiniMax-M2.7'
      }),
      expect.objectContaining({
        id: 'M2-her',
        providerId: 'minimax',
        displayName: 'M2-her'
      })
    ]);
    expect(provider.isConfigured()).toBe(true);
  });

  it('creates a minimax model and returns text output', async () => {
    createMiniMaxChatModelMock.mockReturnValue({
      invoke: vi.fn(async () => ({
        content: [{ text: 'hello from minimax' }],
        response_metadata: {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
          model: 'MiniMax-M2.7'
        }
      }))
    });
    const onUsage = vi.fn();
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      apiKey: 'minimax-key',
      baseUrl: 'https://api.minimaxi.com/v1',
      models: ['MiniMax-M2.7'],
      roleModels: {
        manager: 'MiniMax-M2.7'
      }
    });

    await expect(
      provider.generateText([{ role: 'user', content: '你好' }], {
        role: 'manager',
        onUsage
      })
    ).resolves.toBe('hello from minimax');

    expect(createMiniMaxChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'MiniMax-M2.7',
        apiKey: 'minimax-key',
        baseUrl: 'https://api.minimaxi.com/v1',
        temperature: 0.2,
        streamUsage: false
      })
    );
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18,
        model: 'MiniMax-M2.7'
      })
    );
  });

  it('disables unsupported LangChain chat settings for MiniMax compatibility', async () => {
    createMiniMaxChatModelMock.mockReturnValue({
      stream: vi.fn(async function* () {
        yield {
          content: 'ok',
          response_metadata: { model_name: 'MiniMax-M2.7' }
        };
      })
    });
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      apiKey: 'minimax-key',
      baseUrl: 'https://api.minimaxi.com/v1',
      models: ['MiniMax-M2.7'],
      roleModels: {
        manager: 'MiniMax-M2.7'
      }
    });

    await provider.streamText([{ role: 'user', content: '你好' }], { role: 'manager' }, () => undefined);

    expect(createMiniMaxChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'MiniMax-M2.7',
        streamUsage: false
      })
    );
  });

  it('does not pass runtime thinking settings through to MiniMax chat models', async () => {
    createMiniMaxChatModelMock.mockReturnValue({
      stream: vi.fn(async function* () {
        yield {
          content: 'ok',
          response_metadata: { model_name: 'MiniMax-M2.7' }
        };
      })
    });
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      apiKey: 'minimax-key',
      models: ['MiniMax-M2.7'],
      roleModels: {
        manager: 'MiniMax-M2.7'
      }
    });

    await provider.streamText(
      [{ role: 'user', content: '你好' }],
      { role: 'manager', thinking: true },
      () => undefined
    );

    expect(createMiniMaxChatModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'MiniMax-M2.7',
        thinking: false
      })
    );
  });

  it('streams tokens and forwards the resolved model id', async () => {
    createMiniMaxChatModelMock.mockReturnValue({
      stream: vi.fn(async function* () {
        yield {
          content: [{ text: '你' }],
          response_metadata: { model_name: 'MiniMax-M2.5' }
        };
        yield {
          content: [{ text: '你好' }],
          response_metadata: {
            model_name: 'MiniMax-M2.5',
            output_tokens: 2,
            input_tokens: 1,
            total_tokens: 3
          }
        };
      })
    });
    const onToken = vi.fn();
    const onUsage = vi.fn();
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      apiKey: 'minimax-key',
      models: ['MiniMax-M2.5'],
      roleModels: {
        manager: 'MiniMax-M2.7',
        research: 'MiniMax-M2.5'
      }
    });

    await expect(
      provider.streamText(
        [{ role: 'user', content: '打个招呼' }],
        {
          role: 'research',
          modelId: 'MiniMax-M2.5',
          onUsage
        },
        onToken
      )
    ).resolves.toBe('你好');

    expect(onToken).toHaveBeenNthCalledWith(1, '你', { model: 'MiniMax-M2.5' });
    expect(onToken).toHaveBeenNthCalledWith(2, '好', { model: 'MiniMax-M2.5' });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3
      })
    );
  });

  it('parses structured object responses', async () => {
    createMiniMaxChatModelMock.mockReturnValue({
      invoke: vi.fn(async () => ({
        content: '{"title":"Roadmap","score":9}'
      }))
    });
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      apiKey: 'minimax-key',
      models: ['MiniMax-M2.7'],
      roleModels: {
        reviewer: 'MiniMax-M2.7'
      }
    });

    await expect(
      provider.generateObject(
        [{ role: 'user', content: '输出 JSON' }],
        z.object({
          title: z.string(),
          score: z.number()
        }),
        { role: 'reviewer' }
      )
    ).resolves.toEqual({
      title: 'Roadmap',
      score: 9
    });
  });

  it('surfaces provider-specific errors with normalized base url context', async () => {
    createMiniMaxChatModelMock.mockReturnValue({
      invoke: vi.fn(async () => {
        throw new Error('bad gateway');
      })
    });
    const provider = new MiniMaxProvider({
      id: 'minimax',
      type: 'minimax',
      apiKey: 'minimax-key',
      baseUrl: 'https://api.minimaxi.com/v1/',
      models: ['MiniMax-M2.7'],
      roleModels: {
        manager: 'MiniMax-M2.7'
      }
    });

    await expect(
      provider.generateText([{ role: 'user', content: 'hello' }], {
        role: 'manager'
      })
    ).rejects.toThrow(
      '[provider=minimax stage=generateText model=MiniMax-M2.7 baseUrl=https://api.minimaxi.com/v1] bad gateway'
    );
    expect(normalizeModelBaseUrlMock).toHaveBeenCalledWith('https://api.minimaxi.com/v1/');
  });
});
