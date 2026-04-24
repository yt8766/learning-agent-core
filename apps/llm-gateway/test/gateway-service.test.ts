import { describe, expect, it } from 'vitest';
import { createGatewayService } from '../src/gateway/gateway-service.js';
import { createMockProviderAdapter } from '../src/providers/mock-provider-adapter.js';

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
