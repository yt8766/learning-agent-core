import type { z } from 'zod';
import type {
  GatewayAccountingRequestSchema,
  GatewayAccountingResponseSchema,
  GatewayApiKeyListResponseSchema,
  GatewayApiKeySchema,
  GatewayApiKeyStatusSchema,
  GatewayApiKeyUsageSchema,
  GatewayAuthErrorCodeSchema,
  GatewayAuthErrorSchema,
  GatewayCompleteOAuthRequestSchema,
  GatewayCompleteOAuthResponseSchema,
  GatewayCredentialFileSchema,
  GatewayDeleteApiKeyRequestSchema,
  GatewayDeleteCredentialFileRequestSchema,
  GatewayDeleteProviderRequestSchema,
  GatewayConfigDiffResponseSchema,
  GatewayConfigSchema,
  GatewayConfigValueSchema,
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayConnectionStatusSchema,
  GatewayCreateApiKeyRequestSchema,
  GatewayLogEntrySchema,
  GatewayLogListResponseSchema,
  GatewayLoginRequestSchema,
  GatewayLoginResponseSchema,
  GatewayPreprocessRequestSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeRequestSchema,
  GatewayProbeResponseSchema,
  GatewayProviderConfigListResponseSchema,
  GatewayProviderConfigSchema,
  GatewayProviderCredentialSetSchema,
  GatewayProviderKindSchema,
  GatewayQuotaSchema,
  GatewayRawConfigResponseSchema,
  GatewayRefreshRequestSchema,
  GatewayRefreshResponseSchema,
  GatewayReplaceApiKeysRequestSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRelayMessageSchema,
  GatewayRelayRequestSchema,
  GatewayRelayResponseSchema,
  GatewayRelayUsageSchema,
  GatewaySaveConnectionProfileRequestSchema,
  GatewaySaveRawConfigRequestSchema,
  GatewayRuntimeStatusSchema,
  GatewaySessionSchema,
  GatewaySnapshotSchema,
  GatewayStartOAuthRequestSchema,
  GatewayStartOAuthResponseSchema,
  GatewayTokenCountRequestSchema,
  GatewayTokenCountResponseSchema,
  GatewayUpdateApiKeyRequestSchema,
  GatewayUpdateConfigRequestSchema,
  GatewayUpdateQuotaRequestSchema,
  GatewayUpsertCredentialFileRequestSchema,
  GatewayUpsertProviderConfigRequestSchema,
  GatewayUpsertProviderRequestSchema,
  GatewayUsageListResponseSchema,
  GatewayUsageRecordSchema,
  GatewayUserSchema
} from './agent-gateway.schemas';
import type {
  GatewayAvailableModelSchema,
  GatewayAuthFileAcceptedUploadSchema,
  GatewayAuthFileBatchUploadRequestSchema,
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFilePatchRequestSchema,
  GatewayAuthFileRejectedUploadSchema,
  GatewayAuthFileSchema,
  GatewayAuthFileStatusSchema,
  GatewayAuthFileUploadItemSchema,
  GatewayClearLogsResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayLogFileSchema,
  GatewayLogSearchRequestSchema,
  GatewayOAuthModelAliasesResponseSchema,
  GatewayOAuthPolicySchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayQuotaDetailSchema,
  GatewayRequestLogEntrySchema,
  GatewayRequestLogListResponseSchema,
  GatewaySystemModelGroupSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayUpdateOAuthModelAliasesRequestSchema,
  GatewayUpdateOAuthPolicyRequestSchema
} from './agent-gateway-management-projections.schemas';
import type {
  GatewayClientApiKeyListResponseSchema,
  GatewayClientApiKeySchema,
  GatewayClientApiKeyScopeSchema,
  GatewayClientApiKeyStatusSchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayClientRequestLogSchema,
  GatewayClientSchema,
  GatewayClientStatusSchema,
  GatewayClientUsageSummarySchema,
  GatewayCreateClientApiKeyRequestSchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayCreateClientRequestSchema,
  GatewayOpenAIChatCompletionRequestSchema,
  GatewayOpenAIChatCompletionResponseSchema,
  GatewayOpenAIChatMessageSchema,
  GatewayOpenAICompatibleErrorResponseSchema,
  GatewayOpenAIModelSchema,
  GatewayOpenAIModelsResponseSchema,
  GatewayUpdateClientApiKeyRequestSchema,
  GatewayUpdateClientQuotaRequestSchema,
  GatewayUpdateClientRequestSchema
} from './agent-gateway-internal-cli-proxy.schemas';
import type {
  GatewayAmpcodeConfigResponseSchema,
  GatewayAmpcodeModelMappingSchema,
  GatewayAmpcodeUpstreamApiKeyMappingSchema,
  GatewayAuthFileDeleteRequestSchema,
  GatewayAuthFileDeleteResponseSchema,
  GatewayClearLoginStorageResponseSchema,
  GatewayCloakPolicySchema,
  GatewayDashboardProviderSummarySchema,
  GatewayDashboardRoutingSummarySchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayGeminiCliOAuthStartRequestSchema,
  GatewayManagementApiCallMethodSchema,
  GatewayManagementApiCallRequestSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayModelAliasRuleSchema,
  GatewayOAuthCallbackRequestSchema,
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthModelAliasRuleSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayProviderOAuthStartProviderSchema,
  GatewayProviderOAuthStartRequestSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderCredentialSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayProviderTypeSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewayUpdateAmpcodeForceModelMappingsRequestSchema,
  GatewayUpdateAmpcodeModelMappingsRequestSchema,
  GatewayUpdateAmpcodeUpstreamApiKeyRequestSchema,
  GatewayUpdateAmpcodeUpstreamApiKeysRequestSchema,
  GatewayUpdateAmpcodeUpstreamUrlRequestSchema,
  GatewayUpdateOAuthModelAliasRulesRequestSchema,
  GatewayVertexCredentialImportRequestSchema,
  GatewayVertexCredentialImportResponseSchema
} from './agent-gateway-cli-proxy-parity.schemas';
export type GatewayUser = z.infer<typeof GatewayUserSchema>;
export type GatewaySession = z.infer<typeof GatewaySessionSchema>;
export type GatewayAuthErrorCode = z.infer<typeof GatewayAuthErrorCodeSchema>;
export type GatewayAuthError = z.infer<typeof GatewayAuthErrorSchema>;
export type GatewayLoginRequest = z.infer<typeof GatewayLoginRequestSchema>;
export type GatewayLoginResponse = z.infer<typeof GatewayLoginResponseSchema>;
export type GatewayRefreshRequest = z.infer<typeof GatewayRefreshRequestSchema>;
export type GatewayRefreshResponse = z.infer<typeof GatewayRefreshResponseSchema>;
export type GatewayProviderCredentialSet = z.infer<typeof GatewayProviderCredentialSetSchema>;
export type GatewayCredentialFile = z.infer<typeof GatewayCredentialFileSchema>;
export type GatewayQuota = z.infer<typeof GatewayQuotaSchema>;
export type GatewayRuntimeStatus = z.infer<typeof GatewayRuntimeStatusSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type GatewaySnapshot = z.infer<typeof GatewaySnapshotSchema>;
export type GatewayLogEntry = z.infer<typeof GatewayLogEntrySchema>;
export type GatewayUsageRecord = z.infer<typeof GatewayUsageRecordSchema>;
export type GatewayLogListResponse = z.infer<typeof GatewayLogListResponseSchema>;
export type GatewayUsageListResponse = z.infer<typeof GatewayUsageListResponseSchema>;
export type GatewayProbeRequest = z.infer<typeof GatewayProbeRequestSchema>;
export type GatewayProbeResponse = z.infer<typeof GatewayProbeResponseSchema>;
export type GatewayTokenCountRequest = z.infer<typeof GatewayTokenCountRequestSchema>;
export type GatewayTokenCountResponse = z.infer<typeof GatewayTokenCountResponseSchema>;
export type GatewayPreprocessRequest = z.infer<typeof GatewayPreprocessRequestSchema>;
export type GatewayPreprocessResponse = z.infer<typeof GatewayPreprocessResponseSchema>;
export type GatewayAccountingRequest = z.infer<typeof GatewayAccountingRequestSchema>;
export type GatewayAccountingResponse = z.infer<typeof GatewayAccountingResponseSchema>;
export type GatewayUpdateConfigRequest = z.infer<typeof GatewayUpdateConfigRequestSchema>;
export type GatewayUpsertProviderRequest = z.infer<typeof GatewayUpsertProviderRequestSchema>;
export type GatewayDeleteProviderRequest = z.infer<typeof GatewayDeleteProviderRequestSchema>;
export type GatewayUpsertCredentialFileRequest = z.infer<typeof GatewayUpsertCredentialFileRequestSchema>;
export type GatewayDeleteCredentialFileRequest = z.infer<typeof GatewayDeleteCredentialFileRequestSchema>;
export type GatewayUpdateQuotaRequest = z.infer<typeof GatewayUpdateQuotaRequestSchema>;
export type GatewayRelayMessage = z.infer<typeof GatewayRelayMessageSchema>;
export type GatewayRelayRequest = z.infer<typeof GatewayRelayRequestSchema>;
export type GatewayRelayUsage = z.infer<typeof GatewayRelayUsageSchema>;
export type GatewayRelayResponse = z.infer<typeof GatewayRelayResponseSchema>;
export type GatewayStartOAuthRequest = z.infer<typeof GatewayStartOAuthRequestSchema>;
export type GatewayStartOAuthResponse = z.infer<typeof GatewayStartOAuthResponseSchema>;
export type GatewayCompleteOAuthRequest = z.infer<typeof GatewayCompleteOAuthRequestSchema>;
export type GatewayCompleteOAuthResponse = z.infer<typeof GatewayCompleteOAuthResponseSchema>;
export type GatewayConnectionStatus = z.infer<typeof GatewayConnectionStatusSchema>;
export type GatewaySaveConnectionProfileRequest = z.infer<typeof GatewaySaveConnectionProfileRequestSchema>;
export type GatewayConnectionProfile = z.infer<typeof GatewayConnectionProfileSchema>;
export type GatewayConnectionStatusResponse = z.infer<typeof GatewayConnectionStatusResponseSchema>;
export type GatewayRawConfigResponse = z.infer<typeof GatewayRawConfigResponseSchema>;
export type GatewaySaveRawConfigRequest = z.infer<typeof GatewaySaveRawConfigRequestSchema>;
export type GatewayConfigDiffResponse = z.infer<typeof GatewayConfigDiffResponseSchema>;
export type GatewayReloadConfigResponse = z.infer<typeof GatewayReloadConfigResponseSchema>;
export type GatewayApiKeyStatus = z.infer<typeof GatewayApiKeyStatusSchema>;
export type GatewayApiKeyUsage = z.infer<typeof GatewayApiKeyUsageSchema>;
export type GatewayApiKey = z.infer<typeof GatewayApiKeySchema>;
export type GatewayCreateApiKeyRequest = z.infer<typeof GatewayCreateApiKeyRequestSchema>;
export type GatewayUpdateApiKeyRequest = z.infer<typeof GatewayUpdateApiKeyRequestSchema>;
export type GatewayReplaceApiKeysRequest = z.infer<typeof GatewayReplaceApiKeysRequestSchema>;
export type GatewayDeleteApiKeyRequest = z.infer<typeof GatewayDeleteApiKeyRequestSchema>;
export type GatewayApiKeyListResponse = z.infer<typeof GatewayApiKeyListResponseSchema>;
export type GatewayProviderKind = z.infer<typeof GatewayProviderKindSchema>;
export type GatewayConfigValue = z.infer<typeof GatewayConfigValueSchema>;
export type GatewayProviderConfig = z.infer<typeof GatewayProviderConfigSchema>;
export type GatewayUpsertProviderConfigRequest = z.infer<typeof GatewayUpsertProviderConfigRequestSchema>;
export type GatewayProviderConfigListResponse = z.infer<typeof GatewayProviderConfigListResponseSchema>;
export type GatewayAuthFileStatus = z.infer<typeof GatewayAuthFileStatusSchema>;
export type GatewayAuthFileUploadItem = z.infer<typeof GatewayAuthFileUploadItemSchema>;
export type GatewayAuthFileBatchUploadRequest = z.infer<typeof GatewayAuthFileBatchUploadRequestSchema>;
export type GatewayAuthFileAcceptedUpload = z.infer<typeof GatewayAuthFileAcceptedUploadSchema>;
export type GatewayAuthFileRejectedUpload = z.infer<typeof GatewayAuthFileRejectedUploadSchema>;
export type GatewayAuthFileBatchUploadResponse = z.infer<typeof GatewayAuthFileBatchUploadResponseSchema>;
export type GatewayAuthFile = z.infer<typeof GatewayAuthFileSchema>;
export type GatewayAuthFileListResponse = z.infer<typeof GatewayAuthFileListResponseSchema>;
export type GatewayAuthFilePatchRequest = z.infer<typeof GatewayAuthFilePatchRequestSchema>;
export type GatewayAvailableModel = z.infer<typeof GatewayAvailableModelSchema>;
export type GatewayAuthFileModelListResponse = z.infer<typeof GatewayAuthFileModelListResponseSchema>;
export type GatewayOAuthPolicy = z.infer<typeof GatewayOAuthPolicySchema>;
export type GatewayUpdateOAuthPolicyRequest = z.infer<typeof GatewayUpdateOAuthPolicyRequestSchema>;
export type GatewayOAuthModelAliasesResponse = z.infer<typeof GatewayOAuthModelAliasesResponseSchema>;
export type GatewayUpdateOAuthModelAliasesRequest = z.infer<typeof GatewayUpdateOAuthModelAliasesRequestSchema>;
export type GatewayQuotaDetail = z.infer<typeof GatewayQuotaDetailSchema>;
export type GatewayQuotaDetailListResponse = z.infer<typeof GatewayQuotaDetailListResponseSchema>;
export type GatewayLogFile = z.infer<typeof GatewayLogFileSchema>;
export type GatewayLogFileListResponse = z.infer<typeof GatewayLogFileListResponseSchema>;
export type GatewayLogSearchRequest = z.infer<typeof GatewayLogSearchRequestSchema>;
export type GatewayClearLogsResponse = z.infer<typeof GatewayClearLogsResponseSchema>;
export type GatewayRequestLogEntry = z.infer<typeof GatewayRequestLogEntrySchema>;
export type GatewayRequestLogListResponse = z.infer<typeof GatewayRequestLogListResponseSchema>;
export type GatewaySystemVersionResponse = z.infer<typeof GatewaySystemVersionResponseSchema>;
export type GatewaySystemModelGroup = z.infer<typeof GatewaySystemModelGroupSchema>;
export type GatewaySystemModelsResponse = z.infer<typeof GatewaySystemModelsResponseSchema>;
export type GatewayClientStatus = z.infer<typeof GatewayClientStatusSchema>;
export type GatewayClient = z.infer<typeof GatewayClientSchema>;
export type GatewayClientListResponse = z.infer<typeof GatewayClientListResponseSchema>;
export type GatewayCreateClientRequest = z.infer<typeof GatewayCreateClientRequestSchema>;
export type GatewayUpdateClientRequest = z.infer<typeof GatewayUpdateClientRequestSchema>;
export type GatewayClientApiKeyStatus = z.infer<typeof GatewayClientApiKeyStatusSchema>;
export type GatewayClientApiKeyScope = z.infer<typeof GatewayClientApiKeyScopeSchema>;
export type GatewayClientApiKey = z.infer<typeof GatewayClientApiKeySchema>;
export type GatewayClientApiKeyListResponse = z.infer<typeof GatewayClientApiKeyListResponseSchema>;
export type GatewayCreateClientApiKeyRequest = z.infer<typeof GatewayCreateClientApiKeyRequestSchema>;
export type GatewayUpdateClientApiKeyRequest = z.infer<typeof GatewayUpdateClientApiKeyRequestSchema>;
export type GatewayCreateClientApiKeyResponse = z.infer<typeof GatewayCreateClientApiKeyResponseSchema>;
export type GatewayClientQuota = z.infer<typeof GatewayClientQuotaSchema>;
export type GatewayUpdateClientQuotaRequest = z.infer<typeof GatewayUpdateClientQuotaRequestSchema>;
export type GatewayClientUsageSummary = z.infer<typeof GatewayClientUsageSummarySchema>;
export type GatewayClientRequestLog = z.infer<typeof GatewayClientRequestLogSchema>;
export type GatewayClientRequestLogListResponse = z.infer<typeof GatewayClientRequestLogListResponseSchema>;
export type GatewayOpenAIChatMessage = z.infer<typeof GatewayOpenAIChatMessageSchema>;
export type GatewayOpenAIChatCompletionRequest = z.infer<typeof GatewayOpenAIChatCompletionRequestSchema>;
export type GatewayOpenAIChatCompletionResponse = z.infer<typeof GatewayOpenAIChatCompletionResponseSchema>;
export type GatewayOpenAIModel = z.infer<typeof GatewayOpenAIModelSchema>;
export type GatewayOpenAIModelsResponse = z.infer<typeof GatewayOpenAIModelsResponseSchema>;
export type GatewayOpenAICompatibleErrorResponse = z.infer<typeof GatewayOpenAICompatibleErrorResponseSchema>;
export type GatewayDashboardProviderSummary = z.infer<typeof GatewayDashboardProviderSummarySchema>;
export type GatewayDashboardRoutingSummary = z.infer<typeof GatewayDashboardRoutingSummarySchema>;
export type GatewayDashboardSummaryResponse = z.infer<typeof GatewayDashboardSummaryResponseSchema>;
export type GatewayProviderType = z.infer<typeof GatewayProviderTypeSchema>;
export type GatewayModelAliasRule = z.infer<typeof GatewayModelAliasRuleSchema>;
export type GatewayCloakPolicy = z.infer<typeof GatewayCloakPolicySchema>;
export type GatewayProviderCredential = z.infer<typeof GatewayProviderCredentialSchema>;
export type GatewayProviderSpecificConfigRecord = z.infer<typeof GatewayProviderSpecificConfigRecordSchema>;
export type GatewayProviderSpecificConfigListResponse = z.infer<typeof GatewayProviderSpecificConfigListResponseSchema>;
export type GatewayOAuthModelAliasRule = z.infer<typeof GatewayOAuthModelAliasRuleSchema>;
export type GatewayOAuthModelAliasListResponse = z.infer<typeof GatewayOAuthModelAliasListResponseSchema>;
export type GatewayUpdateOAuthModelAliasRulesRequest = z.infer<typeof GatewayUpdateOAuthModelAliasRulesRequestSchema>;
export type GatewayVertexCredentialImportRequest = z.infer<typeof GatewayVertexCredentialImportRequestSchema>;
export type GatewayVertexCredentialImportResponse = z.infer<typeof GatewayVertexCredentialImportResponseSchema>;
export type GatewayAuthFileDeleteRequest = z.infer<typeof GatewayAuthFileDeleteRequestSchema>;
export type GatewayAuthFileDeleteResponse = z.infer<typeof GatewayAuthFileDeleteResponseSchema>;
export type GatewayOAuthStatusResponse = z.infer<typeof GatewayOAuthStatusResponseSchema>;
export type GatewayOAuthCallbackRequest = z.infer<typeof GatewayOAuthCallbackRequestSchema>;
export type GatewayOAuthCallbackResponse = z.infer<typeof GatewayOAuthCallbackResponseSchema>;
export type GatewayProviderOAuthStartProvider = z.infer<typeof GatewayProviderOAuthStartProviderSchema>;
export type GatewayProviderOAuthStartRequest = z.infer<typeof GatewayProviderOAuthStartRequestSchema>;
export type GatewayProviderOAuthStartResponse = z.infer<typeof GatewayProviderOAuthStartResponseSchema>;
export type GatewayGeminiCliOAuthStartRequest = z.infer<typeof GatewayGeminiCliOAuthStartRequestSchema>;
export type GatewayRequestLogSettingResponse = z.infer<typeof GatewayRequestLogSettingResponseSchema>;
export type GatewayClearLoginStorageResponse = z.infer<typeof GatewayClearLoginStorageResponseSchema>;
export type GatewayManagementApiCallMethod = z.infer<typeof GatewayManagementApiCallMethodSchema>;
export type GatewayManagementApiCallRequest = z.infer<typeof GatewayManagementApiCallRequestSchema>;
export type GatewayManagementApiCallResponse = z.infer<typeof GatewayManagementApiCallResponseSchema>;
export type GatewayAmpcodeUpstreamApiKeyMapping = z.infer<typeof GatewayAmpcodeUpstreamApiKeyMappingSchema>;
export type GatewayAmpcodeModelMapping = z.infer<typeof GatewayAmpcodeModelMappingSchema>;
export type GatewayAmpcodeConfigResponse = z.infer<typeof GatewayAmpcodeConfigResponseSchema>;
export type GatewayUpdateAmpcodeUpstreamUrlRequest = z.infer<typeof GatewayUpdateAmpcodeUpstreamUrlRequestSchema>;
export type GatewayUpdateAmpcodeUpstreamApiKeyRequest = z.infer<typeof GatewayUpdateAmpcodeUpstreamApiKeyRequestSchema>;
export type GatewayUpdateAmpcodeUpstreamApiKeysRequest = z.infer<
  typeof GatewayUpdateAmpcodeUpstreamApiKeysRequestSchema
>;
export type GatewayUpdateAmpcodeModelMappingsRequest = z.infer<typeof GatewayUpdateAmpcodeModelMappingsRequestSchema>;
export type GatewayUpdateAmpcodeForceModelMappingsRequest = z.infer<
  typeof GatewayUpdateAmpcodeForceModelMappingsRequestSchema
>;
