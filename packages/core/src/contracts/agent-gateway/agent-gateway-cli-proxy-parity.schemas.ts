import { z } from 'zod';
import { GatewayConnectionStatusSchema, GatewayProviderKindSchema } from './agent-gateway.schemas';

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'proxy-authorization'
]);
export const GatewaySafeHeaderNameSchema = z
  .string()
  .min(1)
  .refine(value => !SENSITIVE_HEADER_NAMES.has(value.trim().toLowerCase()), {
    message: 'Sensitive headers must not cross Agent Gateway management projections'
  });
export const GatewaySafeHeaderMetadataSchema = z.record(GatewaySafeHeaderNameSchema, z.string());
export const GatewaySafeHeaderArrayMetadataSchema = z.record(GatewaySafeHeaderNameSchema, z.array(z.string()));

export const GatewayDashboardProviderSummarySchema = z
  .object({
    providerKind: GatewayProviderKindSchema,
    configured: z.boolean(),
    enabled: z.number().int().nonnegative(),
    disabled: z.number().int().nonnegative(),
    modelCount: z.number().int().nonnegative()
  })
  .strict();

export const GatewayDashboardRoutingSummarySchema = z
  .object({
    strategy: z.string(),
    forceModelPrefix: z.boolean(),
    requestRetry: z.number().int().nonnegative(),
    wsAuth: z.boolean(),
    proxyUrl: z.string().nullable()
  })
  .strict();

export const GatewayDashboardSummaryResponseSchema = z
  .object({
    observedAt: z.string(),
    connection: z
      .object({
        status: GatewayConnectionStatusSchema,
        apiBase: z.string().url().nullable(),
        serverVersion: z.string().nullable(),
        serverBuildDate: z.string().nullable()
      })
      .strict(),
    counts: z
      .object({
        managementApiKeys: z.number().int().nonnegative(),
        authFiles: z.number().int().nonnegative(),
        providerCredentials: z.number().int().nonnegative(),
        availableModels: z.number().int().nonnegative()
      })
      .strict(),
    providers: z.array(GatewayDashboardProviderSummarySchema),
    routing: GatewayDashboardRoutingSummarySchema,
    latestVersion: z.string().nullable().optional(),
    updateAvailable: z.boolean().optional()
  })
  .strict();

export const GatewayProviderTypeSchema = z.enum(['gemini', 'codex', 'claude', 'vertex', 'openaiCompatible', 'ampcode']);

export const GatewayModelAliasRuleSchema = z
  .object({
    name: z.string().min(1),
    alias: z.string().min(1).optional(),
    priority: z.number().int().optional(),
    testModel: z.string().min(1).optional(),
    fork: z.boolean().optional()
  })
  .strict();

export const GatewayCloakPolicySchema = z
  .object({
    mode: z.string().optional(),
    strictMode: z.boolean().optional(),
    sensitiveWords: z.array(z.string()).default([])
  })
  .strict();

export const GatewayProviderCredentialSchema = z
  .object({
    credentialId: z.string().min(1),
    apiKeyMasked: z.string().optional(),
    secretRef: z.string().optional(),
    authIndex: z.string().optional(),
    proxyUrl: z.string().nullable().optional(),
    headers: GatewaySafeHeaderMetadataSchema.optional(),
    status: z.enum(['valid', 'missing', 'disabled', 'unavailable', 'unknown'])
  })
  .strict();

export const GatewayProviderSpecificConfigSummarySchema = z
  .object({
    id: z.string().min(1),
    providerKind: GatewayProviderTypeSchema,
    displayName: z.string().min(1),
    enabled: z.boolean(),
    maskedSecret: z.string().optional(),
    modelCount: z.number().int().nonnegative(),
    updatedAt: z.string()
  })
  .strict();

export const GatewayProviderSpecificConfigRecordSchema = z
  .object({
    providerType: GatewayProviderTypeSchema,
    id: z.string().min(1),
    displayName: z.string().min(1),
    enabled: z.boolean(),
    baseUrl: z.string().nullable(),
    priority: z.number().int().optional(),
    prefix: z.string().optional(),
    proxyUrl: z.string().nullable().optional(),
    headers: GatewaySafeHeaderMetadataSchema.optional(),
    models: z.array(GatewayModelAliasRuleSchema),
    excludedModels: z.array(z.string()),
    credentials: z.array(GatewayProviderCredentialSchema),
    cloakPolicy: GatewayCloakPolicySchema.optional(),
    testModel: z.string().optional(),
    authIndex: z.string().optional(),
    rawSource: z.enum(['config', 'runtime', 'adapter']).optional()
  })
  .strict();

export const GatewayProviderSpecificConfigListResponseSchema = z
  .object({
    items: z.array(z.union([GatewayProviderSpecificConfigRecordSchema, GatewayProviderSpecificConfigSummarySchema]))
  })
  .strict();

export const GatewayOAuthModelAliasRuleSchema = z
  .object({
    channel: z.string().min(1),
    sourceModel: z.string().min(1),
    alias: z.string().min(1),
    fork: z.boolean().default(false)
  })
  .strict();

export const GatewayOAuthModelAliasListResponseSchema = z
  .object({
    providerId: z.string().min(1),
    modelAliases: z.array(GatewayOAuthModelAliasRuleSchema),
    updatedAt: z.string()
  })
  .strict();

export const GatewayUpdateOAuthModelAliasRulesRequestSchema = z
  .object({
    providerId: z.string().min(1),
    modelAliases: z.array(GatewayOAuthModelAliasRuleSchema)
  })
  .strict();

export const GatewayVertexCredentialImportRequestSchema = z
  .object({
    fileName: z.string().min(1),
    contentBase64: z.string().min(1),
    location: z.string().min(1).optional()
  })
  .strict();

export const GatewayVertexCredentialImportResponseSchema = z
  .object({
    status: z.literal('ok'),
    imported: z.boolean().optional(),
    projectId: z.string().optional(),
    email: z.string().optional(),
    location: z.string().optional(),
    authFile: z.string().optional(),
    authFileId: z.string().optional()
  })
  .strict();

export const GatewayAuthFileDeleteRequestSchema = z
  .object({
    names: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional()
  })
  .strict();

export const GatewayAuthFileDeleteResponseSchema = z
  .object({
    deleted: z.array(z.string()),
    skipped: z.array(z.object({ name: z.string(), reason: z.string() }).strict())
  })
  .strict();

export const GatewayOAuthStatusResponseSchema = z
  .object({
    state: z.string().min(1),
    status: z.enum(['pending', 'completed', 'expired', 'error']),
    checkedAt: z.string()
  })
  .strict();

export const GatewayOAuthCallbackRequestSchema = z
  .object({
    provider: z.string().min(1),
    redirectUrl: z.string().min(1)
  })
  .strict();

export const GatewayOAuthCallbackResponseSchema = z
  .object({
    accepted: z.boolean(),
    provider: z.string().min(1),
    completedAt: z.string()
  })
  .strict();

export const GatewayProviderOAuthStartProviderSchema = z.enum([
  'codex',
  'anthropic',
  'antigravity',
  'gemini-cli',
  'kimi'
]);

export const GatewayProviderOAuthStartRequestSchema = z
  .object({
    provider: GatewayProviderOAuthStartProviderSchema,
    isWebui: z.boolean().optional(),
    projectId: z.string().min(1).optional()
  })
  .strict();

export const GatewayProviderOAuthStartResponseSchema = z
  .object({
    state: z.string().min(1),
    verificationUri: z.string().min(1),
    userCode: z.string().optional(),
    expiresAt: z.string()
  })
  .strict();

export const GatewayGeminiCliOAuthStartRequestSchema = z
  .object({
    projectId: z.string().min(1).optional()
  })
  .strict();

export const GatewayRequestLogSettingResponseSchema = z
  .object({
    requestLog: z.boolean(),
    updatedAt: z.string()
  })
  .strict();

export const GatewayClearLoginStorageResponseSchema = z
  .object({
    cleared: z.boolean(),
    clearedAt: z.string()
  })
  .strict();

export const GatewayManagementApiCallMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const GatewayManagementApiCallRequestSchema = z
  .object({
    providerKind: GatewayProviderKindSchema.optional(),
    authIndex: z.string().optional(),
    method: GatewayManagementApiCallMethodSchema,
    url: z.string().url().optional(),
    path: z.string().min(1).optional(),
    header: GatewaySafeHeaderMetadataSchema.optional(),
    headers: GatewaySafeHeaderMetadataSchema.optional(),
    data: z.string().optional(),
    body: z.unknown().nullable().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.url === undefined) === (value.path === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'Exactly one of url or path must be provided',
        path: ['url']
      });
    }
  });

export const GatewayManagementApiCallResponseSchema = z
  .object({
    ok: z.boolean().optional(),
    statusCode: z.number().int().nonnegative(),
    header: GatewaySafeHeaderArrayMetadataSchema,
    bodyText: z.string(),
    body: z.unknown().nullable(),
    durationMs: z.number().nonnegative().optional()
  })
  .strict();

export const GatewayAmpcodeUpstreamApiKeyMappingSchema = z
  .object({
    upstreamApiKeyMasked: z.string().optional(),
    upstreamSecretRef: z.string().optional(),
    apiKeys: z.array(z.string().min(1))
  })
  .strict();

export const GatewayAmpcodeModelMappingSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    enabled: z.boolean().default(true)
  })
  .strict();

export const GatewayAmpcodeConfigResponseSchema = z
  .object({
    upstreamUrl: z.string().url().optional(),
    upstreamApiKeyMasked: z.string().optional(),
    upstreamSecretRef: z.string().optional(),
    forceModelMappings: z.boolean(),
    upstreamApiKeys: z.array(GatewayAmpcodeUpstreamApiKeyMappingSchema),
    modelMappings: z.array(GatewayAmpcodeModelMappingSchema),
    updatedAt: z.string()
  })
  .strict();

export const GatewayUpdateAmpcodeUpstreamUrlRequestSchema = z
  .object({
    upstreamUrl: z.string().url().nullable()
  })
  .strict();

export const GatewayUpdateAmpcodeUpstreamApiKeyRequestSchema = z
  .object({
    upstreamApiKey: z.string().min(1).nullable()
  })
  .strict();

export const GatewayUpdateAmpcodeUpstreamApiKeysRequestSchema = z
  .object({
    upstreamApiKeys: z.array(
      z
        .object({
          upstreamApiKey: z.string().min(1),
          apiKeys: z.array(z.string().min(1))
        })
        .strict()
    )
  })
  .strict();

export const GatewayUpdateAmpcodeModelMappingsRequestSchema = z
  .object({
    modelMappings: z.array(GatewayAmpcodeModelMappingSchema)
  })
  .strict();

export const GatewayUpdateAmpcodeForceModelMappingsRequestSchema = z
  .object({
    forceModelMappings: z.boolean()
  })
  .strict();
