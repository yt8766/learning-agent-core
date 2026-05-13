import type {
  GatewayAccountingRequest,
  GatewayAccountingResponse,
  GatewayApiKey,
  GatewayApiKeyListResponse,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayClearLoginStorageResponse,
  GatewayClearLogsResponse,
  GatewayClient,
  GatewayClientApiKey,
  GatewayClientApiKeyListResponse,
  GatewayClientListResponse,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientRequestLogListResponse,
  GatewayClientUsageSummary,
  GatewayCompleteOAuthRequest,
  GatewayCompleteOAuthResponse,
  GatewayConfig,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientApiKeyResponse,
  GatewayCreateClientRequest,
  GatewayCredentialFile,
  GatewayDashboardSummaryResponse,
  GatewayGeminiCliOAuthStartRequest,
  GatewayLogFile,
  GatewayLogFileListResponse,
  GatewayLogListResponse,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayMigrationApplyResponse,
  GatewayMigrationPreview,
  GatewayOAuthCallbackRequest,
  GatewayOAuthCallbackResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayPreprocessRequest,
  GatewayPreprocessResponse,
  GatewayProbeRequest,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayProviderKind,
  GatewayProviderOAuthStartProvider,
  GatewayProviderOAuthStartResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayQuota,
  GatewayQuotaDetailListResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayRelayRequest,
  GatewayRelayResponse,
  GatewayReplaceApiKeysRequest,
  GatewayRequestLogSettingResponse,
  GatewayRuntimeHealthResponse,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewaySnapshot,
  GatewayStartOAuthRequest,
  GatewayStartOAuthResponse,
  GatewaySystemModelGroup,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayTokenCountRequest,
  GatewayTokenCountResponse,
  GatewayUpdateClientApiKeyRequest,
  GatewayUpdateClientQuotaRequest,
  GatewayUpdateClientRequest,
  GatewayUpdateConfigRequest,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayUpdateQuotaRequest,
  GatewayUpsertCredentialFileRequest,
  GatewayUpsertProviderRequest,
  GatewayUsageAnalyticsQuery,
  GatewayUsageAnalyticsResponse,
  GatewayUsageListResponse,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
} from '@agent/core';

export type {
  GatewayAccountingRequest,
  GatewayAccountingResponse,
  GatewayApiKey,
  GatewayApiKeyListResponse,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse,
  GatewayAuthFileListResponse,
  GatewayAuthFileModelListResponse,
  GatewayAuthFilePatchRequest,
  GatewayClearLoginStorageResponse,
  GatewayClearLogsResponse,
  GatewayClient,
  GatewayClientApiKey,
  GatewayClientApiKeyListResponse,
  GatewayClientListResponse,
  GatewayClientQuota,
  GatewayClientRequestLog,
  GatewayClientRequestLogListResponse,
  GatewayClientUsageSummary,
  GatewayCompleteOAuthRequest,
  GatewayCompleteOAuthResponse,
  GatewayConfig,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayCreateClientApiKeyRequest,
  GatewayCreateClientApiKeyResponse,
  GatewayCreateClientRequest,
  GatewayCredentialFile,
  GatewayDashboardSummaryResponse,
  GatewayGeminiCliOAuthStartRequest,
  GatewayLogFile,
  GatewayLogFileListResponse,
  GatewayLogListResponse,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewayMigrationApplyResponse,
  GatewayMigrationPreview,
  GatewayOAuthCallbackRequest,
  GatewayOAuthCallbackResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayPreprocessRequest,
  GatewayPreprocessResponse,
  GatewayProbeRequest,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayProviderKind,
  GatewayProviderOAuthStartProvider,
  GatewayProviderOAuthStartResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayQuota,
  GatewayQuotaDetailListResponse,
  GatewayRawConfigResponse,
  GatewayReloadConfigResponse,
  GatewayRelayRequest,
  GatewayRelayResponse,
  GatewayReplaceApiKeysRequest,
  GatewayRequestLogSettingResponse,
  GatewayRuntimeHealthResponse,
  GatewaySaveConnectionProfileRequest,
  GatewaySaveRawConfigRequest,
  GatewaySnapshot,
  GatewayStartOAuthRequest,
  GatewayStartOAuthResponse,
  GatewaySystemModelGroup,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayTokenCountRequest,
  GatewayTokenCountResponse,
  GatewayUpdateClientApiKeyRequest,
  GatewayUpdateClientQuotaRequest,
  GatewayUpdateClientRequest,
  GatewayUpdateConfigRequest,
  GatewayUpdateOAuthModelAliasRulesRequest,
  GatewayUpdateQuotaRequest,
  GatewayUpsertCredentialFileRequest,
  GatewayUpsertProviderRequest,
  GatewayUsageAnalyticsQuery,
  GatewayUsageAnalyticsResponse,
  GatewayUsageListResponse,
  GatewayVertexCredentialImportRequest,
  GatewayVertexCredentialImportResponse
};

export interface GatewayGeminiCliOAuthStartResponse {
  state: string;
  verificationUri: string;
  expiresAt: string;
}

export interface AgentGatewayApiClientOptions {
  baseUrl?: string;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
}

export interface ParseableSchema<T> {
  parse(payload: unknown): T;
}

export interface GatewayErrorPayload {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface GatewayAuthFileQuery {
  query?: string;
  providerKind?: GatewayProviderKind;
  cursor?: string;
  limit?: number;
}

export interface GatewayMigrationPreviewRequest {
  apiBase: string;
  managementKey: string;
  timeoutMs?: number;
}

export interface GatewayMigrationApplyRequest extends GatewayMigrationPreviewRequest {
  selectedSourceIds?: string[];
  confirmUnsafeConflicts?: boolean;
}
