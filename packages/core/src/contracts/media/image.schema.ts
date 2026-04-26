import { z } from 'zod';

import { MediaAssetSchema, MediaPreferenceSchema } from './media-common.schema';

export const ImageGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().min(1).optional(),
  aspectRatio: z.string().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  count: z.number().int().positive().optional(),
  style: z.string().min(1).optional(),
  qualityPreference: MediaPreferenceSchema.optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export const ImageGenerationResultSchema = z.object({
  assets: z.array(MediaAssetSchema),
  taskId: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;
export type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;
