import { z } from 'zod';

import {
  BudgetInterruptStateSchema,
  BudgetStateSchema,
  EvaluationResultSchema,
  LearningConflictRecordSchema,
  LearningConflictScanResultSchema,
  LearningConflictScanSuggestionSchema,
  LearningEvaluationBudgetEfficiencySchema,
  LearningEvaluationRecordSchema,
  LearningEvaluationSourceSummarySchema,
  LearningEvaluationTimeoutStatsSchema,
  SkillGovernanceRecommendationSchema
} from '../schemas/knowledge-fields';

export type BudgetInterruptState = z.infer<typeof BudgetInterruptStateSchema>;
export type BudgetState = z.infer<typeof BudgetStateSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type LearningEvaluationBudgetEfficiency = z.infer<typeof LearningEvaluationBudgetEfficiencySchema>;
export type LearningEvaluationTimeoutStats = z.infer<typeof LearningEvaluationTimeoutStatsSchema>;
export type SkillGovernanceRecommendation = z.infer<typeof SkillGovernanceRecommendationSchema>;
export type LearningEvaluationSourceSummary = z.infer<typeof LearningEvaluationSourceSummarySchema>;
export type LearningEvaluationRecord = z.infer<typeof LearningEvaluationRecordSchema>;
export type LearningConflictRecord = z.infer<typeof LearningConflictRecordSchema>;
export type LearningConflictScanSuggestion = z.infer<typeof LearningConflictScanSuggestionSchema>;
export type LearningConflictScanResult = z.infer<typeof LearningConflictScanResultSchema>;
