import { z } from 'zod';

import { ExecutionPlanModeSchema } from './primitives';

export const PlanQuestionOptionRecordSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string()
});

export const PlanQuestionRecordSchema = z.object({
  id: z.string(),
  question: z.string(),
  questionType: z.enum(['direction', 'detail', 'tradeoff']),
  options: z.array(PlanQuestionOptionRecordSchema),
  recommendedOptionId: z.string().optional(),
  allowFreeform: z.boolean().optional(),
  defaultAssumption: z.string().optional(),
  whyAsked: z.string().optional(),
  impactOnPlan: z.string().optional()
});

export const PlanDecisionRecordSchema = z.object({
  questionId: z.string(),
  resolutionSource: z.enum([
    'user-answer',
    'default-assumption',
    'auto-resolved',
    'bypass-recommended',
    'fallback-assumption'
  ]),
  selectedOptionId: z.string().optional(),
  freeform: z.string().optional(),
  assumedValue: z.string().optional(),
  whyAsked: z.string().optional(),
  decisionRationale: z.string().optional(),
  impactOnPlan: z.string().optional(),
  answeredAt: z.string()
});

export const PlanModeTransitionRecordSchema = z.object({
  from: z.enum(['intent', 'implementation', 'finalized', 'aborted']).optional(),
  to: z.enum(['intent', 'implementation', 'finalized', 'aborted']),
  reason: z.string(),
  at: z.string()
});

export const CounselorSelectionStrategySchema = z.enum([
  'user-id',
  'session-ratio',
  'task-type',
  'feature-flag',
  'manual'
]);

export const CounselorSelectorSchema = z.object({
  strategy: CounselorSelectionStrategySchema,
  key: z.string().optional(),
  candidateIds: z.array(z.string()).optional(),
  weights: z.array(z.number()).optional(),
  selectedCounselorId: z.string().optional(),
  selectedVersion: z.string().optional(),
  featureFlag: z.string().optional()
});

export const ImperialDirectIntentTriggerSchema = z.enum([
  'slash-exec',
  'explicit-direct-execution',
  'known-capability'
]);

export const ImperialDirectIntentSchema = z.object({
  enabled: z.boolean(),
  trigger: ImperialDirectIntentTriggerSchema,
  requestedCapability: z.string().optional(),
  reason: z.string().optional()
});

export const EntryDecisionRecordSchema = z.object({
  requestedMode: ExecutionPlanModeSchema,
  counselorSelector: CounselorSelectorSchema.optional(),
  selectionReason: z.string().optional(),
  defaultCounselorId: z.string().optional(),
  imperialDirectIntent: ImperialDirectIntentSchema.optional()
});

export const DispatchChainNodeSchema = z.enum([
  'entry_router',
  'mode_gate',
  'dispatch_planner',
  'context_filter',
  'result_aggregator',
  'interrupt_controller',
  'learning_recorder'
]);

export const PartialAggregationOutputKindSchema = z.enum([
  'preview',
  'low_risk_action_suggestion',
  'approved_lightweight_progress'
]);

export const PartialAggregationPolicySchema = z.object({
  allowedOutputKinds: z.array(PartialAggregationOutputKindSchema),
  requiresInterruptApprovalForProgress: z.boolean()
});

export const ExecutionPlanRecordSchema = z.object({
  mode: ExecutionPlanModeSchema,
  tokenBudget: z.number().optional(),
  costBudget: z.number().optional(),
  softBudgetThreshold: z.number().optional(),
  hardBudgetThreshold: z.number().optional(),
  modeCapabilities: z.array(z.string()).optional(),
  dispatchChain: z.array(DispatchChainNodeSchema).optional(),
  filteredCapabilities: z.array(z.string()).optional(),
  strategyCounselors: z.array(z.string()).optional(),
  executionMinistries: z.array(z.string()).optional(),
  selectedCounselorId: z.string().optional(),
  selectedVersion: z.string().optional(),
  partialAggregationPolicy: PartialAggregationPolicySchema.optional()
});

export const PartialAggregationRecordSchema = z.object({
  kind: PartialAggregationOutputKindSchema,
  summary: z.string(),
  recommendedNextStep: z.string().optional(),
  requiresApproval: z.boolean(),
  allowedCapabilities: z.array(z.string()),
  sourceCounselorIds: z.array(z.string()).optional(),
  createdAt: z.string()
});

export const PlanDraftQuestionSetSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional()
});

export const PlanDraftMicroBudgetSchema = z.object({
  readOnlyToolLimit: z.number(),
  readOnlyToolsUsed: z.number(),
  tokenBudgetUsd: z.number().optional(),
  budgetTriggered: z.boolean().optional()
});

export const PlanDraftRecordSchema = z.object({
  summary: z.string(),
  autoResolved: z.array(z.string()),
  openQuestions: z.array(z.string()),
  assumptions: z.array(z.string()),
  decisions: z.array(PlanDecisionRecordSchema).optional(),
  questionSet: PlanDraftQuestionSetSchema.optional(),
  questions: z.array(PlanQuestionRecordSchema).optional(),
  maxPlanTurns: z.number().optional(),
  planTurnsUsed: z.number().optional(),
  microBudget: PlanDraftMicroBudgetSchema.optional()
});
