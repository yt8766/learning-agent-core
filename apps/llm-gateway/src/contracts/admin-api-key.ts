import { z } from 'zod';

export const ApiKeyAdminStatusSchema = z.enum(['active', 'disabled', 'revoked']);

const NullablePositiveIntSchema = z.number().int().positive().nullable();
const NullableNonnegativeNumberSchema = z.number().nonnegative().nullable();
const NullableDateTimeSchema = z.string().datetime().nullable();

export const ApiKeyAdminSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    keyPrefix: z.string().min(1),
    status: ApiKeyAdminStatusSchema,
    allowAllModels: z.boolean(),
    models: z.array(z.string().min(1)),
    rpmLimit: NullablePositiveIntSchema,
    tpmLimit: NullablePositiveIntSchema,
    dailyTokenLimit: NullablePositiveIntSchema,
    dailyCostLimit: NullableNonnegativeNumberSchema,
    usedTokensToday: z.number().int().nonnegative(),
    usedCostToday: z.number().nonnegative(),
    requestCountToday: z.number().int().nonnegative(),
    expiresAt: NullableDateTimeSchema,
    lastUsedAt: NullableDateTimeSchema,
    createdAt: z.string().datetime(),
    revokedAt: NullableDateTimeSchema
  })
  .strict();

export const CreateApiKeyRequestSchema = z
  .object({
    name: z.string().min(1).max(80),
    allowAllModels: z.boolean(),
    models: z.array(z.string().min(1)),
    rpmLimit: NullablePositiveIntSchema,
    tpmLimit: NullablePositiveIntSchema,
    dailyTokenLimit: NullablePositiveIntSchema,
    dailyCostLimit: NullableNonnegativeNumberSchema,
    expiresAt: NullableDateTimeSchema
  })
  .strict();

export const CreateApiKeyResponseSchema = z
  .object({
    key: ApiKeyAdminSummarySchema,
    plaintext: z.string().min(1)
  })
  .strict();

export const UpdateApiKeyRequestSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    allowAllModels: z.boolean().optional(),
    models: z.array(z.string().min(1)).optional(),
    rpmLimit: NullablePositiveIntSchema.optional(),
    tpmLimit: NullablePositiveIntSchema.optional(),
    dailyTokenLimit: NullablePositiveIntSchema.optional(),
    dailyCostLimit: NullableNonnegativeNumberSchema.optional(),
    expiresAt: NullableDateTimeSchema.optional()
  })
  .strict();

export const ApiKeyAdminListResponseSchema = z
  .object({
    items: z.array(ApiKeyAdminSummarySchema),
    nextCursor: z.string().nullable()
  })
  .strict();

export type ApiKeyAdminStatus = z.infer<typeof ApiKeyAdminStatusSchema>;
export type ApiKeyAdminSummary = z.infer<typeof ApiKeyAdminSummarySchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;
export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>;
export type UpdateApiKeyRequest = z.infer<typeof UpdateApiKeyRequestSchema>;
export type ApiKeyAdminListResponse = z.infer<typeof ApiKeyAdminListResponseSchema>;
