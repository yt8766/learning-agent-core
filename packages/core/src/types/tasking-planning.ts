import { z } from 'zod';

export const PlanQuestionOptionRecordSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string()
});

export type PlanQuestionOptionRecord = z.infer<typeof PlanQuestionOptionRecordSchema>;

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

export type PlanQuestionRecord = z.infer<typeof PlanQuestionRecordSchema>;

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

export type PlanDecisionRecord = z.infer<typeof PlanDecisionRecordSchema>;

export const PlanModeTransitionRecordSchema = z.object({
  from: z.enum(['intent', 'implementation', 'finalized', 'aborted']).optional(),
  to: z.enum(['intent', 'implementation', 'finalized', 'aborted']),
  reason: z.string(),
  at: z.string()
});

export type PlanModeTransitionRecord = z.infer<typeof PlanModeTransitionRecordSchema>;

export const EntryDecisionRecordSchema = z.object({
  requestedMode: z.enum(['plan', 'execute', 'imperial_direct']),
  counselorSelector: z
    .object({
      strategy: z.enum(['user-id', 'session-ratio', 'task-type', 'feature-flag', 'manual']),
      key: z.string().optional(),
      candidateIds: z.array(z.string()).optional(),
      weights: z.array(z.number()).optional(),
      selectedCounselorId: z.string().optional(),
      selectedVersion: z.string().optional(),
      featureFlag: z.string().optional()
    })
    .optional(),
  selectionReason: z.string().optional(),
  defaultCounselorId: z.string().optional(),
  imperialDirectIntent: z
    .object({
      enabled: z.boolean(),
      trigger: z.enum(['slash-exec', 'explicit-direct-execution', 'known-capability']),
      requestedCapability: z.string().optional(),
      reason: z.string().optional()
    })
    .optional()
});

export type EntryDecisionRecord = z.infer<typeof EntryDecisionRecordSchema>;

export const ExecutionPlanRecordSchema = z.object({
  mode: z.enum(['plan', 'execute', 'imperial_direct']),
  tokenBudget: z.number().optional(),
  costBudget: z.number().optional(),
  softBudgetThreshold: z.number().optional(),
  hardBudgetThreshold: z.number().optional(),
  modeCapabilities: z.array(z.string()).optional(),
  dispatchChain: z
    .array(
      z.enum([
        'entry_router',
        'mode_gate',
        'dispatch_planner',
        'context_filter',
        'result_aggregator',
        'interrupt_controller',
        'learning_recorder'
      ])
    )
    .optional(),
  filteredCapabilities: z.array(z.string()).optional(),
  strategyCounselors: z.array(z.string()).optional(),
  executionMinistries: z.array(z.string()).optional(),
  selectedCounselorId: z.string().optional(),
  selectedVersion: z.string().optional(),
  partialAggregationPolicy: z
    .object({
      allowedOutputKinds: z.array(z.enum(['preview', 'low_risk_action_suggestion', 'approved_lightweight_progress'])),
      requiresInterruptApprovalForProgress: z.boolean()
    })
    .optional()
});

export type ExecutionPlanRecord = z.infer<typeof ExecutionPlanRecordSchema>;

export const PartialAggregationRecordSchema = z.object({
  kind: z.enum(['preview', 'low_risk_action_suggestion', 'approved_lightweight_progress']),
  summary: z.string(),
  recommendedNextStep: z.string().optional(),
  requiresApproval: z.boolean(),
  allowedCapabilities: z.array(z.string()),
  sourceCounselorIds: z.array(z.string()).optional(),
  createdAt: z.string()
});

export type PartialAggregationRecord = z.infer<typeof PartialAggregationRecordSchema>;

export const PlanDraftRecordSchema = z.object({
  summary: z.string(),
  autoResolved: z.array(z.string()),
  openQuestions: z.array(z.string()),
  assumptions: z.array(z.string()),
  decisions: z.array(PlanDecisionRecordSchema).optional(),
  questionSet: z
    .object({
      title: z.string().optional(),
      summary: z.string().optional()
    })
    .optional(),
  questions: z.array(PlanQuestionRecordSchema).optional(),
  maxPlanTurns: z.number().optional(),
  planTurnsUsed: z.number().optional(),
  microBudget: z
    .object({
      readOnlyToolLimit: z.number(),
      readOnlyToolsUsed: z.number(),
      tokenBudgetUsd: z.number().optional(),
      budgetTriggered: z.boolean().optional()
    })
    .optional()
});

export type PlanDraftRecord = z.infer<typeof PlanDraftRecordSchema>;
