import { describe, expect, it } from 'vitest';
import type { GatewayClient, GatewayClientQuota, GatewayClientRequestLog } from '@agent/core';

import {
  PostgresAgentGatewayClientRepository,
  PostgresAgentGatewayRepository,
  PostgresAgentGatewaySecretVault,
  type PostgresAgentGatewayClient
} from '../../src/domains/agent-gateway/persistence/postgres-agent-gateway.repository';

class FakePostgresClient implements PostgresAgentGatewayClient {
  readonly records = new Map<string, Record<string, unknown>>();
  readonly clientRecords = new Map<string, Record<string, unknown>>();
  readonly secrets = new Map<string, string>();

  async query(sql: string, values: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.startsWith('insert into agent_gateway_records')) {
      this.records.set(recordKey(String(values[0]), String(values[1])), values[2] as Record<string, unknown>);
      return { rows: [] };
    }
    if (normalized.startsWith('select record from agent_gateway_records where domain = $1 and id = $2')) {
      const record = this.records.get(recordKey(String(values[0]), String(values[1])));
      return { rows: record ? [{ record }] : [] };
    }
    if (normalized.startsWith('select record from agent_gateway_records where domain = $1')) {
      const prefix = `${String(values[0])}:`;
      return {
        rows: [...this.records.entries()].filter(([key]) => key.startsWith(prefix)).map(([, record]) => ({ record }))
      };
    }
    if (normalized.startsWith('delete from agent_gateway_records')) {
      this.records.delete(recordKey(String(values[0]), String(values[1])));
      return { rows: [] };
    }
    if (normalized.startsWith('insert into agent_gateway_client_records')) {
      this.clientRecords.set(clientRecordKey(String(values[0]), String(values[1])), {
        kind: values[0],
        id: values[1],
        client_id: values[2],
        secret_hash: values[3],
        record: values[4]
      });
      return { rows: [] };
    }
    if (normalized.startsWith('select record from agent_gateway_client_records where kind = $1 and id = $2')) {
      const row = this.clientRecords.get(clientRecordKey(String(values[0]), String(values[1])));
      return { rows: row ? [{ record: row.record }] : [] };
    }
    if (normalized.startsWith('select record from agent_gateway_client_records where kind = $1 and client_id = $2')) {
      return {
        rows: [...this.clientRecords.values()]
          .filter(row => row.kind === values[0] && row.client_id === values[1])
          .map(row => ({ record: row.record }))
      };
    }
    if (normalized.startsWith('select record from agent_gateway_client_records where kind = $1 and secret_hash = $2')) {
      const row = [...this.clientRecords.values()].find(
        candidate => candidate.kind === values[0] && candidate.secret_hash === values[1]
      );
      return { rows: row ? [{ record: row.record }] : [] };
    }
    if (normalized.startsWith('select record from agent_gateway_client_records where kind = $1')) {
      return {
        rows: [...this.clientRecords.values()]
          .filter(row => row.kind === values[0])
          .map(row => ({ record: row.record }))
      };
    }
    if (normalized.startsWith('insert into agent_gateway_secrets')) {
      this.secrets.set(clientRecordKey(String(values[0]), String(values[1])), String(values[2]));
      return { rows: [] };
    }
    if (normalized.startsWith('select secret_value from agent_gateway_secrets')) {
      const secret = this.secrets.get(clientRecordKey(String(values[0]), String(values[1])));
      return { rows: secret ? [{ secret_value: secret }] : [] };
    }
    if (normalized.startsWith('delete from agent_gateway_secrets')) {
      this.secrets.delete(clientRecordKey(String(values[0]), String(values[1])));
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

function makeClient(overrides: Partial<GatewayClient> = {}): GatewayClient {
  return {
    id: 'client-1',
    name: 'Test Client',
    status: 'active',
    tags: ['prod'],
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...overrides
  };
}

function makeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    clientId: 'client-1',
    name: 'runtime',
    prefix: 'gw_live_abc',
    status: 'active',
    scopes: ['models.read', 'chat.completions'],
    createdAt: '2026-05-11T00:00:00.000Z',
    expiresAt: null,
    lastUsedAt: null,
    secretHash: 'hash-1',
    ...overrides
  };
}

describe('PostgresAgentGatewayRepository extended tests', () => {
  it('getConfig returns DEFAULT_CONFIG when no record exists', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const config = await repo.getConfig();

    expect(config).toEqual({
      inputTokenStrategy: 'preprocess',
      outputTokenStrategy: 'postprocess',
      retryLimit: 2,
      circuitBreakerEnabled: true,
      auditEnabled: true
    });
  });

  it('updateConfig merges with existing config', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const updated = await repo.updateConfig({ retryLimit: 5 });

    expect(updated.retryLimit).toBe(5);
    expect(updated.auditEnabled).toBe(true);
  });

  it('updateConfig merges with stored config', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayRepository(client);
    await repo.updateConfig({ retryLimit: 5 });
    const updated = await repo.updateConfig({ auditEnabled: false });

    expect(updated.retryLimit).toBe(5);
    expect(updated.auditEnabled).toBe(false);
  });

  it('upsertProvider clones modelFamilies array', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const families = ['gpt-5'];
    const provider = {
      id: 'p1',
      provider: 'OpenAI',
      modelFamilies: families,
      status: 'healthy' as const,
      priority: 1,
      baseUrl: 'https://api.openai.com',
      timeoutMs: 60000
    };

    const result = await repo.upsertProvider(provider);
    families.push('gpt-6');
    expect(result.modelFamilies).toEqual(['gpt-5']);
  });

  it('upsertCredentialFile returns a copy', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const file = { id: 'cf1', provider: 'codex', path: '/test', status: 'valid' as const, lastCheckedAt: null };
    const result = await repo.upsertCredentialFile(file);

    expect(result).toEqual(file);
    expect(result).not.toBe(file);
  });

  it('updateQuota returns a copy', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const quota = {
      id: 'q1',
      providerKind: 'codex' as const,
      window: 'daily' as const,
      limit: 100,
      used: 50,
      resetAt: '2026-05-12T00:00:00.000Z'
    };
    const result = await repo.updateQuota(quota);
    expect(result).toEqual(quota);
    expect(result).not.toBe(quota);
  });

  it('appendLog returns a copy', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const log = {
      id: 'log-1',
      timestamp: '2026-05-11T00:00:00.000Z',
      level: 'info' as const,
      message: 'test log',
      source: 'test'
    };
    const result = await repo.appendLog(log);
    expect(result).toEqual(log);
    expect(result).not.toBe(log);
  });

  it('listLogs applies safe limit cap', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayRepository(client);
    await repo.appendLog({ id: 'l1', timestamp: '', level: 'info', message: '', source: '' });
    await repo.appendLog({ id: 'l2', timestamp: '', level: 'info', message: '', source: '' });

    const logs = await repo.listLogs(1);
    expect(logs).toHaveLength(1);
  });

  it('listLogs uses default limit of 50 for invalid input', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayRepository(client);

    const logs = await repo.listLogs(-1);
    expect(logs).toHaveLength(0);
  });

  it('listLogs uses default limit of 50 for NaN input', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayRepository(client);

    const logs = await repo.listLogs(Number.NaN);
    expect(logs).toHaveLength(0);
  });

  it('appendUsage returns a copy', async () => {
    const repo = new PostgresAgentGatewayRepository(new FakePostgresClient());
    const record = {
      id: 'u1',
      timestamp: '2026-05-11T00:00:00.000Z',
      providerKind: 'codex' as const,
      model: 'gpt-5',
      inputTokens: 10,
      outputTokens: 20,
      clientId: 'c1'
    };
    const result = await repo.appendUsage(record);
    expect(result).toEqual(record);
    expect(result).not.toBe(record);
  });

  it('listUsage applies limit', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayRepository(client);
    await repo.appendUsage({
      id: 'u1',
      timestamp: '',
      providerKind: 'codex',
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      clientId: ''
    });
    await repo.appendUsage({
      id: 'u2',
      timestamp: '',
      providerKind: 'codex',
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      clientId: ''
    });

    const usage = await repo.listUsage(1);
    expect(usage).toHaveLength(1);
  });
});

describe('PostgresAgentGatewayClientRepository extended tests', () => {
  it('findClient returns null when client does not exist', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.findClient('nonexistent')).toBeNull();
  });

  it('updateClient returns null when client does not exist', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.updateClient('nonexistent', { name: 'New' })).toBeNull();
  });

  it('updateClient merges patch with existing client', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient());

    const updated = await repo.updateClient('client-1', { name: 'Updated', tags: ['new-tag'] });
    expect(updated?.name).toBe('Updated');
    expect(updated?.tags).toEqual(['new-tag']);
    expect(updated?.id).toBe('client-1');
  });

  it('updateClient preserves existing tags when patch has no tags', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient({ tags: ['original'] }));

    const updated = await repo.updateClient('client-1', { name: 'Updated' });
    expect(updated?.tags).toEqual(['original']);
  });

  it('findApiKey returns null when apiKey does not exist', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.findApiKey('c1', 'nonexistent')).toBeNull();
  });

  it('findApiKey returns null when clientId does not match', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient({ id: 'c1' }));
    await repo.createApiKey(makeApiKey({ clientId: 'c1', id: 'k1' }));

    expect(await repo.findApiKey('c2', 'k1')).toBeNull();
  });

  it('findApiKey returns key when clientId matches', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient({ id: 'c1' }));
    await repo.createApiKey(makeApiKey({ clientId: 'c1', id: 'k1' }));

    const key = await repo.findApiKey('c1', 'k1');
    expect(key?.id).toBe('k1');
  });

  it('updateApiKey returns null when key does not exist', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.updateApiKey('c1', 'nonexistent', { name: 'new' })).toBeNull();
  });

  it('updateApiKey merges patch with existing key', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient({ id: 'c1' }));
    await repo.createApiKey(makeApiKey({ clientId: 'c1', id: 'k1', scopes: ['a'] }));

    const updated = await repo.updateApiKey('c1', 'k1', { name: 'renamed', scopes: ['b'] });
    expect(updated?.name).toBe('renamed');
    expect(updated?.scopes).toEqual(['b']);
    expect(updated?.id).toBe('k1');
    expect(updated?.clientId).toBe('c1');
  });

  it('updateApiKey preserves scopes when patch has no scopes', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient({ id: 'c1' }));
    await repo.createApiKey(makeApiKey({ clientId: 'c1', id: 'k1', scopes: ['original'] }));

    const updated = await repo.updateApiKey('c1', 'k1', { name: 'renamed' });
    expect(updated?.scopes).toEqual(['original']);
  });

  it('touchApiKey updates lastUsedAt', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    await repo.createClient(makeClient({ id: 'c1' }));
    await repo.createApiKey(makeApiKey({ clientId: 'c1', id: 'k1' }));

    const touched = await repo.touchApiKey('c1', 'k1', '2026-05-12T00:00:00.000Z');
    expect(touched?.lastUsedAt).toBe('2026-05-12T00:00:00.000Z');
  });

  it('touchApiKey returns null when key not found', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.touchApiKey('c1', 'nonexistent', '2026-05-12T00:00:00.000Z')).toBeNull();
  });

  it('getQuota returns null when not found', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.getQuota('nonexistent')).toBeNull();
  });

  it('upsertQuota returns a copy', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    const quota: GatewayClientQuota = {
      clientId: 'c1',
      period: 'monthly',
      tokenLimit: 1000,
      requestLimit: 100,
      usedTokens: 0,
      usedRequests: 0,
      resetAt: '2026-06-01T00:00:00.000Z',
      status: 'normal'
    };
    const result = await repo.upsertQuota(quota);
    expect(result).toEqual(quota);
    expect(result).not.toBe(quota);
  });

  it('addUsage creates empty usage summary when no existing usage', async () => {
    const now = new Date('2026-05-11T00:00:00.000Z');
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient(), () => now);

    const usage = await repo.addUsage('c1', { inputTokens: 10, outputTokens: 20, requestCount: 1 });
    expect(usage.clientId).toBe('c1');
    expect(usage.requestCount).toBe(1);
    expect(usage.inputTokens).toBe(10);
    expect(usage.outputTokens).toBe(20);
    expect(usage.totalTokens).toBe(30);
    expect(usage.window).toBe('current-period');
    expect(usage.lastRequestAt).toBe(now.toISOString());
  });

  it('addUsage accumulates with existing usage', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    await repo.addUsage('c1', { inputTokens: 10, outputTokens: 20, requestCount: 1, estimatedCostUsd: 0.5 });
    const usage = await repo.addUsage('c1', {
      inputTokens: 5,
      outputTokens: 10,
      requestCount: 2,
      estimatedCostUsd: 0.2
    });

    expect(usage.requestCount).toBe(3);
    expect(usage.inputTokens).toBe(15);
    expect(usage.outputTokens).toBe(30);
    expect(usage.totalTokens).toBe(45);
    expect(usage.estimatedCostUsd).toBeCloseTo(0.7);
  });

  it('addUsage uses defaults when patch values are undefined', async () => {
    const now = new Date('2026-05-11T00:00:00.000Z');
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient(), () => now);

    const usage = await repo.addUsage('c1', {});
    expect(usage.requestCount).toBe(1);
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.estimatedCostUsd).toBe(0);
    expect(usage.lastRequestAt).toBe(now.toISOString());
  });

  it('addUsage uses patch.lastRequestAt when provided', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    const usage = await repo.addUsage('c1', { lastRequestAt: '2026-05-12T00:00:00.000Z' });
    expect(usage.lastRequestAt).toBe('2026-05-12T00:00:00.000Z');
  });

  it('appendRequestLog returns a copy', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    const log: GatewayClientRequestLog = {
      id: 'req-1',
      clientId: 'c1',
      apiKeyId: 'k1',
      occurredAt: '2026-05-11T00:00:00.000Z',
      endpoint: '/v1/chat/completions',
      model: 'gpt-5',
      providerId: 'openai',
      statusCode: 200,
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 50
    };
    const result = await repo.appendRequestLog(log);
    expect(result).toEqual(log);
    expect(result).not.toBe(log);
  });

  it('listRequestLogs applies limit', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    const base = {
      clientId: 'c1',
      apiKeyId: 'k1',
      occurredAt: '',
      endpoint: '',
      model: '',
      providerId: '',
      statusCode: 200,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0
    };
    await repo.appendRequestLog({ id: 'r1', ...base });
    await repo.appendRequestLog({ id: 'r2', ...base });

    const logs = await repo.listRequestLogs('c1', 1);
    expect(logs).toHaveLength(1);
  });

  it('listRequestLogs uses default limit of 50', async () => {
    const client = new FakePostgresClient();
    const repo = new PostgresAgentGatewayClientRepository(client);
    const logs = await repo.listRequestLogs('c1');
    expect(logs).toHaveLength(0);
  });

  it('getUsage returns null when not found', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.getUsage('nonexistent')).toBeNull();
  });

  it('listClients returns empty array when no clients', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.listClients()).toEqual([]);
  });

  it('listApiKeys returns empty array when no keys', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    expect(await repo.listApiKeys('c1')).toEqual([]);
  });

  it('createClient returns a cloned client', async () => {
    const repo = new PostgresAgentGatewayClientRepository(new FakePostgresClient());
    const original = makeClient({ tags: ['test'] });
    const result = await repo.createClient(original);

    expect(result).toEqual(original);
    expect(result).not.toBe(original);
    expect(result.tags).not.toBe(original.tags);
  });
});

describe('PostgresAgentGatewaySecretVault extended tests', () => {
  it('readProviderSecretRef returns undefined when not found', async () => {
    const vault = new PostgresAgentGatewaySecretVault(new FakePostgresClient());
    expect(await vault.readProviderSecretRef('nonexistent')).toBeUndefined();
  });

  it('readCredentialFileContent returns undefined when not found', async () => {
    const vault = new PostgresAgentGatewaySecretVault(new FakePostgresClient());
    expect(await vault.readCredentialFileContent('nonexistent')).toBeUndefined();
  });

  it('deleteProviderSecretRef removes the secret', async () => {
    const client = new FakePostgresClient();
    const vault = new PostgresAgentGatewaySecretVault(client);
    await vault.writeProviderSecretRef('p1', 'secret');
    await vault.deleteProviderSecretRef('p1');

    expect(await vault.readProviderSecretRef('p1')).toBeUndefined();
  });

  it('deleteCredentialFileContent removes the secret', async () => {
    const client = new FakePostgresClient();
    const vault = new PostgresAgentGatewaySecretVault(client);
    await vault.writeCredentialFileContent('cf1', 'content');
    await vault.deleteCredentialFileContent('cf1');

    expect(await vault.readCredentialFileContent('cf1')).toBeUndefined();
  });

  it('write and read provider secret ref roundtrip', async () => {
    const vault = new PostgresAgentGatewaySecretVault(new FakePostgresClient());
    await vault.writeProviderSecretRef('p1', 'my-secret');
    expect(await vault.readProviderSecretRef('p1')).toBe('my-secret');
  });

  it('write and read credential file content roundtrip', async () => {
    const vault = new PostgresAgentGatewaySecretVault(new FakePostgresClient());
    await vault.writeCredentialFileContent('cf1', '{"token":"abc"}');
    expect(await vault.readCredentialFileContent('cf1')).toBe('{"token":"abc"}');
  });
});

function recordKey(domain: string, id: string): string {
  return `${domain}:${id}`;
}

function clientRecordKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}
