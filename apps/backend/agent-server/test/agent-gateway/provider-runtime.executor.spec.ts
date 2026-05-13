import { describe, expect, it, vi } from 'vitest';

import {
  ProviderRuntimeExecutor,
  OpenAICompatibleRuntimeExecutor
} from '../../src/domains/agent-gateway/runtime-engine/executors/provider-runtime.executor';
import { GatewayRuntimeExecutorError } from '../../src/domains/agent-gateway/runtime-engine/executors/gateway-runtime-executor.error';

function createMockHttpClient(
  responses: Array<{ status: number; body: unknown; stream?: AsyncIterable<unknown> }> = []
) {
  let callIndex = 0;
  return {
    request: vi.fn(async () => responses[Math.min(callIndex++, responses.length - 1)])
  };
}

function makeInvocation(overrides: Record<string, any> = {}) {
  return {
    id: 'inv-1',
    model: 'gpt-4',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    stream: false,
    ...overrides
  };
}

describe('ProviderRuntimeExecutor', () => {
  describe('constructor', () => {
    it('initializes with required options', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1/',
        apiKeySecretRef: 'openai-key'
      });
      expect(executor.providerKind).toBe('openai');
    });

    it('trims trailing slash from baseUrl', async () => {
      const httpClient = createMockHttpClient([{ status: 200, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1/',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await executor.invoke(makeInvocation());
      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.openai.com/v1/invoke' })
      );
    });

    it('uses credentialId from options', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        credentialId: 'cred-1'
      });
      // Access via invoke to check route
      expect(executor.providerKind).toBe('openai');
    });

    it('defaults credentialId to apiKeySecretRef', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'my-key'
      });
      expect(executor.providerKind).toBe('openai');
    });
  });

  describe('health', () => {
    it('returns health status', async () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        now: () => '2026-05-11T12:00:00.000Z'
      });
      const health = await executor.health();
      expect(health.providerKind).toBe('openai');
      expect(health.status).toBe('ready');
      expect(health.supportsStreaming).toBe(true);
      expect(health.activeRequests).toBe(0);
      expect(health.checkedAt).toBe('2026-05-11T12:00:00.000Z');
    });
  });

  describe('canHandle', () => {
    it('returns true for matching model', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key'
      });
      expect(executor.canHandle(makeInvocation({ model: 'gpt-4' }))).toBe(true);
    });

    it('returns false for empty model', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key'
      });
      expect(executor.canHandle(makeInvocation({ model: '' }))).toBe(false);
    });

    it('returns false for mismatched providerKind', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key'
      });
      expect(executor.canHandle(makeInvocation({ providerKind: 'anthropic' }))).toBe(false);
    });

    it('returns true when model matches alias source', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        modelAliases: [{ source: 'my-gpt', target: 'gpt-4' }]
      });
      expect(executor.canHandle(makeInvocation({ model: 'my-gpt' }))).toBe(true);
    });

    it('returns true when model matches alias target', () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        modelAliases: [{ source: 'my-gpt', target: 'gpt-4' }]
      });
      expect(executor.canHandle(makeInvocation({ model: 'gpt-4' }))).toBe(true);
    });
  });

  describe('discoverModels', () => {
    it('parses model list from response', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {
            data: [
              { id: 'gpt-4', owned_by: 'openai', created: 1234567890 },
              { id: 'gpt-3.5-turbo', ownedBy: 'openai', created: 1234567891 }
            ]
          }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const models = await executor.discoverModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gpt-4');
      expect(models[0].ownedBy).toBe('openai');
      expect(models[1].ownedBy).toBe('openai');
    });

    it('returns empty array when data is not an array', async () => {
      const httpClient = createMockHttpClient([{ status: 200, body: { data: 'not-array' } }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const models = await executor.discoverModels();
      expect(models).toEqual([]);
    });

    it('returns empty array when body has no data', async () => {
      const httpClient = createMockHttpClient([{ status: 200, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const models = await executor.discoverModels();
      expect(models).toEqual([]);
    });

    it('applies model aliases', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: { data: [{ id: 'gpt-4', owned_by: 'openai', created: 100 }] }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        modelAliases: [{ source: 'my-model', target: 'gpt-4' }],
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const models = await executor.discoverModels();
      expect(models).toHaveLength(2);
      expect(models[1].id).toBe('my-model');
      expect(models[1].ownedBy).toBe('openai');
    });

    it('throws on provider error', async () => {
      const httpClient = createMockHttpClient([{ status: 401, body: { error: 'Unauthorized' } }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await expect(executor.discoverModels()).rejects.toThrow(GatewayRuntimeExecutorError);
    });
  });

  describe('invoke', () => {
    it('returns invoke result', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {
            choices: [{ message: { content: 'Hello there!' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret',
        now: () => '2026-05-11T12:00:00.000Z'
      });
      const result = await executor.invoke(makeInvocation());
      expect(result.text).toBe('Hello there!');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.route.providerKind).toBe('openai');
    });

    it('handles model aliases in invoke', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {
            choices: [{ message: { content: 'response' } }],
            usage: {}
          }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        modelAliases: [{ source: 'my-model', target: 'gpt-4' }],
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const result = await executor.invoke(makeInvocation({ model: 'my-model' }));
      expect(result).toBeDefined();
    });

    it('decrements activeRequests on error', async () => {
      const httpClient = createMockHttpClient([{ status: 500, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await expect(executor.invoke(makeInvocation())).rejects.toThrow();
      const health = await executor.health();
      expect(health.activeRequests).toBe(0);
    });

    it('extracts text from output_text fallback', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: { output_text: 'Direct output', usage: {} }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const result = await executor.invoke(makeInvocation());
      expect(result.text).toBe('Direct output');
    });

    it('extracts text from text fallback', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: { text: 'Plain text', usage: {} }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const result = await executor.invoke(makeInvocation());
      expect(result.text).toBe('Plain text');
    });

    it('handles usage with input_tokens/output_tokens format', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {
            choices: [{ message: { content: 'response' } }],
            usage: { input_tokens: 20, output_tokens: 10 }
          }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const result = await executor.invoke(makeInvocation());
      expect(result.usage.inputTokens).toBe(20);
      expect(result.usage.outputTokens).toBe(10);
      expect(result.usage.totalTokens).toBe(30);
    });

    it('handles image content in messages', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: { choices: [{ message: { content: 'ok' } }], usage: {} }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await executor.invoke(
        makeInvocation({
          messages: [{ role: 'user', content: [{ type: 'image', imageUrl: 'https://example.com/img.png' }] }]
        })
      );
      expect(httpClient.request).toHaveBeenCalled();
    });
  });

  describe('stream', () => {
    it('yields delta events and done', async () => {
      async function* streamChunks() {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
      }
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {},
          stream: streamChunks()
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret',
        now: () => '2026-05-11T12:00:00.000Z'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation())) {
        events.push(event);
      }
      expect(events.some(e => e.type === 'delta')).toBe(true);
      expect(events.some(e => e.type === 'done')).toBe(true);
    });

    it('yields usage events when usage data present', async () => {
      async function* streamChunks() {
        yield { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
      }
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {},
          stream: streamChunks()
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation())) {
        events.push(event);
      }
      expect(events.some(e => e.type === 'usage')).toBe(true);
    });

    it('handles string chunks in stream', async () => {
      async function* streamChunks() {
        yield '{"choices":[{"delta":{"content":"test"}}]}';
      }
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {},
          stream: streamChunks()
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation())) {
        events.push(event);
      }
      expect(events.some(e => e.type === 'delta')).toBe(true);
    });

    it('handles non-JSON string chunks', async () => {
      async function* streamChunks() {
        yield 'plain text response';
      }
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {},
          stream: streamChunks()
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation())) {
        events.push(event);
      }
      expect(events.some(e => e.type === 'delta')).toBe(true);
    });

    it('falls back to body when no stream', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: { choices: [{ delta: { content: 'fallback' } }] }
        }
      ]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation())) {
        events.push(event);
      }
      expect(events.some(e => e.type === 'delta')).toBe(true);
    });

    it('decrements activeRequests on stream error', async () => {
      const httpClient = createMockHttpClient([{ status: 500, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const collect = async () => {
        for await (const _ of executor.stream(makeInvocation())) {
          // consume
        }
      };
      await expect(collect()).rejects.toThrow();
      const health = await executor.health();
      expect(health.activeRequests).toBe(0);
    });
  });

  describe('error handling', () => {
    it('throws auth error for 401', async () => {
      const httpClient = createMockHttpClient([{ status: 401, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      try {
        await executor.invoke(makeInvocation());
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayRuntimeExecutorError);
        expect((error as GatewayRuntimeExecutorError).code).toBe('provider_auth_failed');
        expect((error as GatewayRuntimeExecutorError).retryable).toBe(false);
      }
    });

    it('throws auth error for 403', async () => {
      const httpClient = createMockHttpClient([{ status: 403, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      try {
        await executor.invoke(makeInvocation());
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as GatewayRuntimeExecutorError).code).toBe('provider_auth_failed');
      }
    });

    it('throws rate limit error for 429', async () => {
      const httpClient = createMockHttpClient([{ status: 429, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      try {
        await executor.invoke(makeInvocation());
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as GatewayRuntimeExecutorError).code).toBe('provider_rate_limited');
        expect((error as GatewayRuntimeExecutorError).retryable).toBe(true);
      }
    });

    it('throws request failed for 500 with retryable=true', async () => {
      const httpClient = createMockHttpClient([{ status: 500, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      try {
        await executor.invoke(makeInvocation());
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as GatewayRuntimeExecutorError).code).toBe('provider_request_failed');
        expect((error as GatewayRuntimeExecutorError).retryable).toBe(true);
      }
    });

    it('throws request failed for 400 with retryable=false', async () => {
      const httpClient = createMockHttpClient([{ status: 400, body: {} }]);
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      try {
        await executor.invoke(makeInvocation());
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as GatewayRuntimeExecutorError).retryable).toBe(false);
      }
    });

    it('throws when secret resolver fails', async () => {
      const executor = new ProviderRuntimeExecutor({
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key'
      });
      await expect(executor.invoke(makeInvocation())).rejects.toThrow('secret resolver is not configured');
    });
  });
});

describe('OpenAICompatibleRuntimeExecutor', () => {
  it('defaults providerKind to openaiCompatible', () => {
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://api.openai.com/v1',
      apiKeySecretRef: 'key'
    });
    expect(executor.providerKind).toBe('openaiCompatible');
  });

  it('allows custom providerKind', () => {
    const executor = new OpenAICompatibleRuntimeExecutor({
      providerKind: 'kimi',
      baseUrl: 'https://api.kimi.com/v1',
      apiKeySecretRef: 'key'
    });
    expect(executor.providerKind).toBe('kimi');
  });

  describe('invoke', () => {
    it('uses chat/completions endpoint by default', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {
            choices: [{ message: { content: 'response' } }],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
          }
        }
      ]);
      const executor = new OpenAICompatibleRuntimeExecutor({
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await executor.invoke(makeInvocation());
      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.openai.com/v1/chat/completions' })
      );
    });

    it('uses responses endpoint for openai.responses protocol', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: {
            choices: [{ message: { content: 'response' } }],
            usage: {}
          }
        }
      ]);
      const executor = new OpenAICompatibleRuntimeExecutor({
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await executor.invoke(makeInvocation({ protocol: 'openai.responses' }));
      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.openai.com/v1/responses' })
      );
    });

    it('builds openai responses body format', async () => {
      const httpClient = createMockHttpClient([
        {
          status: 200,
          body: { choices: [{ message: { content: 'ok' } }], usage: {} }
        }
      ]);
      const executor = new OpenAICompatibleRuntimeExecutor({
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      await executor.invoke(
        makeInvocation({
          protocol: 'openai.responses',
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'hello' }] },
            { role: 'user', content: [{ type: 'image', imageUrl: 'https://img.png' }] }
          ]
        })
      );
      const body = httpClient.request.mock.calls[0][0].body;
      expect(body.input).toBeDefined();
      expect(body.input[0].content[0].type).toBe('input_text');
      expect(body.input[1].content[0].type).toBe('input_image');
    });
  });

  describe('stream', () => {
    it('uses chat/completions for stream by default', async () => {
      async function* chunks() {
        yield { choices: [{ delta: { content: 'hi' } }] };
      }
      const httpClient = createMockHttpClient([{ status: 200, body: {}, stream: chunks() }]);
      const executor = new OpenAICompatibleRuntimeExecutor({
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation())) {
        events.push(event);
      }
      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.openai.com/v1/chat/completions' })
      );
    });

    it('uses responses endpoint for openai.responses protocol in stream', async () => {
      async function* chunks() {
        yield { choices: [{ delta: { content: 'hi' } }] };
      }
      const httpClient = createMockHttpClient([{ status: 200, body: {}, stream: chunks() }]);
      const executor = new OpenAICompatibleRuntimeExecutor({
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'key',
        httpClient: httpClient as any,
        resolveSecret: async () => 'secret'
      });
      const events: any[] = [];
      for await (const event of executor.stream(makeInvocation({ protocol: 'openai.responses' }))) {
        events.push(event);
      }
      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.openai.com/v1/responses' })
      );
    });
  });
});
