import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AdminConsole,
  createApiKeyFromForm,
  createModelFromForm,
  createProviderFromForm,
  deleteProvider,
  loadAdminConsoleData,
  loadAdminConsoleDataForCenter,
  loadAdminLogsData,
  updateProviderFromForm
} from '../src/admin/admin-console.js';

const { adminFetchMock } = vi.hoisted(() => ({
  adminFetchMock: vi.fn()
}));

vi.mock('../src/auth/admin-client-auth.js', () => ({
  adminFetch: adminFetchMock
}));

const now = '2026-04-25T00:00:00.000Z';

describe('admin console', () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
  });

  it('loads API keys, providers, and models through adminFetch and renders the console state', async () => {
    adminFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/admin/keys') {
        return jsonResponse({ items: [apiKey({ name: 'prod-key', requestCountToday: 7 })], nextCursor: null });
      }
      if (url === '/api/admin/providers') {
        return jsonResponse({
          providers: [
            provider({
              name: 'OpenAI main',
              credentialKeyPrefix: 'sk-live',
              credentialStatus: 'active'
            })
          ]
        });
      }
      if (url === '/api/admin/models') {
        return jsonResponse({ models: [model({ alias: 'gpt-4o-mini', providerId: 'provider_openai_main' })] });
      }
      if (url === '/api/admin/dashboard') {
        return jsonResponse(dashboard());
      }
      if (url === '/api/admin/logs') {
        return jsonResponse({ items: [requestLog({ id: 'log_1', keyId: 'key_1' })], nextCursor: null });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const data = await loadAdminConsoleData();
    const keysHtml = renderToStaticMarkup(<AdminConsole initialData={data} />);
    const providersHtml = renderToStaticMarkup(<AdminConsole initialData={data} initialTab="providers" />);
    const modelsHtml = renderToStaticMarkup(<AdminConsole initialData={data} initialTab="models" />);

    expect(keysHtml).toContain('prod-key');
    expect(keysHtml).toContain('调用凭证');
    expect(keysHtml).toContain('服务商');
    expect(keysHtml).toContain('模型');
    expect(providersHtml).toContain('OpenAI main');
    expect(providersHtml).toContain('凭据 活跃');
    expect(providersHtml).toContain('sk-live');
    expect(modelsHtml).toContain('gpt-4o-mini');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/keys');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/providers');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/models');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/dashboard');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/logs');
  });

  it('loads only the selected dashboard center API instead of preloading every admin API', async () => {
    adminFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/admin/models') {
        return jsonResponse({ models: [model({ alias: 'model-on-demand' })] });
      }
      if (url === '/api/admin/dashboard') {
        return jsonResponse(dashboard());
      }
      if (url === '/api/admin/logs') {
        return jsonResponse({ items: [requestLog({ id: 'log-on-demand' })], nextCursor: null });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(loadAdminConsoleDataForCenter('models')).resolves.toMatchObject({
      models: [expect.objectContaining({ alias: 'model-on-demand' })]
    });
    expect(adminFetchMock.mock.calls.map(call => String(call[0]))).toEqual(['/api/admin/models']);

    adminFetchMock.mockClear();
    await expect(loadAdminConsoleDataForCenter('logs')).resolves.toMatchObject({
      operations: {
        dashboard: expect.any(Object),
        logs: [expect.objectContaining({ id: 'log-on-demand' })]
      }
    });
    expect(adminFetchMock.mock.calls.map(call => String(call[0]))).toEqual(['/api/admin/dashboard', '/api/admin/logs']);

    adminFetchMock.mockClear();
    await expect(loadAdminConsoleDataForCenter('approvals')).resolves.toEqual({});
    expect(adminFetchMock).not.toHaveBeenCalled();
  });

  it('loads dashboard and request logs and renders cost operations without secret leakage', async () => {
    adminFetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/admin/dashboard?provider=minimax&status=error') {
        return jsonResponse(
          dashboard({
            summary: {
              requestCount: 1,
              totalTokens: 20,
              estimatedCost: 0.001,
              failureRate: 1,
              averageLatencyMs: 800
            },
            topModels: [{ model: 'gpt-alt', requestCount: 1, totalTokens: 20, estimatedCost: 0.001 }],
            topKeys: [{ keyId: 'key_stage', requestCount: 1, totalTokens: 20, estimatedCost: 0.001 }],
            topProviders: [{ provider: 'minimax', requestCount: 1, totalTokens: 20, estimatedCost: 0.001 }]
          })
        );
      }
      if (url === '/api/admin/logs?provider=minimax&status=error') {
        return jsonResponse({
          items: [
            requestLog({
              id: 'log_error',
              keyId: 'key_stage',
              model: 'gpt-alt',
              provider: 'minimax',
              status: 'error',
              errorMessage: '[redacted]'
            })
          ],
          nextCursor: null
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const data = await loadAdminLogsData({ provider: 'minimax', status: 'error' });
    const html = renderToStaticMarkup(
      <AdminConsole initialData={{ keys: [], providers: [], models: [], operations: data }} initialTab="logs" />
    );

    expect(html).toContain('成本与日志');
    expect(html).toContain('请求数');
    expect(html).toContain('$0.001000');
    expect(html).toContain('100%');
    expect(html).toContain('gpt-alt');
    expect(html).toContain('key_stage');
    expect(html).toContain('[redacted]');
    expect(html).not.toContain('sk-provider-secret');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/dashboard?provider=minimax&status=error');
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/logs?provider=minimax&status=error');
  });

  it('creates an API key and renders plaintext only in the one-time reveal region', async () => {
    adminFetchMock.mockResolvedValue(
      jsonResponse({
        key: apiKey({ name: 'staging key', allowAllModels: false, models: ['gpt-4o-mini', 'qwen-plus'] }),
        plaintext: 'sk-admin-plaintext-once'
      })
    );

    const result = await createApiKeyFromForm({
      name: 'staging key',
      allowAllModels: false,
      models: 'gpt-4o-mini, qwen-plus',
      rpmLimit: '120',
      tpmLimit: '120000',
      dailyTokenLimit: '1000000',
      dailyCostLimit: '20.5',
      expiresAt: '2026-04-25T12:00:00.000Z'
    });

    expect(JSON.parse(String(adminFetchMock.mock.calls[0][1].body))).toMatchObject({
      name: 'staging key',
      allowAllModels: false,
      models: ['gpt-4o-mini', 'qwen-plus'],
      rpmLimit: 120,
      tpmLimit: 120000,
      dailyTokenLimit: 1000000,
      dailyCostLimit: 20.5,
      expiresAt: '2026-04-25T12:00:00.000Z'
    });

    const html = renderToStaticMarkup(
      <AdminConsole
        initialData={{ keys: [result.key], providers: [], models: [] }}
        initialPlaintext={{ keyName: result.key.name, plaintext: result.plaintext }}
      />
    );

    expect(html).toContain('仅展示一次');
    expect(html).toContain('Token 额度');
    expect(html).toContain('成本额度');
    expect(html).toContain('sk-admin-plaintext-once');
    expect(html.match(/sk-admin-plaintext-once/g)).toHaveLength(1);
  });

  it('creates providers with credentials while rendering only credential status and key prefix', async () => {
    adminFetchMock.mockResolvedValueOnce(
      jsonResponse({
        provider: provider({
          id: 'provider_minimax_prod',
          name: 'Minimax prod',
          credentialKeyPrefix: 'secret-',
          credentialStatus: 'active'
        })
      })
    );

    const result = await createProviderFromForm({
      name: 'Minimax prod',
      kind: 'minimax',
      status: 'active',
      baseUrl: 'https://api.minimax.io',
      timeoutMs: '',
      plaintextApiKey: 'secret-provider-key'
    });

    expect(JSON.parse(String(adminFetchMock.mock.calls[0][1].body))).toMatchObject({
      name: 'Minimax prod',
      kind: 'minimax',
      status: 'active',
      baseUrl: 'https://api.minimax.io',
      plaintextApiKey: 'secret-provider-key'
    });
    expect(adminFetchMock).toHaveBeenCalledTimes(1);

    const html = renderToStaticMarkup(
      <AdminConsole initialData={{ keys: [], providers: [result], models: [] }} initialTab="providers" />
    );

    expect(html).toContain('Minimax prod');
    expect(html).toContain('secret-');
    expect(html).toContain('凭据 活跃');
    expect(html).not.toContain('secret-provider-key');
  });

  it('updates providers and rotates credentials through the provider resource endpoint', async () => {
    adminFetchMock.mockResolvedValueOnce(
      jsonResponse({
        provider: provider({
          id: 'provider_minimax_prod',
          name: 'Minimax edited',
          credentialKeyPrefix: 'secret-',
          credentialStatus: 'active'
        })
      })
    );

    const result = await updateProviderFromForm('provider_minimax_prod', {
      name: 'Minimax edited',
      kind: 'minimax',
      status: 'active',
      baseUrl: 'https://api.minimax.io/v1',
      timeoutMs: '45000',
      plaintextApiKey: 'secret-rotated-key'
    });

    expect(adminFetchMock).toHaveBeenCalledWith(
      '/api/admin/providers/provider_minimax_prod',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(JSON.parse(String(adminFetchMock.mock.calls[0][1].body))).toMatchObject({
      name: 'Minimax edited',
      kind: 'minimax',
      status: 'active',
      baseUrl: 'https://api.minimax.io/v1',
      timeoutMs: 45000,
      plaintextApiKey: 'secret-rotated-key'
    });
    expect(adminFetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ credentialKeyPrefix: 'secret-', credentialStatus: 'active' });
  });

  it('soft deletes providers through the provider resource endpoint while keeping credential summary fields', async () => {
    adminFetchMock.mockResolvedValueOnce(
      jsonResponse({
        provider: provider({
          id: 'provider_minimax_prod',
          name: 'Minimax prod',
          status: 'disabled',
          credentialKeyPrefix: 'secret-',
          credentialStatus: 'active'
        })
      })
    );

    const result = await deleteProvider('provider_minimax_prod');

    expect(adminFetchMock).toHaveBeenCalledWith(
      '/api/admin/providers/provider_minimax_prod',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result).toMatchObject({
      id: 'provider_minimax_prod',
      status: 'disabled',
      credentialKeyPrefix: 'secret-',
      credentialStatus: 'active'
    });
    expect(result).not.toHaveProperty('credentials');
  });

  it('submits the model form with routing, capability, pricing, fallback, and visibility fields', async () => {
    adminFetchMock.mockResolvedValue(
      jsonResponse({
        model: model({
          alias: 'gpt-4o-mini',
          providerId: 'provider_openai_main',
          providerModel: 'gpt-4o-mini-2024-07-18',
          adminOnly: true
        })
      })
    );

    const result = await createModelFromForm({
      alias: 'gpt-4o-mini',
      providerId: 'provider_openai_main',
      providerModel: 'gpt-4o-mini-2024-07-18',
      contextWindow: '128000',
      capabilities: 'chat_completions, streaming, json_mode',
      inputPricePer1mTokens: '0.15',
      outputPricePer1mTokens: '0.60',
      fallbackAliases: 'gpt-4.1-mini',
      adminOnly: true,
      enabled: true
    });

    expect(JSON.parse(String(adminFetchMock.mock.calls[0][1].body))).toEqual({
      alias: 'gpt-4o-mini',
      providerId: 'provider_openai_main',
      providerModel: 'gpt-4o-mini-2024-07-18',
      enabled: true,
      contextWindow: 128000,
      inputPricePer1mTokens: 0.15,
      outputPricePer1mTokens: 0.6,
      capabilities: ['chat_completions', 'streaming', 'json_mode'],
      fallbackAliases: ['gpt-4.1-mini'],
      adminOnly: true
    });

    const html = renderToStaticMarkup(
      <AdminConsole initialData={{ keys: [], providers: [], models: [result] }} initialTab="models" />
    );
    expect(html).toContain('gpt-4o-mini-2024-07-18');
    expect(html).toContain('仅管理员可见');
  });
});

function apiKey(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'key_1',
    name: 'default-key',
    keyPrefix: 'lgw_123',
    status: 'active',
    allowAllModels: true,
    models: [],
    rpmLimit: null,
    tpmLimit: null,
    dailyTokenLimit: null,
    dailyCostLimit: null,
    usedTokensToday: 42,
    usedCostToday: 0.12,
    requestCountToday: 1,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: now,
    revokedAt: null,
    ...overrides
  };
}

function provider(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'provider_openai_main',
    name: 'OpenAI main',
    kind: 'openai',
    status: 'active',
    baseUrl: 'https://api.openai.com/v1',
    timeoutMs: null,
    createdAt: now,
    updatedAt: now,
    credentialId: null,
    credentialKeyPrefix: null,
    credentialFingerprint: null,
    credentialKeyVersion: null,
    credentialStatus: null,
    credentialCreatedAt: null,
    credentialRotatedAt: null,
    ...overrides
  };
}

function model(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'model_gpt_4o_mini',
    alias: 'gpt-4o-mini',
    providerId: 'provider_openai_main',
    providerModel: 'gpt-4o-mini',
    enabled: true,
    contextWindow: 128000,
    inputPricePer1mTokens: 0.15,
    outputPricePer1mTokens: 0.6,
    capabilities: ['chat_completions', 'streaming'],
    fallbackAliases: [],
    adminOnly: false,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function requestLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log_1',
    keyId: 'key_1',
    requestedModel: 'gpt-4o-mini',
    model: 'gpt-4o-mini',
    provider: 'openai',
    providerModel: 'gpt-4o-mini',
    status: 'success',
    promptTokens: 10,
    completionTokens: 12,
    totalTokens: 22,
    estimatedCost: 0.00002,
    latencyMs: 250,
    stream: false,
    fallbackAttemptCount: 0,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    ...overrides
  };
}

function dashboard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    summary: {
      requestCount: 1,
      totalTokens: 22,
      estimatedCost: 0.00002,
      failureRate: 0,
      averageLatencyMs: 250
    },
    topModels: [{ model: 'gpt-4o-mini', requestCount: 1, totalTokens: 22, estimatedCost: 0.00002 }],
    topKeys: [{ keyId: 'key_1', requestCount: 1, totalTokens: 22, estimatedCost: 0.00002 }],
    topProviders: [{ provider: 'openai', requestCount: 1, totalTokens: 22, estimatedCost: 0.00002 }],
    ...overrides
  };
}
