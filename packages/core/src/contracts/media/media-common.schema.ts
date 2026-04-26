import { z } from 'zod';

export const MediaKindSchema = z.enum(['audio', 'image', 'video', 'music']);

export const MediaProviderIdSchema = z.string().min(1);

export const MediaTaskStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled']);

export const MediaRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const MediaPreferenceSchema = z.enum(['latency', 'balanced', 'quality']);

export const MediaProvenanceSchema = z.object({
  source: z.enum(['generated', 'uploaded', 'imported', 'derived']),
  promptRef: z.string().min(1).optional(),
  sourceAssetRefs: z.array(z.string().min(1)).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export const MediaAssetSchema = z.object({
  assetId: z.string().min(1),
  kind: MediaKindSchema,
  uri: z.string().min(1),
  mimeType: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  provider: MediaProviderIdSchema.optional(),
  model: z.string().min(1).optional(),
  provenance: MediaProvenanceSchema.optional(),
  createdAt: z.string().datetime()
});

export const MediaProviderErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().optional(),
  provider: MediaProviderIdSchema.optional()
});

export const MediaGenerationTaskSchema = z.object({
  taskId: z.string().min(1),
  kind: MediaKindSchema,
  provider: MediaProviderIdSchema,
  status: MediaTaskStatusSchema,
  providerTaskId: z.string().min(1).optional(),
  assetRefs: z.array(z.string().min(1)).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  error: MediaProviderErrorSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional()
});

export type MediaKind = z.infer<typeof MediaKindSchema>;
export type MediaProviderId = z.infer<typeof MediaProviderIdSchema>;
export type MediaTaskStatus = z.infer<typeof MediaTaskStatusSchema>;
export type MediaRiskLevel = z.infer<typeof MediaRiskLevelSchema>;
export type MediaPreference = z.infer<typeof MediaPreferenceSchema>;
export type MediaProvenance = z.infer<typeof MediaProvenanceSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaProviderError = z.infer<typeof MediaProviderErrorSchema>;
export type MediaGenerationTask = z.infer<typeof MediaGenerationTaskSchema>;
