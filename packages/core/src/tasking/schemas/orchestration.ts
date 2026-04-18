import { z } from 'zod';

import { ChatRoleSchema, ReviewDecisionSchema, RiskLevelSchema } from '../../primitives';
import { PlanQuestionRecordSchema } from './planning';

export const AgentMessageRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  from: z.enum(['manager', 'research', 'executor', 'reviewer']),
  to: z.enum(['manager', 'research', 'executor', 'reviewer']),
  type: z.enum(['dispatch', 'research_result', 'execution_result', 'review_result', 'summary', 'summary_delta']),
  content: z.string(),
  createdAt: z.string()
});

export const SubTaskRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  assignedTo: z.enum(['manager', 'research', 'executor', 'reviewer']),
  status: z.enum(['pending', 'running', 'completed', 'blocked'])
});

export const ManagerPlanSchema = z.object({
  id: z.string(),
  goal: z.string(),
  summary: z.string(),
  steps: z.array(z.string()),
  subTasks: z.array(SubTaskRecordSchema),
  createdAt: z.string()
});

export const ReviewRecordSchema = z.object({
  taskId: z.string(),
  decision: z.enum(['approved', 'retry', 'blocked']),
  notes: z.array(z.string()),
  createdAt: z.string()
});

export const DispatchInstructionSchema = z.object({
  taskId: z.string(),
  subTaskId: z.string(),
  from: z.enum(['manager', 'research', 'executor', 'reviewer']),
  to: z.enum(['manager', 'research', 'executor', 'reviewer']),
  kind: z.enum(['strategy', 'ministry', 'fallback']),
  objective: z.string()
});

export const AgentTokenEventSchema = z.object({
  taskId: z.string(),
  role: z.enum(['manager', 'research', 'executor', 'reviewer']),
  messageId: z.string(),
  token: z.string(),
  model: z.string().optional(),
  createdAt: z.string()
});

export const SpecialistLeadRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  domain: z.string(),
  reason: z.string().optional()
});

export const SpecialistSupportRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  domain: z.string(),
  reason: z.string().optional()
});

export const SpecialistFindingRecordSchema = z.object({
  specialistId: z.string(),
  role: z.enum(['lead', 'support']),
  contractVersion: z.literal('specialist-finding.v1'),
  source: z.enum(['route', 'research', 'execution', 'critique']),
  stage: z.enum(['planning', 'research', 'execution', 'review']),
  summary: z.string(),
  domain: z.string(),
  riskLevel: RiskLevelSchema.optional(),
  blockingIssues: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  confidence: z.number().optional()
});

export const ContextSliceRecentTurnSchema = z.object({
  role: ChatRoleSchema,
  content: z.string()
});

export const ContextSliceRecordSchema = z.object({
  specialistId: z.string(),
  summary: z.string().optional(),
  recentTurns: z.array(ContextSliceRecentTurnSchema).optional(),
  relatedHistory: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  domainInstruction: z.string().optional(),
  outputInstruction: z.string().optional()
});

export const CritiqueResultRecordSchema = z.object({
  contractVersion: z.literal('critique-result.v1'),
  decision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']),
  summary: z.string(),
  blockingIssues: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  shouldBlockEarly: z.boolean().optional()
});

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

export const GovernanceDimensionSchema = z.object({
  score: z.number(),
  summary: z.string()
});

export const GovernanceReviewOutcomeSchema = z.object({
  decision: z.union([
    ReviewDecisionSchema,
    z.literal('pass'),
    z.literal('revise_required'),
    z.literal('needs_human_approval')
  ]),
  summary: z.string()
});

export const GovernanceInterruptLoadSchema = z.object({
  interruptCount: z.number(),
  microLoopCount: z.number(),
  summary: z.string()
});

export const GovernanceReportRecordSchema = z.object({
  ministry: z.literal('libu-governance'),
  summary: z.string(),
  executionQuality: GovernanceDimensionSchema,
  evidenceSufficiency: GovernanceDimensionSchema,
  sandboxReliability: GovernanceDimensionSchema,
  reviewOutcome: GovernanceReviewOutcomeSchema,
  interruptLoad: GovernanceInterruptLoadSchema,
  businessFeedback: GovernanceDimensionSchema,
  recommendedLearningTargets: z.array(z.enum(['memory', 'rule', 'skill'])),
  trustAdjustment: z.enum(['promote', 'hold', 'downgrade']),
  updatedAt: z.string()
});

export const BudgetGateStateRecordSchema = z.object({
  node: z.literal('budget_gate'),
  status: z.enum(['open', 'soft_blocked', 'hard_blocked', 'throttled']),
  summary: z.string(),
  queueDepth: z.number().optional(),
  rateLimitKey: z.string().optional(),
  triggeredAt: z.string().optional(),
  updatedAt: z.string()
});

export const ComplexTaskPlanDependencySchema = z.object({
  from: z.string(),
  to: z.string()
});

export const ComplexTaskPlanRecordSchema = z.object({
  node: z.literal('complex_task_plan'),
  status: z.enum(['pending', 'completed', 'blocked']),
  summary: z.string(),
  subGoals: z.array(z.string()),
  dependencies: z.array(ComplexTaskPlanDependencySchema),
  recoveryPoints: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const BlackboardRefsSchema = z.object({
  traceCount: z.number(),
  evidenceCount: z.number(),
  checkpointId: z.string().optional(),
  activeInterruptId: z.string().optional()
});

export const BlackboardStateRecordSchema = z.object({
  node: z.literal('blackboard_state'),
  taskId: z.string(),
  sessionId: z.string().optional(),
  visibleScopes: z.array(z.enum(['supervisor', 'strategy', 'ministry', 'fallback', 'governance'])),
  refs: BlackboardRefsSchema,
  updatedAt: z.string()
});

export const MicroLoopStateRecordSchema = z.object({
  state: z.enum(['idle', 'retrying', 'exhausted', 'completed']),
  attempt: z.number(),
  maxAttempts: z.number(),
  exhaustedReason: z.string().optional(),
  updatedAt: z.string()
});

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

export const ContextFilterPipelineAuditRecordSchema = z.object({
  stage: z.enum([
    'large_result_offload',
    'micro_compression',
    'history_trim',
    'projection',
    'conversation_summary',
    'reactive_compact_retry'
  ]),
  applied: z.boolean(),
  reason: z.string(),
  originalSize: z.number().optional(),
  compactedSize: z.number().optional(),
  artifactIds: z.array(z.string()).optional(),
  triggeredBy: z.string().optional()
});

export const ContextFilterSummaryRecordSchema = z.object({
  summary: z.string(),
  historyTraceCount: z.number(),
  evidenceCount: z.number(),
  specialistCount: z.number(),
  ministryCount: z.number(),
  compressionApplied: z.boolean().optional(),
  compressionSource: z.enum(['heuristic', 'llm']).optional(),
  compressedMessageCount: z.number().optional(),
  artifactCount: z.number().optional(),
  originalCharacterCount: z.number().optional(),
  compactedCharacterCount: z.number().optional(),
  reactiveRetryCount: z.number().optional(),
  pipelineAudit: z.array(ContextFilterPipelineAuditRecordSchema).optional()
});

export const ContextFilterAudienceSliceSchema = z.object({
  summary: z.string(),
  dispatchCount: z.number()
});

export const ContextFilterRecordSchema = z.object({
  node: z.literal('context_filter'),
  status: z.enum(['pending', 'completed', 'blocked']),
  filteredContextSlice: ContextFilterSummaryRecordSchema,
  audienceSlices: z
    .object({
      strategy: ContextFilterAudienceSliceSchema,
      ministry: ContextFilterAudienceSliceSchema,
      fallback: ContextFilterAudienceSliceSchema
    })
    .optional(),
  dispatchOrder: z.array(z.enum(['strategy', 'ministry', 'fallback'])).optional(),
  noiseGuards: z.array(z.string()).optional(),
  hiddenTraceCount: z.number().optional(),
  redactedKeys: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const FinalReviewRecordSchema = z.object({
  node: z.literal('final_review'),
  ministry: z.string(),
  decision: z.enum(['pass', 'revise_required', 'block']),
  summary: z.string(),
  interruptRequired: z.boolean(),
  deliveryStatus: z.enum(['pending', 'delivered', 'interrupted']).optional(),
  deliveryMinistry: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const GuardrailStateRecordSchema = z.object({
  stage: z.enum(['pre', 'post']),
  verdict: z.enum(['pass_through', 'rewrite_required', 'block']),
  summary: z.string(),
  eventId: z.string().optional(),
  updatedAt: z.string()
});

export const CriticStateRecordSchema = z.object({
  node: z.literal('critic'),
  decision: z.enum(['pass_through', 'rewrite_required']),
  summary: z.string(),
  blockingIssues: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const SandboxStateRecordSchema = z.object({
  node: z.literal('sandbox'),
  stage: z.enum(['gongbu', 'bingbu', 'review']),
  status: z.enum(['idle', 'running', 'passed', 'failed', 'exhausted']),
  attempt: z.number(),
  maxAttempts: z.number(),
  verdict: z.enum(['safe', 'unsafe', 'retry']).optional(),
  exhaustedReason: z.string().optional(),
  updatedAt: z.string()
});

export const KnowledgeIngestionStateRecordSchema = z.object({
  node: z.literal('knowledge_ingestion'),
  store: z.enum(['wenyuan', 'cangjing']),
  sourceId: z.string().optional(),
  receiptId: z.string().optional(),
  status: z.enum(['idle', 'queued', 'processing', 'completed', 'partial', 'failed']),
  updatedAt: z.string()
});

export const KnowledgeIndexStateRecordSchema = z.object({
  node: z.literal('knowledge_index'),
  store: z.enum(['wenyuan', 'cangjing']),
  indexStatus: z.enum(['ready', 'partial', 'building', 'failed']),
  searchableDocumentCount: z.number().optional(),
  blockedDocumentCount: z.number().optional(),
  updatedAt: z.string()
});

export const EvaluationReportRecordSchema = z.object({
  id: z.string(),
  ministry: z.literal('libu-governance'),
  score: z.number(),
  summary: z.string(),
  rlaifNotes: z.array(z.string()),
  derivedFromTaskId: z.string(),
  derivedFromTraceId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const InternalSubAgentResultSchema = z.object({
  agentId: z.string(),
  status: z.enum(['continue', 'needs_user_input', 'needs_revision', 'blocked']),
  interactionKind: z.enum(['plan-question', 'supplemental-input']).optional(),
  summary: z.string().optional(),
  questions: z.array(PlanQuestionRecordSchema).optional(),
  createdAt: z.string()
});

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
