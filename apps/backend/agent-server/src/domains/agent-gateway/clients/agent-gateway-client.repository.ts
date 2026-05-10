import type {
  GatewayClient,
  GatewayClientApiKey,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientUsageSummary
} from '@agent/core';

export const AGENT_GATEWAY_CLIENT_REPOSITORY = Symbol('AGENT_GATEWAY_CLIENT_REPOSITORY');
export const AGENT_GATEWAY_CLIENT_CLOCK = Symbol('AGENT_GATEWAY_CLIENT_CLOCK');

export type StoredGatewayClientApiKey = GatewayClientApiKey & {
  secretHash: string;
};

export type GatewayClientUsagePatch = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  requestCount?: number;
  lastRequestAt?: string | null;
};

export interface AgentGatewayClientRepository {
  listClients(): Promise<GatewayClient[]>;
  createClient(client: GatewayClient): Promise<GatewayClient>;
  findClient(clientId: string): Promise<GatewayClient | null>;
  updateClient(clientId: string, patch: Partial<GatewayClient>): Promise<GatewayClient | null>;

  listApiKeys(clientId: string): Promise<StoredGatewayClientApiKey[]>;
  createApiKey(apiKey: StoredGatewayClientApiKey): Promise<StoredGatewayClientApiKey>;
  findApiKeyByHash(secretHash: string): Promise<StoredGatewayClientApiKey | null>;
  findApiKey(clientId: string, apiKeyId: string): Promise<StoredGatewayClientApiKey | null>;
  updateApiKey(
    clientId: string,
    apiKeyId: string,
    patch: Partial<StoredGatewayClientApiKey>
  ): Promise<StoredGatewayClientApiKey | null>;
  touchApiKey(clientId: string, apiKeyId: string, lastUsedAt: string): Promise<StoredGatewayClientApiKey | null>;

  getQuota(clientId: string): Promise<GatewayClientQuota | null>;
  upsertQuota(quota: GatewayClientQuota): Promise<GatewayClientQuota>;

  getUsage(clientId: string): Promise<GatewayClientUsageSummary | null>;
  addUsage(clientId: string, patch: GatewayClientUsagePatch): Promise<GatewayClientUsageSummary>;

  appendRequestLog(log: GatewayClientRequestLog): Promise<GatewayClientRequestLog>;
  listRequestLogs(clientId: string, limit?: number): Promise<GatewayClientRequestLog[]>;
}
