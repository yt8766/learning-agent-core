import { z } from 'zod';

export const GatewayUsageAnalyticsRangePresetSchema = z.enum(['today', '24h', '7d', '30d']);
export const GatewayUsageAnalyticsTabSchema = z.enum(['requestLogs', 'providers', 'models']);

export const GatewayUsageAnalyticsQuerySchema = z.object({
  range: GatewayUsageAnalyticsRangePresetSchema.default('today'),
  providerId: z.string().min(1).optional(),
  status: z.enum(['all', 'success', 'error']).default('all'),
  providerSearch: z.string().optional(),
  modelSearch: z.string().optional(),
  applicationId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100)
});

export const GatewayUsageAnalyticsRangeSchema = z.object({
  preset: GatewayUsageAnalyticsRangePresetSchema,
  from: z.string(),
  to: z.string(),
  bucketMinutes: z.number().int().positive()
});

export const GatewayUsageAnalyticsSummarySchema = z.object({
  requestCount: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheCreateTokens: z.number().int().nonnegative(),
  cacheHitTokens: z.number().int().nonnegative()
});

export const GatewayUsageAnalyticsTrendPointSchema = z.object({
  bucketStart: z.string(),
  requestCount: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheCreateTokens: z.number().int().nonnegative(),
  cacheHitTokens: z.number().int().nonnegative()
});

export const GatewayUsageAnalyticsRequestLogSchema = z.object({
  id: z.string().min(1),
  occurredAt: z.string(),
  providerId: z.string().nullable(),
  providerName: z.string(),
  model: z.string().nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cacheCreateTokens: z.number().int().nonnegative(),
  cacheHitTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  statusCode: z.number().int(),
  source: z.string(),
  applicationId: z.string().nullable()
});

export const GatewayUsageAnalyticsProviderStatSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  requestCount: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  successRate: z.number().min(0).max(1),
  averageLatencyMs: z.number().nonnegative()
});

export const GatewayUsageAnalyticsModelStatSchema = z.object({
  model: z.string(),
  providerId: z.string().nullable(),
  requestCount: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  averageCostUsd: z.number().nonnegative()
});

export const GatewayUsageAnalyticsFilterOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative()
});

export const GatewayUsageAnalyticsResponseSchema = z.object({
  observedAt: z.string(),
  range: GatewayUsageAnalyticsRangeSchema,
  activeTab: GatewayUsageAnalyticsTabSchema.default('requestLogs'),
  summary: GatewayUsageAnalyticsSummarySchema,
  trend: z.array(GatewayUsageAnalyticsTrendPointSchema),
  requestLogs: z.object({
    items: z.array(GatewayUsageAnalyticsRequestLogSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable()
  }),
  providerStats: z.array(GatewayUsageAnalyticsProviderStatSchema),
  modelStats: z.array(GatewayUsageAnalyticsModelStatSchema),
  filters: z.object({
    providers: z.array(GatewayUsageAnalyticsFilterOptionSchema),
    models: z.array(GatewayUsageAnalyticsFilterOptionSchema),
    applications: z.array(GatewayUsageAnalyticsFilterOptionSchema)
  })
});
