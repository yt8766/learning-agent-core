import { z } from 'zod';
export const GatewayUserRoleSchema = z.enum(['admin', 'operator', 'viewer']);
export const GatewayUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: GatewayUserRoleSchema
});
export const GatewaySessionSchema = z.object({ user: GatewayUserSchema, issuedAt: z.string() });
export const GatewayAuthErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'INVALID_REQUEST',
  'ACCESS_TOKEN_EXPIRED',
  'REFRESH_TOKEN_EXPIRED',
  'FORBIDDEN'
]);
export const GatewayAuthErrorSchema = z.object({ code: GatewayAuthErrorCodeSchema, message: z.string() });
export const GatewayLoginRequestSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
export const GatewayRefreshRequestSchema = z.object({ refreshToken: z.string().min(1) });
export const GatewayLoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshTokenExpiresAt: z.string(),
  refreshTokenStorage: z.literal('localStorage'),
  session: GatewaySessionSchema
});
export const GatewayRefreshResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
  refreshTokenStorage: z.literal('localStorage'),
  session: GatewaySessionSchema
});
export const GatewayProviderStatusSchema = z.enum(['healthy', 'degraded', 'disabled']);
export const GatewayCredentialStatusSchema = z.enum(['valid', 'expiring', 'missing']);
export const GatewayQuotaStatusSchema = z.enum(['normal', 'warning', 'exceeded']);
export const GatewayLogLevelSchema = z.enum(['info', 'warn', 'error']);
export const GatewayProviderCredentialSetSchema = z.object({
  id: z.string(),
  provider: z.string(),
  modelFamilies: z.array(z.string()),
  status: GatewayProviderStatusSchema,
  priority: z.number().int().nonnegative(),
  baseUrl: z.string(),
  timeoutMs: z.number().int().positive()
});
export const GatewayCredentialFileSchema = z.object({
  id: z.string(),
  provider: z.string(),
  path: z.string(),
  status: GatewayCredentialStatusSchema,
  lastCheckedAt: z.string()
});
export const GatewayQuotaSchema = z.object({
  id: z.string(),
  provider: z.string(),
  scope: z.string(),
  usedTokens: z.number().int().nonnegative(),
  limitTokens: z.number().int().positive(),
  resetAt: z.string(),
  status: GatewayQuotaStatusSchema
});
export const GatewayRuntimeStatusSchema = z.object({
  mode: z.literal('proxy'),
  status: GatewayProviderStatusSchema,
  activeProviderCount: z.number().int().nonnegative(),
  degradedProviderCount: z.number().int().nonnegative(),
  requestPerMinute: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative()
});
export const GatewayConfigSchema = z.object({
  inputTokenStrategy: z.enum(['preprocess', 'provider-reported', 'hybrid']),
  outputTokenStrategy: z.enum(['postprocess', 'provider-reported', 'hybrid']),
  retryLimit: z.number().int().nonnegative(),
  circuitBreakerEnabled: z.boolean(),
  auditEnabled: z.boolean()
});
export const GatewaySnapshotSchema = z.object({
  observedAt: z.string(),
  runtime: GatewayRuntimeStatusSchema,
  config: GatewayConfigSchema,
  providerCredentialSets: z.array(GatewayProviderCredentialSetSchema),
  credentialFiles: z.array(GatewayCredentialFileSchema),
  quotas: z.array(GatewayQuotaSchema)
});
export const GatewayLogEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  level: GatewayLogLevelSchema,
  stage: z.enum(['preprocess', 'proxy', 'postprocess', 'accounting']),
  provider: z.string(),
  message: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative()
});
export const GatewayUsageRecordSchema = z.object({
  id: z.string(),
  provider: z.string(),
  date: z.string(),
  requestCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative()
});
export const GatewayListQuerySchema = z.object({ limit: z.coerce.number().int().positive().max(100).optional() });
export const GatewayLogListResponseSchema = z.object({ items: z.array(GatewayLogEntrySchema) });
export const GatewayUsageListResponseSchema = z.object({ items: z.array(GatewayUsageRecordSchema) });
export const GatewayProbeRequestSchema = z.object({ providerId: z.string().min(1), prompt: z.string().min(1) });
export const GatewayProbeResponseSchema = z.object({
  providerId: z.string(),
  ok: z.boolean(),
  latencyMs: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  message: z.string()
});
export const GatewayTokenCountRequestSchema = z.object({ text: z.string() });
export const GatewayTokenCountResponseSchema = z.object({
  tokens: z.number().int().nonnegative(),
  method: z.enum(['approximate'])
});
export const GatewayPreprocessRequestSchema = z.object({ prompt: z.string(), model: z.string().optional() });
export const GatewayPreprocessResponseSchema = z.object({
  normalizedPrompt: z.string(),
  inputTokens: z.number().int().nonnegative(),
  warnings: z.array(z.string())
});
export const GatewayAccountingRequestSchema = z.object({
  providerId: z.string().min(1),
  inputText: z.string(),
  outputText: z.string()
});
export const GatewayAccountingResponseSchema = z.object({
  providerId: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative()
});
export const GatewayUpdateConfigRequestSchema = GatewayConfigSchema.partial().refine(
  value => Object.keys(value).length > 0,
  { message: '至少需要一个配置字段' }
);
export const GatewayUpsertProviderRequestSchema = GatewayProviderCredentialSetSchema.extend({
  secretRef: z.string().min(1).optional()
});
export const GatewayDeleteProviderRequestSchema = z.object({ providerId: z.string().min(1) });
export const GatewayUpsertCredentialFileRequestSchema = GatewayCredentialFileSchema.extend({
  content: z.string().min(1).optional()
});
export const GatewayDeleteCredentialFileRequestSchema = z.object({ credentialFileId: z.string().min(1) });
export const GatewayUpdateQuotaRequestSchema = GatewayQuotaSchema.pick({
  id: true,
  limitTokens: true,
  resetAt: true,
  status: true
});
export const GatewayRelayMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string()
});
export const GatewayRelayRequestSchema = z.object({
  model: z.string().min(1),
  providerId: z.string().min(1).optional(),
  messages: z.array(GatewayRelayMessageSchema).min(1),
  stream: z.boolean().default(false),
  metadata: z.record(z.string(), z.string()).optional()
});
export const GatewayRelayUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative()
});
export const GatewayRelayResponseSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  model: z.string(),
  content: z.string(),
  usage: GatewayRelayUsageSchema,
  logId: z.string()
});
export const GatewayStartOAuthRequestSchema = z.object({
  providerId: z.string().min(1),
  credentialFileId: z.string().min(1)
});
export const GatewayStartOAuthResponseSchema = z.object({
  flowId: z.string(),
  providerId: z.string(),
  credentialFileId: z.string(),
  verificationUri: z.string().url(),
  userCode: z.string(),
  expiresAt: z.string()
});
export const GatewayCompleteOAuthRequestSchema = z.object({
  flowId: z.string().min(1),
  userCode: z.string().min(1)
});
export const GatewayCompleteOAuthResponseSchema = z.object({
  flowId: z.string(),
  providerId: z.string(),
  credentialFileId: z.string(),
  status: z.literal('valid'),
  completedAt: z.string(),
  credentialFile: GatewayCredentialFileSchema
});

export const GatewayConnectionStatusSchema = z.enum(['connected', 'disconnected', 'checking', 'error']);
export const GatewaySaveConnectionProfileRequestSchema = z.object({
  apiBase: z.string().url(),
  managementKey: z.string().min(1),
  timeoutMs: z.number().int().positive().max(120000).default(15000)
});
export const GatewayConnectionProfileSchema = z.object({
  apiBase: z.string().url(),
  managementKeyMasked: z.string(),
  timeoutMs: z.number().int().positive(),
  updatedAt: z.string()
});
export const GatewayConnectionStatusResponseSchema = z.object({
  status: GatewayConnectionStatusSchema,
  checkedAt: z.string(),
  serverVersion: z.string().nullable(),
  serverBuildDate: z.string().nullable(),
  error: z.string().optional()
});

export const GatewayRawConfigResponseSchema = z.object({
  content: z.string(),
  format: z.literal('yaml'),
  version: z.string()
});
export const GatewaySaveRawConfigRequestSchema = z.object({
  content: z.string(),
  expectedVersion: z.string().optional()
});
export const GatewayConfigDiffResponseSchema = z.object({
  changed: z.boolean(),
  before: z.string(),
  after: z.string()
});
export const GatewayReloadConfigResponseSchema = z.object({
  reloaded: z.boolean(),
  reloadedAt: z.string()
});

export const GatewayApiKeyStatusSchema = z.enum(['active', 'disabled', 'expired']);
export const GatewayApiKeyUsageSchema = z.object({
  requestCount: z.number().int().nonnegative(),
  lastRequestAt: z.string().nullable()
});
export const GatewayApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  status: GatewayApiKeyStatusSchema,
  scopes: z.array(z.string()),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  usage: GatewayApiKeyUsageSchema
});
export const GatewayCreateApiKeyRequestSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().nullable().optional()
});
export const GatewayUpdateApiKeyRequestSchema = z.object({
  keyId: z.string().min(1),
  name: z.string().min(1).optional(),
  status: GatewayApiKeyStatusSchema.optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().nullable().optional()
});
export const GatewayReplaceApiKeysRequestSchema = z.object({
  keys: z.array(z.string().min(1))
});
export const GatewayDeleteApiKeyRequestSchema = z.object({
  index: z.number().int().nonnegative()
});
export const GatewayApiKeyListResponseSchema = z.object({ items: z.array(GatewayApiKeySchema) });

export const GatewayProviderKindSchema = z.enum([
  'gemini',
  'codex',
  'claude',
  'vertex',
  'openai-compatible',
  'ampcode',
  'custom'
]);
export const GatewayConfigValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const GatewayProviderConfigSchema = z.object({
  providerId: z.string(),
  kind: GatewayProviderKindSchema,
  displayName: z.string(),
  enabled: z.boolean(),
  baseUrl: z.string().url().nullable(),
  models: z.array(z.string()),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().nonnegative(),
  settings: z.record(z.string(), GatewayConfigValueSchema),
  updatedAt: z.string()
});
export const GatewayUpsertProviderConfigRequestSchema = GatewayProviderConfigSchema.omit({ updatedAt: true });
export const GatewayProviderConfigListResponseSchema = z.object({ items: z.array(GatewayProviderConfigSchema) });
