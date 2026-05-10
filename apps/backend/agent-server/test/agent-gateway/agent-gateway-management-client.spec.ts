import { describe, expect, it, vi } from 'vitest';
import { CliProxyManagementClient } from '../../src/domains/agent-gateway/management/cli-proxy-management-client';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';

describe('MemoryAgentGatewayManagementClient', () => {
  it('reports disconnected before a profile and connected after save', async () => {
    const client = new MemoryAgentGatewayManagementClient();

    await expect(client.checkConnection()).resolves.toMatchObject({ status: 'disconnected' });

    await client.saveProfile({
      apiBase: 'https://remote.router-for.me/v0/management',
      managementKey: 'secret',
      timeoutMs: 15000
    });

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'connected',
      serverVersion: 'memory-cli-proxy'
    });
  });

  it('exposes deterministic management projections without leaking raw vendor shapes', async () => {
    const client = new MemoryAgentGatewayManagementClient();

    await expect(client.readRawConfig()).resolves.toMatchObject({
      content: 'debug: true\nrequest-retry: 2\n',
      format: 'yaml',
      version: 'config-1'
    });
    await expect(client.diffRawConfig({ content: 'debug: false\n' })).resolves.toMatchObject({
      changed: true,
      before: 'debug: true\nrequest-retry: 2\n',
      after: 'debug: false\n'
    });

    await client.replaceApiKeys({ keys: ['sk-one', 'sk-two'] });
    await expect(client.listApiKeys()).resolves.toMatchObject({
      items: [
        { id: 'proxy-key-0', prefix: 'sk-***one', lastUsedAt: null },
        { id: 'proxy-key-1', prefix: 'sk-***two', lastUsedAt: null }
      ]
    });

    await expect(client.listQuotaDetails()).resolves.toMatchObject({
      items: [{ providerId: 'claude', scope: 'daily', status: 'warning' }]
    });

    await expect(client.searchLogs({ query: 'proxy', hideManagementTraffic: true, limit: 10 })).resolves.toMatchObject({
      items: [{ id: 'log-proxy-1', message: 'proxy request completed' }]
    });
    await expect(client.listRequestErrorFiles()).resolves.toMatchObject({
      items: [{ fileName: 'request-error-1.log', sizeBytes: 42 }]
    });

    await expect(client.systemInfo()).resolves.toMatchObject({ version: 'memory-cli-proxy' });
    await expect(client.discoverModels()).resolves.toMatchObject({ groups: [{ providerId: 'openai' }] });
  });

  it('preserves CLIProxyAPI provider OAuth authorization URLs and device codes', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          state: 'codex-state',
          url: [
            'https://auth.openai.com/oauth/authorize',
            '?client_id=app_EMoamEEZ73f0CkXaXp7hrann',
            '&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback',
            '&response_type=code',
            '&state=codex-state'
          ].join('')
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    const client = new CliProxyManagementClient({
      apiBase: 'https://cli-proxy.example.com/v0/management',
      managementKey: 'secret',
      fetcher
    });

    const result = await client.startProviderOAuth({ provider: 'codex', isWebui: true });

    expect(result.verificationUri).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback');
    expect(result.verificationUri).not.toContain('api%2Fagent-gateway%2Foauth%2Fcallback');
  });

  it('starts Kimi OAuth through the generic CLIProxyAPI auth-url endpoint', async () => {
    const requests: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      requests.push(url);
      return jsonResponse({
        state: 'kimi-state',
        url: 'https://www.kimi.com/code/authorize_device?user_code=52ZR-Z2BO',
        user_code: '52ZR-Z2BO'
      });
    });
    const client = new CliProxyManagementClient({
      apiBase: 'https://cli-proxy.example.com/v0/management',
      managementKey: 'secret',
      fetcher
    });

    await expect(client.startProviderOAuth({ provider: 'kimi', isWebui: true })).resolves.toMatchObject({
      state: 'kimi-state',
      verificationUri: 'https://www.kimi.com/code/authorize_device?user_code=52ZR-Z2BO',
      userCode: '52ZR-Z2BO'
    });
    expect(requests[0]).toBe('https://cli-proxy.example.com/v0/management/kimi-auth-url?is_webui=true');
  });

  it('checks CLIProxyAPI connectivity through the real management config endpoint and CPA headers', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ debug: false }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-cpa-version': 'v7.1.0',
          'x-cpa-build-date': '2026-05-10'
        }
      });
    });
    const client = new CliProxyManagementClient({
      apiBase: 'https://cli-proxy.example.com',
      managementKey: 'secret',
      fetcher
    });

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'connected',
      serverVersion: 'v7.1.0',
      serverBuildDate: '2026-05-10'
    });
    expect(requests[0]?.url).toBe('https://cli-proxy.example.com/v0/management/config');
  });

  it('uses CLIProxyAPI management headers and native api-key payloads', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith('/api-keys') && init?.method === 'GET') {
        return jsonResponse({ 'api-keys': ['sk-one', 'sk-two'] });
      }
      if (url.endsWith('/api-keys') && init?.method === 'PUT') {
        return jsonResponse({ status: 'ok' });
      }
      if (url.endsWith('/api-keys') && init?.method === 'PATCH') {
        return jsonResponse({ status: 'ok' });
      }
      if (url.endsWith('/api-keys?index=1') && init?.method === 'DELETE') {
        return jsonResponse({ status: 'ok' });
      }
      return jsonResponse({});
    });
    const client = new CliProxyManagementClient({
      apiBase: 'https://cli-proxy.example.com',
      managementKey: 'secret',
      fetcher
    });

    await expect(client.listApiKeys()).resolves.toMatchObject({
      items: [
        { id: 'proxy-key-0', prefix: 'sk-***one' },
        { id: 'proxy-key-1', prefix: 'sk-***two' }
      ]
    });
    await client.replaceApiKeys({ keys: ['sk-three'] });
    await client.updateApiKey({ keyId: '0', name: 'sk-four' });
    await client.deleteApiKey({ index: 1 });

    expect(requests[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer secret',
      'x-management-key': 'secret'
    });
    const putRequest = requests.find(request => request.init?.method === 'PUT');
    const patchRequest = requests.find(request => request.init?.method === 'PATCH');
    const deleteRequest = requests.find(request => request.init?.method === 'DELETE');

    expect(putRequest).toMatchObject({
      url: 'https://cli-proxy.example.com/v0/management/api-keys',
      init: { method: 'PUT', body: JSON.stringify(['sk-three']) }
    });
    expect(patchRequest).toMatchObject({
      url: 'https://cli-proxy.example.com/v0/management/api-keys',
      init: { method: 'PATCH', body: JSON.stringify({ index: 0, value: 'sk-four' }) }
    });
    expect(deleteRequest).toMatchObject({
      url: 'https://cli-proxy.example.com/v0/management/api-keys?index=1',
      init: { method: 'DELETE' }
    });
  });

  it('submits OAuth callbacks using CLIProxyAPI snake_case fields and normalizes status responses', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.includes('/get-auth-status')) {
        return jsonResponse({ status: 'ok' });
      }
      if (url.endsWith('/oauth-callback')) {
        return jsonResponse({ status: 'ok' });
      }
      return jsonResponse({});
    });
    const client = new CliProxyManagementClient({
      apiBase: 'https://cli-proxy.example.com/v0/management',
      managementKey: 'secret',
      fetcher
    });

    await expect(client.getOAuthStatus('codex-state')).resolves.toMatchObject({ status: 'completed' });
    await expect(
      client.submitOAuthCallback({
        provider: 'codex',
        redirectUrl: 'http://localhost:3000/api/agent-gateway/oauth/callback?provider=codex&code=abc&state=codex-state'
      })
    ).resolves.toMatchObject({ accepted: true, provider: 'codex' });

    expect(requests[1]).toMatchObject({
      url: 'https://cli-proxy.example.com/v0/management/oauth-callback',
      init: {
        method: 'POST',
        body: JSON.stringify({
          provider: 'codex',
          redirect_url:
            'http://localhost:3000/api/agent-gateway/oauth/callback?provider=codex&code=abc&state=codex-state'
        })
      }
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}
