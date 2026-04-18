import type {
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  ChatRouteRecord,
  ContextFilterRecord,
  CurrentSkillExecutionRecord,
  EntryDecisionRecord,
  EvaluationReportRecord,
  EvidenceRecord,
  ExecutionPlanRecord,
  ExecutionStepRecord,
  ExecutionTrace,
  FinalReviewRecord,
  GovernanceReportRecord,
  GovernanceScoreRecord,
  GuardrailStateRecord,
  InternalSubAgentResult,
  LearningCandidateRecord,
  LearningEvaluationRecord,
  LlmUsageRecord,
  ManagerPlan,
  MicroLoopStateRecord,
  ModelRouteDecision,
  PendingActionRecord,
  PendingApprovalRecord,
  PlatformApprovalInterruptRecord,
  QueueStateRecord,
  RequestedExecutionHints,
  ReviewRecord,
  SandboxStateRecord,
  SkillSearchStateRecord,
  SpecialistDomain,
  TaskBackgroundLearningState,
  TaskStatus,
  ToolAttachmentRecord,
  ToolUsageSummaryRecord
} from '@agent/core';

type ActionIntentValue = string;
type TaskStatusValue = 'queued' | 'running' | 'waiting_approval' | 'blocked' | 'cancelled' | 'completed' | 'failed';

type RuntimeTaskApprovalInterruptRecord = Omit<
  PlatformApprovalInterruptRecord,
  'intent' | 'riskLevel' | 'createdAt'
> & {
  intent?: ActionIntentValue;
  createdAt: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  family?: string;
  capabilityType?: import('@agent/core').ToolCapabilityType;
  ownerType?: import('@agent/core').CapabilityOwnerType;
  ownerId?: string;
  blockedReason?: string;
  threadId?: string;
  checkpointId?: string;
  interactionKind?:
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition';
  origin?: 'counselor_proxy' | 'runtime' | 'timeout' | 'budget' | 'review';
  proxySourceAgentId?: string;
  timeoutMinutes?: number;
  timeoutPolicy?: 'reject' | 'default-continue' | 'cancel-task';
  timedOutAt?: string;
  resolvedAt?: string;
};

type RuntimeTaskSpecialistLeadRecord = {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
};

type RuntimeTaskSpecialistFindingRecord = {
  specialistId: SpecialistDomain;
  role: 'lead' | 'support';
  contractVersion: 'specialist-finding.v1';
  source: 'route' | 'research' | 'execution' | 'critique';
  stage: 'planning' | 'research' | 'execution' | 'review';
  summary: string;
  domain: SpecialistDomain;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  blockingIssues?: string[];
  constraints?: string[];
  suggestions?: string[];
  evidenceRefs?: string[];
  confidence?: number;
};

export interface RuntimeStateTaskRecord {
  id: string;
  goal: string;
  context?: string;
  status: TaskStatusValue;
  sessionId?: string;
  runId?: string;
  traceId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: import('@agent/core').WorkflowPresetDefinition;
  subgraphTrail?: string[];
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  specialistLead?: RuntimeTaskSpecialistLeadRecord;
  supportingSpecialists?: RuntimeTaskSpecialistLeadRecord[];
  specialistFindings?: RuntimeTaskSpecialistFindingRecord[];
  routeConfidence?: number;
  contextSlicesBySpecialist?: import('@agent/core').ContextSliceRecord[];
  dispatches?: import('@agent/core').DispatchInstruction[];
  critiqueResult?: import('@agent/core').CritiqueResultRecord;
  chatRoute?: ChatRouteRecord;
  executionSteps?: ExecutionStepRecord[];
  currentExecutionStep?: ExecutionStepRecord;
  queueState?: QueueStateRecord;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
  approvalFeedback?: string;
  modelRoute?: ModelRouteDecision[];
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  revisionCount?: number;
  maxRevisions?: number;
  microLoopCount?: number;
  maxMicroLoops?: number;
  microLoopState?: MicroLoopStateRecord;
  revisionState?: 'idle' | 'needs_revision' | 'revising' | 'blocked' | 'completed';
  trace: ExecutionTrace[];
  approvals: import('@agent/core').ApprovalRecord[];
  result?: string;
  plan?: ManagerPlan;
  entryDecision?: EntryDecisionRecord;
  executionPlan?: ExecutionPlanRecord;
  budgetGateState?: import('@agent/core').BudgetGateStateRecord;
  complexTaskPlan?: import('@agent/core').ComplexTaskPlanRecord;
  blackboardState?: import('@agent/core').BlackboardStateRecord;
  mainChainNode?: string;
  modeGateState?: import('@agent/core').TaskModeGateState;
  contextFilterState?: ContextFilterRecord;
  guardrailState?: GuardrailStateRecord;
  criticState?: import('@agent/core').CriticStateRecord;
  sandboxState?: SandboxStateRecord;
  finalReviewState?: FinalReviewRecord;
  governanceScore?: GovernanceScoreRecord;
  governanceReport?: GovernanceReportRecord;
  libuEvaluationReportId?: string;
  evaluationReport?: EvaluationReportRecord;
  planMode?: 'intent' | 'implementation' | 'finalized' | 'aborted';
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  partialAggregation?: import('@agent/core').PartialAggregationRecord;
  internalSubAgents?: InternalSubAgentResult[];
  interruptOrigin?: 'counselor_proxy' | 'runtime' | 'timeout' | 'budget' | 'review';
  planModeTransitions?: import('@agent/core').PlanModeTransitionRecord[];
  planDraft?: import('@agent/core').PlanDraftRecord;
  agentStates: import('@agent/core').AgentExecutionState[];
  messages: import('@agent/core').AgentMessageRecord[];
  review?: ReviewRecord;
  learningCandidates?: LearningCandidateRecord[];
  externalSources?: EvidenceRecord[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  usedInstalledSkills?: string[];
  usedCompanyWorkers?: string[];
  connectorRefs?: string[];
  requestedHints?: RequestedExecutionHints;
  toolAttachments?: ToolAttachmentRecord[];
  toolUsageSummary?: ToolUsageSummaryRecord[];
  activeInterrupt?: RuntimeTaskApprovalInterruptRecord;
  interruptHistory?: RuntimeTaskApprovalInterruptRecord[];
  budgetState?: import('@agent/core').BudgetState;
  knowledgeIngestionState?: import('@agent/core').KnowledgeIngestionStateRecord;
  knowledgeIndexState?: import('@agent/core').KnowledgeIndexStateRecord;
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  capabilityAttachments?: CapabilityAttachmentRecord[];
  llmUsage?: LlmUsageRecord;
  currentSkillExecution?: CurrentSkillExecutionRecord;
  learningEvaluation?: LearningEvaluationRecord;
  skillSearch?: SkillSearchStateRecord;
  learningQueueItemId?: string;
  backgroundLearningState?: TaskBackgroundLearningState;
  createdAt: string;
  updatedAt: string;
}
