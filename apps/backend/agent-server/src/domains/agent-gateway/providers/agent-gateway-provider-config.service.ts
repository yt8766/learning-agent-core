import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayProbeResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewaySystemModelsResponse
} from '@agent/core';
import {
  GatewayProbeResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewaySystemModelsResponseSchema
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

interface ProviderConfigManagementClient {
  listProviderConfigs?(): Promise<GatewayProviderSpecificConfigListResponse>;
  saveProviderConfig?(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord>;
  deleteProviderConfig?(providerId: string): Promise<void>;
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
    const response = delegate.listProviderConfigs
      ? await delegate.listProviderConfigs()
      : { items: [...this.providerConfigs.values()].map(cloneProviderConfig) };
    return GatewayProviderSpecificConfigListResponseSchema.parse(response);
  }

  async save(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    return this.saveProviderConfig(request.id, request);
  }

  async saveProviderConfig(
    providerId: string,
    request: GatewayProviderSpecificConfigRecord
  ): Promise<GatewayProviderSpecificConfigRecord> {
    const normalized = GatewayProviderSpecificConfigRecordSchema.parse({ ...request, id: providerId });
    const delegate = this.delegate();
    const response = delegate.saveProviderConfig ? await delegate.saveProviderConfig(normalized) : normalized;
    this.providerConfigs.set(normalized.id, cloneProviderConfig(response));
    return GatewayProviderSpecificConfigRecordSchema.parse(cloneProviderConfig(response));
  }

  async deleteProviderConfig(providerId: string): Promise<void> {
    const delegate = this.delegate();
    if (delegate.deleteProviderConfig) {
      await delegate.deleteProviderConfig(providerId);
    }
    this.providerConfigs.delete(providerId);
  }

  async discoverModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    const delegate = this.delegate();
    const response = delegate.discoverProviderModels
      ? await delegate.discoverProviderModels(providerId)
      : await this.managementClient.discoverModels();
    return GatewaySystemModelsResponseSchema.parse(response);
  }

  async testModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    const delegate = this.delegate();
    if (delegate.testProviderModel) return delegate.testProviderModel(providerId, model);
    const response = {
      ok: true,
      latencyMs: 0,
      providerId,
      inputTokens: 0,
      outputTokens: 0,
      message: 'Provider model probe is pending management client wiring'
    };
    return GatewayProbeResponseSchema.parse(response);
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
