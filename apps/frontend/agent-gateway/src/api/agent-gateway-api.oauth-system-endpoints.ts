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
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayMigrationApplyResponseSchema,
  GatewayMigrationPreviewSchema,
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayProbeResponseSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewayStartOAuthResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayVertexCredentialImportResponseSchema,
  buildQueryString,
  geminiCliOAuthStartResponseSchema,
  stringResponseSchema
} from './agent-gateway-api.schemas';
import { AgentGatewayBaseEndpointOperations } from './agent-gateway-api.endpoints';
import type {
  GatewayAccountingRequest,
  GatewayAccountingResponse,
  GatewayApiKeyListResponse,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayAuthFileQuery,
  GatewayClearLoginStorageResponse,
  GatewayCompleteOAuthRequest,
  GatewayCompleteOAuthResponse,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayGeminiCliOAuthStartRequest,
  GatewayGeminiCliOAuthStartResponse,
  GatewayLogFileListResponse,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayMigrationApplyRequest,
  GatewayMigrationApplyResponse,
  GatewayMigrationPreview,
  GatewayMigrationPreviewRequest,
  GatewayOAuthCallbackRequest,
  GatewayOAuthCallbackResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderOAuthStartProvider,
  GatewayProviderOAuthStartResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayProbeResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayReplaceApiKeysRequest,
  GatewayRequestLogSettingResponse,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewayStartOAuthRequest,
  GatewayStartOAuthResponse,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from './agent-gateway-api.types';

export class AgentGatewayEndpointOperations extends AgentGatewayBaseEndpointOperations {
  startOAuth(request: GatewayStartOAuthRequest): Promise<GatewayStartOAuthResponse> {
    return this.transport.post('/agent-gateway/oauth/start', request, GatewayStartOAuthResponseSchema);
  }

  completeOAuth(request: GatewayCompleteOAuthRequest): Promise<GatewayCompleteOAuthResponse> {
    return this.transport.post('/agent-gateway/oauth/complete', request, GatewayCompleteOAuthResponseSchema);
  }

  accounting(request: GatewayAccountingRequest): Promise<GatewayAccountingResponse> {
    return this.transport.post('/agent-gateway/accounting', request, GatewayAccountingResponseSchema);
  }

  saveConnectionProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile> {
    return this.transport.put('/agent-gateway/connection/profile', request, GatewayConnectionProfileSchema);
  }

  checkConnection(): Promise<GatewayConnectionStatusResponse> {
    return this.transport.post('/agent-gateway/connection/check', {}, GatewayConnectionStatusResponseSchema);
  }

  rawConfig(): Promise<GatewayRawConfigResponse> {
    return this.transport.get('/agent-gateway/config/raw', GatewayRawConfigResponseSchema);
  }

  diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse> {
    return this.transport.post('/agent-gateway/config/raw/diff', request, GatewayConfigDiffResponseSchema);
  }

  saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse> {
    return this.transport.put('/agent-gateway/config/raw', request, GatewayRawConfigResponseSchema);
  }

  reloadConfig(): Promise<GatewayReloadConfigResponse> {
    return this.transport.post('/agent-gateway/config/reload', {}, GatewayReloadConfigResponseSchema);
  }

  apiKeys(): Promise<GatewayApiKeyListResponse> {
    return this.transport.get('/agent-gateway/api-keys', GatewayApiKeyListResponseSchema);
  }

  replaceApiKeys(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse> {
    return this.transport.put('/agent-gateway/api-keys', request, GatewayApiKeyListResponseSchema);
  }

  logFiles(): Promise<GatewayLogFileListResponse> {
    return this.transport.get('/agent-gateway/logs/request-error-files', GatewayLogFileListResponseSchema);
  }

  systemInfo(): Promise<GatewaySystemVersionResponse> {
    return this.transport.get('/agent-gateway/system/info', GatewaySystemVersionResponseSchema);
  }

  discoverModels(): Promise<GatewaySystemModelsResponse> {
    return this.transport.get('/agent-gateway/system/models', GatewaySystemModelsResponseSchema);
  }

  providerConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return this.transport.get('/agent-gateway/provider-configs', GatewayProviderSpecificConfigListResponseSchema);
  }

  saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord> {
    return this.transport.put(
      `/agent-gateway/provider-configs/${encodeURIComponent(request.id)}`,
      request,
      GatewayProviderSpecificConfigRecordSchema
    );
  }

  providerConfigModels(providerId: string): Promise<GatewaySystemModelsResponse> {
    return this.transport.get(
      `/agent-gateway/provider-configs/${encodeURIComponent(providerId)}/models`,
      GatewaySystemModelsResponseSchema
    );
  }

  testProviderModel(providerId: string, model: string): Promise<GatewayProbeResponse> {
    return this.transport.post(
      `/agent-gateway/provider-configs/${encodeURIComponent(providerId)}/test-model`,
      { model },
      GatewayProbeResponseSchema
    );
  }

  authFiles(query: GatewayAuthFileQuery = {}): Promise<GatewayAuthFileListResponse> {
    return this.transport.get(`/agent-gateway/auth-files${buildQueryString(query)}`, GatewayAuthFileListResponseSchema);
  }

  batchUploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse> {
    return this.transport.post('/agent-gateway/auth-files', request, GatewayAuthFileBatchUploadResponseSchema);
  }

  patchAuthFileFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile> {
    return this.transport.patch('/agent-gateway/auth-files/fields', request, GatewayAuthFileSchema);
  }

  authFileModels(authFileId: string): Promise<GatewayAuthFileModelListResponse> {
    return this.transport.get(
      `/agent-gateway/auth-files/${encodeURIComponent(authFileId)}/models`,
      GatewayAuthFileModelListResponseSchema
    );
  }

  downloadAuthFile(authFileId: string): Promise<string> {
    return this.transport.get(
      `/agent-gateway/auth-files/${encodeURIComponent(authFileId)}/download`,
      stringResponseSchema
    );
  }

  deleteAuthFiles(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse> {
    return this.transport.deleteWithBody('/agent-gateway/auth-files', request, GatewayAuthFileDeleteResponseSchema);
  }

  oauthModelAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse> {
    return this.transport.get(
      `/agent-gateway/oauth/model-aliases/${encodeURIComponent(providerId)}`,
      GatewayOAuthModelAliasListResponseSchema
    );
  }

  saveOAuthModelAliases(
    providerId: string,
    request: GatewayUpdateOAuthModelAliasRulesRequest
  ): Promise<GatewayOAuthModelAliasListResponse> {
    return this.transport.patch(
      `/agent-gateway/oauth/model-aliases/${encodeURIComponent(providerId)}`,
      request,
      GatewayOAuthModelAliasListResponseSchema
    );
  }

  oauthStatus(state: string): Promise<GatewayOAuthStatusResponse> {
    return this.transport.get(
      `/agent-gateway/oauth/status/${encodeURIComponent(state)}`,
      GatewayOAuthStatusResponseSchema
    );
  }

  submitOAuthCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse> {
    return this.transport.post('/agent-gateway/oauth/callback', request, GatewayOAuthCallbackResponseSchema);
  }

  startProviderOAuth(provider: GatewayProviderOAuthStartProvider): Promise<GatewayProviderOAuthStartResponse> {
    return this.transport.post(
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
    return this.transport.post('/agent-gateway/oauth/gemini-cli/start', request, geminiCliOAuthStartResponseSchema);
  }

  importVertexCredential(
    request: GatewayVertexCredentialImportRequest
  ): Promise<GatewayVertexCredentialImportResponse> {
    return this.transport.post(
      '/agent-gateway/oauth/vertex/import',
      request,
      GatewayVertexCredentialImportResponseSchema
    );
  }

  managementApiCall(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse> {
    return this.transport.post('/agent-gateway/api-call', request, GatewayManagementApiCallResponseSchema);
  }

  previewMigration(request: GatewayMigrationPreviewRequest): Promise<GatewayMigrationPreview> {
    return this.transport.post('/agent-gateway/migration/preview', request, GatewayMigrationPreviewSchema);
  }

  applyMigration(request: GatewayMigrationApplyRequest): Promise<GatewayMigrationApplyResponse> {
    return this.transport.post('/agent-gateway/migration/apply', request, GatewayMigrationApplyResponseSchema);
  }

  latestVersion(): Promise<GatewaySystemVersionResponse> {
    return this.transport.get('/agent-gateway/system/latest-version', GatewaySystemVersionResponseSchema);
  }

  setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse> {
    return this.transport.put(
      '/agent-gateway/system/request-log',
      { requestLog: enabled },
      GatewayRequestLogSettingResponseSchema
    );
  }

  clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return this.transport.post('/agent-gateway/system/clear-login-storage', {}, GatewayClearLoginStorageResponseSchema);
  }
}
