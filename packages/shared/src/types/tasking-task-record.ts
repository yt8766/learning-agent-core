export {
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema,
  TaskRecordSchema,
  TaskModeGateStateSchema
} from '@agent/core';
import type {
  TaskBackgroundLearningState,
  TaskCheckpointCursorState,
  TaskCheckpointGraphState,
  TaskCheckpointStreamStatus,
  TaskRecord as CoreTaskRecord,
  TaskModeGateState
} from '@agent/core';
import type {
  ApprovalInterruptRecord,
  ApprovalPolicyRecord,
  ApprovalRecord,
  ConnectorHealthRecord
} from './governance';
import type {
  ChatRouteRecord,
  CheckpointRef,
  ExecutionPlanMode,
  ExecutionStepRecord,
  LlmUsageRecord,
  MainChainNode,
  ModelRouteDecision,
  PendingActionRecord,
  PendingApprovalRecord,
  QueueStateRecord,
  TaskStatus,
  WorkerDomain,
  WorkflowApprovalPolicy,
  WorkflowPresetDefinition
} from './primitives';
import type { EvidenceRecord } from './knowledge';
import type { ProfilePolicyHintRecord } from './skills';
import type {
  AgentExecutionState,
  AgentMessage,
  BlackboardStateRecord,
  BudgetGateStateRecord,
  ComplexTaskPlanRecord,
  ContextFilterRecord,
  CriticStateRecord,
  CritiqueResultRecord,
  DispatchInstruction,
  EvaluationReportRecord,
  FinalReviewRecord,
  GovernanceReportRecord,
  GovernanceScoreRecord,
  GuardrailStateRecord,
  InternalSubAgentResult,
  KnowledgeIndexStateRecord,
  KnowledgeIngestionStateRecord,
  LearningCandidateRecord,
  ManagerPlan,
  MicroLoopStateRecord,
  ReviewRecord,
  SandboxStateRecord,
  SpecialistFindingRecord,
  SpecialistLeadRecord,
  SpecialistSupportRecord
} from './tasking-orchestration';
import type { TaskRuntimeDecorations } from './tasking-runtime-decorations';
import type {
  EntryDecisionRecord,
  ExecutionPlanRecord,
  PartialAggregationRecord,
  PlanDraftRecord,
  PlanMode,
  PlanModeTransitionRecord
} from './tasking-planning';

export interface TaskRecord extends TaskRuntimeDecorations, Omit<CoreTaskRecord, 'resolvedWorkflow'> {
  status: TaskStatus;
  resolvedWorkflow?: WorkflowPresetDefinition;
  currentMinistry?: WorkerDomain;
  specialistLead?: SpecialistLeadRecord;
  supportingSpecialists?: SpecialistSupportRecord[];
  specialistFindings?: SpecialistFindingRecord[];
  dispatches?: DispatchInstruction[];
  critiqueResult?: CritiqueResultRecord;
  chatRoute?: ChatRouteRecord;
  executionSteps?: ExecutionStepRecord[];
  currentExecutionStep?: ExecutionStepRecord;
  queueState?: QueueStateRecord;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
  modelRoute?: ModelRouteDecision[];
  microLoopState?: MicroLoopStateRecord;
  trace: import('./knowledge').ExecutionTrace[];
  approvals: ApprovalRecord[];
  plan?: ManagerPlan;
  entryDecision?: EntryDecisionRecord;
  executionPlan?: ExecutionPlanRecord;
  budgetGateState?: BudgetGateStateRecord;
  complexTaskPlan?: ComplexTaskPlanRecord;
  blackboardState?: BlackboardStateRecord;
  mainChainNode?: MainChainNode;
  contextFilterState?: ContextFilterRecord;
  guardrailState?: GuardrailStateRecord;
  criticState?: CriticStateRecord;
  sandboxState?: SandboxStateRecord;
  finalReviewState?: FinalReviewRecord;
  governanceScore?: GovernanceScoreRecord;
  governanceReport?: GovernanceReportRecord;
  evaluationReport?: EvaluationReportRecord;
  partialAggregation?: PartialAggregationRecord;
  internalSubAgents?: InternalSubAgentResult[];
  interruptOrigin?: ApprovalInterruptRecord['origin'];
  messages: AgentMessage[];
  review?: ReviewRecord;
  learningCandidates?: LearningCandidateRecord[];
  externalSources?: EvidenceRecord[];
  budgetState?: import('./knowledge').BudgetState;
  knowledgeIngestionState?: KnowledgeIngestionStateRecord;
  knowledgeIndexState?: KnowledgeIndexStateRecord;
  llmUsage?: LlmUsageRecord;
}

export interface ConnectorCapabilityPolicySummary {
  approvalPolicy?: WorkflowApprovalPolicy;
  profilePolicy?: ProfilePolicyHintRecord;
  healthChecks?: ConnectorHealthRecord[];
  approvalPolicies?: ApprovalPolicyRecord[];
  checkpointRef?: CheckpointRef;
}

export type { HealthCheckResult } from '@agent/core';
export type {
  TaskBackgroundLearningState,
  TaskCheckpointCursorState,
  TaskCheckpointGraphState,
  TaskCheckpointStreamStatus,
  TaskRecord as CoreTaskRecord,
  TaskModeGateState
} from '@agent/core';
