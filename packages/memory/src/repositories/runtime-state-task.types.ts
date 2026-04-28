import type { EvidenceRecord, LearningCandidateRecord } from '../contracts';

type RuntimeStateLooseRecord = Record<string, unknown>;
type RuntimeStateToolCapabilityType = 'local-tool' | 'mcp-capability' | 'governance-tool';
type RuntimeStateLearningEvaluationRecord = {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  notes: string[];
  recommendedCandidateIds: string[];
  autoConfirmCandidateIds: string[];
  sourceSummary: {
    externalSourceCount: number;
    internalSourceCount: number;
    reusedMemoryCount: number;
    reusedRuleCount: number;
    reusedSkillCount: number;
  };
  [key: string]: unknown;
};
type RuntimeStateToolAttachmentRecord = RuntimeStateLooseRecord;
type RuntimeStateToolUsageSummaryRecord = RuntimeStateLooseRecord;
type CapabilityAttachmentRecord = RuntimeStateLooseRecord;
type CapabilityAugmentationRecord = RuntimeStateLooseRecord;
type ChatRouteRecord = RuntimeStateLooseRecord;
type ContextFilterRecord = RuntimeStateLooseRecord;
type CurrentSkillExecutionRecord = RuntimeStateLooseRecord;
type EntryDecisionRecord = RuntimeStateLooseRecord;
type EvaluationReportRecord = RuntimeStateLooseRecord;
type ExecutionPlanRecord = RuntimeStateLooseRecord;
type ExecutionStepRecord = RuntimeStateLooseRecord;
type ExecutionTrace = RuntimeStateLooseRecord;
type FinalReviewRecord = RuntimeStateLooseRecord;
type GovernanceReportRecord = RuntimeStateLooseRecord;
type GovernanceScoreRecord = RuntimeStateLooseRecord;
type GuardrailStateRecord = RuntimeStateLooseRecord;
type InternalSubAgentResult = RuntimeStateLooseRecord;
type LlmUsageRecord = RuntimeStateLooseRecord;
type ManagerPlan = RuntimeStateLooseRecord;
type MicroLoopStateRecord = RuntimeStateLooseRecord;
type ModelRouteDecision = RuntimeStateLooseRecord;
type PendingActionRecord = RuntimeStateLooseRecord;
type PendingApprovalRecord = RuntimeStateLooseRecord;
type PlatformApprovalInterruptRecord = RuntimeStateLooseRecord;
type QueueStateRecord = RuntimeStateLooseRecord;
type RequestedExecutionHints = RuntimeStateLooseRecord;
type ReviewRecord = RuntimeStateLooseRecord;
type SandboxStateRecord = RuntimeStateLooseRecord;
type SkillSearchStateRecord = RuntimeStateLooseRecord;
type SpecialistDomain = string;
type TaskBackgroundLearningState = RuntimeStateLooseRecord;

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
  capabilityType?: RuntimeStateToolCapabilityType;
  ownerType?: string;
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
  resolvedWorkflow?: RuntimeStateLooseRecord;
  subgraphTrail?: string[];
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  specialistLead?: RuntimeTaskSpecialistLeadRecord;
  supportingSpecialists?: RuntimeTaskSpecialistLeadRecord[];
  specialistFindings?: RuntimeTaskSpecialistFindingRecord[];
  routeConfidence?: number;
  contextSlicesBySpecialist?: RuntimeStateLooseRecord[];
  dispatches?: RuntimeStateLooseRecord[];
  critiqueResult?: RuntimeStateLooseRecord;
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
  approvals: RuntimeStateLooseRecord[];
  result?: string;
  plan?: ManagerPlan;
  entryDecision?: EntryDecisionRecord;
  executionPlan?: ExecutionPlanRecord;
  budgetGateState?: RuntimeStateLooseRecord;
  complexTaskPlan?: RuntimeStateLooseRecord;
  blackboardState?: RuntimeStateLooseRecord;
  mainChainNode?: string;
  modeGateState?: RuntimeStateLooseRecord;
  contextFilterState?: ContextFilterRecord;
  guardrailState?: GuardrailStateRecord;
  criticState?: RuntimeStateLooseRecord;
  sandboxState?: SandboxStateRecord;
  finalReviewState?: FinalReviewRecord;
  governanceScore?: GovernanceScoreRecord;
  governanceReport?: GovernanceReportRecord;
  libuEvaluationReportId?: string;
  evaluationReport?: EvaluationReportRecord;
  planMode?: 'intent' | 'implementation' | 'finalized' | 'aborted';
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  partialAggregation?: RuntimeStateLooseRecord;
  internalSubAgents?: InternalSubAgentResult[];
  interruptOrigin?: 'counselor_proxy' | 'runtime' | 'timeout' | 'budget' | 'review';
  planModeTransitions?: RuntimeStateLooseRecord[];
  planDraft?: RuntimeStateLooseRecord;
  agentStates: RuntimeStateLooseRecord[];
  messages: RuntimeStateLooseRecord[];
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
  toolAttachments?: RuntimeStateToolAttachmentRecord[];
  toolUsageSummary?: RuntimeStateToolUsageSummaryRecord[];
  activeInterrupt?: RuntimeTaskApprovalInterruptRecord;
  interruptHistory?: RuntimeTaskApprovalInterruptRecord[];
  budgetState?: RuntimeStateLooseRecord;
  knowledgeIngestionState?: RuntimeStateLooseRecord;
  knowledgeIndexState?: RuntimeStateLooseRecord;
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  capabilityAttachments?: CapabilityAttachmentRecord[];
  llmUsage?: LlmUsageRecord;
  currentSkillExecution?: CurrentSkillExecutionRecord;
  learningEvaluation?: RuntimeStateLearningEvaluationRecord;
  skillSearch?: SkillSearchStateRecord;
  learningQueueItemId?: string;
  backgroundLearningState?: TaskBackgroundLearningState;
  createdAt: string;
  updatedAt: string;
}
