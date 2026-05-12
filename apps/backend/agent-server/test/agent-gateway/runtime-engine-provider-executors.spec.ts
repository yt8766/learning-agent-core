import { describe, expect, it } from 'vitest';
import type { GatewayRuntimeInvocation } from '@agent/core';

import {
  OpenAICompatibleRuntimeExecutor,
  ProviderRuntimeExecutor
} from '../../src/domains/agent-gateway/runtime-engine/executors';
import type {
  GatewayRuntimeExecutorHttpClient,
  GatewayRuntimeExecutorHttpRequest,
  GatewayRuntimeExecutorHttpResponse
} from '../../src/domains/agent-gateway/runtime-engine/executors';

describe('Gateway runtime provider executors', () => {
  it('executes OpenAI-compatible chat completions through a configured HTTP client without leaking raw vendor data', async () => {
    const http = new RecordingHttpClient([
      jsonResponse(200, {
        id: 'chatcmpl_real',
        model: 'vendor-gpt',
        choices: [{ message: { content: 'real provider response' } }],
        usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
        raw_secret_echo: 'do-not-project'
      })
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1/',
      apiKeySecretRef: 'vault://agent-gateway/openai-primary',
      credentialId: 'openai-primary',
      modelAliases: [{ source: 'gpt-public', target: 'vendor-gpt' }],
      httpClient: http,
      resolveSecret: async secretRef => `secret-for:${secretRef}`,
      now: fixedNow
    });

    const result = await executor.invoke(createInvocation({ model: 'gpt-public' }));

    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://provider.example/v1/chat/completions',
      headers: { authorization: 'Bearer secret-for:vault://agent-gateway/openai-primary' }
    });
    expect(http.requests[0]?.body).toMatchObject({
      model: 'vendor-gpt',
      messages: [{ role: 'user', content: 'ping' }],
      stream: false
    });
    expect(result).toMatchObject({
      invocationId: 'inv_1',
      model: 'gpt-public',
      text: 'real provider response',
      route: {
        providerKind: 'openaiCompatible',
        credentialId: 'openai-primary',
        model: 'vendor-gpt',
        strategy: 'fill-first'
      },
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
    });
    expect(JSON.stringify(result)).not.toContain('do-not-project');
  });

  it('executes OpenAI-compatible responses API through the same configurable boundary', async () => {
    const http = new RecordingHttpClient([
      jsonResponse(200, {
        id: 'resp_real',
        model: 'vendor-responses',
        output_text: 'responses provider text',
        usage: { input_tokens: 5, output_tokens: 6, total_tokens: 11 }
      })
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1',
      apiKeySecretRef: 'vault://agent-gateway/responses',
      credentialId: 'openai-responses',
      modelAliases: [{ source: 'gpt-responses', target: 'vendor-responses' }],
      httpClient: http,
      resolveSecret: async () => 'responses-key',
      now: fixedNow
    });

    const result = await executor.invoke({
      ...createInvocation({ model: 'gpt-responses' }),
      protocol: 'openai.responses'
    });

    expect(http.requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://provider.example/v1/responses',
      headers: { authorization: 'Bearer responses-key' },
      body: {
        model: 'vendor-responses',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'ping' }] }],
        stream: false
      }
    });
    expect(result.text).toBe('responses provider text');
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 6, totalTokens: 11 });
  });

  it('discovers OpenAI-compatible models through fake HTTP client and applies aliases', async () => {
    const http = new RecordingHttpClient([
      jsonResponse(200, {
        data: [{ id: 'vendor-gpt', owned_by: 'vendor', created: 123 }]
      })
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1',
      apiKeySecretRef: 'vault://agent-gateway/openai-primary',
      modelAliases: [{ source: 'gpt-public', target: 'vendor-gpt' }],
      httpClient: http,
      resolveSecret: async () => 'model-key',
      now: fixedNow
    });

    await expect(executor.discoverModels()).resolves.toEqual([
      { id: 'vendor-gpt', ownedBy: 'vendor', created: 123 },
      { id: 'gpt-public', ownedBy: 'vendor', created: 123 }
    ]);
    expect(http.requests[0]).toMatchObject({
      method: 'GET',
      url: 'https://provider.example/v1/models',
      headers: { authorization: 'Bearer model-key' }
    });
  });

  it('normalizes OpenAI-compatible provider errors without exposing vendor raw response or secret values', async () => {
    const http = new RecordingHttpClient([
      jsonResponse(401, {
        error: {
          type: 'invalid_request_error',
          code: 'invalid_api_key',
          message: 'bad key sk-live-secret from upstream'
        },
        raw: { authorization: 'Bearer sk-live-secret' }
      })
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1',
      apiKeySecretRef: 'vault://agent-gateway/openai-primary',
      httpClient: http,
      resolveSecret: async () => 'sk-live-secret',
      now: fixedNow
    });

    await expect(executor.invoke(createInvocation({ model: 'gpt-5.4' }))).rejects.toMatchObject({
      code: 'provider_auth_failed',
      type: 'authentication_error',
      statusCode: 401,
      retryable: false,
      message: 'Provider credential rejected'
    });
  });

  it('projects OpenAI-compatible stream chunks into gateway stream events', async () => {
    const http = new RecordingHttpClient([
      streamResponse(200, [
        { choices: [{ delta: { content: 'hel' } }] },
        { choices: [{ delta: { content: 'lo' } }] },
        { usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }
      ])
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1',
      apiKeySecretRef: 'vault://agent-gateway/openai-primary',
      httpClient: http,
      resolveSecret: async () => 'stream-key',
      now: fixedNow
    });

    const events = await collect(executor.stream({ ...createInvocation({ model: 'gpt-5.4' }), stream: true }));

    expect(events).toEqual([
      { invocationId: 'inv_1', type: 'delta', sequence: 0, createdAt: fixedNow(), delta: { text: 'hel' } },
      { invocationId: 'inv_1', type: 'delta', sequence: 1, createdAt: fixedNow(), delta: { text: 'lo' } },
      {
        invocationId: 'inv_1',
        type: 'usage',
        sequence: 2,
        createdAt: fixedNow(),
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }
      },
      { invocationId: 'inv_1', type: 'done', sequence: 3, createdAt: fixedNow() }
    ]);
  });

  it.each([
    ['claude', 'claude-sonnet-4.5', 'claude provider response'],
    ['gemini', 'gemini-2.5-pro', 'gemini provider response'],
    ['kimi', 'kimi-k2', 'kimi provider response'],
    ['antigravity', 'antigravity-main', 'antigravity provider response'],
    ['codex', 'gpt-5-codex', 'codex provider response']
  ] as const)(
    'supports %s fake-client execution, stream projection, model discovery, and normalized errors',
    async (providerKind, model, text) => {
      const http = new RecordingHttpClient([
        jsonResponse(200, { data: [{ id: model, owned_by: providerKind, created: 456 }] }),
        jsonResponse(200, {
          text,
          usage: { input_tokens: 8, output_tokens: 13, total_tokens: 21 }
        }),
        streamResponse(200, [
          { delta: { text: `${providerKind}-` } },
          { delta: { text: 'stream' } },
          { usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 } }
        ]),
        jsonResponse(429, { error: { message: 'quota exceeded with secret-provider-token' } })
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind,
        baseUrl: `https://${providerKind}.example/runtime`,
        apiKeySecretRef: `vault://agent-gateway/${providerKind}`,
        modelAliases: [{ source: `${providerKind}-public`, target: model }],
        httpClient: http,
        resolveSecret: async () => 'secret-provider-token',
        now: fixedNow
      });

      await expect(executor.discoverModels()).resolves.toContainEqual({
        id: `${providerKind}-public`,
        ownedBy: providerKind,
        created: 456
      });
      await expect(executor.invoke(createInvocation({ model: `${providerKind}-public` }))).resolves.toMatchObject({
        model: `${providerKind}-public`,
        text,
        route: { providerKind, model }
      });
      await expect(
        collect(executor.stream({ ...createInvocation({ model: `${providerKind}-public` }), stream: true }))
      ).resolves.toEqual([
        {
          invocationId: 'inv_1',
          type: 'delta',
          sequence: 0,
          createdAt: fixedNow(),
          delta: { text: `${providerKind}-` }
        },
        { invocationId: 'inv_1', type: 'delta', sequence: 1, createdAt: fixedNow(), delta: { text: 'stream' } },
        {
          invocationId: 'inv_1',
          type: 'usage',
          sequence: 2,
          createdAt: fixedNow(),
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
        },
        { invocationId: 'inv_1', type: 'done', sequence: 3, createdAt: fixedNow() }
      ]);
      await expect(executor.invoke(createInvocation({ model: `${providerKind}-public` }))).rejects.toMatchObject({
        code: 'provider_rate_limited',
        type: 'rate_limit_error',
        statusCode: 429,
        retryable: true,
        message: 'Provider rate limit exceeded'
      });
    }
  );
});

class RecordingHttpClient implements GatewayRuntimeExecutorHttpClient {
  readonly requests: GatewayRuntimeExecutorHttpRequest[] = [];
  private responseIndex = 0;

  constructor(private readonly responses: GatewayRuntimeExecutorHttpResponse[]) {}

  async request(request: GatewayRuntimeExecutorHttpRequest): Promise<GatewayRuntimeExecutorHttpResponse> {
    this.requests.push(request);
    const response = this.responses[this.responseIndex];
    this.responseIndex += 1;
    if (!response) throw new Error('Unexpected HTTP request in fake client');
    return response;
  }
}

function createInvocation(options: { model: string }): GatewayRuntimeInvocation {
  return {
    id: 'inv_1',
    protocol: 'openai.chat.completions',
    model: options.model,
    stream: false,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
    requestedAt: '2026-05-10T00:00:00.000Z',
    client: { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] },
    metadata: {}
  };
}

function jsonResponse(status: number, body: unknown): GatewayRuntimeExecutorHttpResponse {
  return { status, headers: { 'content-type': 'application/json' }, body };
}

function streamResponse(status: number, chunks: unknown[]): GatewayRuntimeExecutorHttpResponse {
  return { status, headers: { 'content-type': 'text/event-stream' }, body: null, stream: asyncIterable(chunks) };
}

async function* asyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

function fixedNow(): string {
  return '2026-05-11T00:00:00.000Z';
}
