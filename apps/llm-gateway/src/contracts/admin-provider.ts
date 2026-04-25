import { z } from 'zod';

export const ProviderAdminKindSchema = z.enum(['openai', 'minimax', 'mimo', 'mock', 'openai-compatible']);
export const ProviderAdminStatusSchema = z.enum(['active', 'disabled']);
export const ProviderCredentialAdminStatusSchema = z.enum(['active', 'rotated', 'revoked']);

const NullableDateTimeSchema = z.string().datetime().nullable();
const NullablePositiveIntSchema = z.number().int().positive().nullable();

export const ProviderAdminRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    kind: ProviderAdminKindSchema,
    status: ProviderAdminStatusSchema,
    baseUrl: z.string().url(),
    timeoutMs: NullablePositiveIntSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .strict();

export const UpsertProviderRequestSchema = z
  .object({
    name: z.string().min(1).max(80),
    kind: ProviderAdminKindSchema,
    status: ProviderAdminStatusSchema,
    baseUrl: z.string().url(),
    timeoutMs: NullablePositiveIntSchema
  })
  .strict();

export const UpsertProviderWithCredentialRequestSchema = UpsertProviderRequestSchema.extend({
  plaintextApiKey: z.string().optional()
}).strict();

export const ProviderCredentialAdminRecordSchema = z
  .object({
    id: z.string().min(1),
    providerId: z.string().min(1),
    keyPrefix: z.string().min(1),
    fingerprint: z.string().min(1),
    keyVersion: z.string().min(1),
    status: ProviderCredentialAdminStatusSchema,
    createdAt: z.string().datetime(),
    rotatedAt: NullableDateTimeSchema
  })
  .strict();

export const ProviderAdminSummarySchema = ProviderAdminRecordSchema.extend({
  credentialId: z.string().min(1).nullable(),
  credentialKeyPrefix: z.string().min(1).nullable(),
  credentialFingerprint: z.string().min(1).nullable(),
  credentialKeyVersion: z.string().min(1).nullable(),
  credentialStatus: ProviderCredentialAdminStatusSchema.nullable(),
  credentialCreatedAt: z.string().datetime().nullable(),
  credentialRotatedAt: NullableDateTimeSchema
}).strict();

export const CreateProviderCredentialRequestSchema = z
  .object({
    providerId: z.string().min(1),
    plaintextApiKey: z.string().min(1)
  })
  .strict();

export const RotateProviderCredentialRequestSchema = z
  .object({
    plaintextApiKey: z.string().min(1)
  })
  .strict();

export const CreateProviderCredentialResponseSchema = z
  .object({
    credential: ProviderCredentialAdminRecordSchema
  })
  .strict();

export const RotateProviderCredentialResponseSchema = z
  .object({
    credential: ProviderCredentialAdminRecordSchema
  })
  .strict();

export type ProviderAdminKind = z.infer<typeof ProviderAdminKindSchema>;
export type ProviderAdminStatus = z.infer<typeof ProviderAdminStatusSchema>;
export type ProviderCredentialAdminStatus = z.infer<typeof ProviderCredentialAdminStatusSchema>;
export type ProviderAdminRecord = z.infer<typeof ProviderAdminRecordSchema>;
export type ProviderAdminSummary = z.infer<typeof ProviderAdminSummarySchema>;
export type UpsertProviderRequest = z.infer<typeof UpsertProviderRequestSchema>;
export type UpsertProviderWithCredentialRequest = z.infer<typeof UpsertProviderWithCredentialRequestSchema>;
export type ProviderCredentialAdminRecord = z.infer<typeof ProviderCredentialAdminRecordSchema>;
export type CreateProviderCredentialRequest = z.infer<typeof CreateProviderCredentialRequestSchema>;
export type RotateProviderCredentialRequest = z.infer<typeof RotateProviderCredentialRequestSchema>;
export type CreateProviderCredentialResponse = z.infer<typeof CreateProviderCredentialResponseSchema>;
export type RotateProviderCredentialResponse = z.infer<typeof RotateProviderCredentialResponseSchema>;
