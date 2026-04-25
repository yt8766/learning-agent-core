import { z } from 'zod';

export const AdminRequestLogStatusSchema = z.enum(['success', 'error']);

const NullableStringSchema = z.string().nullable();
const NonnegativeNumberSchema = z.number().nonnegative();
const NonnegativeIntSchema = z.number().int().nonnegative();
const AdminRequestLogLimitSchema = z.coerce.number().int().min(1).max(200).default(50);

export const AdminRequestLogQuerySchema = z
  .object({
    keyId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    status: AdminRequestLogStatusSchema.optional(),
    limit: AdminRequestLogLimitSchema
  })
  .strict();

export const AdminRequestLogEntrySchema = z
  .object({
    id: z.string().min(1),
    keyId: z.string().min(1),
    requestedModel: z.string().min(1),
    model: z.string().min(1),
    provider: z.string().min(1),
    providerModel: z.string().min(1),
    status: AdminRequestLogStatusSchema,
    promptTokens: NonnegativeIntSchema,
    completionTokens: NonnegativeIntSchema,
    totalTokens: NonnegativeIntSchema,
    estimatedCost: NonnegativeNumberSchema,
    latencyMs: NonnegativeIntSchema,
    stream: z.boolean(),
    fallbackAttemptCount: NonnegativeIntSchema,
    errorCode: NullableStringSchema,
    errorMessage: NullableStringSchema,
    createdAt: z.string().datetime()
  })
  .strict();

export const AdminRequestLogListResponseSchema = z
  .object({
    items: z.array(AdminRequestLogEntrySchema),
    nextCursor: z.string().nullable()
  })
  .strict();

export const AdminDashboardSummarySchema = z
  .object({
    requestCount: NonnegativeIntSchema,
    totalTokens: NonnegativeIntSchema,
    estimatedCost: NonnegativeNumberSchema,
    failureRate: z.number().min(0).max(1),
    averageLatencyMs: NonnegativeIntSchema
  })
  .strict();

export const AdminDashboardDimensionRollupSchema = z
  .object({
    requestCount: NonnegativeIntSchema,
    totalTokens: NonnegativeIntSchema,
    estimatedCost: NonnegativeNumberSchema
  })
  .strict();

export const AdminDashboardModelRollupSchema = AdminDashboardDimensionRollupSchema.extend({
  model: z.string().min(1)
}).strict();

export const AdminDashboardKeyRollupSchema = AdminDashboardDimensionRollupSchema.extend({
  keyId: z.string().min(1)
}).strict();

export const AdminDashboardProviderRollupSchema = AdminDashboardDimensionRollupSchema.extend({
  provider: z.string().min(1)
}).strict();

export const AdminDashboardResponseSchema = z
  .object({
    summary: AdminDashboardSummarySchema,
    topModels: z.array(AdminDashboardModelRollupSchema),
    topKeys: z.array(AdminDashboardKeyRollupSchema),
    topProviders: z.array(AdminDashboardProviderRollupSchema)
  })
  .strict();

export type AdminRequestLogStatus = z.infer<typeof AdminRequestLogStatusSchema>;
export type AdminRequestLogQuery = z.infer<typeof AdminRequestLogQuerySchema>;
export type AdminRequestLogEntry = z.infer<typeof AdminRequestLogEntrySchema>;
export type AdminRequestLogListResponse = z.infer<typeof AdminRequestLogListResponseSchema>;
export type AdminDashboardSummary = z.infer<typeof AdminDashboardSummarySchema>;
export type AdminDashboardModelRollup = z.infer<typeof AdminDashboardModelRollupSchema>;
export type AdminDashboardKeyRollup = z.infer<typeof AdminDashboardKeyRollupSchema>;
export type AdminDashboardProviderRollup = z.infer<typeof AdminDashboardProviderRollupSchema>;
export type AdminDashboardResponse = z.infer<typeof AdminDashboardResponseSchema>;
