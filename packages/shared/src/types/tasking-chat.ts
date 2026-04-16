export {
  ChatCheckpointAgentStatesSchema,
  ChatCheckpointMetadataSchema,
  ChatCheckpointPendingApprovalsSchema,
  ChatCheckpointRecordSchema,
  ChatEventRecordSchema,
  ChatMessageCardSchema,
  ChatMessageRecordSchema,
  ChatSessionApprovalPoliciesSchema,
  ChatSessionCompressionPreviewMessageSchema,
  ChatSessionCompressionRecordSchema,
  ChatSessionRecordSchema,
  ChatThinkStateSchema,
  ChatThoughtChainItemSchema
} from '@agent/core';
import type {
  ChatCheckpointAgentStates,
  ChatCheckpointMetadata,
  ChatCheckpointPendingApprovals,
  ChatEventRecord,
  ChatMessageCard,
  ChatMessageRecord,
  ChatSessionApprovalPolicies,
  ChatSessionCompressionPreviewMessage,
  ChatSessionCompressionRecord,
  ChatSessionRecord,
  TaskCheckpointCursorState,
  ChatThinkState,
  ThoughtGraphRecord,
  TaskCheckpointStreamStatus,
  ChatThoughtChainItem
} from '@agent/core';
import type { ApprovalScopePolicyRecord } from './governance';
import type {
  BlackboardStateRecord,
  BudgetGateStateRecord,
  ComplexTaskPlanRecord,
  CriticStateRecord,
  CritiqueResultRecord,
  CurrentSkillExecutionRecord,
  DispatchInstruction,
  FinalReviewRecord,
  GovernanceReportRecord,
  GovernanceScoreRecord,
  GuardrailStateRecord,
  KnowledgeIndexStateRecord,
  KnowledgeIngestionStateRecord,
  SpecialistFindingRecord,
  SpecialistLeadRecord,
  SpecialistSupportRecord
} from './tasking-orchestration';
import type {
  EntryDecisionRecord,
  ExecutionPlanRecord,
  PartialAggregationRecord,
  PlanDraftRecord,
  PlanMode,
  PlanModeTransitionRecord
} from './tasking-planning';
import type { TaskCheckpointGraphState } from '@agent/core';

export interface ChatCheckpointRecord extends ChatCheckpointMetadata {
  checkpointId: string;
  sessionId: string;
  taskId: string;
  context?: string;
  resolvedWorkflow?: import('./primitives').WorkflowPresetDefinition;
  subgraphTrail?: import('./primitives').SubgraphId[];
  currentNode?: string;
  currentMinistry?: import('./primitives').WorkerDomain;
  currentWorker?: string;
  specialistLead?: SpecialistLeadRecord;
  supportingSpecialists?: SpecialistSupportRecord[];
  specialistFindings?: SpecialistFindingRecord[];
  routeConfidence?: number;
  contextSlicesBySpecialist?: import('./tasking-orchestration').ContextSliceRecord[];
  dispatches?: DispatchInstruction[];
  critiqueResult?: CritiqueResultRecord;
  chatRoute?: import('./primitives').ChatRouteRecord;
  executionSteps?: import('./primitives').ExecutionStepRecord[];
  currentExecutionStep?: import('./primitives').ExecutionStepRecord;
  queueState?: import('./primitives').QueueStateRecord;
  pendingAction?: import('./primitives').PendingActionRecord;
  pendingApproval?: import('./primitives').PendingApprovalRecord;
  approvalFeedback?: string;
  modelRoute?: import('./primitives').ModelRouteDecision[];
  externalSources?: import('./knowledge').EvidenceRecord[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  usedInstalledSkills?: string[];
  usedCompanyWorkers?: string[];
  connectorRefs?: string[];
  requestedHints?: import('./skills').RequestedExecutionHints;
  toolAttachments?: import('./governance').ToolAttachmentRecord[];
  toolUsageSummary?: import('./governance').ToolUsageSummaryRecord[];
  activeInterrupt?: import('./governance').ApprovalInterruptRecord;
  interruptHistory?: import('./governance').ApprovalInterruptRecord[];
  entryDecision?: EntryDecisionRecord;
  executionPlan?: ExecutionPlanRecord;
  budgetGateState?: BudgetGateStateRecord;
  complexTaskPlan?: ComplexTaskPlanRecord;
  blackboardState?: BlackboardStateRecord;
  planMode?: PlanMode;
  executionMode?: import('./primitives').ExecutionMode;
  partialAggregation?: PartialAggregationRecord;
  planModeTransitions?: PlanModeTransitionRecord[];
  planDraft?: PlanDraftRecord;
  capabilityAugmentations?: import('./skills').CapabilityAugmentationRecord[];
  capabilityAttachments?: import('./skills').CapabilityAttachmentRecord[];
  currentSkillExecution?: CurrentSkillExecutionRecord;
  streamStatus?: TaskCheckpointStreamStatus;
  approvalPolicies?: ApprovalScopePolicyRecord[];
  learningEvaluation?: import('./knowledge').LearningEvaluationRecord;
  governanceScore?: GovernanceScoreRecord;
  governanceReport?: GovernanceReportRecord;
  skillSearch?: import('./skills').SkillSearchStateRecord;
  budgetState?: import('./knowledge').BudgetState;
  guardrailState?: GuardrailStateRecord;
  criticState?: CriticStateRecord;
  sandboxState?: import('./tasking-orchestration').SandboxStateRecord;
  knowledgeIngestionState?: KnowledgeIngestionStateRecord;
  knowledgeIndexState?: KnowledgeIndexStateRecord;
  llmUsage?: import('./primitives').LlmUsageRecord;
  backgroundLearningState?: import('@agent/core').TaskBackgroundLearningState;
  traceCursor: TaskCheckpointCursorState['traceCursor'];
  messageCursor: TaskCheckpointCursorState['messageCursor'];
  approvalCursor: TaskCheckpointCursorState['approvalCursor'];
  learningCursor: TaskCheckpointCursorState['learningCursor'];
  graphState: TaskCheckpointGraphState;
  pendingApprovals: ChatCheckpointPendingApprovals['pendingApprovals'];
  agentStates: ChatCheckpointAgentStates['agentStates'];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  thoughtGraph?: ThoughtGraphRecord;
}

export type {
  ChatCheckpointAgentStates,
  ChatCheckpointMetadata,
  ChatCheckpointPendingApprovals,
  ChatEventRecord,
  ChatMessageCard,
  ChatMessageRecord,
  ChatSessionApprovalPolicies,
  ChatSessionCompressionPreviewMessage,
  ChatSessionCompressionRecord,
  ChatSessionRecord,
  TaskCheckpointCursorState,
  TaskCheckpointGraphState,
  TaskCheckpointStreamStatus,
  ChatThinkState,
  ChatThoughtChainItem
} from '@agent/core';
