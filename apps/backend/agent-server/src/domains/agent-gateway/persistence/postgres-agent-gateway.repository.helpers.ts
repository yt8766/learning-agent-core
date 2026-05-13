import type { GatewayClient, GatewayClientUsageSummary } from '@agent/core';
import type { StoredGatewayClientApiKey } from '../clients/agent-gateway-client.repository';

export function cloneClient(client: GatewayClient): GatewayClient {
  return { ...client, tags: [...client.tags] };
}

export function cloneApiKey(apiKey: StoredGatewayClientApiKey): StoredGatewayClientApiKey {
  return { ...apiKey, scopes: [...apiKey.scopes] };
}

export function createEmptyUsage(clientId: string): GatewayClientUsageSummary {
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

export function takeLimit<T>(records: T[], limit: number): T[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
  return records.slice(0, safeLimit);
}
