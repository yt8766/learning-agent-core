import { afterEach, describe, expect, it, vi } from 'vitest';

import { getGatewayServiceForRoutes, setGatewayServiceForRoutes } from '../src/gateway/route-runtime.js';

const originalEnv = { ...process.env };

vi.mock('../src/repositories/postgres-gateway.js', () => ({
  createPostgresGatewayRepository: vi.fn(() => ({
    async verifyApiKey() {
      return {
        id: 'key-e2e',
        name: 'E2E key',
        status: 'active',
        models: ['gpt-main'],
        rpmLimit: 60,
        tpmLimit: 100000,
        dailyTokenLimit: 500000,
        dailyCostLimit: 10,
        usedTokensToday: 0,
        usedCostToday: 0,
        expiresAt: null
      };
    },
    async getUsageForToday() {
      return { usedTokensToday: 0, usedCostToday: 0 };
    },
    async listModels() {
      return [
        {
          alias: 'gpt-main',
          provider: 'mock',
          providerModel: 'mock-gpt-main',
          enabled: true,
          contextWindow: 128000,
          inputPricePer1mTokens: 0,
          outputPricePer1mTokens: 0,
          fallbackAliases: [],
          adminOnly: false
        }
      ];
    }
  }))
}));

describe('gateway route runtime postgres mode', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    setGatewayServiceForRoutes(null);
  });

  it('creates a postgres-backed mock-provider gateway service when configured for e2e', async () => {
    process.env.LLM_GATEWAY_RUNTIME = 'postgres';
    process.env.DATABASE_URL = 'postgresql://llm_gateway:password@localhost:5432/llm_gateway';
    process.env.LLM_GATEWAY_API_KEY_SECRET = 'route-runtime-secret';
    process.env.LLM_GATEWAY_PROVIDER_MODE = 'mock';

    const service = getGatewayServiceForRoutes();
    const models = await service.listModels({ authorization: 'Bearer sk-llmgw_test_valid_000000' });

    expect(models).toEqual({
      object: 'list',
      data: [{ id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' }]
    });
  });
});
