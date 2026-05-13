import { Inject, Injectable } from '@nestjs/common';
import {
  GatewayManagementApiCallResponseSchema,
  GatewayQuotaDetailListResponseSchema,
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
      return parseSanitizedApiCallResponse(await this.managementClient.managementApiCall(request));
    }

    return parseSanitizedApiCallResponse({
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
    return this.refreshProviderQuota(providerKind);
  }

  async refreshProviderQuota(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse> {
    if (this.managementClient.refreshQuotaDetails) {
      return GatewayQuotaDetailListResponseSchema.parse(await this.managementClient.refreshQuotaDetails(providerKind));
    }

    const details = await this.managementClient.listQuotaDetails();
    return GatewayQuotaDetailListResponseSchema.parse({
      items: details.items.filter(item => item.providerId === providerKind)
    });
  }
}

function inferProviderFromUrl(url: string | undefined): string {
  if (!url) return 'custom';
  if (url.includes('anthropic.com')) return 'claude';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  return 'custom';
}

function parseSanitizedApiCallResponse(response: GatewayManagementApiCallResponse): GatewayManagementApiCallResponse {
  const body = sanitizeProjectionValue(response.body);
  return GatewayManagementApiCallResponseSchema.parse({
    ...response,
    body,
    bodyText: JSON.stringify(body)
  });
}

const sensitiveProjectionKeyPattern = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|cookie|secret)/i;

function sanitizeProjectionValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeProjectionValue(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveProjectionKeyPattern.test(key))
      .map(([key, nested]) => [key, sanitizeProjectionValue(nested)])
  );
}
