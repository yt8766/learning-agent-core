import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayConfigDiffResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewaySaveRawConfigRequest
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayConfigFileService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  readRawConfig(): Promise<GatewayRawConfigResponse> {
    return this.managementClient.readRawConfig();
  }

  diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    return this.managementClient.diffRawConfig(request);
  }

  saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    return this.managementClient.saveRawConfig(request);
  }

  reloadConfig(): Promise<GatewayReloadConfigResponse> {
    return this.managementClient.reloadConfig();
  }
}
