import { z } from 'zod';

import { EvidenceRecordSchema, LearningCandidateRecordSchema } from '../../memory';
import { ApprovalRecordSchema, ToolAttachmentRecordSchema, ToolUsageSummaryRecordSchema } from '../../governance';
import { PlatformApprovalInterruptRecordSchema } from '../../platform-console';
import {
  ChatCheckpointAgentStatesSchema,
  ChatCheckpointSharedStringRefsSchema,
  ChatCheckpointSpecialistStateSchema
} from './checkpoint';
import {
  AgentMessageRecordSchema,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextFilterRecordSchema,
  CriticStateRecordSchema,
  CurrentSkillExecutionRecordSchema,
  EvaluationReportRecordSchema,
  FinalReviewRecordSchema,
  GuardrailStateRecordSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  InternalSubAgentResultSchema,
  KnowledgeIndexStateRecordSchema,
  KnowledgeIngestionStateRecordSchema,
  ManagerPlanSchema,
  MicroLoopStateRecordSchema,
  ReviewRecordSchema,
  SandboxStateRecordSchema
} from './orchestration';
import {
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDraftRecordSchema,
  PlanModeTransitionRecordSchema
} from './planning';
import { TaskBackgroundLearningStateSchema, TaskModeGateStateSchema } from './runtime-state';
import {
  CapabilityAttachmentRecordSchema,
  CapabilityAugmentationRecordSchema,
  RequestedExecutionHintsSchema,
  SkillSearchStateRecordSchema
} from '../../skills';
import { BudgetStateSchema, LearningEvaluationRecordSchema } from '../../knowledge';
import {
  ChatRouteRecordSchema,
  ExecutionStepRecordSchema,
  LlmUsageRecordSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  QueueStateRecordSchema,
  TaskStatusSchema,
  WorkflowPresetDefinitionSchema
} from '../../primitives';
import { ExecutionTraceSchema } from '../../execution-trace';

export const TaskRecordExecutionStateSchema = z.object({
  currentStep: z.string().optional(),
  retryCount: z.number().optional(),
  maxRetries: z.number().optional(),
  revisionCount: z.number().optional(),
  maxRevisions: z.number().optional(),
  microLoopCount: z.number().optional(),
  maxMicroLoops: z.number().optional(),
  microLoopState: MicroLoopStateRecordSchema.optional(),
  revisionState: z.enum(['idle', 'needs_revision', 'revising', 'blocked', 'completed']).optional()
});

export const TaskRecordAgentOutputsSchema = z.object({
  agentStates: ChatCheckpointAgentStatesSchema.shape.agentStates,
  messages: z.array(AgentMessageRecordSchema)
});

export const TaskRecordPlanningStateSchema = z.object({
  entryDecision: EntryDecisionRecordSchema.optional(),
  executionPlan: ExecutionPlanRecordSchema.optional(),
  plan: ManagerPlanSchema.optional(),
  planMode: z.enum(['intent', 'implementation', 'finalized', 'aborted']).optional(),
  executionMode: z.enum(['standard', 'planning-readonly', 'plan', 'execute', 'imperial_direct']).optional(),
  partialAggregation: PartialAggregationRecordSchema.optional(),
  planModeTransitions: z.array(PlanModeTransitionRecordSchema).optional(),
  planDraft: PlanDraftRecordSchema.optional()
});

export const TaskRecordSchema = z.object({
  id: z.string(),
  goal: z.string(),
  context: z.string().optional(),
  status: TaskStatusSchema,
  sessionId: z.string().optional(),
  runId: z.string().optional(),
  traceId: z.string().optional(),
  skillId: z.string().optional(),
  skillStage: z.string().optional(),
  resolvedWorkflow: WorkflowPresetDefinitionSchema.optional(),
  subgraphTrail: z.array(z.string()).optional(),
  currentNode: z.string().optional(),
  currentMinistry: z.string().optional(),
  currentWorker: z.string().optional(),
  specialistLead: ChatCheckpointSpecialistStateSchema.shape.specialistLead,
  supportingSpecialists: ChatCheckpointSpecialistStateSchema.shape.supportingSpecialists,
  specialistFindings: ChatCheckpointSpecialistStateSchema.shape.specialistFindings,
  routeConfidence: z.number().optional(),
  contextSlicesBySpecialist: ChatCheckpointSpecialistStateSchema.shape.contextSlicesBySpecialist,
  dispatches: ChatCheckpointSpecialistStateSchema.shape.dispatches,
  critiqueResult: ChatCheckpointSpecialistStateSchema.shape.critiqueResult,
  chatRoute: ChatRouteRecordSchema.optional(),
  executionSteps: z.array(ExecutionStepRecordSchema).optional(),
  currentExecutionStep: ExecutionStepRecordSchema.optional(),
  queueState: QueueStateRecordSchema.optional(),
  pendingAction: PendingActionRecordSchema.optional(),
  pendingApproval: PendingApprovalRecordSchema.optional(),
  approvalFeedback: z.string().optional(),
  modelRoute: z.array(ModelRouteDecisionSchema).optional(),
  currentStep: TaskRecordExecutionStateSchema.shape.currentStep,
  retryCount: TaskRecordExecutionStateSchema.shape.retryCount,
  maxRetries: TaskRecordExecutionStateSchema.shape.maxRetries,
  revisionCount: TaskRecordExecutionStateSchema.shape.revisionCount,
  maxRevisions: TaskRecordExecutionStateSchema.shape.maxRevisions,
  microLoopCount: TaskRecordExecutionStateSchema.shape.microLoopCount,
  maxMicroLoops: TaskRecordExecutionStateSchema.shape.maxMicroLoops,
  microLoopState: TaskRecordExecutionStateSchema.shape.microLoopState,
  revisionState: TaskRecordExecutionStateSchema.shape.revisionState,
  trace: z.array(ExecutionTraceSchema),
  approvals: z.array(ApprovalRecordSchema),
  result: z.string().optional(),
  plan: TaskRecordPlanningStateSchema.shape.plan,
  entryDecision: TaskRecordPlanningStateSchema.shape.entryDecision,
  executionPlan: TaskRecordPlanningStateSchema.shape.executionPlan,
  budgetGateState: BudgetGateStateRecordSchema.optional(),
  complexTaskPlan: ComplexTaskPlanRecordSchema.optional(),
  blackboardState: BlackboardStateRecordSchema.optional(),
  mainChainNode: z.string().optional(),
  modeGateState: TaskModeGateStateSchema.optional(),
  contextFilterState: ContextFilterRecordSchema.optional(),
  guardrailState: GuardrailStateRecordSchema.optional(),
  criticState: CriticStateRecordSchema.optional(),
  sandboxState: SandboxStateRecordSchema.optional(),
  finalReviewState: FinalReviewRecordSchema.optional(),
  governanceScore: GovernanceScoreRecordSchema.optional(),
  governanceReport: GovernanceReportRecordSchema.optional(),
  libuEvaluationReportId: z.string().optional(),
  evaluationReport: EvaluationReportRecordSchema.optional(),
  planMode: TaskRecordPlanningStateSchema.shape.planMode,
  executionMode: TaskRecordPlanningStateSchema.shape.executionMode,
  partialAggregation: TaskRecordPlanningStateSchema.shape.partialAggregation,
  internalSubAgents: z.array(InternalSubAgentResultSchema).optional(),
  interruptOrigin: z.enum(['counselor_proxy', 'runtime', 'timeout', 'budget', 'review']).optional(),
  planModeTransitions: TaskRecordPlanningStateSchema.shape.planModeTransitions,
  planDraft: TaskRecordPlanningStateSchema.shape.planDraft,
  agentStates: TaskRecordAgentOutputsSchema.shape.agentStates,
  messages: TaskRecordAgentOutputsSchema.shape.messages,
  review: ReviewRecordSchema.optional(),
  learningCandidates: z.array(LearningCandidateRecordSchema).optional(),
  externalSources: z.array(EvidenceRecordSchema).optional(),
  reusedMemories: ChatCheckpointSharedStringRefsSchema.shape.reusedMemories,
  reusedRules: ChatCheckpointSharedStringRefsSchema.shape.reusedRules,
  reusedSkills: ChatCheckpointSharedStringRefsSchema.shape.reusedSkills,
  usedInstalledSkills: ChatCheckpointSharedStringRefsSchema.shape.usedInstalledSkills,
  usedCompanyWorkers: ChatCheckpointSharedStringRefsSchema.shape.usedCompanyWorkers,
  connectorRefs: ChatCheckpointSharedStringRefsSchema.shape.connectorRefs,
  requestedHints: RequestedExecutionHintsSchema.optional(),
  toolAttachments: z.array(ToolAttachmentRecordSchema).optional(),
  toolUsageSummary: z.array(ToolUsageSummaryRecordSchema).optional(),
  activeInterrupt: PlatformApprovalInterruptRecordSchema.optional(),
  interruptHistory: z.array(PlatformApprovalInterruptRecordSchema).optional(),
  budgetState: BudgetStateSchema.optional(),
  knowledgeIngestionState: KnowledgeIngestionStateRecordSchema.optional(),
  knowledgeIndexState: KnowledgeIndexStateRecordSchema.optional(),
  capabilityAugmentations: z.array(CapabilityAugmentationRecordSchema).optional(),
  capabilityAttachments: z.array(CapabilityAttachmentRecordSchema).optional(),
  llmUsage: LlmUsageRecordSchema.optional(),
  currentSkillExecution: CurrentSkillExecutionRecordSchema.optional(),
  learningEvaluation: LearningEvaluationRecordSchema.optional(),
  skillSearch: SkillSearchStateRecordSchema.optional(),
  learningQueueItemId: z.string().optional(),
  backgroundLearningState: TaskBackgroundLearningStateSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
