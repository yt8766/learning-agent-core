import { z } from 'zod';

import { EvidenceRecordSchema } from '../../memory';
import {
  ApprovalRecordSchema,
  ApprovalScopePolicyRecordSchema,
  ToolAttachmentRecordSchema,
  ToolUsageSummaryRecordSchema
} from '../../governance';
import { PlatformApprovalInterruptRecordSchema } from '../../platform-console';
import {
  AgentExecutionStateSchema,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextSliceRecordSchema,
  CriticStateRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  GuardrailStateRecordSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  KnowledgeIndexStateRecordSchema,
  KnowledgeIngestionStateRecordSchema,
  SandboxStateRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema
} from './orchestration';
import {
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDraftRecordSchema,
  PlanModeTransitionRecordSchema
} from './planning';
import { BudgetStateSchema, LearningEvaluationRecordSchema } from '../../knowledge';
import {
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema
} from './runtime-state';
import { ChatThinkStateSchema, ChatThoughtChainItemSchema } from './chat';
import { ChannelIdentitySchema } from './session';
import {
  CapabilityAttachmentRecordSchema,
  CapabilityAugmentationRecordSchema,
  RequestedExecutionHintsSchema,
  SkillSearchStateRecordSchema
} from '../../skills';
import {
  ChatRouteRecordSchema,
  ExecutionStepRecordSchema,
  LlmUsageRecordSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  QueueStateRecordSchema,
  WorkflowPresetDefinitionSchema
} from '../../primitives';
import { ThoughtGraphRecordSchema } from './thought-graph';

export const ChatCheckpointCursorFieldsSchema = z.object({
  traceCursor: TaskCheckpointCursorStateSchema.shape.traceCursor,
  messageCursor: TaskCheckpointCursorStateSchema.shape.messageCursor,
  approvalCursor: TaskCheckpointCursorStateSchema.shape.approvalCursor,
  learningCursor: TaskCheckpointCursorStateSchema.shape.learningCursor
});

export const ChatCheckpointPendingApprovalsSchema = z.object({
  pendingApprovals: z.array(ApprovalRecordSchema)
});

export const ChatCheckpointAgentStatesSchema = z.object({
  agentStates: z.array(AgentExecutionStateSchema)
});

export const ChatCheckpointMetadataSchema = z.object({
  checkpointId: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  channelIdentity: ChannelIdentitySchema.optional(),
  runId: z.string().optional(),
  traceId: z.string().optional(),
  skillId: z.string().optional(),
  skillStage: z.string().optional(),
  learningQueueItemId: z.string().optional(),
  recoverability: z.enum(['safe', 'partial', 'unsafe']).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ChatCheckpointSharedStringRefsSchema = z.object({
  reusedMemories: z.array(z.string()).optional(),
  reusedRules: z.array(z.string()).optional(),
  reusedSkills: z.array(z.string()).optional(),
  usedInstalledSkills: z.array(z.string()).optional(),
  usedCompanyWorkers: z.array(z.string()).optional(),
  connectorRefs: z.array(z.string()).optional()
});

export const ChatCheckpointSpecialistStateSchema = z.object({
  specialistLead: SpecialistLeadRecordSchema.optional(),
  supportingSpecialists: z.array(SpecialistSupportRecordSchema).optional(),
  specialistFindings: z.array(SpecialistFindingRecordSchema).optional(),
  contextSlicesBySpecialist: z.array(ContextSliceRecordSchema).optional(),
  dispatches: z.array(DispatchInstructionSchema).optional(),
  critiqueResult: CritiqueResultRecordSchema.optional()
});

export const ChatCheckpointRecordSchema = ChatCheckpointMetadataSchema.extend({
  context: z.string().optional(),
  currentNode: z.string().optional(),
  currentMinistry: z.string().optional(),
  currentWorker: z.string().optional(),
  routeConfidence: z.number().optional(),
  approvalFeedback: z.string().optional(),
  streamStatus: TaskCheckpointStreamStatusSchema.optional(),
  approvalPolicies: z.array(ApprovalScopePolicyRecordSchema).optional(),
  backgroundLearningState: TaskBackgroundLearningStateSchema.optional(),
  traceCursor: ChatCheckpointCursorFieldsSchema.shape.traceCursor,
  messageCursor: ChatCheckpointCursorFieldsSchema.shape.messageCursor,
  approvalCursor: ChatCheckpointCursorFieldsSchema.shape.approvalCursor,
  learningCursor: ChatCheckpointCursorFieldsSchema.shape.learningCursor,
  graphState: TaskCheckpointGraphStateSchema,
  pendingApprovals: z.array(ApprovalRecordSchema),
  agentStates: z.array(AgentExecutionStateSchema),
  thoughtChain: z.array(ChatThoughtChainItemSchema).optional(),
  thinkState: ChatThinkStateSchema.optional(),
  thoughtGraph: ThoughtGraphRecordSchema.optional(),
  resolvedWorkflow: WorkflowPresetDefinitionSchema.optional(),
  subgraphTrail: z.array(z.string()).optional(),
  specialistLead: ChatCheckpointSpecialistStateSchema.shape.specialistLead,
  supportingSpecialists: ChatCheckpointSpecialistStateSchema.shape.supportingSpecialists,
  specialistFindings: ChatCheckpointSpecialistStateSchema.shape.specialistFindings,
  contextSlicesBySpecialist: ChatCheckpointSpecialistStateSchema.shape.contextSlicesBySpecialist,
  dispatches: ChatCheckpointSpecialistStateSchema.shape.dispatches,
  critiqueResult: ChatCheckpointSpecialistStateSchema.shape.critiqueResult,
  chatRoute: ChatRouteRecordSchema.optional(),
  executionSteps: z.array(ExecutionStepRecordSchema).optional(),
  currentExecutionStep: ExecutionStepRecordSchema.optional(),
  queueState: QueueStateRecordSchema.optional(),
  pendingAction: PendingActionRecordSchema.optional(),
  pendingApproval: PendingApprovalRecordSchema.optional(),
  modelRoute: z.array(ModelRouteDecisionSchema).optional(),
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
  entryDecision: EntryDecisionRecordSchema.optional(),
  executionPlan: ExecutionPlanRecordSchema.optional(),
  budgetGateState: BudgetGateStateRecordSchema.optional(),
  complexTaskPlan: ComplexTaskPlanRecordSchema.optional(),
  blackboardState: BlackboardStateRecordSchema.optional(),
  planMode: z.enum(['intent', 'implementation', 'finalized', 'aborted']).optional(),
  executionMode: z.enum(['standard', 'planning-readonly', 'plan', 'execute', 'imperial_direct']).optional(),
  partialAggregation: PartialAggregationRecordSchema.optional(),
  planModeTransitions: z.array(PlanModeTransitionRecordSchema).optional(),
  planDraft: PlanDraftRecordSchema.optional(),
  capabilityAugmentations: z.array(CapabilityAugmentationRecordSchema).optional(),
  capabilityAttachments: z.array(CapabilityAttachmentRecordSchema).optional(),
  currentSkillExecution: CurrentSkillExecutionRecordSchema.optional(),
  learningEvaluation: LearningEvaluationRecordSchema.optional(),
  governanceScore: GovernanceScoreRecordSchema.optional(),
  governanceReport: GovernanceReportRecordSchema.optional(),
  skillSearch: SkillSearchStateRecordSchema.optional(),
  budgetState: BudgetStateSchema.optional(),
  guardrailState: GuardrailStateRecordSchema.optional(),
  criticState: CriticStateRecordSchema.optional(),
  sandboxState: SandboxStateRecordSchema.optional(),
  knowledgeIngestionState: KnowledgeIngestionStateRecordSchema.optional(),
  knowledgeIndexState: KnowledgeIndexStateRecordSchema.optional(),
  llmUsage: LlmUsageRecordSchema.optional()
});
