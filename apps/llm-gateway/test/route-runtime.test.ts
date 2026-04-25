import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGatewayServiceForRuntime, createRateLimitersForRuntime } from '../src/gateway/route-runtime.js';

describe('gateway route runtime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails fast in production when no Redis configuration is available', () => {
    expect(() => createRateLimitersForRuntime({}, 'production')).toThrow(/Redis rate limiter/i);
  });

  it('uses Upstash rate limiters when Upstash configuration is available', async () => {
    const fetchCalls: unknown[] = [];
    const { rpmLimiter } = createRateLimitersForRuntime(
      {
        UPSTASH_REDIS_REST_URL: 'https://redis.example',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token'
      },
      'production',
      {
        fetch: async (input, init) => {
          fetchCalls.push([input, init]);
          return {
            ok: true,
            async json() {
              return { result: [1, 1, Date.parse('2026-04-25T00:01:00.000Z')] };
            }
          };
        }
      }
    );

    await expect(
      rpmLimiter.consume({
        key: 'llm-gateway:rate:rpm:key_1',
        limit: 10,
        windowMs: 60_000,
        now: Date.parse('2026-04-25T00:00:00.000Z')
      })
    ).resolves.toMatchObject({ allowed: true, remaining: 9 });
    expect(fetchCalls).toHaveLength(1);
  });

  it('uses memory limiters outside production when Redis configuration is missing', async () => {
    const { rpmLimiter } = createRateLimitersForRuntime({}, 'development');

    await expect(rpmLimiter.consume({ key: 'key_1', limit: 1, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true
    });
  });

  it('creates a DB-backed gateway service when DATABASE_URL is configured', async () => {
    const createPostgresRepository = vi.fn(() => ({
      async verifyApiKey() {
        return null;
      },
      async getUsageForToday() {
        return { usedTokensToday: 0, usedCostToday: 0 };
      },
      async resolve() {
        return undefined;
      },
      async list() {
        return [];
      },
      async listProviderRuntimeConfigs() {
        return [];
      }
    }));
    const service = createGatewayServiceForRuntime(
      {
        DATABASE_URL: 'postgres://gateway.example/db',
        LLM_GATEWAY_KEY_HASH_SECRET: 'hash-secret',
        LLM_GATEWAY_PROVIDER_SECRET_KEY: 'local-provider-secret-vault-key-32',
        LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION: 'local-v1'
      },
      'development',
      {
        createPostgresRepository,
        createBootstrapGatewayService: vi.fn(() => {
          throw new Error('bootstrap should not be used');
        })
      }
    );

    await expect(service.listModels({ authorization: 'Bearer sk-llmgw_missing' })).rejects.toMatchObject({
      code: 'AUTH_ERROR'
    });
    expect(createPostgresRepository).toHaveBeenCalledWith(
      'postgres://gateway.example/db',
      'hash-secret',
      expect.objectContaining({
        providerSecretVault: expect.any(Object)
      })
    );
  });

  it('passes Postgres provider runtime config into MiniMax adapters', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      async json() {
        return {
          id: 'chatcmpl_minimax',
          object: 'chat.completion',
          created: 1777075200,
          model: 'MiniMax-Text-01',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'db minimax response' },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 }
        };
      }
    }));
    vi.stubGlobal('fetch', fetch);
    const createPostgresRepository = vi.fn(() => ({
      async verifyApiKey() {
        return {
          id: 'key_db',
          name: 'DB key',
          status: 'active' as const,
          models: ['mini'],
          rpmLimit: null,
          tpmLimit: null,
          dailyTokenLimit: null,
          dailyCostLimit: null,
          usedTokensToday: 0,
          usedCostToday: 0,
          expiresAt: null
        };
      },
      async getUsageForToday() {
        return { usedTokensToday: 0, usedCostToday: 0 };
      },
      async resolve() {
        return {
          alias: 'mini',
          provider: 'provider_minimax',
          providerModel: 'MiniMax-Text-01',
          enabled: true,
          contextWindow: 128000,
          inputPricePer1mTokens: 0,
          outputPricePer1mTokens: 0,
          fallbackAliases: [],
          adminOnly: false
        };
      },
      async list() {
        return [
          {
            alias: 'mini',
            provider: 'provider_minimax',
            providerModel: 'MiniMax-Text-01',
            enabled: true,
            contextWindow: 128000,
            inputPricePer1mTokens: 0,
            outputPricePer1mTokens: 0,
            fallbackAliases: [],
            adminOnly: false
          }
        ];
      },
      async listProviderRuntimeConfigs() {
        return [
          {
            providerId: 'provider_minimax',
            providerKind: 'minimax',
            baseUrl: 'https://api.minimax.example/v1',
            apiKey: 'sk-minimax-db',
            timeoutMs: 30000
          }
        ];
      }
    }));
    const service = createGatewayServiceForRuntime(
      {
        DATABASE_URL: 'postgres://gateway.example/db',
        LLM_GATEWAY_KEY_HASH_SECRET: 'hash-secret',
        LLM_GATEWAY_PROVIDER_SECRET_KEY: 'local-provider-secret-vault-key-32'
      },
      'development',
      { createPostgresRepository }
    );

    await expect(
      service.complete({
        authorization: 'Bearer sk-llmgw_db',
        body: { model: 'mini', messages: [{ role: 'user', content: 'hello' }] }
      })
    ).resolves.toMatchObject({
      choices: [{ message: { content: 'db minimax response' } }],
      usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 }
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.minimax.example/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer sk-minimax-db'
        })
      })
    );
  });

  it('fails closed for DB provider runtime when provider secret key is missing', () => {
    expect(() =>
      createGatewayServiceForRuntime(
        {
          DATABASE_URL: 'postgres://gateway.example/db',
          LLM_GATEWAY_KEY_HASH_SECRET: 'hash-secret',
          LLM_GATEWAY_BOOTSTRAP_API_KEY: 'sk-llmgw_bootstrap'
        },
        'development',
        {
          createBootstrapGatewayService: vi.fn(() => {
            throw new Error('bootstrap should not be used');
          })
        }
      )
    ).toThrow(/LLM_GATEWAY_PROVIDER_SECRET_KEY/);
  });

  it('falls back to bootstrap when DB runtime cannot be created outside production', async () => {
    const service = createGatewayServiceForRuntime(
      {
        DATABASE_URL: 'postgres://gateway.example/db',
        LLM_GATEWAY_BOOTSTRAP_API_KEY: 'sk-llmgw_bootstrap'
      },
      'development',
      {
        createPostgresRepository: vi.fn(() => {
          throw new Error('db unavailable');
        })
      }
    );

    await expect(service.listModels({ authorization: 'Bearer sk-llmgw_bootstrap' })).resolves.toEqual({
      object: 'list',
      data: [{ id: 'gpt-main', object: 'model', owned_by: 'llm-gateway' }]
    });
  });
});
