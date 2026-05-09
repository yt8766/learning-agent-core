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
});
