import { describe, expect, it } from 'vitest';
import { GatewayError } from '../src/gateway/errors.js';
import { createGatewayService } from '../src/gateway/gateway-service.js';
import type { GatewayChatStreamChunk, ProviderAdapter } from '../src/providers/provider-adapter.js';
import { createMockProviderAdapter } from '../src/providers/mock-provider-adapter.js';
import { RateLimiterUnavailableError } from '../src/rate-limit/rate-limiter.js';

const activeKey = {
  id: 'key_1',
  name: 'local',
  status: 'active' as const,
  models: ['gpt-main'],
  rpmLimit: 10,
  tpmLimit: 10_000,
  dailyTokenLimit: 20_000,
  dailyCostLimit: 5,
  usedTokensToday: 0,
  usedCostToday: 0,
  expiresAt: null
};

const model = {
  alias: 'gpt-main',
  provider: 'mock',
  providerModel: 'mock-model',
  enabled: true,
  contextWindow: 4096,
  inputPricePer1mTokens: 1,
  outputPricePer1mTokens: 2,
  fallbackAliases: [],
  adminOnly: false
};

const fallbackModel = {
  alias: 'cheap-fast',
  provider: 'fallback',
  providerModel: 'mock-cheap-fast',
  enabled: true,
  contextWindow: 4096,
  inputPricePer1mTokens: 0.5,
  outputPricePer1mTokens: 1,
  fallbackAliases: [],
  adminOnly: false
};

function createRepository(key = activeKey) {
  const requestLogs: unknown[] = [];
  const usageRecords: unknown[] = [];

  return {
    requestLogs,
    usageRecords,
    async verifyApiKey(plaintext: string) {
      return plaintext === 'sk-llmgw_test' ? key : null;
    },
    async getUsageForToday() {
      return {
        usedTokensToday: key.usedTokensToday,
        usedCostToday: key.usedCostToday
      };
    },
    async writeRequestLog(log: unknown) {
      requestLogs.push(log);
    },
    async recordUsage(usage: unknown) {
      usageRecords.push(usage);
    }
  };
}

function createModelRegistry(resolvedModel = model) {
  return {
    resolve(alias: string) {
      return alias === resolvedModel.alias ? resolvedModel : undefined;
    },
    list() {
      return [resolvedModel];
    }
  };
}

function createModelRegistryFrom(models: (typeof model)[]) {
  return {
    resolve(alias: string) {
      return models.find(candidate => candidate.alias === alias);
    },
    list() {
      return models;
    }
  };
}

function streamChunk(content: string, modelAlias = 'gpt-main'): GatewayChatStreamChunk {
  return {
    id: 'chatcmpl-test-stream',
    object: 'chat.completion.chunk',
    created: 1,
    model: modelAlias,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null
      }
    ]
  };
}

function createFailingStream(error: unknown): AsyncIterable<GatewayChatStreamChunk> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<GatewayChatStreamChunk>> {
          throw error;
        }
      };
    }
  };
}

describe('gateway service', () => {
  it('rejects a disabled key', async () => {
    const repository = createRepository({ ...activeKey, status: 'disabled' });
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    await expect(
      gateway.complete({
        authorization: 'Bearer sk-llmgw_test',
        body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }] }
      })
    ).rejects.toMatchObject({ code: 'KEY_DISABLED' });
  });

  it('rejects a revoked key with a distinct error code', async () => {
    const repository = createRepository({ ...activeKey, status: 'revoked' });
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    await expect(
      gateway.complete({
        authorization: 'Bearer sk-llmgw_test',
        body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }] }
      })
    ).rejects.toMatchObject({ code: 'KEY_REVOKED' });
  });

  it('routes an allowed model to a provider and writes usage', async () => {
    const repository = createRepository();
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    const response = await gateway.complete({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }] }
    });

    expect(response.choices[0]?.message.content).toBe('ok');
    expect(repository.requestLogs).toHaveLength(1);
    expect(repository.usageRecords).toHaveLength(1);
  });

  it('rejects an invalid request body with a contract error code', async () => {
    const gateway = createGatewayService({
      repository: createRepository(),
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    await expect(
      gateway.complete({
        authorization: 'Bearer sk-llmgw_test',
        body: {
          model: 'gpt-main',
          messages: [{ role: 'system-admin', content: 'hello' }]
        } as never
      })
    ).rejects.toMatchObject({ code: 'UPSTREAM_BAD_RESPONSE' });
  });

  it('writes a request log after streaming completes', async () => {
    const repository = createRepository();
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    const stream = await gateway.stream({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }], stream: true }
    });

    for await (const chunk of stream) {
      expect(chunk.object).toBe('chat.completion.chunk');
      // Drain the stream so the completion hook can write usage/log data.
    }

    expect(repository.requestLogs).toHaveLength(1);
    expect(repository.usageRecords).toHaveLength(1);
    expect(repository.requestLogs[0]).toMatchObject({
      usageSource: 'gateway_estimated_usage',
      stream: true
    });
    expect((repository.requestLogs[0] as { totalTokens: number }).totalTokens).toBeGreaterThan(
      (repository.usageRecords[0] as { promptTokens: number }).promptTokens
    );
  });

  it('rejects requests that would exceed the daily cost budget', async () => {
    const repository = createRepository({ ...activeKey, dailyCostLimit: 0.000001 });
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    await expect(
      gateway.complete({
        authorization: 'Bearer sk-llmgw_test',
        body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }], max_tokens: 1000 }
      })
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
  });

  it('surfaces rate limiter outages without calling the provider', async () => {
    const gateway = createGatewayService({
      repository: createRepository(),
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) },
      rpmLimiter: {
        async consume() {
          throw new RateLimiterUnavailableError('Rate limiter unavailable');
        }
      }
    });

    await expect(
      gateway.complete({
        authorization: 'Bearer sk-llmgw_test',
        body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }] }
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITER_UNAVAILABLE', status: 503 });
  });

  it('falls back to the next model alias when an upstream provider times out', async () => {
    const repository = createRepository();
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistryFrom([
        {
          ...model,
          provider: 'primary',
          fallbackAliases: ['cheap-fast']
        },
        fallbackModel
      ]),
      providers: {
        primary: {
          id: 'primary',
          async complete() {
            throw new GatewayError('UPSTREAM_TIMEOUT', 'timeout', 504);
          },
          stream() {
            throw new GatewayError('UPSTREAM_TIMEOUT', 'timeout', 504);
          },
          async healthCheck() {
            return { status: 'unavailable' as const, checkedAt: new Date().toISOString() };
          }
        },
        fallback: createMockProviderAdapter({ content: 'fallback ok' })
      }
    });

    const response = await gateway.complete({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }] }
    });

    expect(response.model).toBe('gpt-main');
    expect(response.choices[0]?.message.content).toBe('fallback ok');
    expect(repository.requestLogs).toHaveLength(1);
    expect(repository.requestLogs[0]).toMatchObject({
      model: 'cheap-fast',
      requestedModel: 'gpt-main',
      fallbackAttemptCount: 1
    });
  });

  it('falls back to the next model alias when streaming fails before the first chunk', async () => {
    const repository = createRepository();
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistryFrom([
        {
          ...model,
          provider: 'primary',
          fallbackAliases: ['cheap-fast']
        },
        fallbackModel
      ]),
      providers: {
        primary: {
          id: 'primary',
          async complete() {
            throw new GatewayError('UPSTREAM_TIMEOUT', 'timeout', 504);
          },
          stream() {
            return createFailingStream(new GatewayError('UPSTREAM_TIMEOUT', 'timeout', 504));
          },
          async healthCheck() {
            return { status: 'unavailable' as const, checkedAt: new Date().toISOString() };
          }
        },
        fallback: createMockProviderAdapter({ content: 'fallback stream ok' })
      }
    });

    const stream = await gateway.stream({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }], stream: true }
    });
    let content = '';

    for await (const chunk of stream) {
      content += chunk.choices.map(choice => choice.delta.content ?? '').join('');
    }

    expect(content).toBe('fallback stream ok');
    expect(repository.requestLogs).toHaveLength(1);
    expect(repository.requestLogs[0]).toMatchObject({
      model: 'cheap-fast',
      requestedModel: 'gpt-main',
      fallbackAttemptCount: 1,
      stream: true
    });
  });

  it('does not switch providers after a streaming chunk has been emitted and records the failure', async () => {
    const repository = createRepository();
    let fallbackStreamCalls = 0;
    const fallback: ProviderAdapter = {
      ...createMockProviderAdapter({ content: 'should not stream' }),
      stream(request) {
        fallbackStreamCalls += 1;
        return createMockProviderAdapter({ content: 'should not stream' }).stream(request);
      }
    };
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistryFrom([
        {
          ...model,
          provider: 'primary',
          fallbackAliases: ['cheap-fast']
        },
        fallbackModel
      ]),
      providers: {
        primary: {
          id: 'primary',
          async complete() {
            throw new GatewayError('UPSTREAM_TIMEOUT', 'timeout', 504);
          },
          async *stream() {
            yield streamChunk('partial');
            throw new GatewayError('UPSTREAM_TIMEOUT', 'timeout after chunk', 504);
          },
          async healthCheck() {
            return { status: 'available' as const, checkedAt: new Date().toISOString() };
          }
        },
        fallback
      }
    });

    const stream = await gateway.stream({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }], stream: true }
    });

    await expect(async () => {
      for await (const chunk of stream) {
        // Drain the partial stream so the post-chunk failure is observed.
        void chunk;
      }
    }).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });

    expect(fallbackStreamCalls).toBe(0);
    expect(repository.requestLogs).toHaveLength(1);
    expect(repository.requestLogs[0]).toMatchObject({
      status: 'error',
      model: 'gpt-main',
      requestedModel: 'gpt-main',
      stream: true,
      fallbackAttemptCount: 0,
      errorCode: 'UPSTREAM_TIMEOUT'
    });
  });

  it('redacts secret-like content before writing post-chunk streaming errors to logs', async () => {
    const repository = createRepository();
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: {
        mock: {
          id: 'mock',
          async complete() {
            return createMockProviderAdapter({ content: 'ok' }).complete({
              model: 'gpt-main',
              providerModel: 'mock-model',
              messages: [{ role: 'user', content: 'hello' }]
            });
          },
          async *stream() {
            yield streamChunk('partial');
            throw new GatewayError('UPSTREAM_UNAVAILABLE', 'provider failed with sk-live-secret-token', 503);
          },
          async healthCheck() {
            return { status: 'unavailable' as const, checkedAt: new Date().toISOString() };
          }
        }
      }
    });

    const stream = await gateway.stream({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }], stream: true }
    });

    await expect(async () => {
      for await (const chunk of stream) {
        void chunk;
      }
    }).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });

    expect(JSON.stringify(repository.requestLogs)).not.toContain('sk-live-secret-token');
    expect(repository.requestLogs[0]).toMatchObject({
      status: 'error',
      errorMessage: '[redacted]'
    });
  });

  it('uses provider final usage from the last stream chunk before gateway estimates', async () => {
    const repository = createRepository();
    const gateway = createGatewayService({
      repository,
      modelRegistry: createModelRegistry(),
      providers: {
        mock: {
          id: 'mock',
          async complete() {
            return createMockProviderAdapter({ content: 'ok' }).complete({
              model: 'gpt-main',
              providerModel: 'mock-model',
              messages: [{ role: 'user', content: 'hello' }]
            });
          },
          async *stream() {
            yield streamChunk('ok');
            yield {
              id: 'chatcmpl-test-stream',
              object: 'chat.completion.chunk',
              created: 1,
              model: 'gpt-main',
              choices: [],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 2,
                total_tokens: 12
              }
            } satisfies GatewayChatStreamChunk;
          },
          async healthCheck() {
            return { status: 'available' as const, checkedAt: new Date().toISOString() };
          }
        }
      }
    });

    const stream = await gateway.stream({
      authorization: 'Bearer sk-llmgw_test',
      body: { model: 'gpt-main', messages: [{ role: 'user', content: 'hello' }], stream: true }
    });

    for await (const chunk of stream) {
      // Drain the stream so the completion hook can write usage/log data.
      void chunk;
    }

    expect(repository.requestLogs[0]).toMatchObject({
      usageSource: 'provider_final_usage',
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12
    });
    expect(repository.usageRecords[0]).toMatchObject({
      usageSource: 'provider_final_usage',
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12
    });
  });

  it('returns only permitted models for the current key', async () => {
    const gateway = createGatewayService({
      repository: createRepository(),
      modelRegistry: createModelRegistry(),
      providers: { mock: createMockProviderAdapter({ content: 'ok' }) }
    });

    const response = await gateway.listModels({ authorization: 'Bearer sk-llmgw_test' });

    expect(response.data).toEqual([{ id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' }]);
  });
});
