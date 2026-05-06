import { z } from 'zod';

export const KnowledgeBaseStatusSchema = z.enum(['active', 'archived']);

export const KnowledgeBaseMemberRoleSchema = z.enum(['owner', 'editor', 'viewer']);

export const KnowledgeServiceUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1)
});

export const KnowledgeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  createdByUserId: z.string().min(1),
  status: KnowledgeBaseStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeBaseCreateRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('')
});

export const KnowledgeBaseMemberSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  userId: z.string().min(1),
  role: KnowledgeBaseMemberRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const KnowledgeBaseMemberCreateRequestSchema = z.object({
  userId: z.string().min(1),
  role: KnowledgeBaseMemberRoleSchema
});

export const KnowledgeBaseMemberUpdateRequestSchema = z.object({
  role: KnowledgeBaseMemberRoleSchema
});

const NonNegativeIntegerSchema = z.number().int().nonnegative();
const PercentScoreSchema = z.number().min(0).max(100);

export const KnowledgeProviderHealthStatusSchema = z.enum(['ok', 'degraded', 'unconfigured']);

export const KnowledgeGovernanceProviderSchema = z.enum(['embedding', 'vector', 'keyword', 'generation']);

export const KnowledgeGovernanceIngestionSourceStatusSchema = z.enum(['active', 'paused', 'failed', 'unknown']);

export const KnowledgeGovernanceSummarySchema = z.object({
  knowledgeBaseCount: NonNegativeIntegerSchema,
  documentCount: NonNegativeIntegerSchema,
  readyDocumentCount: NonNegativeIntegerSchema,
  failedJobCount: NonNegativeIntegerSchema,
  warningCount: NonNegativeIntegerSchema
});

export const KnowledgeGovernanceProviderHealthSchema = z.object({
  provider: KnowledgeGovernanceProviderSchema,
  status: KnowledgeProviderHealthStatusSchema,
  warningCount: NonNegativeIntegerSchema,
  reason: z.string().min(1).optional()
});

export const KnowledgeGovernanceIngestionSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceType: z.string().min(1),
  status: KnowledgeGovernanceIngestionSourceStatusSchema,
  indexedDocumentCount: NonNegativeIntegerSchema,
  failedDocumentCount: NonNegativeIntegerSchema
});

export const KnowledgeGovernanceRetrievalDiagnosticSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  retrievalMode: z.string().min(1),
  hitCount: NonNegativeIntegerSchema,
  totalCount: NonNegativeIntegerSchema,
  failedRetrieverCount: NonNegativeIntegerSchema
});

export const KnowledgeGovernanceAgentUsageSchema = z.object({
  agentId: z.string().min(1),
  agentLabel: z.string().min(1),
  knowledgeBaseIds: z.array(z.string().min(1)),
  recentRunCount: NonNegativeIntegerSchema,
  evidenceCount: NonNegativeIntegerSchema
});

export const KnowledgeGovernanceProjectionSchema = z.object({
  summary: KnowledgeGovernanceSummarySchema,
  providerHealth: z.array(KnowledgeGovernanceProviderHealthSchema),
  ingestionSources: z.array(KnowledgeGovernanceIngestionSourceSchema),
  retrievalDiagnostics: z.array(KnowledgeGovernanceRetrievalDiagnosticSchema),
  agentUsage: z.array(KnowledgeGovernanceAgentUsageSchema),
  updatedAt: z.string().datetime()
});

export const KnowledgeWorkspaceUserRoleSchema = z.enum(['admin', 'editor', 'viewer']);

export const KnowledgeWorkspaceUserStatusSchema = z.enum(['active', 'inactive', 'pending']);

export const KnowledgeWorkspaceUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: KnowledgeWorkspaceUserRoleSchema,
  status: KnowledgeWorkspaceUserStatusSchema,
  department: z.string().min(1).optional(),
  avatarUrl: z.string().min(1).optional(),
  kbAccessCount: NonNegativeIntegerSchema,
  queryCount: NonNegativeIntegerSchema,
  lastActiveAt: z.string().datetime().nullable()
});

export const KnowledgeWorkspaceUsersSummarySchema = z.object({
  totalUsers: NonNegativeIntegerSchema,
  activeUsers: NonNegativeIntegerSchema,
  adminUsers: NonNegativeIntegerSchema,
  pendingUsers: NonNegativeIntegerSchema
});

export const KnowledgeWorkspaceUsersResponseSchema = z.object({
  items: z.array(KnowledgeWorkspaceUserSchema),
  total: NonNegativeIntegerSchema,
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
  summary: KnowledgeWorkspaceUsersSummarySchema
});

export const KnowledgeWorkspaceInvitationCreateRequestSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  role: KnowledgeWorkspaceUserRoleSchema,
  department: z.string().min(1).optional()
});

export const KnowledgeWorkspaceInvitationCreateResponseSchema = z.object({
  invitationIds: z.array(z.string().min(1)),
  invitedUsers: z.array(KnowledgeWorkspaceUserSchema),
  inviteLink: z.string().url(),
  expiresAt: z.string().datetime()
});

export const KnowledgeModelProviderStatusSchema = z.enum(['connected', 'disconnected', 'error']);

export const KnowledgeModelCapabilitySchema = z.enum(['chat', 'embedding', 'rerank', 'vision']);

export const KnowledgeModelSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  capabilities: z.array(KnowledgeModelCapabilitySchema).min(1),
  contextWindow: NonNegativeIntegerSchema.optional()
});

export const KnowledgeModelProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: KnowledgeModelProviderStatusSchema,
  models: z.array(KnowledgeModelSummarySchema),
  defaultModelId: z.string().min(1).optional(),
  configuredAt: z.string().datetime().optional()
});

export const KnowledgeModelProvidersResponseSchema = z.object({
  items: z.array(KnowledgeModelProviderSchema),
  updatedAt: z.string().datetime()
});

export const KnowledgeApiKeyPermissionSchema = z.enum([
  'knowledge:read',
  'knowledge:write',
  'users:manage',
  'settings:manage'
]);

export const KnowledgeApiKeyStatusSchema = z.enum(['active', 'revoked']);

export const KnowledgeApiKeySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maskedKey: z.string().min(1),
  status: KnowledgeApiKeyStatusSchema,
  permissions: z.array(KnowledgeApiKeyPermissionSchema).min(1),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable().optional()
});

export const KnowledgeApiKeysResponseSchema = z.object({
  items: z.array(KnowledgeApiKeySchema)
});

export const KnowledgeApiKeyCreateRequestSchema = z.object({
  name: z.string().min(1),
  permissions: z.array(KnowledgeApiKeyPermissionSchema).min(1),
  expiresAt: z.string().datetime().optional()
});

export const KnowledgeApiKeyCreateResponseSchema = z.object({
  apiKey: KnowledgeApiKeySchema
});

export const KnowledgeStorageBucketSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  used: z.number().nonnegative(),
  total: z.number().positive(),
  unit: z.enum(['MB', 'GB', 'TB'])
});

export const KnowledgeStorageKnowledgeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  documentCount: NonNegativeIntegerSchema,
  storageUsed: z.number().nonnegative(),
  storageUnit: z.enum(['MB', 'GB', 'TB']),
  vectorIndexSize: z.string().min(1),
  lastBackupAt: z.string().datetime().nullable()
});

export const KnowledgeStorageSettingsResponseSchema = z.object({
  buckets: z.array(KnowledgeStorageBucketSchema),
  knowledgeBases: z.array(KnowledgeStorageKnowledgeBaseSchema),
  updatedAt: z.string().datetime()
});

export const KnowledgePasswordPolicySchema = z.enum(['basic', 'strong', 'enterprise']);

export const KnowledgeEncryptionSettingsSchema = z.object({
  enabled: z.boolean(),
  transport: z.string().min(1),
  atRest: z.string().min(1)
});

export const KnowledgeSecuritySettingsResponseSchema = z.object({
  ssoEnabled: z.boolean(),
  mfaRequired: z.boolean(),
  ipAllowlistEnabled: z.boolean(),
  ipAllowlist: z.array(z.string().min(1)),
  auditLogEnabled: z.boolean(),
  passwordPolicy: KnowledgePasswordPolicySchema,
  encryption: KnowledgeEncryptionSettingsSchema,
  securityScore: PercentScoreSchema,
  updatedAt: z.string().datetime()
});

export const KnowledgeSecuritySettingsPatchRequestSchema = z
  .object({
    ssoEnabled: z.boolean().optional(),
    mfaRequired: z.boolean().optional(),
    ipAllowlistEnabled: z.boolean().optional(),
    ipAllowlist: z.array(z.string().min(1)).optional(),
    auditLogEnabled: z.boolean().optional(),
    passwordPolicy: KnowledgePasswordPolicySchema.optional()
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one setting must be provided.' });

export const KnowledgeAssistantThinkingStepStatusSchema = z.enum(['pending', 'running', 'done']);

export const KnowledgeAssistantThinkingStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: KnowledgeAssistantThinkingStepStatusSchema
});

export const KnowledgeAssistantConfigResponseSchema = z.object({
  deepThinkEnabled: z.boolean(),
  webSearchEnabled: z.boolean(),
  modelProfileId: z.string().min(1),
  defaultKnowledgeBaseIds: z.array(z.string().min(1)),
  quickPrompts: z.array(z.string().min(1)),
  thinkingSteps: z.array(KnowledgeAssistantThinkingStepSchema),
  updatedAt: z.string().datetime()
});

export const KnowledgeAssistantConfigPatchRequestSchema = z
  .object({
    deepThinkEnabled: z.boolean().optional(),
    webSearchEnabled: z.boolean().optional(),
    modelProfileId: z.string().min(1).optional(),
    defaultKnowledgeBaseIds: z.array(z.string().min(1)).optional(),
    quickPrompts: z.array(z.string().min(1)).optional()
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one assistant setting must be provided.' });

export const KnowledgeMeResponseSchema = z.object({
  user: KnowledgeServiceUserSchema
});

export const KnowledgeBasesListResponseSchema = z.object({
  bases: z.array(KnowledgeBaseSchema)
});

export const KnowledgeBaseResponseSchema = z.object({
  base: KnowledgeBaseSchema
});

export const KnowledgeBaseMembersResponseSchema = z.object({
  members: z.array(KnowledgeBaseMemberSchema)
});

export const KnowledgeServiceErrorCodeSchema = z.enum([
  'auth_required',
  'auth_forbidden',
  'knowledge_base_not_found',
  'knowledge_permission_denied',
  'member_not_found',
  'invalid_member_role',
  'internal_error'
]);

export const KnowledgeServiceErrorResponseSchema = z.object({
  error: z.object({
    code: KnowledgeServiceErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1)
  })
});
