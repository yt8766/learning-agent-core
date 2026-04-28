import { z } from 'zod';

import { JsonObjectSchema } from './metadata.schema';

export const DocumentSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  metadata: JsonObjectSchema
});

export type Document = z.infer<typeof DocumentSchema>;
