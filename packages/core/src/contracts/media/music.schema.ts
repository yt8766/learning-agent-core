import { z } from 'zod';

import { MediaAssetSchema, MediaPreferenceSchema } from './media-common.schema';

export const MusicGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  mood: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  durationMs: z.number().int().positive().optional(),
  useCase: z.string().min(1).optional(),
  qualityPreference: MediaPreferenceSchema.optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export const MusicGenerationResultSchema = z.object({
  asset: MediaAssetSchema,
  taskId: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).optional()
});

export type MusicGenerationRequest = z.infer<typeof MusicGenerationRequestSchema>;
export type MusicGenerationResult = z.infer<typeof MusicGenerationResultSchema>;
