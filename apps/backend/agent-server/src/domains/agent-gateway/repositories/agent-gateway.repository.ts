import type {
  GatewayConfig,
  GatewayCredentialFile,
  GatewayLogEntry,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewayUpdateConfigRequest,
  GatewayUsageRecord
} from '@agent/core';

export const AGENT_GATEWAY_REPOSITORY = Symbol('AGENT_GATEWAY_REPOSITORY');

export interface AgentGatewayRepository {
  getConfig(): Promise<GatewayConfig>;
  updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig>;
  listProviders(): Promise<GatewayProviderCredentialSet[]>;
  upsertProvider(provider: GatewayProviderCredentialSet): Promise<GatewayProviderCredentialSet>;
  deleteProvider(providerId: string): Promise<void>;
  listCredentialFiles(): Promise<GatewayCredentialFile[]>;
  upsertCredentialFile(file: GatewayCredentialFile): Promise<GatewayCredentialFile>;
  deleteCredentialFile(fileId: string): Promise<void>;
  listQuotas(): Promise<GatewayQuota[]>;
  updateQuota(quota: GatewayQuota): Promise<GatewayQuota>;
  appendLog(entry: GatewayLogEntry): Promise<GatewayLogEntry>;
  listLogs(limit: number): Promise<GatewayLogEntry[]>;
  appendUsage(record: GatewayUsageRecord): Promise<GatewayUsageRecord>;
  listUsage(limit: number): Promise<GatewayUsageRecord[]>;
}
