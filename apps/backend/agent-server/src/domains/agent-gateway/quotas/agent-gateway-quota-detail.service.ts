import { Inject, Injectable } from '@nestjs/common';
import {
  GatewayQuotaDetailListResponseSchema,
  type GatewayProviderKind,
  type GatewayQuotaDetailListResponse
} from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

@Injectable()
export class AgentGatewayQuotaDetailService {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async list(): Promise<GatewayQuotaDetailListResponse> {
    return GatewayQuotaDetailListResponseSchema.parse(await this.managementClient.listQuotaDetails());
  }

  async refresh(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    return this.refreshProviderQuota(providerKind);
  }

  async refreshProviderQuota(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    return GatewayQuotaDetailListResponseSchema.parse(await this.managementClient.refreshQuotaDetails(providerKind));
  }
}
