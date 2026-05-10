import { Inject, Injectable } from '@nestjs/common';
import type { GatewayQuotaDetailListResponse } from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayQuotaDetailService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  list(): Promise<GatewayQuotaDetailListResponse> {
    return this.managementClient.listQuotaDetails();
  }
}
