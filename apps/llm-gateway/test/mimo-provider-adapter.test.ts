import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMiMoProviderAdapter } from '../src/providers/mimo-provider-adapter.js';

const request = {
  id: 'req_mimo',
  model: 'mimo-main',
  providerModel: 'mimo-vl-7b',
  messages: [
    { role: 'system' as const, content: 'Be concise.' },
    { role: 'user' as const, content: 'Hello' }
  ],
  temperature: 0.3,
  maxTokens: 96
};

const config = {
  baseUrl: 'https://api.mimo.test/v1',
  apiKey: 'mimo-key',
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

describe('MiMo provider adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends chat completion requests and maps OpenAI-compatible responses to the gateway alias', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'chatcmpl-mimo',
        object: 'chat.completion',
        created: 321,
        model: 'mimo-vl-7b',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'MiMo hello' },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 5,
          total_tokens: 14
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createMiMoProviderAdapter(config);
    const response = await adapter.complete(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mimo.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer mimo-key',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          model: 'mimo-vl-7b',
          messages: request.messages,
          stream: false,
          temperature: 0.3,
          max_tokens: 96
        })
      })
    );
    expect(response).toEqual({
      id: 'chatcmpl-mimo',
      object: 'chat.completion',
      created: 321,
      model: 'mimo-main',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'MiMo hello' },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 9,
        completion_tokens: 5,
        total_tokens: 14
      }
    });
  });

  it('parses MiMo SSE chunks and ignores the done sentinel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"id":"chatcmpl-mimo-stream","object":"chat.completion.chunk","created":654,"model":"mimo-vl-7b","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
          'data: {"id":"chatcmpl-mimo-stream","object":"chat.completion.chunk","created":654,"model":"mimo-vl-7b","choices":[{"index":0,"delta":{"content":"Yo"},"finish_reason":null}]}\n\n',
          'data: [DONE]\n\n'
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createMiMoProviderAdapter(config);
    const chunks = [];

    for await (const chunk of adapter.stream({ ...request, stream: true })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        id: 'chatcmpl-mimo-stream',
        object: 'chat.completion.chunk',
        created: 654,
        model: 'mimo-main',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
      },
      {
        id: 'chatcmpl-mimo-stream',
        object: 'chat.completion.chunk',
        created: 654,
        model: 'mimo-main',
        choices: [{ index: 0, delta: { content: 'Yo' }, finish_reason: null }]
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
  ])('maps upstream status %s to %s with MiMo context', async (upstreamStatus, code, status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'upstream failed' } }, { status: upstreamStatus }))
    );

    const adapter = createMiMoProviderAdapter(config);

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code,
      status,
      message: expect.stringContaining('MiMo')
    });
  });

  it('maps unavailable fetch failures with MiMo context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failed')));

    const adapter = createMiMoProviderAdapter(config);

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      status: 503,
      message: expect.stringContaining('MiMo')
    });
  });

  it('fails closed when MiMo config is missing', async () => {
    const adapter = createMiMoProviderAdapter();

    await expect(adapter.complete(request)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      status: 503
    });
  });

  it('maps malformed MiMo stream chunks as bad upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(['data: not-json\n\n'])));

    const adapter = createMiMoProviderAdapter(config);

    await expect(async () => {
      for await (const chunk of adapter.stream({ ...request, stream: true })) {
        // Drain stream to surface parser errors.
        void chunk;
      }
    }).rejects.toMatchObject({
      code: 'UPSTREAM_BAD_RESPONSE',
      status: 502,
      message: expect.stringContaining('MiMo')
    });
  });
});
