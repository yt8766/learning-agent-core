import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GatewayClearLoginStorageResponse,
  GatewayRequestLogSettingResponse,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse
} from '@agent/core';
import {
  GatewayClearLoginStorageResponseSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema
} from '@agent/core';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';
import { RuntimeEngineFacade } from '../runtime-engine/runtime-engine.facade';

interface SystemRuntimeManagementClient {
  systemInfo(): Promise<GatewaySystemVersionResponse>;
  discoverModels(): Promise<GatewaySystemModelsResponse>;
  latestVersion?(): Promise<GatewaySystemVersionResponse>;
  setRequestLogEnabled?(enabled: boolean): Promise<GatewayRequestLogSettingResponse>;
  clearLoginStorage?(): Promise<GatewayClearLoginStorageResponse>;
}

@Injectable()
export class AgentGatewaySystemService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: SystemRuntimeManagementClient,
    @Optional() private readonly runtimeEngine?: RuntimeEngineFacade
  ) {}

  async info(): Promise<GatewaySystemVersionResponse> {
    return GatewaySystemVersionResponseSchema.parse(await this.managementClient.systemInfo());
  }

  async models(): Promise<GatewaySystemModelsResponse> {
    if (process.env.AGENT_GATEWAY_MANAGEMENT_MODE === 'cli-proxy') {
      return GatewaySystemModelsResponseSchema.parse(await this.managementClient.discoverModels());
    }

    if (this.runtimeEngine) {
      const models = await this.runtimeEngine.listModels();
      return GatewaySystemModelsResponseSchema.parse({
        groups: [
          {
            providerId: 'runtime',
            providerKind: 'custom',
            models: models.data.map(model => ({
              id: model.id,
              displayName: model.id,
              providerKind: 'custom',
              available: true
            }))
          }
        ]
      });
    }

    return GatewaySystemModelsResponseSchema.parse(await this.managementClient.discoverModels());
  }

  async latestVersion(): Promise<GatewaySystemVersionResponse> {
    if (this.managementClient.latestVersion) {
      return GatewaySystemVersionResponseSchema.parse(await this.managementClient.latestVersion());
    }

    return GatewaySystemVersionResponseSchema.parse(await this.managementClient.systemInfo());
  }

  async setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    if (this.managementClient.setRequestLogEnabled) {
      return GatewayRequestLogSettingResponseSchema.parse(await this.managementClient.setRequestLogEnabled(enabled));
    }

    return GatewayRequestLogSettingResponseSchema.parse({
      requestLog: enabled,
      updatedAt: new Date().toISOString()
    });
  }

  async clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    if (this.managementClient.clearLoginStorage) {
      return GatewayClearLoginStorageResponseSchema.parse(await this.managementClient.clearLoginStorage());
    }

    return GatewayClearLoginStorageResponseSchema.parse({ cleared: true, clearedAt: new Date().toISOString() });
  }
}
