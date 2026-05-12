import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayConfigDiffResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewaySaveRawConfigRequest
} from '@agent/core';
import {
  GatewayConfigDiffResponseSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayConfigFileService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async readRawConfig(): Promise<GatewayRawConfigResponse> {
    return GatewayRawConfigResponseSchema.parse(await this.managementClient.readRawConfig());
  }

  async diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    return GatewayConfigDiffResponseSchema.parse(await this.managementClient.diffRawConfig(request));
  }

  async saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    return GatewayRawConfigResponseSchema.parse(await this.managementClient.saveRawConfig(request));
  }

  async reloadConfig(): Promise<GatewayReloadConfigResponse> {
    return GatewayReloadConfigResponseSchema.parse(await this.managementClient.reloadConfig());
  }
}
