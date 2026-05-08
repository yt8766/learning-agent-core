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
