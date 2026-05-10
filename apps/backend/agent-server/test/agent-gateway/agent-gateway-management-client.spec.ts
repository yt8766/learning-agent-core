import { describe, expect, it } from 'vitest';
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
});
