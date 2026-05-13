import { describe, expect, it } from 'vitest';
import type {
  GatewayClient,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayProviderCredentialSet
} from '@agent/core';
import {
  createAgentGatewayPersistenceProviders,
  resolveAgentGatewayPersistenceConfig,
  PostgresAgentGatewayClientRepository,
  PostgresAgentGatewayRepository,
  PostgresAgentGatewaySecretVault,
  type PostgresAgentGatewayClient
} from '../../src/domains/agent-gateway/persistence/postgres-agent-gateway.repository';
import { AGENT_GATEWAY_CLIENT_REPOSITORY } from '../../src/domains/agent-gateway/clients/agent-gateway-client.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../../src/domains/agent-gateway/repositories/agent-gateway.repository';
import { AGENT_GATEWAY_SECRET_VAULT } from '../../src/domains/agent-gateway/secrets/agent-gateway-secret-vault';

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

describe('Agent Gateway postgres persistence', () => {
  it('selects postgres repository and secret vault when production persistence env is enabled', () => {
    const config = resolveAgentGatewayPersistenceConfig({
      AGENT_GATEWAY_PERSISTENCE: 'postgres',
      AGENT_GATEWAY_DATABASE_URL: 'postgres://gateway'
    });
    const fakeClient = new FakePostgresClient();
    const providers = createAgentGatewayPersistenceProviders(config, () => fakeClient);

    expect(providers.find(provider => provider.provide === AGENT_GATEWAY_REPOSITORY)?.useFactory()).toBeInstanceOf(
      PostgresAgentGatewayRepository
    );
    expect(
      providers.find(provider => provider.provide === AGENT_GATEWAY_CLIENT_REPOSITORY)?.useFactory()
    ).toBeInstanceOf(PostgresAgentGatewayClientRepository);
    expect(providers.find(provider => provider.provide === AGENT_GATEWAY_SECRET_VAULT)?.useFactory()).toBeInstanceOf(
      PostgresAgentGatewaySecretVault
    );
  });

  it('fails fast when postgres persistence is selected without a database URL', () => {
    expect(() => resolveAgentGatewayPersistenceConfig({ AGENT_GATEWAY_PERSISTENCE: 'postgres' })).toThrow(
      /AGENT_GATEWAY_DATABASE_URL or DATABASE_URL is required/
    );
  });

  it('persists provider configuration across repository instances', async () => {
    const client = new FakePostgresClient();
    const first = new PostgresAgentGatewayRepository(client);
    const provider: GatewayProviderCredentialSet = {
      id: 'openai-primary',
      provider: 'OpenAI',
      modelFamilies: ['gpt-5.4'],
      status: 'healthy',
      priority: 1,
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 60000
    };

    await first.upsertProvider(provider);
    const second = new PostgresAgentGatewayRepository(client);

    await expect(second.listProviders()).resolves.toEqual([provider]);
  });

  it('persists gateway clients, keys, quota, usage, and logs', async () => {
    const client = new FakePostgresClient();
    const first = new PostgresAgentGatewayClientRepository(client, () => new Date('2026-05-11T00:00:00.000Z'));
    const gatewayClient: GatewayClient = {
      id: 'client-1',
      name: 'Client One',
      status: 'active',
      tags: ['prod'],
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z'
    };
    const quota: GatewayClientQuota = {
      clientId: 'client-1',
      period: 'monthly',
      tokenLimit: 1000,
      requestLimit: 100,
      usedTokens: 0,
      usedRequests: 0,
      resetAt: '2026-06-01T00:00:00.000Z',
      status: 'normal'
    };
    const log: GatewayClientRequestLog = {
      id: 'req-1',
      clientId: 'client-1',
      apiKeyId: 'key-1',
      occurredAt: '2026-05-11T00:00:00.000Z',
      endpoint: '/v1/chat/completions',
      model: 'gpt-5.4',
      providerId: 'openai-primary',
      statusCode: 200,
      inputTokens: 2,
      outputTokens: 3,
      latencyMs: 50
    };

    await first.createClient(gatewayClient);
    await first.createApiKey({
      id: 'key-1',
      clientId: 'client-1',
      name: 'runtime',
      prefix: 'gw_live_abc',
      status: 'active',
      scopes: ['models.read', 'chat.completions'],
      createdAt: '2026-05-11T00:00:00.000Z',
      expiresAt: null,
      lastUsedAt: null,
      secretHash: 'hash-1'
    });
    await first.upsertQuota(quota);
    await first.addUsage('client-1', { inputTokens: 2, outputTokens: 3, requestCount: 1 });
    await first.appendRequestLog(log);

    const second = new PostgresAgentGatewayClientRepository(client);

    await expect(second.listClients()).resolves.toEqual([gatewayClient]);
    await expect(second.findApiKeyByHash('hash-1')).resolves.toMatchObject({ id: 'key-1', secretHash: 'hash-1' });
    await expect(second.getQuota('client-1')).resolves.toEqual(quota);
    await expect(second.getUsage('client-1')).resolves.toMatchObject({ totalTokens: 5, requestCount: 1 });
    await expect(second.listRequestLogs('client-1')).resolves.toEqual([log]);
  });

  it('stores secrets in the vault without exposing them through projections', async () => {
    const client = new FakePostgresClient();
    const vault = new PostgresAgentGatewaySecretVault(client);

    await vault.writeProviderSecretRef('openai-primary', 'sk-secret');
    await vault.writeCredentialFileContent('codex.json', '{"refresh_token":"secret"}');

    await expect(vault.readProviderSecretRef('openai-primary')).resolves.toBe('sk-secret');
    await expect(vault.readCredentialFileContent('codex.json')).resolves.toBe('{"refresh_token":"secret"}');
    expect([...client.records.values(), ...client.clientRecords.values()]).not.toContain('sk-secret');
  });
});

function recordKey(domain: string, id: string): string {
  return `${domain}:${id}`;
}

function clientRecordKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}
