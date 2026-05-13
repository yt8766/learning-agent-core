import { z } from 'zod';

export const GatewayRuntimeProviderKindSchema = z.enum([
  'codex',
  'claude',
  'gemini',
  'antigravity',
  'openaiCompatible',
  'ampcode'
]);

export const GatewayRuntimeExecutorHealthSchema = z
  .object({
    providerKind: GatewayRuntimeProviderKindSchema,
    status: z.enum(['ready', 'degraded', 'disabled', 'error']),
    checkedAt: z.string().min(1),
    activeRequests: z.number().int().nonnegative(),
    supportsStreaming: z.boolean(),
    message: z.string().optional()
  })
  .strict();

export const GatewayRuntimeUsageQueueHealthSchema = z
  .object({
    pending: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative()
  })
  .strict();

export const GatewayRuntimeCooldownHealthSchema = z
  .object({
    subjectType: z.enum(['user', 'client', 'apiKey']),
    subjectId: z.string().min(1),
    reason: z.string().min(1),
    recordedAt: z.string().min(1)
  })
  .strict();

export const GatewayRuntimeHealthResponseSchema = z
  .object({
    status: z.enum(['ready', 'degraded', 'error']),
    checkedAt: z.string().min(1),
    executors: z.array(GatewayRuntimeExecutorHealthSchema),
    activeRequests: z.number().int().nonnegative(),
    activeStreams: z.number().int().nonnegative(),
    usageQueue: GatewayRuntimeUsageQueueHealthSchema,
    cooldowns: z.array(GatewayRuntimeCooldownHealthSchema)
  })
  .strict();
