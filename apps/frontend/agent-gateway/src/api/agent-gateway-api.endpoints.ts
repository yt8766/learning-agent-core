import type { AgentGatewayApiTransport } from './agent-gateway-api.requests';
import {
  GatewayClearLogsResponseSchema,
  GatewayClientApiKeyListResponseSchema,
  GatewayClientApiKeySchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayClientSchema,
  GatewayClientUsageSummarySchema,
  GatewayConfigSchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayCredentialFileSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayLogListResponseSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeResponseSchema,
  GatewayProviderCredentialSetSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayQuotaSchema,
  GatewayRelayResponseSchema,
  GatewaySnapshotSchema,
  GatewayTokenCountResponseSchema,
  GatewayUsageAnalyticsResponseSchema,
  GatewayUsageListResponseSchema,
  arrayOf,
  buildQueryString,
  gatewayRuntimeHealthResponseSchema
} from './agent-gateway-api.schemas';
import type {
  GatewayClearLogsResponse,
  GatewayClient,
  GatewayClientApiKey,
  GatewayClientApiKeyListResponse,
  GatewayClientListResponse,
  GatewayClientQuota,
  GatewayClientRequestLogListResponse,
  GatewayClientUsageSummary,
  GatewayConfig,
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientApiKeyResponse,
  GatewayCreateClientRequest,
  GatewayCredentialFile,
  GatewayDashboardSummaryResponse,
  GatewayLogListResponse,
  GatewayPreprocessRequest,
  GatewayPreprocessResponse,
  GatewayProbeRequest,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewayQuotaDetailListResponse,
  GatewayRelayRequest,
  GatewayRelayResponse,
  GatewayRuntimeHealthResponse,
  GatewaySnapshot,
  GatewayTokenCountRequest,
  GatewayTokenCountResponse,
  GatewayUpdateClientApiKeyRequest,
  GatewayUpdateClientQuotaRequest,
  GatewayUpdateClientRequest,
  GatewayUpdateConfigRequest,
  GatewayUpdateQuotaRequest,
  GatewayUpsertCredentialFileRequest,
  GatewayUpsertProviderRequest,
  GatewayUsageAnalyticsQuery,
  GatewayUsageAnalyticsResponse,
  GatewayUsageListResponse
} from './agent-gateway-api.types';

export class AgentGatewayBaseEndpointOperations {
  protected readonly transport: AgentGatewayApiTransport;

  constructor(transport: AgentGatewayApiTransport) {
    this.transport = transport;
  }

  snapshot(): Promise<GatewaySnapshot> {
    return this.transport.get('/agent-gateway/snapshot', GatewaySnapshotSchema);
  }

  logs(limit = 50): Promise<GatewayLogListResponse> {
    return this.transport.get(`/agent-gateway/logs?limit=${limit}`, GatewayLogListResponseSchema);
  }

  clearLogs(): Promise<GatewayClearLogsResponse> {
    return this.transport.deleteWithBodylessResponse('/agent-gateway/logs', GatewayClearLogsResponseSchema);
  }

  usage(limit = 50): Promise<GatewayUsageListResponse> {
    return this.transport.get(`/agent-gateway/usage?limit=${limit}`, GatewayUsageListResponseSchema);
  }

  usageAnalytics(query: Partial<GatewayUsageAnalyticsQuery> = {}): Promise<GatewayUsageAnalyticsResponse> {
    return this.transport.get(
      `/agent-gateway/usage/analytics${buildQueryString(query)}`,
      GatewayUsageAnalyticsResponseSchema
    );
  }

  providers(): Promise<GatewayProviderCredentialSet[]> {
    return this.transport.get('/agent-gateway/providers', arrayOf(GatewayProviderCredentialSetSchema));
  }

  credentialFiles(): Promise<GatewayCredentialFile[]> {
    return this.transport.get('/agent-gateway/credential-files', arrayOf(GatewayCredentialFileSchema));
  }

  quotas(): Promise<GatewayQuota[]> {
    return this.transport.get('/agent-gateway/quotas', arrayOf(GatewayQuotaSchema));
  }

  clients(): Promise<GatewayClientListResponse> {
    return this.transport.get('/agent-gateway/clients', GatewayClientListResponseSchema);
  }

  createClient(request: GatewayCreateClientRequest): Promise<GatewayClient> {
    return this.transport.post('/agent-gateway/clients', request, GatewayClientSchema);
  }

  updateClient(clientId: string, request: GatewayUpdateClientRequest): Promise<GatewayClient> {
    return this.transport.patch(`/agent-gateway/clients/${encodeURIComponent(clientId)}`, request, GatewayClientSchema);
  }

  enableClient(clientId: string): Promise<GatewayClient> {
    return this.transport.patch(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/enable`,
      {},
      GatewayClientSchema
    );
  }

  disableClient(clientId: string): Promise<GatewayClient> {
    return this.transport.patch(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/disable`,
      {},
      GatewayClientSchema
    );
  }

  clientApiKeys(clientId: string): Promise<GatewayClientApiKeyListResponse> {
    return this.transport.get(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys`,
      GatewayClientApiKeyListResponseSchema
    );
  }

  createClientApiKey(
    clientId: string,
    request: GatewayCreateClientApiKeyRequest
  ): Promise<GatewayCreateClientApiKeyResponse> {
    return this.transport.post(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys`,
      request,
      GatewayCreateClientApiKeyResponseSchema
    );
  }

  updateClientApiKey(
    clientId: string,
    apiKeyId: string,
    request: GatewayUpdateClientApiKeyRequest
  ): Promise<GatewayClientApiKey> {
    return this.transport.patch(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys/${encodeURIComponent(apiKeyId)}`,
      request,
      GatewayClientApiKeySchema
    );
  }

  revokeClientApiKey(clientId: string, apiKeyId: string): Promise<GatewayClientApiKey> {
    return this.transport.deleteWithBodylessResponse(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys/${encodeURIComponent(apiKeyId)}`,
      GatewayClientApiKeySchema
    );
  }

  rotateClientApiKey(clientId: string, apiKeyId: string): Promise<GatewayCreateClientApiKeyResponse> {
    return this.transport.post(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys/${encodeURIComponent(apiKeyId)}/rotate`,
      {},
      GatewayCreateClientApiKeyResponseSchema
    );
  }

  clientQuota(clientId: string): Promise<GatewayClientQuota> {
    return this.transport.get(`/agent-gateway/clients/${encodeURIComponent(clientId)}/quota`, GatewayClientQuotaSchema);
  }

  updateClientQuota(clientId: string, request: GatewayUpdateClientQuotaRequest): Promise<GatewayClientQuota> {
    return this.transport.put(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/quota`,
      request,
      GatewayClientQuotaSchema
    );
  }

  clientUsage(clientId: string): Promise<GatewayClientUsageSummary> {
    return this.transport.get(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/usage`,
      GatewayClientUsageSummarySchema
    );
  }

  clientLogs(clientId: string, limit = 20): Promise<GatewayClientRequestLogListResponse> {
    return this.transport.get(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/logs?limit=${limit}`,
      GatewayClientRequestLogListResponseSchema
    );
  }

  dashboard(): Promise<GatewayDashboardSummaryResponse> {
    return this.transport.get('/agent-gateway/dashboard', GatewayDashboardSummaryResponseSchema);
  }

  runtimeHealth(): Promise<GatewayRuntimeHealthResponse> {
    return this.transport.get('/agent-gateway/runtime/health', gatewayRuntimeHealthResponseSchema);
  }

  quotaDetails(): Promise<GatewayQuotaDetailListResponse> {
    return this.transport.get('/agent-gateway/quotas/details', GatewayQuotaDetailListResponseSchema);
  }

  refreshQuotaDetails(providerKind: string): Promise<GatewayQuotaDetailListResponse> {
    return this.transport.post(
      `/agent-gateway/quotas/details/${encodeURIComponent(providerKind)}/refresh`,
      {},
      GatewayQuotaDetailListResponseSchema
    );
  }

  probe(request: GatewayProbeRequest): Promise<GatewayProbeResponse> {
    return this.transport.post('/agent-gateway/probe', request, GatewayProbeResponseSchema);
  }

  tokenCount(request: GatewayTokenCountRequest): Promise<GatewayTokenCountResponse> {
    return this.transport.post('/agent-gateway/token-count', request, GatewayTokenCountResponseSchema);
  }

  preprocess(request: GatewayPreprocessRequest): Promise<GatewayPreprocessResponse> {
    return this.transport.post('/agent-gateway/preprocess', request, GatewayPreprocessResponseSchema);
  }

  relay(request: GatewayRelayRequest): Promise<GatewayRelayResponse> {
    return this.transport.post('/agent-gateway/relay', request, GatewayRelayResponseSchema);
  }

  updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig> {
    return this.transport.patch('/agent-gateway/config', request, GatewayConfigSchema);
  }

  upsertProvider(request: GatewayUpsertProviderRequest): Promise<GatewayProviderCredentialSet> {
    return this.transport.put(`/agent-gateway/providers/${request.id}`, request, GatewayProviderCredentialSetSchema);
  }

  deleteProvider(providerId: string): Promise<void> {
    return this.transport.delete(`/agent-gateway/providers/${providerId}`);
  }

  upsertCredentialFile(request: GatewayUpsertCredentialFileRequest): Promise<GatewayCredentialFile> {
    return this.transport.put(`/agent-gateway/credential-files/${request.id}`, request, GatewayCredentialFileSchema);
  }

  deleteCredentialFile(credentialFileId: string): Promise<void> {
    return this.transport.delete(`/agent-gateway/credential-files/${credentialFileId}`);
  }

  updateQuota(request: GatewayUpdateQuotaRequest): Promise<GatewayQuota> {
    return this.transport.patch(`/agent-gateway/quotas/${request.id}`, request, GatewayQuotaSchema);
  }
}
