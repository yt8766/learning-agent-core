import type { z } from 'zod';

import type {
  ExecutionAutoReviewRecordSchema,
  ExecutionAutoReviewRiskLevelSchema,
  ExecutionAutoReviewSubjectSchema,
  ExecutionAutoReviewVerdictSchema
} from '../schemas/execution-auto-review';

export type ExecutionAutoReviewSubject = z.infer<typeof ExecutionAutoReviewSubjectSchema>;
export type ExecutionAutoReviewVerdict = z.infer<typeof ExecutionAutoReviewVerdictSchema>;
export type ExecutionAutoReviewRiskLevel = z.infer<typeof ExecutionAutoReviewRiskLevelSchema>;
export type ExecutionAutoReviewRecord = z.infer<typeof ExecutionAutoReviewRecordSchema>;
