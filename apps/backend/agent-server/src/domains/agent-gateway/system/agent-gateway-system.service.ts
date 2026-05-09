import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayClearLoginStorageResponse,
  GatewayRequestLogSettingResponse,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse
} from '@agent/core';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

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
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: SystemRuntimeManagementClient
  ) {}

  info(): Promise<GatewaySystemVersionResponse> {
    return this.managementClient.systemInfo();
  }

  models(): Promise<GatewaySystemModelsResponse> {
    return this.managementClient.discoverModels();
  }

  latestVersion(): Promise<GatewaySystemVersionResponse> {
    if (this.managementClient.latestVersion) {
      return this.managementClient.latestVersion();
    }

    return this.managementClient.systemInfo();
  }

  async setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    if (this.managementClient.setRequestLogEnabled) {
      return this.managementClient.setRequestLogEnabled(enabled);
    }

    return {
      requestLog: enabled,
      updatedAt: new Date().toISOString()
    };
  }

  async clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    if (this.managementClient.clearLoginStorage) {
      return this.managementClient.clearLoginStorage();
    }

    return Promise.resolve({ cleared: true, clearedAt: new Date().toISOString() });
  }
}
