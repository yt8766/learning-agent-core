import { z } from 'zod';

export const SemanticCacheRecordSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  role: z.string().min(1),
  modelId: z.string().min(1),
  responseText: z.string(),
  promptFingerprint: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  hitCount: z.number().int().nonnegative()
});

export type SemanticCacheRecord = z.infer<typeof SemanticCacheRecordSchema>;
