import axios, { type AxiosRequestConfig } from 'axios';
import {
  GatewayAccountingResponseSchema,
  GatewayApiKeyListResponseSchema,
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileDeleteResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFileSchema,
  GatewayClearLoginStorageResponseSchema,
  GatewayCompleteOAuthResponseSchema,
  GatewayConfigDiffResponseSchema,
  GatewayConfigSchema,
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayClientApiKeySchema,
  GatewayClientApiKeyListResponseSchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayClientSchema,
  GatewayClientUsageSummarySchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayCredentialFileSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayLogListResponseSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayProviderCredentialSetSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayQuotaSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRelayResponseSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewaySnapshotSchema,
  GatewayStartOAuthResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayTokenCountResponseSchema,
  GatewayVertexCredentialImportResponseSchema,
  GatewayUsageListResponseSchema,
  type GatewayAccountingRequest,
  type GatewayAccountingResponse,
  type GatewayApiKeyListResponse,
  type GatewayAuthFile,
  type GatewayAuthFileBatchUploadRequest,
  type GatewayAuthFileBatchUploadResponse,
  type GatewayAuthFileDeleteRequest,
  type GatewayAuthFileDeleteResponse,
  type GatewayAuthFileListResponse,
  type GatewayAuthFileModelListResponse,
  type GatewayAuthFilePatchRequest,
  type GatewayClearLoginStorageResponse,
  type GatewayCompleteOAuthRequest,
  type GatewayCompleteOAuthResponse,
  type GatewayConfigDiffResponse,
  type GatewayConfig,
  type GatewayConnectionProfile,
  type GatewayConnectionStatusResponse,
  type GatewayClient,
  type GatewayClientApiKey,
  type GatewayClientApiKeyListResponse,
  type GatewayClientListResponse,
  type GatewayClientQuota,
  type GatewayClientRequestLogListResponse,
  type GatewayClientUsageSummary,
  type GatewayCreateClientApiKeyRequest,
  type GatewayCreateClientApiKeyResponse,
  type GatewayCreateClientRequest,
  type GatewayCredentialFile,
  type GatewayDashboardSummaryResponse,
  type GatewayGeminiCliOAuthStartRequest,
  type GatewayLogFileListResponse,
  type GatewayLogListResponse,
  type GatewayManagementApiCallRequest,
  type GatewayManagementApiCallResponse,
  type GatewayOAuthCallbackRequest,
  type GatewayOAuthCallbackResponse,
  type GatewayOAuthModelAliasListResponse,
  type GatewayOAuthStatusResponse,
  type GatewayProviderOAuthStartProvider,
  type GatewayProviderOAuthStartResponse,
  type GatewayPreprocessRequest,
  type GatewayPreprocessResponse,
  type GatewayProbeRequest,
  type GatewayProbeResponse,
  type GatewayProviderKind,
  type GatewayProviderSpecificConfigListResponse,
  type GatewayProviderSpecificConfigRecord,
  type GatewayProviderCredentialSet,
  type GatewayQuota,
  type GatewayQuotaDetailListResponse,
  type GatewayRawConfigResponse,
  type GatewayReloadConfigResponse,
  type GatewayReplaceApiKeysRequest,
  type GatewayRelayRequest,
  type GatewayRelayResponse,
  type GatewayRequestLogSettingResponse,
  type GatewaySaveConnectionProfileRequest,
  type GatewaySaveRawConfigRequest,
  type GatewaySnapshot,
  type GatewayStartOAuthRequest,
  type GatewayStartOAuthResponse,
  type GatewaySystemModelsResponse,
  type GatewaySystemVersionResponse,
  type GatewayTokenCountRequest,
  type GatewayTokenCountResponse,
  type GatewayUpdateOAuthModelAliasRulesRequest,
  type GatewayUpdateClientApiKeyRequest,
  type GatewayUpdateClientQuotaRequest,
  type GatewayUpdateClientRequest,
  type GatewayUpdateConfigRequest,
  type GatewayUpdateQuotaRequest,
  type GatewayVertexCredentialImportRequest,
  type GatewayVertexCredentialImportResponse,
  type GatewayUpsertCredentialFileRequest,
  type GatewayUpsertProviderRequest,
  type GatewayUsageListResponse
} from '@agent/core';

export type {
  GatewayApiKey,
  GatewayApiKeyListResponse,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayClient,
  GatewayClientApiKey,
  GatewayClientApiKeyListResponse,
  GatewayClientListResponse,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientRequestLogListResponse,
  GatewayClientUsageSummary,
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientApiKeyResponse,
  GatewayCreateClientRequest,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayClearLoginStorageResponse,
  GatewayDashboardSummaryResponse,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayOAuthCallbackRequest,
  GatewayOAuthCallbackResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartProvider,
  GatewayProviderOAuthStartResponse,
  GatewayProviderKind,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayRequestLogSettingResponse,
  GatewayLogFile,
  GatewayLogFileListResponse,
  GatewayQuotaDetailListResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayReplaceApiKeysRequest,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewaySystemModelGroup,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayUpdateClientApiKeyRequest,
  GatewayUpdateClientQuotaRequest,
  GatewayUpdateClientRequest,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';

export interface GatewayGeminiCliOAuthStartResponse {
  state: string;
  verificationUri: string;
  expiresAt: string;
}

interface AgentGatewayApiClientOptions {
  baseUrl?: string;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
}

interface ParseableSchema<T> {
  parse(payload: unknown): T;
}

interface GatewayErrorPayload {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface GatewayAuthFileQuery {
  query?: string;
  providerKind?: GatewayProviderKind;
  cursor?: string;
  limit?: number;
}

export class AgentGatewayApiClient {
  private readonly baseUrl: string;

  private readonly options: AgentGatewayApiClientOptions;

  constructor(options: AgentGatewayApiClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl ?? '/api';
  }

  snapshot(): Promise<GatewaySnapshot> {
    return this.get('/agent-gateway/snapshot', GatewaySnapshotSchema);
  }

  logs(limit = 50): Promise<GatewayLogListResponse> {
    return this.get(`/agent-gateway/logs?limit=${limit}`, GatewayLogListResponseSchema);
  }

  usage(limit = 50): Promise<GatewayUsageListResponse> {
    return this.get(`/agent-gateway/usage?limit=${limit}`, GatewayUsageListResponseSchema);
  }

  providers(): Promise<GatewayProviderCredentialSet[]> {
    return this.get('/agent-gateway/providers', arrayOf(GatewayProviderCredentialSetSchema));
  }

  credentialFiles(): Promise<GatewayCredentialFile[]> {
    return this.get('/agent-gateway/credential-files', arrayOf(GatewayCredentialFileSchema));
  }

  quotas(): Promise<GatewayQuota[]> {
    return this.get('/agent-gateway/quotas', arrayOf(GatewayQuotaSchema));
  }

  clients(): Promise<GatewayClientListResponse> {
    return this.get('/agent-gateway/clients', GatewayClientListResponseSchema);
  }

  createClient(request: GatewayCreateClientRequest): Promise<GatewayClient> {
    return this.post('/agent-gateway/clients', request, GatewayClientSchema);
  }

  updateClient(clientId: string, request: GatewayUpdateClientRequest): Promise<GatewayClient> {
    return this.patch(`/agent-gateway/clients/${encodeURIComponent(clientId)}`, request, GatewayClientSchema);
  }

  enableClient(clientId: string): Promise<GatewayClient> {
    return this.patch(`/agent-gateway/clients/${encodeURIComponent(clientId)}/enable`, {}, GatewayClientSchema);
  }

  disableClient(clientId: string): Promise<GatewayClient> {
    return this.patch(`/agent-gateway/clients/${encodeURIComponent(clientId)}/disable`, {}, GatewayClientSchema);
  }

  clientApiKeys(clientId: string): Promise<GatewayClientApiKeyListResponse> {
    return this.get(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys`,
      GatewayClientApiKeyListResponseSchema
    );
  }

  createClientApiKey(
    clientId: string,
    request: GatewayCreateClientApiKeyRequest
  ): Promise<GatewayCreateClientApiKeyResponse> {
    return this.post(
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
    return this.patch(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys/${encodeURIComponent(apiKeyId)}`,
      request,
      GatewayClientApiKeySchema
    );
  }

  revokeClientApiKey(clientId: string, apiKeyId: string): Promise<GatewayClientApiKey> {
    return this.deleteWithBodylessResponse(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys/${encodeURIComponent(apiKeyId)}`,
      GatewayClientApiKeySchema
    );
  }

  rotateClientApiKey(clientId: string, apiKeyId: string): Promise<GatewayCreateClientApiKeyResponse> {
    return this.post(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/api-keys/${encodeURIComponent(apiKeyId)}/rotate`,
      {},
      GatewayCreateClientApiKeyResponseSchema
    );
  }

  clientQuota(clientId: string): Promise<GatewayClientQuota> {
    return this.get(`/agent-gateway/clients/${encodeURIComponent(clientId)}/quota`, GatewayClientQuotaSchema);
  }

  updateClientQuota(clientId: string, request: GatewayUpdateClientQuotaRequest): Promise<GatewayClientQuota> {
    return this.put(`/agent-gateway/clients/${encodeURIComponent(clientId)}/quota`, request, GatewayClientQuotaSchema);
  }

  clientUsage(clientId: string): Promise<GatewayClientUsageSummary> {
    return this.get(`/agent-gateway/clients/${encodeURIComponent(clientId)}/usage`, GatewayClientUsageSummarySchema);
  }

  clientLogs(clientId: string, limit = 20): Promise<GatewayClientRequestLogListResponse> {
    return this.get(
      `/agent-gateway/clients/${encodeURIComponent(clientId)}/logs?limit=${limit}`,
      GatewayClientRequestLogListResponseSchema
    );
  }

  dashboard(): Promise<GatewayDashboardSummaryResponse> {
    return this.get('/agent-gateway/dashboard', GatewayDashboardSummaryResponseSchema);
  }

  quotaDetails(): Promise<GatewayQuotaDetailListResponse> {
    return this.get('/agent-gateway/quotas/details', GatewayQuotaDetailListResponseSchema);
  }

  refreshQuotaDetails(providerKind: string): Promise<GatewayQuotaDetailListResponse> {
    return this.post(
      `/agent-gateway/quotas/details/${encodeURIComponent(providerKind)}/refresh`,
      {},
      GatewayQuotaDetailListResponseSchema
    );
  }

  probe(request: GatewayProbeRequest): Promise<GatewayProbeResponse> {
    return this.post('/agent-gateway/probe', request, GatewayProbeResponseSchema);
  }

  tokenCount(request: GatewayTokenCountRequest): Promise<GatewayTokenCountResponse> {
    return this.post('/agent-gateway/token-count', request, GatewayTokenCountResponseSchema);
  }

  preprocess(request: GatewayPreprocessRequest): Promise<GatewayPreprocessResponse> {
    return this.post('/agent-gateway/preprocess', request, GatewayPreprocessResponseSchema);
  }

  relay(request: GatewayRelayRequest): Promise<GatewayRelayResponse> {
    return this.post('/agent-gateway/relay', request, GatewayRelayResponseSchema);
  }

  updateConfig(request: GatewayUpdateConfigRequest): Promise<GatewayConfig> {
    return this.patch('/agent-gateway/config', request, GatewayConfigSchema);
  }

  upsertProvider(request: GatewayUpsertProviderRequest): Promise<GatewayProviderCredentialSet> {
    return this.put(`/agent-gateway/providers/${request.id}`, request, GatewayProviderCredentialSetSchema);
  }

  deleteProvider(providerId: string): Promise<void> {
    return this.delete(`/agent-gateway/providers/${providerId}`);
  }

  upsertCredentialFile(request: GatewayUpsertCredentialFileRequest): Promise<GatewayCredentialFile> {
    return this.put(`/agent-gateway/credential-files/${request.id}`, request, GatewayCredentialFileSchema);
  }

  deleteCredentialFile(credentialFileId: string): Promise<void> {
    return this.delete(`/agent-gateway/credential-files/${credentialFileId}`);
  }

  updateQuota(request: GatewayUpdateQuotaRequest): Promise<GatewayQuota> {
    return this.patch(`/agent-gateway/quotas/${request.id}`, request, GatewayQuotaSchema);
  }

  startOAuth(request: GatewayStartOAuthRequest): Promise<GatewayStartOAuthResponse> {
    return this.post('/agent-gateway/oauth/start', request, GatewayStartOAuthResponseSchema);
  }

  completeOAuth(request: GatewayCompleteOAuthRequest): Promise<GatewayCompleteOAuthResponse> {
    return this.post('/agent-gateway/oauth/complete', request, GatewayCompleteOAuthResponseSchema);
  }

  accounting(request: GatewayAccountingRequest): Promise<GatewayAccountingResponse> {
    return this.post('/agent-gateway/accounting', request, GatewayAccountingResponseSchema);
  }

  saveConnectionProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile> {
    return this.put('/agent-gateway/connection/profile', request, GatewayConnectionProfileSchema);
  }

  checkConnection(): Promise<GatewayConnectionStatusResponse> {
    return this.post('/agent-gateway/connection/check', {}, GatewayConnectionStatusResponseSchema);
  }

  rawConfig(): Promise<GatewayRawConfigResponse> {
    return this.get('/agent-gateway/config/raw', GatewayRawConfigResponseSchema);
  }

  diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    return this.post('/agent-gateway/config/raw/diff', request, GatewayConfigDiffResponseSchema);
  }

  saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    return this.put('/agent-gateway/config/raw', request, GatewayRawConfigResponseSchema);
  }

  reloadConfig(): Promise<GatewayReloadConfigResponse> {
    return this.post('/agent-gateway/config/reload', {}, GatewayReloadConfigResponseSchema);
  }

  apiKeys(): Promise<GatewayApiKeyListResponse> {
    return this.get('/agent-gateway/api-keys', GatewayApiKeyListResponseSchema);
  }

  replaceApiKeys(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    return this.put('/agent-gateway/api-keys', request, GatewayApiKeyListResponseSchema);
  }

  logFiles(): Promise<GatewayLogFileListResponse> {
    return this.get('/agent-gateway/logs/request-error-files', GatewayLogFileListResponseSchema);
  }

  systemInfo(): Promise<GatewaySystemVersionResponse> {
    return this.get('/agent-gateway/system/info', GatewaySystemVersionResponseSchema);
  }

  discoverModels(): Promise<GatewaySystemModelsResponse> {
    return this.get('/agent-gateway/system/models', GatewaySystemModelsResponseSchema);
  }

  providerConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return this.get('/agent-gateway/provider-configs', GatewayProviderSpecificConfigListResponseSchema);
  }

  saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    return this.put(
      `/agent-gateway/provider-configs/${encodeURIComponent(request.id)}`,
      request,
      GatewayProviderSpecificConfigRecordSchema
    );
  }

  providerConfigModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    return this.get(
      `/agent-gateway/provider-configs/${encodeURIComponent(providerId)}/models`,
      GatewaySystemModelsResponseSchema
    );
  }

  testProviderModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    return this.post(
      `/agent-gateway/provider-configs/${encodeURIComponent(providerId)}/test-model`,
      { model },
      GatewayProbeResponseSchema
    );
  }

  authFiles(query: GatewayAuthFileQuery = {}): Promise<GatewayAuthFileListResponse> {
    return this.get(`/agent-gateway/auth-files${buildQueryString(query)}`, GatewayAuthFileListResponseSchema);
  }

  batchUploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    return this.post('/agent-gateway/auth-files', request, GatewayAuthFileBatchUploadResponseSchema);
  }

  patchAuthFileFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    return this.patch('/agent-gateway/auth-files/fields', request, GatewayAuthFileSchema);
  }

  authFileModels(authFileId: string): Promise<GatewayAuthFileModelListResponse> {
    return this.get(
      `/agent-gateway/auth-files/${encodeURIComponent(authFileId)}/models`,
      GatewayAuthFileModelListResponseSchema
    );
  }

  downloadAuthFile(authFileId: string): Promise<string> {
    return this.get(`/agent-gateway/auth-files/${encodeURIComponent(authFileId)}/download`, stringResponseSchema);
  }

  deleteAuthFiles(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    return this.deleteWithBody('/agent-gateway/auth-files', request, GatewayAuthFileDeleteResponseSchema);
  }

  oauthModelAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    return this.get(
      `/agent-gateway/oauth/model-aliases/${encodeURIComponent(providerId)}`,
      GatewayOAuthModelAliasListResponseSchema
    );
  }

  saveOAuthModelAliases(
    providerId: string,
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ): Promise<GatewayOAuthModelAliasListResponse> {
    return this.patch(
      `/agent-gateway/oauth/model-aliases/${encodeURIComponent(providerId)}`,
      request,
      GatewayOAuthModelAliasListResponseSchema
    );
  }

  oauthStatus(state: string): Promise<GatewayOAuthStatusResponse> {
    return this.get(`/agent-gateway/oauth/status/${encodeURIComponent(state)}`, GatewayOAuthStatusResponseSchema);
  }

  submitOAuthCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    return this.post('/agent-gateway/oauth/callback', request, GatewayOAuthCallbackResponseSchema);
  }

  startProviderOAuth(provider: GatewayProviderOAuthStartProvider): Promise<GatewayProviderOAuthStartResponse> {
    return this.post(
      `/agent-gateway/oauth/${encodeURIComponent(provider)}/start`,
      { isWebui: true },
      GatewayProviderOAuthStartResponseSchema
    );
  }

  startGeminiCliOAuth(request: GatewayStartOAuthRequest): Promise<GatewayGeminiCliOAuthStartResponse>;
  startGeminiCliOAuth(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayGeminiCliOAuthStartResponse>;
  startGeminiCliOAuth(
    request: GatewayStartOAuthRequest | GatewayGeminiCliOAuthStartRequest
  ): Promise<GatewayGeminiCliOAuthStartResponse> {
    return this.post('/agent-gateway/oauth/gemini-cli/start', request, geminiCliOAuthStartResponseSchema);
  }

  importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportResponse> {
    return this.post('/agent-gateway/oauth/vertex/import', request, GatewayVertexCredentialImportResponseSchema);
  }

  managementApiCall(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    return this.post('/agent-gateway/api-call', request, GatewayManagementApiCallResponseSchema);
  }

  latestVersion(): Promise<GatewaySystemVersionResponse> {
    return this.get('/agent-gateway/system/latest-version', GatewaySystemVersionResponseSchema);
  }

  setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    return this.put(
      '/agent-gateway/system/request-log',
      { requestLog: enabled },
      GatewayRequestLogSettingResponseSchema
    );
  }

  clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return this.post('/agent-gateway/system/clear-login-storage', {}, GatewayClearLoginStorageResponseSchema);
  }

  private get<T>(path: string, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema);
  }

  private post<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  private put<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  private patch<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  private delete(path: string): Promise<void> {
    return this.request(path, voidResponseSchema, {
      method: 'DELETE'
    });
  }

  private deleteWithBodylessResponse<T>(path: string, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'DELETE'
    });
  }

  private deleteWithBody<T>(path: string, body: unknown, schema: ParseableSchema<T>): Promise<T> {
    return this.request(path, schema, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      data: body
    });
  }

  private async request<T>(
    path: string,
    schema: ParseableSchema<T>,
    init: AxiosRequestConfig = {},
    retry = true
  ): Promise<T> {
    const token = this.options.getAccessToken();
    const response = await axios.request({
      ...init,
      url: `${this.baseUrl}${path}`,
      headers: {
        ...init.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      validateStatus: () => true
    });
    const payload = response.data as unknown;
    if (response.status >= 200 && response.status < 300) {
      return schema.parse(payload);
    }

    const errorPayload = payload as GatewayErrorPayload;
    const code = errorPayload.error?.code ?? errorPayload.code;
    if (response.status === 401 && isRefreshableAuthError(code) && retry) {
      const refreshedToken = await this.options.refreshAccessToken();
      if (refreshedToken) {
        return this.request(path, schema, init, false);
      }
    }
    throw new Error(errorPayload.error?.message ?? errorPayload.message ?? '网关请求失败');
  }
}

const voidResponseSchema: ParseableSchema<void> = {
  parse(): void {
    return undefined;
  }
};

const stringResponseSchema: ParseableSchema<string> = {
  parse(payload: unknown): string {
    if (typeof payload !== 'string') {
      throw new Error('网关文本响应格式无效');
    }
    return payload;
  }
};

const geminiCliOAuthStartResponseSchema: ParseableSchema<GatewayGeminiCliOAuthStartResponse> = {
  parse(payload: unknown): GatewayGeminiCliOAuthStartResponse {
    if (!isRecord(payload)) {
      throw new Error('Gemini CLI OAuth 响应格式无效');
    }
    const state = payload.state;
    const verificationUri = payload.verificationUri;
    const expiresAt = payload.expiresAt;
    if (typeof state !== 'string' || typeof verificationUri !== 'string' || typeof expiresAt !== 'string') {
      throw new Error('Gemini CLI OAuth 响应缺少 state、verificationUri 或 expiresAt');
    }
    return { state, verificationUri, expiresAt };
  }
};

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return payload !== null && typeof payload === 'object';
}

function isRefreshableAuthError(code: string | undefined): boolean {
  return code === 'ACCESS_TOKEN_EXPIRED' || code === 'UNAUTHENTICATED';
}

function buildQueryString(query: object): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]: [string, unknown]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

function arrayOf<T>(schema: ParseableSchema<T>): ParseableSchema<T[]> {
  return {
    parse(payload: unknown): T[] {
      if (!Array.isArray(payload)) {
        throw new Error('网关列表响应格式无效');
      }
      return payload.map(item => schema.parse(item));
    }
  };
}
