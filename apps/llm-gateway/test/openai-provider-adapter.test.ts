import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiProviderAdapter } from '../src/providers/openai-provider-adapter.js';

const request = {
  id: 'req_1',
  model: 'gpt-main',
  providerModel: 'gpt-5-mini',
  messages: [
    { role: 'system' as const, content: 'Be concise.' },
    { role: 'user' as const, content: 'Hello' }
  ],
  temperature: 0.2,
  maxTokens: 64
};

const config = {
  baseUrl: 'https://api.openai.test/v1',
  apiKey: 'sk-test',
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

describe('OpenAI provider adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends chat completions requests and maps normalized responses to the gateway alias', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'chatcmpl-openai',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-5-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hi there' },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 3,
          total_tokens: 13
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiProviderAdapter(config);
    const response = await adapter.complete(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer sk-test',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: request.messages,
          stream: false,
          temperature: 0.2,
          max_tokens: 64
        })
      })
    );
    expect(response).toEqual({
      id: 'chatcmpl-openai',
      object: 'chat.completion',
      created: 123,
      model: 'gpt-main',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hi there' },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 3,
        total_tokens: 13
      }
    });
  });

  it('parses OpenAI SSE chunks and ignores the done sentinel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":456,"model":"gpt-5-mini","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
          'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":456,"model":"gpt-5-mini","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
          'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":456,"model":"gpt-5-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n'
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiProviderAdapter(config);
    const chunks = [];

    for await (const chunk of adapter.stream({ ...request, stream: true })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 456,
        model: 'gpt-main',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
      },
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 456,
        model: 'gpt-main',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }]
      },
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 456,
        model: 'gpt-main',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
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
  ])('maps upstream status %s to %s', async (upstreamStatus, code, status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'upstream failed' } }, { status: upstreamStatus }))
    );

    const adapter = createOpenAiProviderAdapter(config);

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code,
      status
    });
  });

  it('maps timeout errors', async () => {
    for (const errorName of ['AbortError', 'TimeoutError']) {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: errorName })));

      const adapter = createOpenAiProviderAdapter(config);

      await expect(adapter.complete(request)).rejects.toMatchObject({
        code: 'UPSTREAM_TIMEOUT',
        status: 504
      });
    }
  });

  it('maps malformed responses as bad upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'missing fields' })));

    const adapter = createOpenAiProviderAdapter(config);

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code: 'UPSTREAM_BAD_RESPONSE',
      status: 502
    });
  });
});
