import type { FactoryProvider } from '@nestjs/common';
import { Pool } from 'pg';
import type {
  GatewayClient,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientUsageSummary,
  GatewayConfig,
  GatewayCredentialFile,
  GatewayLogEntry,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewayUpdateConfigRequest,
  GatewayUsageRecord
} from '@agent/core';
import type {
  AgentGatewayClientRepository,
  GatewayClientUsagePatch,
  StoredGatewayClientApiKey
} from '../clients/agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_REPOSITORY } from '../clients/agent-gateway-client.repository';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';
import { MemoryAgentGatewayClientRepository } from '../clients/memory-agent-gateway-client.repository';
import { MemoryAgentGatewayRepository } from '../repositories/memory-agent-gateway.repository';
import type { AgentGatewaySecretVault } from '../secrets/agent-gateway-secret-vault';
import { AGENT_GATEWAY_SECRET_VAULT, MemoryAgentGatewaySecretVault } from '../secrets/agent-gateway-secret-vault';
import {
  resolveAgentGatewayPersistenceConfig,
  type AgentGatewayPersistenceConfig
} from './postgres-agent-gateway.persistence-config';
import { cloneApiKey, cloneClient, createEmptyUsage, takeLimit } from './postgres-agent-gateway.repository.helpers';
export { resolveAgentGatewayPersistenceConfig } from './postgres-agent-gateway.persistence-config';
export type {
  AgentGatewayPersistenceBackend,
  AgentGatewayPersistenceConfig
} from './postgres-agent-gateway.persistence-config';

export interface PostgresAgentGatewayClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export type AgentGatewayPersistenceProvider =
  | FactoryProvider<AgentGatewayRepository>
  | FactoryProvider<AgentGatewayClientRepository>
  | FactoryProvider<AgentGatewaySecretVault>;

export function createAgentGatewayPersistenceProviders(
  config?: AgentGatewayPersistenceConfig,
  createClient?: (databaseUrl: string) => PostgresAgentGatewayClient
): AgentGatewayPersistenceProvider[] {
  const currentConfig = (): AgentGatewayPersistenceConfig =>
    config ?? resolveAgentGatewayPersistenceConfig(process.env);
  let client: PostgresAgentGatewayClient | undefined;
  const getClient = (): PostgresAgentGatewayClient => {
    const databaseUrl = currentConfig().databaseUrl;
    if (!databaseUrl) {
      throw new Error('AGENT_GATEWAY_DATABASE_URL or DATABASE_URL is required when AGENT_GATEWAY_PERSISTENCE=postgres');
    }
    client ??= createClient?.(databaseUrl) ?? new Pool({ connectionString: databaseUrl });
    return client;
  };

  return [
    {
      provide: AGENT_GATEWAY_REPOSITORY,
      useFactory: () =>
        currentConfig().backend === 'postgres'
          ? new PostgresAgentGatewayRepository(getClient())
          : new MemoryAgentGatewayRepository()
    },
    {
      provide: AGENT_GATEWAY_CLIENT_REPOSITORY,
      useFactory: () =>
        currentConfig().backend === 'postgres'
          ? new PostgresAgentGatewayClientRepository(getClient())
          : new MemoryAgentGatewayClientRepository()
    },
    {
      provide: AGENT_GATEWAY_SECRET_VAULT,
      useFactory: () =>
        currentConfig().backend === 'postgres'
          ? new PostgresAgentGatewaySecretVault(getClient())
          : new MemoryAgentGatewaySecretVault()
    }
  ];
}

const DEFAULT_CONFIG: GatewayConfig = {
  inputTokenStrategy: 'preprocess',
  outputTokenStrategy: 'postprocess',
  retryLimit: 2,
  circuitBreakerEnabled: true,
  auditEnabled: true
};

export class PostgresAgentGatewayRepository implements AgentGatewayRepository {
  constructor(private readonly client: PostgresAgentGatewayClient) {}

  async getConfig(): Promise<GatewayConfig> {
    return (await this.readRecord<GatewayConfig>('config', 'default')) ?? { ...DEFAULT_CONFIG };
  }

  async updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig> {
    const next = { ...(await this.getConfig()), ...request };
    await this.writeRecord('config', 'default', next);
    return next;
  }

  async listProviders(): Promise<GatewayProviderCredentialSet[]> {
    return this.listRecords<GatewayProviderCredentialSet>('provider');
  }

  async upsertProvider(provider: GatewayProviderCredentialSet): Promise<GatewayProviderCredentialSet> {
    const next = { ...provider, modelFamilies: [...provider.modelFamilies] };
    await this.writeRecord('provider', next.id, next);
    return next;
  }

  async deleteProvider(providerId: string): Promise<void> {
    await this.deleteRecord('provider', providerId);
  }

  async listCredentialFiles(): Promise<GatewayCredentialFile[]> {
    return this.listRecords<GatewayCredentialFile>('credentialFile');
  }

  async upsertCredentialFile(file: GatewayCredentialFile): Promise<GatewayCredentialFile> {
    await this.writeRecord('credentialFile', file.id, file);
    return { ...file };
  }

  async deleteCredentialFile(fileId: string): Promise<void> {
    await this.deleteRecord('credentialFile', fileId);
  }

  async listQuotas(): Promise<GatewayQuota[]> {
    return this.listRecords<GatewayQuota>('quota');
  }

  async updateQuota(quota: GatewayQuota): Promise<GatewayQuota> {
    await this.writeRecord('quota', quota.id, quota);
    return { ...quota };
  }

  async appendLog(entry: GatewayLogEntry): Promise<GatewayLogEntry> {
    await this.writeRecord('log', entry.id, entry);
    return { ...entry };
  }

  async listLogs(limit: number): Promise<GatewayLogEntry[]> {
    return takeLimit(await this.listRecords<GatewayLogEntry>('log'), limit);
  }

  async appendUsage(record: GatewayUsageRecord): Promise<GatewayUsageRecord> {
    await this.writeRecord('usage', record.id, record);
    return { ...record };
  }

  async listUsage(limit: number): Promise<GatewayUsageRecord[]> {
    return takeLimit(await this.listRecords<GatewayUsageRecord>('usage'), limit);
  }

  private async writeRecord(domain: string, id: string, record: unknown): Promise<void> {
    await this.client.query(
      `insert into agent_gateway_records (domain, id, record, updated_at)
       values ($1, $2, $3, now())
       on conflict (domain, id)
       do update set record = excluded.record, updated_at = now()`,
      [domain, id, record]
    );
  }

  private async readRecord<T>(domain: string, id: string): Promise<T | null> {
    const result = await this.client.query(
      `select record from agent_gateway_records where domain = $1 and id = $2 limit 1`,
      [domain, id]
    );
    return result.rows[0]?.record ? (result.rows[0].record as T) : null;
  }

  private async listRecords<T>(domain: string): Promise<T[]> {
    const result = await this.client.query(
      `select record from agent_gateway_records where domain = $1 order by updated_at desc, id`,
      [domain]
    );
    return result.rows.map(row => row.record as T);
  }

  private async deleteRecord(domain: string, id: string): Promise<void> {
    await this.client.query(`delete from agent_gateway_records where domain = $1 and id = $2`, [domain, id]);
  }
}

export class PostgresAgentGatewayClientRepository implements AgentGatewayClientRepository {
  constructor(
    private readonly client: PostgresAgentGatewayClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async listClients(): Promise<GatewayClient[]> {
    return this.listClientRecords<GatewayClient>('client');
  }

  async createClient(client: GatewayClient): Promise<GatewayClient> {
    await this.writeClientRecord('client', client.id, client.id, null, client);
    return cloneClient(client);
  }

  async findClient(clientId: string): Promise<GatewayClient | null> {
    return this.readClientRecord<GatewayClient>('client', clientId);
  }

  async updateClient(clientId: string, patch: Partial<GatewayClient>): Promise<GatewayClient | null> {
    const current = await this.findClient(clientId);
    if (!current) return null;
    const next = { ...current, ...patch, id: clientId, tags: patch.tags ? [...patch.tags] : [...current.tags] };
    await this.writeClientRecord('client', clientId, clientId, null, next);
    return cloneClient(next);
  }

  async listApiKeys(clientId: string): Promise<StoredGatewayClientApiKey[]> {
    return this.listClientRecords<StoredGatewayClientApiKey>('apiKey', clientId);
  }

  async createApiKey(apiKey: StoredGatewayClientApiKey): Promise<StoredGatewayClientApiKey> {
    await this.writeClientRecord('apiKey', apiKey.id, apiKey.clientId, apiKey.secretHash, apiKey);
    return cloneApiKey(apiKey);
  }

  async findApiKeyByHash(secretHash: string): Promise<StoredGatewayClientApiKey | null> {
    const result = await this.client.query(
      `select record from agent_gateway_client_records where kind = $1 and secret_hash = $2 limit 1`,
      ['apiKey', secretHash]
    );
    return result.rows[0]?.record ? cloneApiKey(result.rows[0].record as StoredGatewayClientApiKey) : null;
  }

  async findApiKey(clientId: string, apiKeyId: string): Promise<StoredGatewayClientApiKey | null> {
    const apiKey = await this.readClientRecord<StoredGatewayClientApiKey>('apiKey', apiKeyId);
    return apiKey?.clientId === clientId ? cloneApiKey(apiKey) : null;
  }

  async updateApiKey(
    clientId: string,
    apiKeyId: string,
    patch: Partial<StoredGatewayClientApiKey>
  ): Promise<StoredGatewayClientApiKey | null> {
    const current = await this.findApiKey(clientId, apiKeyId);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      id: apiKeyId,
      clientId,
      scopes: patch.scopes ? [...patch.scopes] : [...current.scopes]
    };
    await this.writeClientRecord('apiKey', apiKeyId, clientId, next.secretHash, next);
    return cloneApiKey(next);
  }

  async touchApiKey(clientId: string, apiKeyId: string, lastUsedAt: string): Promise<StoredGatewayClientApiKey | null> {
    return this.updateApiKey(clientId, apiKeyId, { lastUsedAt });
  }

  async getQuota(clientId: string): Promise<GatewayClientQuota | null> {
    return this.readClientRecord<GatewayClientQuota>('quota', clientId);
  }

  async upsertQuota(quota: GatewayClientQuota): Promise<GatewayClientQuota> {
    await this.writeClientRecord('quota', quota.clientId, quota.clientId, null, quota);
    return { ...quota };
  }

  async getUsage(clientId: string): Promise<GatewayClientUsageSummary | null> {
    return this.readClientRecord<GatewayClientUsageSummary>('usage', clientId);
  }

  async addUsage(clientId: string, patch: GatewayClientUsagePatch): Promise<GatewayClientUsageSummary> {
    const current = (await this.getUsage(clientId)) ?? createEmptyUsage(clientId);
    const inputTokens = current.inputTokens + (patch.inputTokens ?? 0);
    const outputTokens = current.outputTokens + (patch.outputTokens ?? 0);
    const next: GatewayClientUsageSummary = {
      ...current,
      requestCount: current.requestCount + (patch.requestCount ?? 1),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: current.estimatedCostUsd + (patch.estimatedCostUsd ?? 0),
      lastRequestAt: patch.lastRequestAt === undefined ? this.now().toISOString() : patch.lastRequestAt
    };
    await this.writeClientRecord('usage', clientId, clientId, null, next);
    return { ...next };
  }

  async appendRequestLog(log: GatewayClientRequestLog): Promise<GatewayClientRequestLog> {
    await this.writeClientRecord('requestLog', log.id, log.clientId, null, log);
    return { ...log };
  }

  async listRequestLogs(clientId: string, limit = 50): Promise<GatewayClientRequestLog[]> {
    return takeLimit(await this.listClientRecords<GatewayClientRequestLog>('requestLog', clientId), limit);
  }

  private async writeClientRecord(
    kind: string,
    id: string,
    clientId: string,
    secretHash: string | null,
    record: unknown
  ): Promise<void> {
    await this.client.query(
      `insert into agent_gateway_client_records (kind, id, client_id, secret_hash, record, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (kind, id)
       do update set client_id = excluded.client_id,
         secret_hash = excluded.secret_hash,
         record = excluded.record,
         updated_at = now()`,
      [kind, id, clientId, secretHash, record]
    );
  }

  private async readClientRecord<T>(kind: string, id: string): Promise<T | null> {
    const result = await this.client.query(
      `select record from agent_gateway_client_records where kind = $1 and id = $2 limit 1`,
      [kind, id]
    );
    return result.rows[0]?.record ? (result.rows[0].record as T) : null;
  }

  private async listClientRecords<T>(kind: string, clientId?: string): Promise<T[]> {
    const result = clientId
      ? await this.client.query(
          `select record from agent_gateway_client_records where kind = $1 and client_id = $2 order by updated_at desc, id`,
          [kind, clientId]
        )
      : await this.client.query(
          `select record from agent_gateway_client_records where kind = $1 order by updated_at desc, id`,
          [kind]
        );
    return result.rows.map(row => row.record as T);
  }
}

export class PostgresAgentGatewaySecretVault implements AgentGatewaySecretVault {
  constructor(private readonly client: PostgresAgentGatewayClient) {}

  writeProviderSecretRef(providerId: string, secretRef: string): Promise<void> {
    return this.writeSecret('provider', providerId, secretRef);
  }

  deleteProviderSecretRef(providerId: string): Promise<void> {
    return this.deleteSecret('provider', providerId);
  }

  readProviderSecretRef(providerId: string): Promise<string | undefined> {
    return this.readSecret('provider', providerId);
  }

  writeCredentialFileContent(credentialFileId: string, content: string): Promise<void> {
    return this.writeSecret('credentialFile', credentialFileId, content);
  }

  deleteCredentialFileContent(credentialFileId: string): Promise<void> {
    return this.deleteSecret('credentialFile', credentialFileId);
  }

  readCredentialFileContent(credentialFileId: string): Promise<string | undefined> {
    return this.readSecret('credentialFile', credentialFileId);
  }

  private async writeSecret(namespace: string, id: string, secret: string): Promise<void> {
    await this.client.query(
      `insert into agent_gateway_secrets (namespace, id, secret_value, updated_at)
       values ($1, $2, $3, now())
       on conflict (namespace, id)
       do update set secret_value = excluded.secret_value, updated_at = now()`,
      [namespace, id, secret]
    );
  }

  private async readSecret(namespace: string, id: string): Promise<string | undefined> {
    const result = await this.client.query(
      `select secret_value from agent_gateway_secrets where namespace = $1 and id = $2 limit 1`,
      [namespace, id]
    );
    return result.rows[0]?.secret_value ? String(result.rows[0].secret_value) : undefined;
  }

  private async deleteSecret(namespace: string, id: string): Promise<void> {
    await this.client.query(`delete from agent_gateway_secrets where namespace = $1 and id = $2`, [namespace, id]);
  }
}
