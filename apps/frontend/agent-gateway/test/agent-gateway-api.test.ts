import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentGatewayApiClient } from '../src/api/agent-gateway-api';

vi.mock('axios', () => ({
  default: {
    request: vi.fn()
  }
}));

const axiosRequestMock = vi.mocked(axios.request);

beforeEach(() => {
  axiosRequestMock.mockReset();
});
const snapshot = {
  observedAt: '2026-05-07T00:00:00.000Z',
  runtime: {
    mode: 'proxy',
    status: 'healthy',
    activeProviderCount: 1,
    degradedProviderCount: 0,
    requestPerMinute: 1,
    p95LatencyMs: 100
  },
  config: {
    inputTokenStrategy: 'preprocess',
    outputTokenStrategy: 'postprocess',
    retryLimit: 2,
    circuitBreakerEnabled: true,
    auditEnabled: true
  },
  providerCredentialSets: [],
  credentialFiles: [],
  quotas: []
};
describe('AgentGatewayApiClient', () => {
  it('refreshes once when access token expires', async () => {
    axiosRequestMock
      .mockResolvedValueOnce({ status: 401, data: { error: { code: 'ACCESS_TOKEN_EXPIRED' } } })
      .mockResolvedValueOnce({ status: 200, data: snapshot });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });
    await expect(client.snapshot()).resolves.toEqual(snapshot);
    expect(axiosRequestMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes once when the gateway marks the access token unauthenticated', async () => {
    const refreshAccessToken = vi.fn(async () => 'fresh');
    axiosRequestMock
      .mockResolvedValueOnce({ status: 401, data: { code: 'UNAUTHENTICATED', message: 'Access Token 无效' } })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          state: 'codex-state',
          verificationUri: 'https://auth.openai.com/oauth/authorize?state=codex-state',
          expiresAt: '2026-05-08T00:15:00.000Z'
        }
      });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken
    });

    await expect(client.startProviderOAuth('codex')).resolves.toMatchObject({ state: 'codex-state' });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(axiosRequestMock).toHaveBeenCalledTimes(2);
  });

  it('calls gateway management and relay endpoints through stable client methods', async () => {
    axiosRequestMock
      .mockResolvedValueOnce({ status: 200, data: snapshot.providerCredentialSets })
      .mockResolvedValueOnce({ status: 200, data: snapshot.credentialFiles })
      .mockResolvedValueOnce({ status: 200, data: snapshot.quotas })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          tokens: 2,
          method: 'approximate'
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          id: 'relay-1',
          providerId: 'openai-primary',
          model: 'gpt-main',
          content: 'pong',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          logId: 'log-1'
        }
      });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(client.providers()).resolves.toEqual([]);
    await expect(client.credentialFiles()).resolves.toEqual([]);
    await expect(client.quotas()).resolves.toEqual([]);
    await expect(client.tokenCount({ text: 'ping' })).resolves.toMatchObject({ tokens: 2 });
    await expect(
      client.relay({
        model: 'gpt-main',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      })
    ).resolves.toMatchObject({ content: 'pong' });

    expect(axiosRequestMock.mock.calls.map(call => call[0].url)).toEqual([
      '/api/agent-gateway/providers',
      '/api/agent-gateway/credential-files',
      '/api/agent-gateway/quotas',
      '/api/agent-gateway/token-count',
      '/api/agent-gateway/relay'
    ]);
  });

  it('calls gateway write endpoints with stable command methods', async () => {
    const provider = {
      id: 'openai-primary',
      provider: 'OpenAI',
      modelFamilies: ['gpt-main'],
      status: 'healthy' as const,
      priority: 1,
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 60000
    };
    const credentialFile = {
      id: 'openai-env',
      provider: 'OpenAI',
      path: '.env',
      status: 'valid' as const,
      lastCheckedAt: '2026-05-08T00:00:00.000Z'
    };
    const quota = {
      id: 'daily',
      provider: 'OpenAI',
      scope: 'daily',
      usedTokens: 0,
      limitTokens: 100,
      resetAt: '2026-05-09T00:00:00.000Z',
      status: 'normal' as const
    };
    axiosRequestMock
      .mockResolvedValueOnce({ status: 200, data: snapshot.config })
      .mockResolvedValueOnce({ status: 200, data: provider })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } })
      .mockResolvedValueOnce({ status: 200, data: credentialFile })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } })
      .mockResolvedValueOnce({ status: 200, data: quota });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(client.updateConfig({ retryLimit: 3 })).resolves.toMatchObject({ retryLimit: 2 });
    await expect(client.upsertProvider(provider)).resolves.toEqual(provider);
    await expect(client.deleteProvider('openai-primary')).resolves.toBeUndefined();
    await expect(client.upsertCredentialFile({ ...credentialFile, content: 'secret' })).resolves.toEqual(
      credentialFile
    );
    await expect(client.deleteCredentialFile('openai-env')).resolves.toBeUndefined();
    await expect(client.updateQuota(quota)).resolves.toEqual(quota);

    expect(
      axiosRequestMock.mock.calls.map(call => {
        const config = call[0];
        return [config.url, config.method ?? 'GET'];
      })
    ).toEqual([
      ['/api/agent-gateway/config', 'PATCH'],
      ['/api/agent-gateway/providers/openai-primary', 'PUT'],
      ['/api/agent-gateway/providers/openai-primary', 'DELETE'],
      ['/api/agent-gateway/credential-files/openai-env', 'PUT'],
      ['/api/agent-gateway/credential-files/openai-env', 'DELETE'],
      ['/api/agent-gateway/quotas/daily', 'PATCH']
    ]);
  });

  it('calls gateway client management endpoints through stable client methods', async () => {
    const clientRecord = {
      id: 'client-acme',
      name: 'Acme App',
      status: 'active' as const,
      tags: [],
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z'
    };
    const apiKey = {
      id: 'key-client-acme-runtime',
      clientId: 'client-acme',
      name: 'runtime',
      prefix: 'agp_live',
      status: 'active' as const,
      scopes: ['models.read', 'chat.completions'] as const,
      createdAt: '2026-05-10T00:00:00.000Z',
      expiresAt: null,
      lastUsedAt: null
    };
    const quota = {
      clientId: 'client-acme',
      period: 'monthly' as const,
      tokenLimit: 100,
      requestLimit: 10,
      usedTokens: 0,
      usedRequests: 0,
      resetAt: '2026-06-01T00:00:00.000Z',
      status: 'normal' as const
    };
    axiosRequestMock
      .mockResolvedValueOnce({ status: 200, data: { items: [clientRecord] } })
      .mockResolvedValueOnce({ status: 200, data: clientRecord })
      .mockResolvedValueOnce({ status: 200, data: { apiKey, secret: 'agp_live_secret' } })
      .mockResolvedValueOnce({ status: 200, data: quota })
      .mockResolvedValueOnce({ status: 200, data: { items: [apiKey] } })
      .mockResolvedValueOnce({ status: 200, data: { items: [] } });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(client.clients()).resolves.toEqual({ items: [clientRecord] });
    await expect(client.createClient({ name: 'Acme App' })).resolves.toEqual(clientRecord);
    await expect(
      client.createClientApiKey('client-acme', { name: 'runtime', scopes: ['models.read', 'chat.completions'] })
    ).resolves.toMatchObject({ secret: 'agp_live_secret' });
    await expect(
      client.updateClientQuota('client-acme', {
        tokenLimit: 100,
        requestLimit: 10,
        resetAt: '2026-06-01T00:00:00.000Z'
      })
    ).resolves.toEqual(quota);
    await expect(client.clientApiKeys('client-acme')).resolves.toEqual({ items: [apiKey] });
    await expect(client.clientLogs('client-acme')).resolves.toEqual({ items: [] });

    expect(
      axiosRequestMock.mock.calls.map(call => {
        const config = call[0];
        return [config.url, config.method ?? 'GET'];
      })
    ).toEqual([
      ['/api/agent-gateway/clients', 'GET'],
      ['/api/agent-gateway/clients', 'POST'],
      ['/api/agent-gateway/clients/client-acme/api-keys', 'POST'],
      ['/api/agent-gateway/clients/client-acme/quota', 'PUT'],
      ['/api/agent-gateway/clients/client-acme/api-keys', 'GET'],
      ['/api/agent-gateway/clients/client-acme/logs?limit=20', 'GET']
    ]);
  });

  it('calls gateway OAuth lifecycle endpoints', async () => {
    const oauthStart = {
      flowId: 'oauth-openai-env',
      providerId: 'openai-primary',
      credentialFileId: 'openai-env',
      verificationUri: 'https://gateway.local/oauth/verify/oauth-openai-env',
      userCode: 'CODE-openai-primary-openai-env',
      expiresAt: '2026-05-08T00:15:00.000Z'
    };
    const oauthComplete = {
      flowId: 'oauth-openai-env',
      providerId: 'openai-primary',
      credentialFileId: 'openai-env',
      status: 'valid' as const,
      completedAt: '2026-05-08T00:01:00.000Z',
      credentialFile: {
        id: 'openai-env',
        provider: 'OpenAI',
        path: '.env',
        status: 'valid' as const,
        lastCheckedAt: '2026-05-08T00:01:00.000Z'
      }
    };
    axiosRequestMock
      .mockResolvedValueOnce({ status: 200, data: oauthStart })
      .mockResolvedValueOnce({ status: 200, data: oauthComplete });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(client.startOAuth({ providerId: 'openai-primary', credentialFileId: 'openai-env' })).resolves.toEqual(
      oauthStart
    );
    await expect(
      client.completeOAuth({ flowId: 'oauth-openai-env', userCode: 'CODE-openai-primary-openai-env' })
    ).resolves.toEqual(oauthComplete);

    expect(axiosRequestMock.mock.calls.map(call => call[0].url)).toEqual([
      '/api/agent-gateway/oauth/start',
      '/api/agent-gateway/oauth/complete'
    ]);
  });

  it('starts provider OAuth through the CLI Proxy parity auth-url endpoint', async () => {
    axiosRequestMock.mockResolvedValueOnce({
      status: 200,
      data: {
        state: 'codex-state',
        verificationUri: 'https://auth.openai.com/oauth/authorize?state=codex-state',
        expiresAt: '2026-05-08T00:15:00.000Z'
      }
    });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(client.startProviderOAuth('codex')).resolves.toMatchObject({
      state: 'codex-state',
      verificationUri: 'https://auth.openai.com/oauth/authorize?state=codex-state'
    });

    expect(axiosRequestMock.mock.calls[0]?.[0]).toMatchObject({
      method: 'POST',
      url: '/api/agent-gateway/oauth/codex/start',
      data: { isWebui: true }
    });
  });

  it('calls CLI Proxy parity management endpoints through frontend-owned client methods', async () => {
    const apiKeyPayload = {
      id: 'proxy-key-0',
      name: 'Proxy key 1',
      prefix: 'sk-***abc',
      status: 'active',
      scopes: ['proxy:invoke'],
      createdAt: '2026-05-08T00:00:00.000Z',
      lastUsedAt: null,
      expiresAt: null,
      usage: { requestCount: 0, lastRequestAt: null }
    };
    axiosRequestMock
      .mockResolvedValueOnce({
        status: 200,
        data: {
          apiBase: 'https://remote.router-for.me/v0/management',
          managementKeyMasked: 'sec***ret',
          timeoutMs: 15000,
          updatedAt: '2026-05-08T00:00:00.000Z'
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'connected',
          checkedAt: '2026-05-08T00:00:01.000Z',
          serverVersion: 'memory-cli-proxy',
          serverBuildDate: '2026-05-08'
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { content: 'debug: true\n', format: 'yaml', version: 'config-1' }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { changed: true, before: 'debug: false\n', after: 'debug: true\n' }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { content: 'debug: true\n', format: 'yaml', version: 'config-2' }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { reloadedAt: '2026-05-08T00:02:00.000Z', reloaded: true }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [apiKeyPayload] }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [apiKeyPayload] }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          items: [
            {
              fileName: 'error.log',
              path: '/logs/error.log',
              sizeBytes: 42,
              modifiedAt: '2026-05-08T00:00:00.000Z',
              downloadUrl: '/api/agent-gateway/logs/request-error-files/error.log'
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          version: '1.2.3',
          buildDate: '2026-05-01',
          latestVersion: '1.2.4',
          updateAvailable: true,
          links: { help: 'https://help.router-for.me/' }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          groups: [
            {
              providerId: 'openai',
              providerKind: 'openai-compatible',
              models: [{ id: 'gpt-5.4', displayName: 'gpt-5.4', providerKind: 'openai-compatible', available: true }]
            }
          ]
        }
      });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(
      client.saveConnectionProfile({
        apiBase: 'https://remote.router-for.me/v0/management',
        managementKey: 'secret',
        timeoutMs: 15000
      })
    ).resolves.toMatchObject({ managementKeyMasked: 'sec***ret' });
    await expect(client.checkConnection()).resolves.toMatchObject({ status: 'connected' });
    await expect(client.rawConfig()).resolves.toMatchObject({ version: 'config-1' });
    await expect(client.diffRawConfig({ content: 'debug: true\n' })).resolves.toMatchObject({ changed: true });
    await expect(client.saveRawConfig({ content: 'debug: true\n' })).resolves.toMatchObject({ version: 'config-2' });
    await expect(client.reloadConfig()).resolves.toMatchObject({ reloaded: true });
    await expect(client.apiKeys()).resolves.toMatchObject({ items: [{ prefix: 'sk-***abc' }] });
    await expect(client.replaceApiKeys({ keys: ['sk-secret'] })).resolves.toMatchObject({
      items: [{ prefix: 'sk-***abc' }]
    });
    await expect(client.logFiles()).resolves.toMatchObject({ items: [{ fileName: 'error.log' }] });
    await expect(client.systemInfo()).resolves.toMatchObject({ latestVersion: '1.2.4' });
    await expect(client.discoverModels()).resolves.toMatchObject({ groups: [{ providerId: 'openai' }] });

    expect(
      axiosRequestMock.mock.calls.map(call => {
        const config = call[0];
        return [config.url, config.method ?? 'GET'];
      })
    ).toEqual([
      ['/api/agent-gateway/connection/profile', 'PUT'],
      ['/api/agent-gateway/connection/check', 'POST'],
      ['/api/agent-gateway/config/raw', 'GET'],
      ['/api/agent-gateway/config/raw/diff', 'POST'],
      ['/api/agent-gateway/config/raw', 'PUT'],
      ['/api/agent-gateway/config/reload', 'POST'],
      ['/api/agent-gateway/api-keys', 'GET'],
      ['/api/agent-gateway/api-keys', 'PUT'],
      ['/api/agent-gateway/logs/request-error-files', 'GET'],
      ['/api/agent-gateway/system/info', 'GET'],
      ['/api/agent-gateway/system/models', 'GET']
    ]);
  });

  it('calls agent-server management parity endpoints needed by restored pages', async () => {
    const providerConfig = {
      providerType: 'gemini' as const,
      id: 'gemini-primary',
      displayName: 'Gemini Primary',
      enabled: true,
      baseUrl: null,
      models: [{ name: 'gemini-2.5-pro', alias: 'gemini-pro' }],
      excludedModels: [],
      credentials: [
        {
          credentialId: 'gemini-key-1',
          apiKeyMasked: 'AIza***demo',
          status: 'valid' as const
        }
      ]
    };
    const authFile = {
      id: 'gemini-oauth-prod',
      providerId: 'gemini',
      providerKind: 'gemini',
      fileName: 'gemini-oauth-prod.json',
      path: '/auth/gemini-oauth-prod.json',
      status: 'valid' as const,
      accountEmail: 'agent@example.com',
      projectId: 'agent-project',
      modelCount: 12,
      updatedAt: '2026-05-08T00:00:00.000Z'
    };
    axiosRequestMock
      .mockResolvedValueOnce({ status: 200, data: { items: [providerConfig] } })
      .mockResolvedValueOnce({ status: 200, data: providerConfig })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          groups: [
            {
              providerId: 'gemini-primary',
              providerKind: 'gemini',
              models: [
                {
                  id: 'gemini-2.5-pro',
                  displayName: 'gemini-2.5-pro',
                  providerKind: 'gemini',
                  available: true
                }
              ]
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          providerId: 'gemini-primary',
          ok: true,
          latencyMs: 25,
          inputTokens: 1,
          outputTokens: 1,
          checkedAt: '2026-05-08T00:00:01.000Z',
          message: 'ok'
        }
      })
      .mockResolvedValueOnce({ status: 200, data: { items: [authFile], nextCursor: null } })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          accepted: [
            {
              authFileId: 'gemini-oauth-prod',
              fileName: 'gemini-oauth-prod.json',
              providerKind: 'gemini',
              status: 'valid'
            }
          ],
          rejected: []
        }
      })
      .mockResolvedValueOnce({ status: 200, data: { deleted: ['gemini-oauth-prod.json'], skipped: [] } })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          state: 'flow-1',
          verificationUri: 'https://example.com/verify',
          expiresAt: '2026-05-08T00:15:00.000Z'
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { state: 'flow-1', status: 'pending', checkedAt: '2026-05-08T00:01:00.000Z' }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { accepted: true, provider: 'codex', completedAt: '2026-05-08T00:02:00.000Z' }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          version: '1.2.3',
          buildDate: '2026-05-01',
          latestVersion: '1.2.4',
          updateAvailable: true,
          links: { help: 'https://help.router-for.me/' }
        }
      })
      .mockResolvedValueOnce({ status: 200, data: { requestLog: true, updatedAt: '2026-05-08T00:03:00.000Z' } })
      .mockResolvedValueOnce({ status: 200, data: { cleared: true, clearedAt: '2026-05-08T00:04:00.000Z' } });
    const client = new AgentGatewayApiClient({
      getAccessToken: () => 'access',
      refreshAccessToken: async () => 'fresh'
    });

    await expect(client.providerConfigs()).resolves.toMatchObject({ items: [{ id: 'gemini-primary' }] });
    await expect(client.saveProviderConfig(providerConfig)).resolves.toMatchObject({ displayName: 'Gemini Primary' });
    await expect(client.providerConfigModels('gemini-primary')).resolves.toMatchObject({
      groups: [{ providerId: 'gemini-primary' }]
    });
    await expect(client.testProviderModel('gemini-primary', 'gemini-2.5-pro')).resolves.toMatchObject({
      ok: true
    });
    await expect(client.authFiles({ query: 'gemini', providerKind: 'gemini', limit: 24 })).resolves.toMatchObject({
      items: [{ fileName: 'gemini-oauth-prod.json' }]
    });
    await expect(
      client.batchUploadAuthFiles({
        files: [{ fileName: 'gemini-oauth-prod.json', contentBase64: 'e30=', providerKind: 'gemini' }]
      })
    ).resolves.toMatchObject({ accepted: [{ authFileId: 'gemini-oauth-prod' }] });
    await expect(client.deleteAuthFiles({ names: ['gemini-oauth-prod.json'] })).resolves.toMatchObject({
      deleted: ['gemini-oauth-prod.json']
    });
    await expect(client.startGeminiCliOAuth({ projectId: 'agent-project' })).resolves.toMatchObject({
      state: 'flow-1',
      verificationUri: 'https://example.com/verify'
    });
    await expect(client.oauthStatus('flow-1')).resolves.toMatchObject({ status: 'pending' });
    await expect(
      client.submitOAuthCallback({ provider: 'codex', redirectUrl: 'https://example.com/callback?code=1' })
    ).resolves.toMatchObject({ accepted: true });
    await expect(client.latestVersion()).resolves.toMatchObject({ latestVersion: '1.2.4' });
    await expect(client.setRequestLogEnabled(true)).resolves.toMatchObject({ requestLog: true });
    await expect(client.clearLoginStorage()).resolves.toMatchObject({ cleared: true });

    expect(
      axiosRequestMock.mock.calls.map(call => {
        const config = call[0];
        return [config.url, config.method ?? 'GET'];
      })
    ).toEqual([
      ['/api/agent-gateway/provider-configs', 'GET'],
      ['/api/agent-gateway/provider-configs/gemini-primary', 'PUT'],
      ['/api/agent-gateway/provider-configs/gemini-primary/models', 'GET'],
      ['/api/agent-gateway/provider-configs/gemini-primary/test-model', 'POST'],
      ['/api/agent-gateway/auth-files?query=gemini&providerKind=gemini&limit=24', 'GET'],
      ['/api/agent-gateway/auth-files', 'POST'],
      ['/api/agent-gateway/auth-files', 'DELETE'],
      ['/api/agent-gateway/oauth/gemini-cli/start', 'POST'],
      ['/api/agent-gateway/oauth/status/flow-1', 'GET'],
      ['/api/agent-gateway/oauth/callback', 'POST'],
      ['/api/agent-gateway/system/latest-version', 'GET'],
      ['/api/agent-gateway/system/request-log', 'PUT'],
      ['/api/agent-gateway/system/clear-login-storage', 'POST']
    ]);
    expect(axiosRequestMock.mock.calls[6][0].data).toEqual({ names: ['gemini-oauth-prod.json'] });
  });
});
