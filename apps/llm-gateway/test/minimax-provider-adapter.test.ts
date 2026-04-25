import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMiniMaxProviderAdapter } from '../src/providers/minimax-provider-adapter.js';

const request = {
  id: 'req_minimax',
  model: 'minimax-main',
  providerModel: 'abab6.5-chat',
  messages: [
    { role: 'system' as const, content: 'Be concise.' },
    { role: 'user' as const, content: 'Hello' }
  ],
  temperature: 0.4,
  maxTokens: 128
};

const config = {
  baseUrl: 'https://api.minimax.test/v1',
  apiKey: 'minimax-key',
  timeoutMs: 1000
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  });
}

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    }),
    {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    }
  );
}

describe('MiniMax provider adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends chat completion requests and maps OpenAI-compatible responses to the gateway alias', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'chatcmpl-minimax',
        object: 'chat.completion',
        created: 123,
        model: 'abab6.5-chat',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'MiniMax hello' },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 11,
          completion_tokens: 4,
          total_tokens: 15
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createMiniMaxProviderAdapter(config);
    const response = await adapter.complete(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer minimax-key',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          model: 'abab6.5-chat',
          messages: request.messages,
          stream: false,
          temperature: 0.4,
          max_tokens: 128
        })
      })
    );
    expect(response).toEqual({
      id: 'chatcmpl-minimax',
      object: 'chat.completion',
      created: 123,
      model: 'minimax-main',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'MiniMax hello' },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 4,
        total_tokens: 15
      }
    });
  });

  it('parses MiniMax SSE chunks and ignores the done sentinel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"id":"chatcmpl-minimax-stream","object":"chat.completion.chunk","created":456,"model":"abab6.5-chat","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
          'data: {"id":"chatcmpl-minimax-stream","object":"chat.completion.chunk","created":456,"model":"abab6.5-chat","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
          'data: [DONE]\n\n'
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createMiniMaxProviderAdapter(config);
    const chunks = [];

    for await (const chunk of adapter.stream({ ...request, stream: true })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        id: 'chatcmpl-minimax-stream',
        object: 'chat.completion.chunk',
        created: 456,
        model: 'minimax-main',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
      },
      {
        id: 'chatcmpl-minimax-stream',
        object: 'chat.completion.chunk',
        created: 456,
        model: 'minimax-main',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }]
      }
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: true,
      stream_options: { include_usage: true }
    });
  });

  it.each([
    [401, 'UPSTREAM_AUTH_ERROR', 401],
    [403, 'UPSTREAM_AUTH_ERROR', 403],
    [429, 'UPSTREAM_RATE_LIMITED', 429],
    [500, 'UPSTREAM_UNAVAILABLE', 503]
  ])('maps upstream status %s to %s with MiniMax context', async (upstreamStatus, code, status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'upstream failed' } }, { status: upstreamStatus }))
    );

    const adapter = createMiniMaxProviderAdapter(config);

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code,
      status,
      message: expect.stringContaining('MiniMax')
    });
  });

  it('maps timeout errors with MiniMax context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));

    const adapter = createMiniMaxProviderAdapter(config);

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504,
      message: expect.stringContaining('MiniMax')
    });
  });

  it('fails closed when MiniMax config is missing', async () => {
    const adapter = createMiniMaxProviderAdapter();

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      status: 503
    });
  });

  it('maps malformed MiniMax stream chunks as bad upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(['data: {"id":"missing fields"}\n\n'])));

    const adapter = createMiniMaxProviderAdapter(config);

    await expect(async () => {
      for await (const chunk of adapter.stream({ ...request, stream: true })) {
        // Drain stream to surface parser errors.
        void chunk;
      }
    }).rejects.toMatchObject({
      code: 'UPSTREAM_BAD_RESPONSE',
      status: 502,
      message: expect.stringContaining('MiniMax')
    });
  });
});
