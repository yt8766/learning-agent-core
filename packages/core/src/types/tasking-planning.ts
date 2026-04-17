import { z } from 'zod';

import {
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDecisionRecordSchema,
  PlanDraftRecordSchema,
  PlanModeTransitionRecordSchema,
  PlanQuestionOptionRecordSchema,
  PlanQuestionRecordSchema
} from '../spec/tasking-planning';

export type PlanQuestionOptionRecord = z.infer<typeof PlanQuestionOptionRecordSchema>;
export type PlanQuestionRecord = z.infer<typeof PlanQuestionRecordSchema>;
export type PlanDecisionRecord = z.infer<typeof PlanDecisionRecordSchema>;
export type PlanModeTransitionRecord = z.infer<typeof PlanModeTransitionRecordSchema>;
export type EntryDecisionRecord = z.infer<typeof EntryDecisionRecordSchema>;
export type ExecutionPlanRecord = z.infer<typeof ExecutionPlanRecordSchema>;
export type PartialAggregationRecord = z.infer<typeof PartialAggregationRecordSchema>;
export type PlanDraftRecord = z.infer<typeof PlanDraftRecordSchema>;
