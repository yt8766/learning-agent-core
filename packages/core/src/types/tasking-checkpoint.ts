import { z } from 'zod';

import { EvidenceRecordSchema } from '../memory';
import { ApprovalRecordSchema, ApprovalScopePolicyRecordSchema } from './governance';
import { ChatThinkStateSchema, ChatThoughtChainItemSchema } from './tasking-chat';
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
  ChatRouteRecordSchema,
  ExecutionStepRecordSchema,
  LlmUsageRecordSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  QueueStateRecordSchema,
  WorkflowPresetDefinitionSchema
} from './primitives';
import { ChannelIdentitySchema } from './tasking-session';
import {
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDraftRecordSchema,
  PlanModeTransitionRecordSchema
} from './tasking-planning';
import { ThoughtGraphRecordSchema } from './tasking-thought-graph';
import {
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema
} from './tasking-runtime-state';

export const ChatCheckpointPendingApprovalsSchema = z.object({
  pendingApprovals: z.array(ApprovalRecordSchema)
});

export type ChatCheckpointPendingApprovals = z.infer<typeof ChatCheckpointPendingApprovalsSchema>;

export const ChatCheckpointAgentStatesSchema = z.object({
  agentStates: z.array(AgentExecutionStateSchema)
});

export type ChatCheckpointAgentStates = z.infer<typeof ChatCheckpointAgentStatesSchema>;

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

export type ChatCheckpointMetadata = z.infer<typeof ChatCheckpointMetadataSchema>;

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
  traceCursor: TaskCheckpointCursorStateSchema.shape.traceCursor,
  messageCursor: TaskCheckpointCursorStateSchema.shape.messageCursor,
  approvalCursor: TaskCheckpointCursorStateSchema.shape.approvalCursor,
  learningCursor: TaskCheckpointCursorStateSchema.shape.learningCursor,
  graphState: TaskCheckpointGraphStateSchema,
  pendingApprovals: z.array(ApprovalRecordSchema),
  agentStates: z.array(AgentExecutionStateSchema),
  thoughtChain: z.array(ChatThoughtChainItemSchema).optional(),
  thinkState: ChatThinkStateSchema.optional(),
  thoughtGraph: ThoughtGraphRecordSchema.optional(),
  resolvedWorkflow: WorkflowPresetDefinitionSchema.optional(),
  subgraphTrail: z.array(z.string()).optional(),
  specialistLead: SpecialistLeadRecordSchema.optional(),
  supportingSpecialists: z.array(SpecialistSupportRecordSchema).optional(),
  specialistFindings: z.array(SpecialistFindingRecordSchema).optional(),
  contextSlicesBySpecialist: z.array(ContextSliceRecordSchema).optional(),
  dispatches: z.array(DispatchInstructionSchema).optional(),
  critiqueResult: CritiqueResultRecordSchema.optional(),
  chatRoute: ChatRouteRecordSchema.optional(),
  executionSteps: z.array(ExecutionStepRecordSchema).optional(),
  currentExecutionStep: ExecutionStepRecordSchema.optional(),
  queueState: QueueStateRecordSchema.optional(),
  pendingAction: PendingActionRecordSchema.optional(),
  pendingApproval: PendingApprovalRecordSchema.optional(),
  modelRoute: z.array(ModelRouteDecisionSchema).optional(),
  externalSources: z.array(EvidenceRecordSchema).optional(),
  reusedMemories: z.array(z.string()).optional(),
  reusedRules: z.array(z.string()).optional(),
  reusedSkills: z.array(z.string()).optional(),
  usedInstalledSkills: z.array(z.string()).optional(),
  usedCompanyWorkers: z.array(z.string()).optional(),
  connectorRefs: z.array(z.string()).optional(),
  requestedHints: z.any().optional(),
  toolAttachments: z.array(z.any()).optional(),
  toolUsageSummary: z.array(z.any()).optional(),
  activeInterrupt: z.any().optional(),
  interruptHistory: z.array(z.any()).optional(),
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
  capabilityAttachments: z.array(z.any()).optional(),
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

export type ChatCheckpointRecord = z.infer<typeof ChatCheckpointRecordSchema>;
