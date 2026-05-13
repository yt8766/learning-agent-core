import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayRuntimeInvocation, GatewayRuntimeStreamEvent } from '@agent/core';

import { AgentGatewayOpenAICompatibleController } from '../../src/api/agent-gateway/agent-gateway-openai-compatible.controller';
import { AgentGatewayRuntimeAccountingService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import {
  OpenAICompatibleRuntimeExecutor,
  FetchGatewayRuntimeExecutorHttpClient,
  type GatewayRuntimeExecutorHttpClient,
  type GatewayRuntimeExecutorHttpRequest,
  type GatewayRuntimeExecutorHttpResponse
} from '../../src/domains/agent-gateway/runtime-engine/executors';
import { RuntimeStreamingService } from '../../src/domains/agent-gateway/runtime-engine/streaming/runtime-streaming.service';
import { AgentGatewayClientApiKeyService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from '../../src/domains/agent-gateway/clients/agent-gateway-client.service';
import { MemoryAgentGatewayClientRepository } from '../../src/domains/agent-gateway/clients/memory-agent-gateway-client.repository';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('RuntimeStreamingService', () => {
  it('projects runtime stream events into OpenAI SSE lines without raw provider payloads', async () => {
    const service = new RuntimeStreamingService();

    const sse = await service.toOpenAIChatSse(
      events([
        {
          invocationId: 'chatcmpl-test',
          type: 'delta',
          sequence: 0,
          createdAt: '2026-05-11T00:00:00.000Z',
          delta: { text: 'hello' }
        },
        {
          invocationId: 'chatcmpl-test',
          type: 'usage',
          sequence: 1,
          createdAt: '2026-05-11T00:00:00.000Z',
          usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }
        },
        {
          invocationId: 'chatcmpl-test',
          type: 'done',
          sequence: 2,
          createdAt: '2026-05-11T00:00:00.000Z'
        }
      ]),
      { model: 'gpt-5.4' }
    );

    expect(sse).toContain('data: ');
    expect(sse).toContain('"object":"chat.completion.chunk"');
    expect(sse).toContain('"content":"hello"');
    expect(sse).toContain('"prompt_tokens":2');
    expect(sse).toContain('data: [DONE]');
    expect(sse).not.toContain('rawResponse');
    expect(sse).not.toContain('headers');
    expect(sse).not.toContain('accessToken');
  });
});

describe('OpenAI-compatible provider stream normalization', () => {
  it('uses fetch response streams and forwards abort signals for default HTTP streaming', async () => {
    const abort = new AbortController();
    const captured: RequestInit[] = [];
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      captured.push(init ?? {});
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          }
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      );
    }) as typeof fetch;

    const client = new FetchGatewayRuntimeExecutorHttpClient();
    const response = await client.request({
      method: 'POST',
      url: 'https://provider.example/v1/chat/completions',
      headers: {},
      body: { model: 'gpt-5.4' },
      stream: true,
      signal: abort.signal
    });

    expect(captured[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(response.body).toBeNull();
    expect(await collect(response.stream ?? events([]))).toEqual([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n'
    ]);
  });

  it('parses OpenAI SSE data chunks and final DONE into project-owned stream events', async () => {
    const http = new RecordingHttpClient([
      streamResponse(200, [
        'data: {"choices":[{"delta":{"content":"hel"}}],"rawProviderChunk":"do-not-serialize"}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: {"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\n',
        'data: [DONE]\n\n'
      ])
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1',
      apiKeySecretRef: 'vault://agent-gateway/openai-primary',
      httpClient: http,
      resolveSecret: async () => 'stream-key',
      now: fixedNow
    });

    const runtimeEvents = await collect(executor.stream({ ...createInvocation(), stream: true }));

    expect(runtimeEvents).toEqual([
      { invocationId: 'inv_stream', type: 'delta', sequence: 0, createdAt: fixedNow(), delta: { text: 'hel' } },
      { invocationId: 'inv_stream', type: 'delta', sequence: 1, createdAt: fixedNow(), delta: { text: 'lo' } },
      {
        invocationId: 'inv_stream',
        type: 'usage',
        sequence: 2,
        createdAt: fixedNow(),
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }
      },
      { invocationId: 'inv_stream', type: 'done', sequence: 3, createdAt: fixedNow() }
    ]);
    expect(JSON.stringify(runtimeEvents)).not.toContain('data:');
    expect(JSON.stringify(runtimeEvents)).not.toContain('rawProviderChunk');
    expect(JSON.stringify(runtimeEvents)).not.toContain('do-not-serialize');
  });

  it('stops provider streaming when the runtime context abort signal is cancelled', async () => {
    const abort = new AbortController();
    const http = new RecordingHttpClient([
      streamResponse(200, [
        'data: {"choices":[{"delta":{"content":"first"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"second"}}]}\n\n',
        'data: [DONE]\n\n'
      ])
    ]);
    const executor = new OpenAICompatibleRuntimeExecutor({
      baseUrl: 'https://provider.example/v1',
      apiKeySecretRef: 'vault://agent-gateway/openai-primary',
      httpClient: http,
      resolveSecret: async () => 'stream-key',
      now: fixedNow
    });

    const runtimeEvents: GatewayRuntimeStreamEvent[] = [];
    for await (const event of executor.stream({ ...createInvocation(), stream: true }, { signal: abort.signal })) {
      runtimeEvents.push(event);
      abort.abort();
    }

    expect(runtimeEvents).toEqual([
      { invocationId: 'inv_stream', type: 'delta', sequence: 0, createdAt: fixedNow(), delta: { text: 'first' } }
    ]);
  });
});

describe('AgentGatewayOpenAICompatibleController streaming', () => {
  it('calls runtimeEngine.stream for stream:true chat completions and returns SSE projection', async () => {
    const { controller, runtimeEngine, secret } = await createRuntimeController();

    const response = await controller.chatCompletions(`Bearer ${secret}`, {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'ping' }],
      stream: true
    });

    expect(response).toContain('data: ');
    expect(response).toContain('deterministic executor response');
    expect(response).toContain('data: [DONE]');
    expect(runtimeEngine.streamInvocations).toHaveLength(1);
    expect(runtimeEngine.streamInvocations[0]).toMatchObject({
      protocol: 'openai.chat.completions',
      stream: true,
      model: 'gpt-5.4'
    });
  });
});

async function createRuntimeController() {
  const repository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-10T00:00:00.000Z'));
  const clientService = new AgentGatewayClientService(repository, () => new Date('2026-05-10T00:00:00.000Z'));
  const apiKeyService = new AgentGatewayClientApiKeyService(repository, sequenceSecretFactory());
  const quotaService = new AgentGatewayClientQuotaService(repository, () => new Date('2026-05-10T00:00:00.000Z'));
  const client = await clientService.create({ name: 'Streaming Runtime App' });
  await quotaService.updateQuota(client.id, {
    tokenLimit: 100,
    requestLimit: 5,
    resetAt: '2026-06-01T00:00:00.000Z'
  });
  const key = await apiKeyService.create(client.id, { name: 'runtime', scopes: ['chat.completions'] });
  const runtimeEngine = new RecordingRuntimeEngine();

  return {
    controller: new AgentGatewayOpenAICompatibleController(
      new AgentGatewayRuntimeAuthService(repository),
      runtimeEngine,
      new AgentGatewayRuntimeAccountingService(repository, () => new Date('2026-05-10T00:00:00.000Z')),
      new RuntimeStreamingService()
    ),
    runtimeEngine,
    secret: key.secret
  };
}

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

class RecordingRuntimeEngine extends RuntimeEngineFacade {
  readonly streamInvocations: unknown[] = [];

  override async *stream(invocation: Parameters<RuntimeEngineFacade['stream']>[0]) {
    this.streamInvocations.push(invocation);
    yield* super.stream(invocation);
  }
}

async function* events(items: GatewayRuntimeStreamEvent[]): AsyncIterable<GatewayRuntimeStreamEvent> {
  for (const item of items) yield item;
}

function createInvocation(): GatewayRuntimeInvocation {
  return {
    id: 'inv_stream',
    protocol: 'openai.chat.completions',
    model: 'gpt-5.4',
    stream: false,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
    requestedAt: '2026-05-10T00:00:00.000Z',
    client: { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] },
    metadata: {}
  };
}

function streamResponse(status: number, chunks: unknown[]): GatewayRuntimeExecutorHttpResponse {
  return { status, headers: { 'content-type': 'text/event-stream' }, body: null, stream: events(chunks as never) };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

function fixedNow(): string {
  return '2026-05-11T00:00:00.000Z';
}

function sequenceSecretFactory() {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `agp_live_stream_secret_${sequence}`;
  };
}
