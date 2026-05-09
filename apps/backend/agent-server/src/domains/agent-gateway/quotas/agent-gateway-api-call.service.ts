import { Inject, Injectable } from '@nestjs/common';
import {
  GatewayManagementApiCallResponseSchema,
  type GatewayManagementApiCallRequest,
  type GatewayManagementApiCallResponse,
  type GatewayProviderKind,
  type GatewayQuotaDetailListResponse
} from '@agent/core';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';

interface ApiCallManagementClient {
  listQuotaDetails(): Promise<GatewayQuotaDetailListResponse>;
  managementApiCall?(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse>;
  refreshQuotaDetails?(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse>;
}

@Injectable()
export class AgentGatewayApiCallService {
  constructor(@Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: ApiCallManagementClient) {}

  async call(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    if (this.managementClient.managementApiCall) {
      return this.managementClient.managementApiCall(request);
    }

    return GatewayManagementApiCallResponseSchema.parse({
      statusCode: 200,
      header: {},
      bodyText: JSON.stringify({
        provider: inferProviderFromUrl(request.url),
        url: request.url,
        method: request.method
      }),
      body: {
        provider: inferProviderFromUrl(request.url),
        url: request.url,
        method: request.method
      },
      durationMs: 0
    });
  }

  async refreshQuotaDetails(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    if (this.managementClient.refreshQuotaDetails) {
      return this.managementClient.refreshQuotaDetails(providerKind);
    }

    const details = await this.managementClient.listQuotaDetails();
    return {
      items: details.items.filter(item => item.providerId === providerKind)
    };
  }
}

function inferProviderFromUrl(url: string): string {
  if (url.includes('anthropic.com')) return 'claude';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  return 'custom';
}
