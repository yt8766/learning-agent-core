import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GatewayClient,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientUsageSummary
} from '@agent/core';
import type {
  AgentGatewayClientRepository,
  GatewayClientUsagePatch,
  StoredGatewayClientApiKey
} from './agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_CLOCK } from './agent-gateway-client.repository';

type DateFactory = () => Date;

@Injectable()
export class MemoryAgentGatewayClientRepository implements AgentGatewayClientRepository {
  private readonly clients = new Map<string, GatewayClient>();
  private readonly apiKeys = new Map<string, StoredGatewayClientApiKey>();
  private readonly quotas = new Map<string, GatewayClientQuota>();
  private readonly usage = new Map<string, GatewayClientUsageSummary>();
  private readonly requestLogs: GatewayClientRequestLog[] = [];

  constructor(
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_CLOCK)
    private readonly now: DateFactory = () => new Date()
  ) {}

  async listClients(): Promise<GatewayClient[]> {
    return [...this.clients.values()].map(client => ({ ...client, tags: [...client.tags] }));
  }

  async createClient(client: GatewayClient): Promise<GatewayClient> {
    if (this.clients.has(client.id)) throw new Error(`Gateway client already exists: ${client.id}`);
    this.clients.set(client.id, { ...client, tags: [...client.tags] });
    return { ...client, tags: [...client.tags] };
  }

  async findClient(clientId: string): Promise<GatewayClient | null> {
    return cloneClient(this.clients.get(clientId));
  }

  async updateClient(clientId: string, patch: Partial<GatewayClient>): Promise<GatewayClient | null> {
    const current = this.clients.get(clientId);
    if (!current) return null;
    const next = { ...current, ...patch, id: clientId, tags: patch.tags ? [...patch.tags] : [...current.tags] };
    this.clients.set(clientId, next);
    return cloneClient(next);
  }

  async listApiKeys(clientId: string): Promise<StoredGatewayClientApiKey[]> {
    return [...this.apiKeys.values()].filter(apiKey => apiKey.clientId === clientId).map(apiKey => cloneApiKey(apiKey));
  }

  async createApiKey(apiKey: StoredGatewayClientApiKey): Promise<StoredGatewayClientApiKey> {
    const storageKey = apiKeyStorageKey(apiKey.clientId, apiKey.id);
    if (this.apiKeys.has(storageKey)) throw new Error(`Gateway client API key already exists: ${apiKey.id}`);
    this.assertUniqueSecretHash(apiKey.secretHash);
    this.apiKeys.set(storageKey, cloneApiKey(apiKey));
    return cloneApiKey(apiKey);
  }

  async findApiKeyByHash(secretHash: string): Promise<StoredGatewayClientApiKey | null> {
    const apiKey = [...this.apiKeys.values()].find(candidate => candidate.secretHash === secretHash);
    return apiKey ? cloneApiKey(apiKey) : null;
  }

  async findApiKey(clientId: string, apiKeyId: string): Promise<StoredGatewayClientApiKey | null> {
    const apiKey = this.apiKeys.get(apiKeyStorageKey(clientId, apiKeyId));
    if (!apiKey || apiKey.clientId !== clientId) return null;
    return cloneApiKey(apiKey);
  }

  async updateApiKey(
    clientId: string,
    apiKeyId: string,
    patch: Partial<StoredGatewayClientApiKey>
  ): Promise<StoredGatewayClientApiKey | null> {
    const storageKey = apiKeyStorageKey(clientId, apiKeyId);
    const current = this.apiKeys.get(storageKey);
    if (!current || current.clientId !== clientId) return null;
    if (patch.secretHash && patch.secretHash !== current.secretHash) this.assertUniqueSecretHash(patch.secretHash);
    const next = {
      ...current,
      ...patch,
      id: apiKeyId,
      clientId,
      scopes: patch.scopes ? [...patch.scopes] : [...current.scopes]
    };
    this.apiKeys.set(storageKey, cloneApiKey(next));
    return cloneApiKey(next);
  }

  async touchApiKey(clientId: string, apiKeyId: string, lastUsedAt: string): Promise<StoredGatewayClientApiKey | null> {
    return this.updateApiKey(clientId, apiKeyId, { lastUsedAt });
  }

  private assertUniqueSecretHash(secretHash: string): void {
    if ([...this.apiKeys.values()].some(candidate => candidate.secretHash === secretHash)) {
      throw new Error('GATEWAY_CLIENT_API_KEY_SECRET_HASH_EXISTS');
    }
  }

  async getQuota(clientId: string): Promise<GatewayClientQuota | null> {
    const quota = this.quotas.get(clientId);
    return quota ? { ...quota } : null;
  }

  async upsertQuota(quota: GatewayClientQuota): Promise<GatewayClientQuota> {
    this.quotas.set(quota.clientId, { ...quota });
    return { ...quota };
  }

  async getUsage(clientId: string): Promise<GatewayClientUsageSummary | null> {
    const usage = this.usage.get(clientId);
    return usage ? { ...usage } : null;
  }

  async addUsage(clientId: string, patch: GatewayClientUsagePatch): Promise<GatewayClientUsageSummary> {
    const current = this.usage.get(clientId) ?? createEmptyUsage(clientId);
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
    this.usage.set(clientId, next);
    return { ...next };
  }

  async appendRequestLog(log: GatewayClientRequestLog): Promise<GatewayClientRequestLog> {
    this.requestLogs.unshift({ ...log });
    return { ...log };
  }

  async listRequestLogs(clientId: string, limit = 50): Promise<GatewayClientRequestLog[]> {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
    return this.requestLogs
      .filter(log => log.clientId === clientId)
      .slice(0, safeLimit)
      .map(log => ({ ...log }));
  }
}

function cloneClient(client: GatewayClient | undefined): GatewayClient | null {
  return client ? { ...client, tags: [...client.tags] } : null;
}

function cloneApiKey(apiKey: StoredGatewayClientApiKey): StoredGatewayClientApiKey {
  return { ...apiKey, scopes: [...apiKey.scopes] };
}

function apiKeyStorageKey(clientId: string, apiKeyId: string): string {
  return `${clientId}:${apiKeyId}`;
}

function createEmptyUsage(clientId: string): GatewayClientUsageSummary {
  return {
    clientId,
    window: 'current-period',
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    lastRequestAt: null
  };
}
