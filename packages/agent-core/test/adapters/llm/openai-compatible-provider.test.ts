import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

const openAiHarness = vi.hoisted(() => ({
  instances: [] as Array<{ config: Record<string, unknown> }>,
  invokeMock: vi.fn(),
  streamMock: vi.fn()
}));

vi.mock('@langchain/core/messages', () => ({
  AIMessage: class {
    readonly kind = 'assistant';
    constructor(public readonly content: string) {}
  },
  HumanMessage: class {
    readonly kind = 'user';
    constructor(public readonly content: string) {}
  },
  SystemMessage: class {
    readonly kind = 'system';
    constructor(public readonly content: string) {}
  }
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(public readonly config: Record<string, unknown>) {
      openAiHarness.instances.push(this);
    }

    invoke(messages: unknown[]) {
      return openAiHarness.invokeMock(messages);
    }

    stream(messages: unknown[]) {
      return openAiHarness.streamMock(messages);
    }
  }
}));

import { OpenAICompatibleProvider } from '../../../src/adapters/llm/openai-compatible-provider';

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    openAiHarness.instances.length = 0;
    openAiHarness.invokeMock.mockReset();
    openAiHarness.streamMock.mockReset();
  });

  it('builds providers from config, reports supported models, and checks configuration state', () => {
    const provider = OpenAICompatibleProvider.fromConfig({
      id: 'zhipu',
      type: 'zhipu',
      displayName: 'ZhiPu',
      apiKey: 'zhipu-key',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      models: ['glm-4.5', 'glm-4.5-air'],
      roleModels: {
        manager: 'glm-4.5'
      }
    } as any);

    expect(provider.supportedModels()).toEqual([
      {
        id: 'glm-4.5',
        displayName: 'glm-4.5',
        providerId: 'zhipu',
        contextWindow: 128_000,
        maxOutput: 8_192,
        capabilities: ['text', 'tool-call']
      },
      {
        id: 'glm-4.5-air',
        displayName: 'glm-4.5-air',
        providerId: 'zhipu',
        contextWindow: 128_000,
        maxOutput: 8_192,
        capabilities: ['text', 'tool-call']
      }
    ]);
    expect(provider.isConfigured()).toBe(true);

    expect(
      new OpenAICompatibleProvider({
        id: 'openai',
        type: 'openai',
        displayName: undefined,
        apiKey: '',
        models: ['gpt-5.4']
      } as any).isConfigured()
    ).toBe(false);

    expect(
      new OpenAICompatibleProvider({
        id: 'ollama',
        type: 'ollama',
        models: ['qwen3']
      } as any).isConfigured()
    ).toBe(true);
  });

  it('generates text, normalizes base url, converts messages, and reports usage', async () => {
    const onUsage = vi.fn();
    openAiHarness.invokeMock.mockResolvedValue({
      content: ['hello', { text: ' world' }, { text: 123 }, { nope: true }],
      usage_metadata: {
        prompt_tokens: 5,
        output_tokens: 7,
        model: 'glm-4.5'
      }
    });
    const provider = new OpenAICompatibleProvider({
      id: 'zhipu',
      type: 'zhipu',
      displayName: 'ZhiPu',
      apiKey: 'zhipu-key',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      models: ['glm-4.5'],
      roleModels: {
        manager: 'glm-4.5'
      }
    } as any);

    await expect(
      provider.generateText(
        [
          { role: 'system', content: 'rules' },
          { role: 'assistant', content: 'previous' },
          { role: 'user', content: 'hello' }
        ],
        { role: 'manager', onUsage }
      )
    ).resolves.toBe('hello world');

    expect(openAiHarness.instances[0]?.config).toEqual({
      model: 'glm-4.5',
      temperature: 0.2,
      maxTokens: undefined,
      apiKey: 'zhipu-key',
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      },
      modelKwargs: undefined
    });
    expect(openAiHarness.invokeMock.mock.calls[0]?.[0]).toMatchObject([
      { kind: 'system', content: 'rules' },
      { kind: 'assistant', content: 'previous' },
      { kind: 'user', content: 'hello' }
    ]);
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      model: 'glm-4.5',
      costUsd: undefined,
      costCny: undefined
    });
  });

  it('streams text, skips empty chunks, and falls back to options model metadata', async () => {
    const onUsage = vi.fn();
    const onToken = vi.fn();
    openAiHarness.streamMock.mockResolvedValue(
      (async function* () {
        yield {
          content: '',
          response_metadata: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2
          }
        };
        yield {
          content: ['hel'],
          response_metadata: {
            model_name: 'stream-model',
            prompt_tokens: 4,
            completion_tokens: 2
          }
        };
        yield {
          content: [{ text: 'lo' }]
        };
      })()
    );
    const provider = new OpenAICompatibleProvider({
      id: 'openai',
      type: 'openai',
      apiKey: 'openai-key',
      models: ['gpt-5.4']
    } as any);

    await expect(
      provider.streamText(
        [{ role: 'user', content: 'hello' }],
        { role: 'manager', modelId: 'fallback-model', onUsage },
        onToken
      )
    ).resolves.toBe('hello');

    expect(onToken).toHaveBeenNthCalledWith(1, 'hel', { model: 'stream-model' });
    expect(onToken).toHaveBeenNthCalledWith(2, 'lo', { model: 'fallback-model' });
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 4,
      completionTokens: 2,
      totalTokens: 6,
      model: undefined,
      costUsd: undefined,
      costCny: undefined
    });
  });

  it('deduplicates cumulative stream chunks from providers that emit full snapshots', async () => {
    const onToken = vi.fn();
    openAiHarness.streamMock.mockResolvedValue(
      (async function* () {
        yield {
          content: '我是内阁首辅，一个基于大语言模型的智能助手。'
        };
        yield {
          content: '我是内阁首辅，一个基于大语言模型的智能助手。\n\n我可以帮你处理各种任务，包括：'
        };
        yield {
          content:
            '我是内阁首辅，一个基于大语言模型的智能助手。\n\n我可以帮你处理各种任务，包括：\n\n回答问题和提供建议'
        };
      })()
    );
    const provider = new OpenAICompatibleProvider({
      id: 'openai',
      type: 'openai',
      apiKey: 'openai-key',
      models: ['gpt-5.4']
    } as any);

    await expect(provider.streamText([{ role: 'user', content: 'hello' }], { role: 'manager' }, onToken)).resolves.toBe(
      '我是内阁首辅，一个基于大语言模型的智能助手。\n\n我可以帮你处理各种任务，包括：\n\n回答问题和提供建议'
    );

    expect(onToken).toHaveBeenNthCalledWith(1, '我是内阁首辅，一个基于大语言模型的智能助手。', {
      model: undefined
    });
    expect(onToken).toHaveBeenNthCalledWith(2, '\n\n我可以帮你处理各种任务，包括：', {
      model: undefined
    });
    expect(onToken).toHaveBeenNthCalledWith(3, '\n\n回答问题和提供建议', {
      model: undefined
    });
  });

  it('generates objects by appending schema instructions and parsing embedded json', async () => {
    openAiHarness.invokeMock.mockResolvedValue({
      content: 'before\n{"ok":true,"count":2}\nafter'
    });
    const provider = new OpenAICompatibleProvider({
      id: 'openai',
      type: 'openai',
      apiKey: 'openai-key',
      models: ['gpt-5.4'],
      roleModels: {
        manager: 'gpt-5.4'
      }
    } as any);

    await expect(
      provider.generateObject(
        [{ role: 'user', content: 'Summarize' }],
        z.object({ ok: z.boolean(), count: z.number() }),
        { role: 'manager', thinking: true, maxTokens: 400 }
      )
    ).resolves.toEqual({ ok: true, count: 2 });

    expect(openAiHarness.instances[0]?.config).toEqual({
      model: 'gpt-5.4',
      temperature: 0.2,
      maxTokens: 400,
      apiKey: 'openai-key',
      configuration: undefined,
      modelKwargs: {
        thinking: {
          type: 'enabled'
        }
      }
    });
    expect(openAiHarness.invokeMock.mock.calls[0]?.[0]).toMatchObject([
      { kind: 'user', content: 'Summarize' },
      { kind: 'system' }
    ]);
    expect((openAiHarness.invokeMock.mock.calls[0]?.[0]?.[1] as { content: string }).content).toContain(
      'Return only a single JSON object'
    );
  });

  it('wraps provider and parsing errors with provider, stage, model, and endpoint context', async () => {
    openAiHarness.invokeMock.mockRejectedValueOnce({
      message: 'rate limited',
      response: { status: 429 },
      error: { code: 'rate_limit', type: 'quota', message: 'slow down' }
    });
    openAiHarness.invokeMock.mockResolvedValueOnce({
      content: 'not-json'
    });

    const provider = new OpenAICompatibleProvider({
      id: 'custom',
      type: 'openai',
      apiKey: 'key',
      baseUrl: 'https://api.example.com/v1/chat/completions',
      models: ['model-a']
    } as any);

    await expect(provider.generateText([{ role: 'user', content: 'hi' }], { role: 'manager' })).rejects.toThrow(
      '[provider=custom stage=generateText model=model-a baseUrl=https://api.example.com/v1] rate limited | status=429 | code=rate_limit | type=quota | provider=slow down'
    );

    await expect(
      provider.generateObject([{ role: 'user', content: 'hi' }], z.object({ ok: z.boolean() }), { role: 'manager' })
    ).rejects.toThrow('[provider=custom stage=generateObject model=model-a baseUrl=https://api.example.com/v1]');
  });

  it('surfaces missing model configuration and nested cause descriptions', async () => {
    const provider = new OpenAICompatibleProvider({
      id: 'empty',
      type: 'openai',
      apiKey: 'key',
      models: []
    } as any);

    await expect(provider.generateText([{ role: 'user', content: 'hi' }], { role: 'manager' })).rejects.toThrow(
      '[provider=empty stage=generateText model=unknown-model baseUrl=default-openai-endpoint] Provider empty has no configured model.'
    );

    openAiHarness.streamMock.mockRejectedValueOnce({
      cause: {
        message: 'socket closed'
      }
    });
    const configuredProvider = new OpenAICompatibleProvider({
      id: 'nested',
      type: 'openai',
      apiKey: 'key',
      models: ['model-b']
    } as any);

    await expect(
      configuredProvider.streamText([{ role: 'user', content: 'hi' }], { role: 'manager' }, vi.fn())
    ).rejects.toThrow('[provider=nested stage=streamText model=model-b baseUrl=default-openai-endpoint] socket closed');
  });
});
