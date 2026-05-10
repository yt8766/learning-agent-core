import { Inject, Injectable } from '@nestjs/common';
import type {
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewaySaveConnectionProfileRequest
} from '@agent/core';
import type { AgentGatewayManagementClient } from './agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from './agent-gateway-management-client';

@Injectable()
export class AgentGatewayConnectionService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  saveProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile> {
    return this.managementClient.saveProfile(request);
  }

  checkConnection(): Promise<GatewayConnectionStatusResponse> {
    return this.managementClient.checkConnection();
  }
}
