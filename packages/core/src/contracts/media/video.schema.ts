import { z } from 'zod';

import { MediaPreferenceSchema } from './media-common.schema';

export const VideoGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  imageAssetRefs: z.array(z.string().min(1)).optional(),
  audioAssetRefs: z.array(z.string().min(1)).optional(),
  durationMs: z.number().int().positive().optional(),
  aspectRatio: z.string().min(1).optional(),
  qualityPreference: MediaPreferenceSchema.optional(),
  latencyPreference: MediaPreferenceSchema.optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export const TemplateVideoRequestSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().int().positive().optional(),
  aspectRatio: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>;
export type TemplateVideoRequest = z.infer<typeof TemplateVideoRequestSchema>;
