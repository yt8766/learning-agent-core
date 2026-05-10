import { z } from 'zod';
import { GatewayConfigValueSchema, GatewayProviderKindSchema, GatewayQuotaStatusSchema } from './agent-gateway.schemas';

export const GatewayAuthFileStatusSchema = z.enum(['valid', 'invalid', 'missing', 'expired']);
export const GatewayAuthFileUploadItemSchema = z.object({
  fileName: z.string().min(1),
  contentBase64: z.string().min(1),
  providerKind: GatewayProviderKindSchema.optional()
});
export const GatewayAuthFileBatchUploadRequestSchema = z.object({
  files: z.array(GatewayAuthFileUploadItemSchema).min(1)
});
export const GatewayAuthFileAcceptedUploadSchema = z.object({
  authFileId: z.string(),
  fileName: z.string(),
  providerKind: GatewayProviderKindSchema,
  status: GatewayAuthFileStatusSchema
});
export const GatewayAuthFileRejectedUploadSchema = z.object({
  fileName: z.string(),
  reason: z.string()
});
export const GatewayAuthFileBatchUploadResponseSchema = z.object({
  accepted: z.array(GatewayAuthFileAcceptedUploadSchema),
  rejected: z.array(GatewayAuthFileRejectedUploadSchema)
});
export const GatewayAuthFileSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerKind: GatewayProviderKindSchema,
  fileName: z.string(),
  path: z.string(),
  status: GatewayAuthFileStatusSchema,
  accountEmail: z.string().nullable(),
  projectId: z.string().nullable().optional(),
  modelCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
  metadata: z.record(z.string(), GatewayConfigValueSchema).optional()
});
export const GatewayAuthFileListResponseSchema = z.object({
  items: z.array(GatewayAuthFileSchema),
  nextCursor: z.string().nullable()
});
export const GatewayAuthFilePatchRequestSchema = z.object({
  authFileId: z.string().min(1),
  providerId: z.string().min(1).optional(),
  accountEmail: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  status: GatewayAuthFileStatusSchema.optional(),
  metadata: z.record(z.string(), GatewayConfigValueSchema).optional()
});
export const GatewayAvailableModelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  providerKind: GatewayProviderKindSchema,
  available: z.boolean(),
  aliases: z.array(z.string()).optional()
});
export const GatewayAuthFileModelListResponseSchema = z.object({
  authFileId: z.string(),
  models: z.array(GatewayAvailableModelSchema)
});

export const GatewayOAuthPolicySchema = z.object({
  providerId: z.string(),
  enabled: z.boolean(),
  callbackUrl: z.string().url().nullable(),
  excludedModels: z.array(z.string()),
  allowedDomains: z.array(z.string()),
  updatedAt: z.string()
});
export const GatewayUpdateOAuthPolicyRequestSchema = GatewayOAuthPolicySchema.omit({ updatedAt: true }).partial({
  callbackUrl: true,
  excludedModels: true,
  allowedDomains: true
});
export const GatewayOAuthModelAliasesResponseSchema = z.object({
  providerId: z.string(),
  aliases: z.record(z.string(), z.string()),
  updatedAt: z.string()
});
export const GatewayUpdateOAuthModelAliasesRequestSchema = z.object({
  providerId: z.string().min(1),
  aliases: z.record(z.string(), z.string())
});

export const GatewayQuotaDetailSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  model: z.string(),
  scope: z.string(),
  window: z.string(),
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetAt: z.string().nullable(),
  refreshedAt: z.string(),
  status: GatewayQuotaStatusSchema
});
export const GatewayQuotaDetailListResponseSchema = z.object({ items: z.array(GatewayQuotaDetailSchema) });

export const GatewayLogFileSchema = z.object({
  fileName: z.string(),
  path: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAt: z.string(),
  downloadUrl: z.string().optional()
});
export const GatewayLogFileListResponseSchema = z.object({ items: z.array(GatewayLogFileSchema) });
export const GatewayLogSearchRequestSchema = z.object({
  query: z.string().optional(),
  hideManagementTraffic: z.boolean().default(false),
  limit: z.number().int().positive().max(500).default(100),
  after: z.string().optional()
});
export const GatewayClearLogsResponseSchema = z.object({
  cleared: z.boolean(),
  clearedAt: z.string()
});
export const GatewayRequestLogEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  method: z.string(),
  path: z.string(),
  statusCode: z.number().int().positive(),
  durationMs: z.number().nonnegative(),
  managementTraffic: z.boolean(),
  providerId: z.string().nullable(),
  apiKeyPrefix: z.string().nullable(),
  message: z.string().optional()
});
export const GatewayRequestLogListResponseSchema = z.object({
  items: z.array(GatewayRequestLogEntrySchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable()
});

export const GatewaySystemVersionResponseSchema = z.object({
  version: z.string(),
  latestVersion: z.string().nullable(),
  buildDate: z.string().nullable(),
  updateAvailable: z.boolean(),
  links: z.record(z.string(), z.string().url())
});
export const GatewaySystemModelGroupSchema = z.object({
  providerId: z.string(),
  providerKind: GatewayProviderKindSchema,
  models: z.array(GatewayAvailableModelSchema)
});
export const GatewaySystemModelsResponseSchema = z.object({
  groups: z.array(GatewaySystemModelGroupSchema)
});
