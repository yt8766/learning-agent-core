import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { AnthropicProvider } from '@agent/adapters';

const fetchMock = vi.fn();

describe('AnthropicProvider', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('builds supported models from provider config and reports configured state', () => {
    const provider = new AnthropicProvider({
      id: 'anthropic',
      type: 'anthropic',
      displayName: 'Anthropic',
      apiKey: 'anthropic-key',
      models: ['claude-3-7-sonnet', 'claude-3-5-haiku'],
      roleModels: {
        manager: 'claude-3-7-sonnet'
      }
    });

    expect(provider.isConfigured()).toBe(true);
    expect(provider.supportedModels()).toEqual([
      expect.objectContaining({
        id: 'claude-3-7-sonnet',
        providerId: 'anthropic'
      }),
      expect.objectContaining({
        id: 'claude-3-5-haiku',
        providerId: 'anthropic'
      })
    ]);
  });

  it('calls the anthropic messages api and returns text output', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'hello from claude' }],
        usage: {
          input_tokens: 11,
          output_tokens: 7
        }
      })
    });

    const onUsage = vi.fn();
    const provider = new AnthropicProvider({
      id: 'anthropic',
      type: 'anthropic',
      displayName: 'Anthropic',
      apiKey: 'anthropic-key',
      models: ['claude-3-7-sonnet'],
      roleModels: {
        manager: 'claude-3-7-sonnet'
      }
    });

    await expect(
      provider.generateText(
        [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Say hello' }
        ],
        {
          role: 'manager',
          onUsage
        }
      )
    ).resolves.toBe('hello from claude');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-api-key': 'anthropic-key',
          'anthropic-version': '2023-06-01'
        })
      })
    );
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18
      })
    );
  });

  it('streams anthropic sse text deltas to tokens', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"你"}}\n\n')
        );
        controller.enqueue(
          encoder.encode('event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"好"}}\n\n')
        );
        controller.enqueue(
          encoder.encode('event: message_delta\ndata: {"usage":{"output_tokens":2,"input_tokens":1}}\n\n')
        );
        controller.enqueue(encoder.encode('event: message_stop\ndata: {}\n\n'));
        controller.close();
      }
    });

    fetchMock.mockResolvedValue({
      ok: true,
      body
    });

    const onToken = vi.fn();
    const onUsage = vi.fn();
    const provider = new AnthropicProvider({
      id: 'anthropic',
      type: 'anthropic',
      apiKey: 'anthropic-key',
      models: ['claude-3-7-sonnet'],
      roleModels: {
        research: 'claude-3-7-sonnet'
      }
    });

    await expect(
      provider.streamText(
        [{ role: 'user', content: '打个招呼' }],
        {
          role: 'research',
          onUsage
        },
        onToken
      )
    ).resolves.toBe('你好');

    expect(onToken).toHaveBeenNthCalledWith(1, '你', { model: 'claude-3-7-sonnet' });
    expect(onToken).toHaveBeenNthCalledWith(2, '好', { model: 'claude-3-7-sonnet' });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3
      })
    );
  });

  it('parses structured object responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"title":"Roadmap","score":9}' }]
      })
    });

    const provider = new AnthropicProvider({
      id: 'anthropic',
      type: 'anthropic',
      apiKey: 'anthropic-key',
      models: ['claude-3-7-sonnet'],
      roleModels: {
        reviewer: 'claude-3-7-sonnet'
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
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: 'rate limited',
          type: 'rate_limit_error'
        }
      })
    });

    const provider = new AnthropicProvider({
      id: 'anthropic',
      type: 'anthropic',
      apiKey: 'anthropic-key',
      baseUrl: 'https://api.anthropic.com/v1/',
      models: ['claude-3-7-sonnet'],
      roleModels: {
        manager: 'claude-3-7-sonnet'
      }
    });

    await expect(
      provider.generateText([{ role: 'user', content: 'hello' }], {
        role: 'manager'
      })
    ).rejects.toThrow(
      '[provider=anthropic stage=generateText model=claude-3-7-sonnet baseUrl=https://api.anthropic.com/v1] rate limited | status=429 | type=rate_limit_error'
    );
  });
});
