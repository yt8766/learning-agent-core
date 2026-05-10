import { z } from 'zod';
import { GatewayConnectionStatusSchema, GatewayProviderKindSchema } from './agent-gateway.schemas';

export const GatewayDashboardProviderSummarySchema = z.object({
  providerKind: GatewayProviderKindSchema,
  configured: z.boolean(),
  enabled: z.number().int().nonnegative(),
  disabled: z.number().int().nonnegative(),
  modelCount: z.number().int().nonnegative()
});

export const GatewayDashboardRoutingSummarySchema = z.object({
  strategy: z.string(),
  forceModelPrefix: z.boolean(),
  requestRetry: z.number().int().nonnegative(),
  wsAuth: z.boolean(),
  proxyUrl: z.string().nullable()
});

export const GatewayDashboardSummaryResponseSchema = z.object({
  observedAt: z.string(),
  connection: z.object({
    status: GatewayConnectionStatusSchema,
    apiBase: z.string().url().nullable(),
    serverVersion: z.string().nullable(),
    serverBuildDate: z.string().nullable()
  }),
  counts: z.object({
    managementApiKeys: z.number().int().nonnegative(),
    authFiles: z.number().int().nonnegative(),
    providerCredentials: z.number().int().nonnegative(),
    availableModels: z.number().int().nonnegative()
  }),
  providers: z.array(GatewayDashboardProviderSummarySchema),
  routing: GatewayDashboardRoutingSummarySchema,
  latestVersion: z.string().nullable().optional(),
  updateAvailable: z.boolean().optional()
});

export const GatewayProviderTypeSchema = z.enum(['gemini', 'codex', 'claude', 'vertex', 'openaiCompatible', 'ampcode']);

export const GatewayModelAliasRuleSchema = z.object({
  name: z.string().min(1),
  alias: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  testModel: z.string().min(1).optional(),
  fork: z.boolean().optional()
});

export const GatewayCloakPolicySchema = z.object({
  mode: z.string().optional(),
  strictMode: z.boolean().optional(),
  sensitiveWords: z.array(z.string()).default([])
});

export const GatewayProviderCredentialSchema = z.object({
  credentialId: z.string().min(1),
  apiKeyMasked: z.string().optional(),
  secretRef: z.string().optional(),
  authIndex: z.string().optional(),
  proxyUrl: z.string().nullable().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  status: z.enum(['valid', 'missing', 'disabled', 'unavailable', 'unknown'])
});

export const GatewayProviderSpecificConfigRecordSchema = z.object({
  providerType: GatewayProviderTypeSchema,
  id: z.string().min(1),
  displayName: z.string().min(1),
  enabled: z.boolean(),
  baseUrl: z.string().nullable(),
  priority: z.number().int().optional(),
  prefix: z.string().optional(),
  proxyUrl: z.string().nullable().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  models: z.array(GatewayModelAliasRuleSchema),
  excludedModels: z.array(z.string()),
  credentials: z.array(GatewayProviderCredentialSchema),
  cloakPolicy: GatewayCloakPolicySchema.optional(),
  testModel: z.string().optional(),
  authIndex: z.string().optional(),
  rawSource: z.enum(['config', 'runtime', 'adapter']).optional()
});

export const GatewayProviderSpecificConfigListResponseSchema = z.object({
  items: z.array(GatewayProviderSpecificConfigRecordSchema)
});

export const GatewayOAuthModelAliasRuleSchema = z.object({
  channel: z.string().min(1),
  sourceModel: z.string().min(1),
  alias: z.string().min(1),
  fork: z.boolean().default(false)
});

export const GatewayOAuthModelAliasListResponseSchema = z.object({
  providerId: z.string().min(1),
  modelAliases: z.array(GatewayOAuthModelAliasRuleSchema),
  updatedAt: z.string()
});

export const GatewayUpdateOAuthModelAliasRulesRequestSchema = z.object({
  providerId: z.string().min(1),
  modelAliases: z.array(GatewayOAuthModelAliasRuleSchema)
});

export const GatewayVertexCredentialImportRequestSchema = z.object({
  fileName: z.string().min(1),
  contentBase64: z.string().min(1),
  location: z.string().min(1).optional()
});

export const GatewayVertexCredentialImportResponseSchema = z.object({
  status: z.literal('ok'),
  imported: z.boolean().optional(),
  projectId: z.string().optional(),
  email: z.string().optional(),
  location: z.string().optional(),
  authFile: z.string().optional(),
  authFileId: z.string().optional()
});

export const GatewayAuthFileDeleteRequestSchema = z.object({
  names: z.array(z.string().min(1)).optional(),
  all: z.boolean().optional()
});

export const GatewayAuthFileDeleteResponseSchema = z.object({
  deleted: z.array(z.string()),
  skipped: z.array(z.object({ name: z.string(), reason: z.string() }))
});

export const GatewayOAuthStatusResponseSchema = z.object({
  state: z.string().min(1),
  status: z.enum(['pending', 'completed', 'expired', 'error']),
  checkedAt: z.string()
});

export const GatewayOAuthCallbackRequestSchema = z.object({
  provider: z.string().min(1),
  redirectUrl: z.string().min(1)
});

export const GatewayOAuthCallbackResponseSchema = z.object({
  accepted: z.boolean(),
  provider: z.string().min(1),
  completedAt: z.string()
});

export const GatewayProviderOAuthStartProviderSchema = z.enum([
  'codex',
  'anthropic',
  'antigravity',
  'gemini-cli',
  'kimi'
]);

export const GatewayProviderOAuthStartRequestSchema = z.object({
  provider: GatewayProviderOAuthStartProviderSchema,
  isWebui: z.boolean().optional(),
  projectId: z.string().min(1).optional()
});

export const GatewayProviderOAuthStartResponseSchema = z.object({
  state: z.string().min(1),
  verificationUri: z.string().min(1),
  userCode: z.string().optional(),
  expiresAt: z.string()
});

export const GatewayGeminiCliOAuthStartRequestSchema = z.object({
  projectId: z.string().min(1).optional()
});

export const GatewayRequestLogSettingResponseSchema = z.object({
  requestLog: z.boolean(),
  updatedAt: z.string()
});

export const GatewayClearLoginStorageResponseSchema = z.object({
  cleared: z.boolean(),
  clearedAt: z.string()
});

export const GatewayManagementApiCallMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const GatewayManagementApiCallRequestSchema = z.object({
  providerKind: GatewayProviderKindSchema.optional(),
  authIndex: z.string().optional(),
  method: GatewayManagementApiCallMethodSchema,
  url: z.string().url().optional(),
  path: z.string().min(1).optional(),
  header: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  data: z.string().optional(),
  body: z.unknown().nullable().optional()
});

export const GatewayManagementApiCallResponseSchema = z.object({
  ok: z.boolean().optional(),
  statusCode: z.number().int().nonnegative(),
  header: z.record(z.string(), z.array(z.string())),
  bodyText: z.string(),
  body: z.unknown().nullable(),
  durationMs: z.number().nonnegative().optional()
});

export const GatewayAmpcodeUpstreamApiKeyMappingSchema = z.object({
  upstreamApiKeyMasked: z.string().optional(),
  upstreamSecretRef: z.string().optional(),
  apiKeys: z.array(z.string().min(1))
});

export const GatewayAmpcodeModelMappingSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  enabled: z.boolean().default(true)
});

export const GatewayAmpcodeConfigResponseSchema = z.object({
  upstreamUrl: z.string().url().optional(),
  upstreamApiKeyMasked: z.string().optional(),
  upstreamSecretRef: z.string().optional(),
  forceModelMappings: z.boolean(),
  upstreamApiKeys: z.array(GatewayAmpcodeUpstreamApiKeyMappingSchema),
  modelMappings: z.array(GatewayAmpcodeModelMappingSchema),
  updatedAt: z.string()
});

export const GatewayUpdateAmpcodeUpstreamUrlRequestSchema = z.object({
  upstreamUrl: z.string().url().nullable()
});

export const GatewayUpdateAmpcodeUpstreamApiKeyRequestSchema = z.object({
  upstreamApiKey: z.string().min(1).nullable()
});

export const GatewayUpdateAmpcodeUpstreamApiKeysRequestSchema = z.object({
  upstreamApiKeys: z.array(
    z.object({
      upstreamApiKey: z.string().min(1),
      apiKeys: z.array(z.string().min(1))
    })
  )
});

export const GatewayUpdateAmpcodeModelMappingsRequestSchema = z.object({
  modelMappings: z.array(GatewayAmpcodeModelMappingSchema)
});

export const GatewayUpdateAmpcodeForceModelMappingsRequestSchema = z.object({
  forceModelMappings: z.boolean()
});
