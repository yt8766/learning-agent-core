import type { z } from 'zod';

import type {
  EvidenceRecordSchema,
  LearningCandidateRecordSchema,
  MemoryRecordSchema,
  MemoryScopeTypeSchema,
  MemoryTypeSchema
} from '../schemas/memory-fields';

export type MemoryScopeType = z.infer<typeof MemoryScopeTypeSchema>;
export type MemoryType = z.infer<typeof MemoryTypeSchema>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type LearningCandidateRecord = z.infer<typeof LearningCandidateRecordSchema>;
