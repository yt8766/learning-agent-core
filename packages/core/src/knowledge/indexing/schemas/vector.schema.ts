import { z } from 'zod';

import { JsonObjectSchema } from './metadata.schema';

export const VectorSchema = z.object({
  id: z.string().min(1),
  values: z.array(z.number()).min(1),
  metadata: JsonObjectSchema,
  sourceChunkId: z.string().min(1).optional()
});

export type Vector = z.infer<typeof VectorSchema>;
