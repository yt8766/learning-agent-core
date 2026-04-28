import { z } from 'zod';

export const MemoryEvidenceLinkRecordSchema = z.object({
  id: z.string(),
  memoryId: z.string(),
  evidenceId: z.string(),
  sourceType: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.string()
});

export type MemoryEvidenceLinkRecord = z.infer<typeof MemoryEvidenceLinkRecordSchema>;
