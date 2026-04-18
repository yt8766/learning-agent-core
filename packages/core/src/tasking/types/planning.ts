import { z } from 'zod';

import {
  CounselorSelectorConfigSchema,
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDecisionRecordSchema,
  PlanDraftRecordSchema,
  PlanModeSchema,
  PlanModeTransitionRecordSchema,
  PlanQuestionOptionRecordSchema,
  PlanQuestionRecordSchema
} from '../schemas/planning';

export type PlanQuestionOptionRecord = z.infer<typeof PlanQuestionOptionRecordSchema>;
export type PlanQuestionRecord = z.infer<typeof PlanQuestionRecordSchema>;
export type PlanDecisionRecord = z.infer<typeof PlanDecisionRecordSchema>;
export type PlanMode = z.infer<typeof PlanModeSchema>;
export type PlanModeTransitionRecord = z.infer<typeof PlanModeTransitionRecordSchema>;
export type EntryDecisionRecord = z.infer<typeof EntryDecisionRecordSchema>;
export type ExecutionPlanRecord = z.infer<typeof ExecutionPlanRecordSchema>;
export type PartialAggregationRecord = z.infer<typeof PartialAggregationRecordSchema>;
export type PlanDraftRecord = z.infer<typeof PlanDraftRecordSchema>;
export type CounselorSelectorConfig = z.infer<typeof CounselorSelectorConfigSchema>;
