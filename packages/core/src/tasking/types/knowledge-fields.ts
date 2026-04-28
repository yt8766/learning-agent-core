import type { z } from 'zod';

import type {
  BudgetStateSchema,
  EvaluationResultSchema,
  LearningEvaluationRecordSchema
} from '../schemas/knowledge-fields';

export type BudgetState = z.infer<typeof BudgetStateSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type LearningEvaluationRecord = z.infer<typeof LearningEvaluationRecordSchema>;
