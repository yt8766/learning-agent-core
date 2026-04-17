import { z } from 'zod';

import { EvidenceRecordSchema } from '../memory';
import { ApprovalRecordSchema, ApprovalScopePolicyRecordSchema } from './governance';
import { PlatformApprovalInterruptRecordSchema } from './platform-console';
import {
  AgentExecutionStateSchema,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextSliceRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema
} from './tasking-orchestration';
import {
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDraftRecordSchema,
  PlanModeTransitionRecordSchema
} from './tasking-planning';
import {
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema
} from './tasking-runtime-state';
import { ChatThinkStateSchema, ChatThoughtChainItemSchema } from './tasking-chat';
import { ChannelIdentitySchema } from './tasking-session';
import { CapabilityAttachmentRecordSchema, RequestedExecutionHintsSchema } from './skills';
import {
  ChatRouteRecordSchema,
  ExecutionStepRecordSchema,
  LlmUsageRecordSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  QueueStateRecordSchema,
  WorkflowPresetDefinitionSchema
} from './primitives';
import { ThoughtGraphRecordSchema } from '../types/tasking-thought-graph';

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
  toolAttachments: z.array(z.any()).optional(),
  toolUsageSummary: z.array(z.any()).optional(),
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
  capabilityAugmentations: z.array(z.any()).optional(),
  capabilityAttachments: z.array(CapabilityAttachmentRecordSchema).optional(),
  currentSkillExecution: CurrentSkillExecutionRecordSchema.optional(),
  learningEvaluation: z.any().optional(),
  governanceScore: GovernanceScoreRecordSchema.optional(),
  governanceReport: GovernanceReportRecordSchema.optional(),
  skillSearch: z.any().optional(),
  budgetState: z.any().optional(),
  guardrailState: z.any().optional(),
  criticState: z.any().optional(),
  sandboxState: z.any().optional(),
  knowledgeIngestionState: z.any().optional(),
  knowledgeIndexState: z.any().optional(),
  llmUsage: LlmUsageRecordSchema.optional()
});
