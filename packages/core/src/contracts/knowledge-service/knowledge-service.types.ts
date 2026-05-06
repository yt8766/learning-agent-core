import type { z } from 'zod';

import type {
  KnowledgeBaseCreateRequestSchema,
  KnowledgeBaseMemberCreateRequestSchema,
  KnowledgeBaseMemberRoleSchema,
  KnowledgeBaseMemberSchema,
  KnowledgeBaseMembersResponseSchema,
  KnowledgeBaseMemberUpdateRequestSchema,
  KnowledgeBaseResponseSchema,
  KnowledgeBasesListResponseSchema,
  KnowledgeBaseSchema,
  KnowledgeBaseStatusSchema,
  KnowledgeGovernanceAgentUsageSchema,
  KnowledgeGovernanceIngestionSourceSchema,
  KnowledgeGovernanceIngestionSourceStatusSchema,
  KnowledgeGovernanceProjectionSchema,
  KnowledgeGovernanceProviderHealthSchema,
  KnowledgeGovernanceProviderSchema,
  KnowledgeGovernanceRetrievalDiagnosticSchema,
  KnowledgeGovernanceSummarySchema,
  KnowledgeApiKeyCreateRequestSchema,
  KnowledgeApiKeyCreateResponseSchema,
  KnowledgeApiKeyPermissionSchema,
  KnowledgeApiKeySchema,
  KnowledgeApiKeysResponseSchema,
  KnowledgeApiKeyStatusSchema,
  KnowledgeAssistantConfigPatchRequestSchema,
  KnowledgeAssistantConfigResponseSchema,
  KnowledgeAssistantThinkingStepSchema,
  KnowledgeAssistantThinkingStepStatusSchema,
  KnowledgeEncryptionSettingsSchema,
  KnowledgeMeResponseSchema,
  KnowledgeModelCapabilitySchema,
  KnowledgeModelProviderSchema,
  KnowledgeModelProvidersResponseSchema,
  KnowledgeModelProviderStatusSchema,
  KnowledgeModelSummarySchema,
  KnowledgePasswordPolicySchema,
  KnowledgeProviderHealthStatusSchema,
  KnowledgeSecuritySettingsPatchRequestSchema,
  KnowledgeSecuritySettingsResponseSchema,
  KnowledgeServiceErrorCodeSchema,
  KnowledgeServiceErrorResponseSchema,
  KnowledgeServiceUserSchema,
  KnowledgeStorageBucketSchema,
  KnowledgeStorageKnowledgeBaseSchema,
  KnowledgeStorageSettingsResponseSchema,
  KnowledgeWorkspaceInvitationCreateRequestSchema,
  KnowledgeWorkspaceInvitationCreateResponseSchema,
  KnowledgeWorkspaceUserRoleSchema,
  KnowledgeWorkspaceUserSchema,
  KnowledgeWorkspaceUsersResponseSchema,
  KnowledgeWorkspaceUsersSummarySchema,
  KnowledgeWorkspaceUserStatusSchema
} from './knowledge-service.schemas';

export type KnowledgeBaseStatus = z.infer<typeof KnowledgeBaseStatusSchema>;
export type KnowledgeBaseMemberRole = z.infer<typeof KnowledgeBaseMemberRoleSchema>;
export type KnowledgeServiceUser = z.infer<typeof KnowledgeServiceUserSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type KnowledgeBaseCreateRequest = z.infer<typeof KnowledgeBaseCreateRequestSchema>;
export type KnowledgeBaseMember = z.infer<typeof KnowledgeBaseMemberSchema>;
export type KnowledgeBaseMemberCreateRequest = z.infer<typeof KnowledgeBaseMemberCreateRequestSchema>;
export type KnowledgeBaseMemberUpdateRequest = z.infer<typeof KnowledgeBaseMemberUpdateRequestSchema>;
export type KnowledgeProviderHealthStatus = z.infer<typeof KnowledgeProviderHealthStatusSchema>;
export type KnowledgeGovernanceProvider = z.infer<typeof KnowledgeGovernanceProviderSchema>;
export type KnowledgeGovernanceIngestionSourceStatus = z.infer<typeof KnowledgeGovernanceIngestionSourceStatusSchema>;
export type KnowledgeGovernanceSummary = z.infer<typeof KnowledgeGovernanceSummarySchema>;
export type KnowledgeGovernanceProviderHealth = z.infer<typeof KnowledgeGovernanceProviderHealthSchema>;
export type KnowledgeGovernanceIngestionSource = z.infer<typeof KnowledgeGovernanceIngestionSourceSchema>;
export type KnowledgeGovernanceRetrievalDiagnostic = z.infer<typeof KnowledgeGovernanceRetrievalDiagnosticSchema>;
export type KnowledgeGovernanceAgentUsage = z.infer<typeof KnowledgeGovernanceAgentUsageSchema>;
export type KnowledgeGovernanceProjection = z.infer<typeof KnowledgeGovernanceProjectionSchema>;
export type KnowledgeWorkspaceUserRole = z.infer<typeof KnowledgeWorkspaceUserRoleSchema>;
export type KnowledgeWorkspaceUserStatus = z.infer<typeof KnowledgeWorkspaceUserStatusSchema>;
export type KnowledgeWorkspaceUser = z.infer<typeof KnowledgeWorkspaceUserSchema>;
export type KnowledgeWorkspaceUsersSummary = z.infer<typeof KnowledgeWorkspaceUsersSummarySchema>;
export type KnowledgeWorkspaceUsersResponse = z.infer<typeof KnowledgeWorkspaceUsersResponseSchema>;
export type KnowledgeWorkspaceInvitationCreateRequest = z.infer<typeof KnowledgeWorkspaceInvitationCreateRequestSchema>;
export type KnowledgeWorkspaceInvitationCreateResponse = z.infer<
  typeof KnowledgeWorkspaceInvitationCreateResponseSchema
>;
export type KnowledgeModelProviderStatus = z.infer<typeof KnowledgeModelProviderStatusSchema>;
export type KnowledgeModelCapability = z.infer<typeof KnowledgeModelCapabilitySchema>;
export type KnowledgeModelSummary = z.infer<typeof KnowledgeModelSummarySchema>;
export type KnowledgeModelProvider = z.infer<typeof KnowledgeModelProviderSchema>;
export type KnowledgeModelProvidersResponse = z.infer<typeof KnowledgeModelProvidersResponseSchema>;
export type KnowledgeApiKeyPermission = z.infer<typeof KnowledgeApiKeyPermissionSchema>;
export type KnowledgeApiKeyStatus = z.infer<typeof KnowledgeApiKeyStatusSchema>;
export type KnowledgeApiKey = z.infer<typeof KnowledgeApiKeySchema>;
export type KnowledgeApiKeysResponse = z.infer<typeof KnowledgeApiKeysResponseSchema>;
export type KnowledgeApiKeyCreateRequest = z.infer<typeof KnowledgeApiKeyCreateRequestSchema>;
export type KnowledgeApiKeyCreateResponse = z.infer<typeof KnowledgeApiKeyCreateResponseSchema>;
export type KnowledgeStorageBucket = z.infer<typeof KnowledgeStorageBucketSchema>;
export type KnowledgeStorageKnowledgeBase = z.infer<typeof KnowledgeStorageKnowledgeBaseSchema>;
export type KnowledgeStorageSettingsResponse = z.infer<typeof KnowledgeStorageSettingsResponseSchema>;
export type KnowledgePasswordPolicy = z.infer<typeof KnowledgePasswordPolicySchema>;
export type KnowledgeEncryptionSettings = z.infer<typeof KnowledgeEncryptionSettingsSchema>;
export type KnowledgeSecuritySettingsResponse = z.infer<typeof KnowledgeSecuritySettingsResponseSchema>;
export type KnowledgeSecuritySettingsPatchRequest = z.infer<typeof KnowledgeSecuritySettingsPatchRequestSchema>;
export type KnowledgeAssistantThinkingStepStatus = z.infer<typeof KnowledgeAssistantThinkingStepStatusSchema>;
export type KnowledgeAssistantThinkingStep = z.infer<typeof KnowledgeAssistantThinkingStepSchema>;
export type KnowledgeAssistantConfigResponse = z.infer<typeof KnowledgeAssistantConfigResponseSchema>;
export type KnowledgeAssistantConfigPatchRequest = z.infer<typeof KnowledgeAssistantConfigPatchRequestSchema>;
export type KnowledgeMeResponse = z.infer<typeof KnowledgeMeResponseSchema>;
export type KnowledgeBasesListResponse = z.infer<typeof KnowledgeBasesListResponseSchema>;
export type KnowledgeBaseResponse = z.infer<typeof KnowledgeBaseResponseSchema>;
export type KnowledgeBaseMembersResponse = z.infer<typeof KnowledgeBaseMembersResponseSchema>;
export type KnowledgeServiceErrorCode = z.infer<typeof KnowledgeServiceErrorCodeSchema>;
export type KnowledgeServiceErrorResponse = z.infer<typeof KnowledgeServiceErrorResponseSchema>;
