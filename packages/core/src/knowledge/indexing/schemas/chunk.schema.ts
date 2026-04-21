import { z } from 'zod';

import { JsonObjectSchema } from './metadata.schema';

export const ChunkSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  sourceDocumentId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  metadata: JsonObjectSchema
});

export type Chunk = z.infer<typeof ChunkSchema>;
