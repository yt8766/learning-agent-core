import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayProbeResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewaySystemModelsResponse
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

interface ProviderConfigManagementClient {
  listProviderConfigs?(): Promise<GatewayProviderSpecificConfigListResponse>;
  saveProviderConfig?(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord>;
  discoverProviderModels?(providerId: string): Promise<GatewaySystemModelsResponse>;
  testProviderModel?(providerId: string, model: string): Promise<GatewayProbeResponse>;
}

@Injectable()
export class AgentGatewayProviderConfigService {
  private readonly providerConfigs = new Map<string, GatewayProviderSpecificConfigRecord>();

  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async list(): Promise<GatewayProviderSpecificConfigListResponse> {
    const delegate = this.delegate();
    if (delegate.listProviderConfigs) return delegate.listProviderConfigs();
    return { items: [...this.providerConfigs.values()].map(cloneProviderConfig) };
  }

  async save(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    const delegate = this.delegate();
    if (delegate.saveProviderConfig) return delegate.saveProviderConfig(request);
    this.providerConfigs.set(request.id, cloneProviderConfig(request));
    return cloneProviderConfig(request);
  }

  discoverModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    const delegate = this.delegate();
    if (delegate.discoverProviderModels) return delegate.discoverProviderModels(providerId);
    return this.managementClient.discoverModels();
  }

  async testModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    const delegate = this.delegate();
    if (delegate.testProviderModel) return delegate.testProviderModel(providerId, model);
    return {
      ok: true,
      latencyMs: 0,
      providerId,
      inputTokens: 0,
      outputTokens: 0,
      message: 'Provider model probe is pending management client wiring'
    };
  }

  private delegate(): ProviderConfigManagementClient {
    return this.managementClient as ProviderConfigManagementClient;
  }
}

function cloneProviderConfig(record: GatewayProviderSpecificConfigRecord): GatewayProviderSpecificConfigRecord {
  return {
    ...record,
    models: record.models.map(model => ({ ...model })),
    excludedModels: [...record.excludedModels],
    credentials: record.credentials.map(credential => ({
      ...credential,
      headers: credential.headers ? { ...credential.headers } : undefined
    })),
    headers: record.headers ? { ...record.headers } : undefined,
    cloakPolicy: record.cloakPolicy
      ? { ...record.cloakPolicy, sensitiveWords: [...record.cloakPolicy.sensitiveWords] }
      : undefined
  };
}
