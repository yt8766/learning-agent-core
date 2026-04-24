import { z } from 'zod';

export const ModelObjectSchema = z.object({
  id: z.string().min(1),
  object: z.literal('model'),
  owned_by: z.string().min(1)
});

export const ModelListResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(ModelObjectSchema)
});

export type ModelObject = z.infer<typeof ModelObjectSchema>;
export type ModelListResponse = z.infer<typeof ModelListResponseSchema>;
