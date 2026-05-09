import axios, { type AxiosRequestConfig } from 'axios';
import {
  GatewayAccountingResponseSchema,
  GatewayApiKeyListResponseSchema,
  GatewayCompleteOAuthResponseSchema,
  GatewayConfigDiffResponseSchema,
  GatewayConfigSchema,
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayCredentialFileSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayLogListResponseSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeResponseSchema,
  GatewayProviderCredentialSetSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayQuotaSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRelayResponseSchema,
  GatewaySnapshotSchema,
  GatewayStartOAuthResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayTokenCountResponseSchema,
  GatewayUsageListResponseSchema,
  type GatewayAccountingRequest,
  type GatewayAccountingResponse,
  type GatewayApiKeyListResponse,
  type GatewayCompleteOAuthRequest,
  type GatewayCompleteOAuthResponse,
  type GatewayConfigDiffResponse,
  type GatewayConfig,
  type GatewayConnectionProfile,
  type GatewayConnectionStatusResponse,
  type GatewayCredentialFile,
  type GatewayDashboardSummaryResponse,
  type GatewayLogFileListResponse,
  type GatewayLogListResponse,
  type GatewayPreprocessRequest,
  type GatewayPreprocessResponse,
  type GatewayProbeRequest,
  type GatewayProbeResponse,
  type GatewayProviderCredentialSet,
  type GatewayQuota,
  type GatewayQuotaDetailListResponse,
  type GatewayRawConfigResponse,
  type GatewayReloadConfigResponse,
  type GatewayReplaceApiKeysRequest,
  type GatewayRelayRequest,
  type GatewayRelayResponse,
  type GatewaySaveConnectionProfileRequest,
  type GatewaySaveRawConfigRequest,
  type GatewaySnapshot,
  type GatewayStartOAuthRequest,
  type GatewayStartOAuthResponse,
  type GatewaySystemModelsResponse,
  type GatewaySystemVersionResponse,
  type GatewayTokenCountRequest,
  type GatewayTokenCountResponse,
  type GatewayUpdateConfigRequest,
  type GatewayUpdateQuotaRequest,
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
  GatewayDashboardSummaryResponse,
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
  GatewaySystemVersionResponse
} from '@agent/core';

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
    if (response.status === 401 && code === 'ACCESS_TOKEN_EXPIRED' && retry) {
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
