import { z } from 'zod';

export const AgentMessageRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  from: z.enum(['manager', 'research', 'executor', 'reviewer']),
  to: z.enum(['manager', 'research', 'executor', 'reviewer']),
  type: z.enum(['dispatch', 'research_result', 'execution_result', 'review_result', 'summary', 'summary_delta']),
  content: z.string(),
  createdAt: z.string()
});

export type AgentMessageRecord = z.infer<typeof AgentMessageRecordSchema>;

export const SubTaskRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  assignedTo: z.enum(['manager', 'research', 'executor', 'reviewer']),
  status: z.enum(['pending', 'running', 'completed', 'blocked'])
});

export type SubTaskRecord = z.infer<typeof SubTaskRecordSchema>;

export const ManagerPlanSchema = z.object({
  id: z.string(),
  goal: z.string(),
  summary: z.string(),
  steps: z.array(z.string()),
  subTasks: z.array(SubTaskRecordSchema),
  createdAt: z.string()
});

export type ManagerPlan = z.infer<typeof ManagerPlanSchema>;

export const ReviewRecordSchema = z.object({
  taskId: z.string(),
  decision: z.enum(['approved', 'retry', 'blocked']),
  notes: z.array(z.string()),
  createdAt: z.string()
});

export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const DispatchInstructionSchema = z.object({
  taskId: z.string(),
  subTaskId: z.string(),
  from: z.enum(['manager', 'research', 'executor', 'reviewer']),
  to: z.enum(['manager', 'research', 'executor', 'reviewer']),
  kind: z.enum(['strategy', 'ministry', 'fallback']),
  objective: z.string()
});

export type DispatchInstruction = z.infer<typeof DispatchInstructionSchema>;

export const SpecialistLeadRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  domain: z.string(),
  reason: z.string().optional()
});

export type SpecialistLeadRecord = z.infer<typeof SpecialistLeadRecordSchema>;

export const SpecialistSupportRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  domain: z.string(),
  reason: z.string().optional()
});

export type SpecialistSupportRecord = z.infer<typeof SpecialistSupportRecordSchema>;

export const SpecialistFindingRecordSchema = z.object({
  specialistId: z.string(),
  role: z.enum(['lead', 'support']),
  contractVersion: z.literal('specialist-finding.v1'),
  source: z.enum(['route', 'research', 'execution', 'critique']),
  stage: z.enum(['planning', 'research', 'execution', 'review']),
  summary: z.string(),
  domain: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  blockingIssues: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  confidence: z.number().optional()
});

export type SpecialistFindingRecord = z.infer<typeof SpecialistFindingRecordSchema>;

export const ContextSliceRecordSchema = z.object({
  specialistId: z.string(),
  summary: z.string().optional(),
  recentTurns: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
      })
    )
    .optional(),
  relatedHistory: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  domainInstruction: z.string().optional(),
  outputInstruction: z.string().optional()
});

export type ContextSliceRecord = z.infer<typeof ContextSliceRecordSchema>;

export const CritiqueResultRecordSchema = z.object({
  contractVersion: z.literal('critique-result.v1'),
  decision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']),
  summary: z.string(),
  blockingIssues: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  shouldBlockEarly: z.boolean().optional()
});

export type CritiqueResultRecord = z.infer<typeof CritiqueResultRecordSchema>;

export const GovernanceScoreRecordSchema = z.object({
  ministry: z.literal('libu-governance'),
  score: z.number(),
  status: z.enum(['healthy', 'watch', 'risky']),
  summary: z.string(),
  rationale: z.array(z.string()),
  recommendedLearningTargets: z.array(z.enum(['memory', 'rule', 'skill'])),
  trustAdjustment: z.enum(['promote', 'hold', 'downgrade']),
  updatedAt: z.string()
});

export type GovernanceScoreRecord = z.infer<typeof GovernanceScoreRecordSchema>;

const GovernanceDimensionSchema = z.object({
  score: z.number(),
  summary: z.string()
});

export const GovernanceReportRecordSchema = z.object({
  ministry: z.literal('libu-governance'),
  summary: z.string(),
  executionQuality: GovernanceDimensionSchema,
  evidenceSufficiency: GovernanceDimensionSchema,
  sandboxReliability: GovernanceDimensionSchema,
  reviewOutcome: z.object({
    decision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']),
    summary: z.string()
  }),
  interruptLoad: z.object({
    interruptCount: z.number(),
    microLoopCount: z.number(),
    summary: z.string()
  }),
  businessFeedback: GovernanceDimensionSchema,
  recommendedLearningTargets: z.array(z.enum(['memory', 'rule', 'skill'])),
  trustAdjustment: z.enum(['promote', 'hold', 'downgrade']),
  updatedAt: z.string()
});

export type GovernanceReportRecord = z.infer<typeof GovernanceReportRecordSchema>;

export const BudgetGateStateRecordSchema = z.object({
  node: z.literal('budget_gate'),
  status: z.enum(['open', 'soft_blocked', 'hard_blocked', 'throttled']),
  summary: z.string(),
  queueDepth: z.number().optional(),
  rateLimitKey: z.string().optional(),
  triggeredAt: z.string().optional(),
  updatedAt: z.string()
});

export type BudgetGateStateRecord = z.infer<typeof BudgetGateStateRecordSchema>;

export const ComplexTaskPlanRecordSchema = z.object({
  node: z.literal('complex_task_plan'),
  status: z.enum(['pending', 'completed', 'blocked']),
  summary: z.string(),
  subGoals: z.array(z.string()),
  dependencies: z.array(
    z.object({
      from: z.string(),
      to: z.string()
    })
  ),
  recoveryPoints: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ComplexTaskPlanRecord = z.infer<typeof ComplexTaskPlanRecordSchema>;

export const BlackboardStateRecordSchema = z.object({
  node: z.literal('blackboard_state'),
  taskId: z.string(),
  sessionId: z.string().optional(),
  visibleScopes: z.array(z.enum(['supervisor', 'strategy', 'ministry', 'fallback', 'governance'])),
  refs: z.object({
    traceCount: z.number(),
    evidenceCount: z.number(),
    checkpointId: z.string().optional(),
    activeInterruptId: z.string().optional()
  }),
  updatedAt: z.string()
});

export type BlackboardStateRecord = z.infer<typeof BlackboardStateRecordSchema>;

export const MicroLoopStateRecordSchema = z.object({
  state: z.enum(['idle', 'retrying', 'exhausted', 'completed']),
  attempt: z.number(),
  maxAttempts: z.number(),
  exhaustedReason: z.string().optional(),
  updatedAt: z.string()
});

export type MicroLoopStateRecord = z.infer<typeof MicroLoopStateRecordSchema>;

export const CurrentSkillExecutionRecordSchema = z.object({
  skillId: z.string(),
  displayName: z.string(),
  phase: z.enum(['research', 'execute']),
  stepIndex: z.number(),
  totalSteps: z.number(),
  title: z.string(),
  instruction: z.string(),
  toolNames: z.array(z.string()).optional(),
  updatedAt: z.string()
});

export type CurrentSkillExecutionRecord = z.infer<typeof CurrentSkillExecutionRecordSchema>;

export const AgentExecutionStateSchema = z.object({
  agentId: z.string(),
  role: z.enum(['manager', 'research', 'executor', 'reviewer']),
  goal: z.string(),
  subTask: z.string().optional(),
  plan: z.array(z.string()),
  toolCalls: z.array(z.string()),
  observations: z.array(z.string()),
  shortTermMemory: z.array(z.string()),
  longTermMemoryRefs: z.array(z.string()),
  evaluation: z.unknown().optional(),
  finalOutput: z.string().optional(),
  status: z.enum(['idle', 'running', 'waiting_approval', 'completed', 'failed'])
});

export type AgentExecutionState = z.infer<typeof AgentExecutionStateSchema>;
