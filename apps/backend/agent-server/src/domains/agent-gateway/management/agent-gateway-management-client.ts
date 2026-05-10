import type {
  GatewayApiKeyListResponse,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayClearLogsResponse,
  GatewayClearLoginStorageResponse,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayDeleteApiKeyRequest,
  GatewayGeminiCliOAuthStartRequest,
  GatewayLogFileListResponse,
  GatewayLogSearchRequest,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayOAuthCallbackRequest,
  GatewayOAuthCallbackResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayProbeResponse,
  GatewayProviderKind,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayReplaceApiKeysRequest,
  GatewayRequestLogSettingResponse,
  GatewayRequestLogListResponse,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayUpdateApiKeyRequest,
  GatewayQuotaDetailListResponse,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';

export const AGENT_GATEWAY_MANAGEMENT_CLIENT = Symbol('AGENT_GATEWAY_MANAGEMENT_CLIENT');

export interface AgentGatewayManagementClient {
  saveProfile(request: GatewaySaveConnectionProfileRequest): Promise<GatewayConnectionProfile>;
  checkConnection(): Promise<GatewayConnectionStatusResponse>;
  readRawConfig(): Promise<GatewayRawConfigResponse>;
  diffRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayConfigDiffResponse>;
  saveRawConfig(request: GatewaySaveRawConfigRequest): Promise<GatewayRawConfigResponse>;
  reloadConfig(): Promise<GatewayReloadConfigResponse>;
  listApiKeys(): Promise<GatewayApiKeyListResponse>;
  replaceApiKeys(request: GatewayReplaceApiKeysRequest): Promise<GatewayApiKeyListResponse>;
  updateApiKey(request: GatewayUpdateApiKeyRequest): Promise<GatewayApiKeyListResponse>;
  deleteApiKey(request: GatewayDeleteApiKeyRequest): Promise<GatewayApiKeyListResponse>;
  listProviderConfigs(): Promise<GatewayProviderSpecificConfigListResponse>;
  saveProviderConfig(request: GatewayProviderSpecificConfigRecord): Promise<GatewayProviderSpecificConfigRecord>;
  discoverProviderModels(providerId: string): Promise<GatewaySystemModelsResponse>;
  testProviderModel(providerId: string, model: string): Promise<GatewayProbeResponse>;
  listAuthFiles(query: GatewayAuthFileListQuery): Promise<GatewayAuthFileListResponse>;
  batchUploadAuthFiles(request: GatewayAuthFileBatchUploadRequest): Promise<GatewayAuthFileBatchUploadResponse>;
  patchAuthFileFields(request: GatewayAuthFilePatchRequest): Promise<GatewayAuthFile>;
  listAuthFileModels(authFileId: string): Promise<GatewayAuthFileModelListResponse>;
  downloadAuthFile(authFileId: string): Promise<string>;
  deleteAuthFiles(request: GatewayAuthFileDeleteRequest): Promise<GatewayAuthFileDeleteResponse>;
  listOAuthModelAliases(providerId: string): Promise<GatewayOAuthModelAliasListResponse>;
  saveOAuthModelAliases(request: GatewayUpdateOAuthModelAliasRulesRequest): Promise<GatewayOAuthModelAliasListResponse>;
  getOAuthStatus(state: string): Promise<GatewayOAuthStatusResponse>;
  submitOAuthCallback(request: GatewayOAuthCallbackRequest): Promise<GatewayOAuthCallbackResponse>;
  startGeminiCliOAuth(request: GatewayGeminiCliOAuthStartRequest): Promise<GatewayStartOAuthProjection>;
  importVertexCredential(request: GatewayVertexCredentialImportRequest): Promise<GatewayVertexCredentialImportResponse>;
  managementApiCall(request: GatewayManagementApiCallRequest): Promise<GatewayManagementApiCallResponse>;
  refreshQuotaDetails(providerKind: GatewayProviderKind): Promise<GatewayQuotaDetailListResponse>;
  listQuotaDetails(): Promise<GatewayQuotaDetailListResponse>;
  tailLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse>;
  searchLogs(request: GatewayLogSearchRequest): Promise<GatewayRequestLogListResponse>;
  listRequestErrorFiles(): Promise<GatewayLogFileListResponse>;
  downloadRequestLog(id: string): Promise<string>;
  downloadRequestErrorFile(fileName: string): Promise<string>;
  clearLogs(): Promise<GatewayClearLogsResponse>;
  systemInfo(): Promise<GatewaySystemVersionResponse>;
  latestVersion(): Promise<GatewaySystemVersionResponse>;
  setRequestLogEnabled(enabled: boolean): Promise<GatewayRequestLogSettingResponse>;
  clearLoginStorage(): Promise<GatewayClearLoginStorageResponse>;
  discoverModels(): Promise<GatewaySystemModelsResponse>;
}

export interface GatewayAuthFileListQuery {
  query?: string;
  providerKind?: string;
  cursor?: string;
  limit?: number;
}

export interface GatewayStartOAuthProjection {
  state: string;
  verificationUri: string;
  userCode?: string;
  expiresAt: string;
  projectId?: string;
}
