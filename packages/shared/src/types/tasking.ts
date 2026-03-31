import type { ChannelIdentity } from './channels';
import type {
  ApprovalPolicyRecord,
  ApprovalInterruptRecord,
  ApprovalRecord,
  ConnectorHealthRecord,
  ToolAttachmentRecord,
  ToolUsageSummaryRecord
} from './governance';
import type {
  AgentRole,
  ApprovalStatus,
  ChatEventType,
  ChatRole,
  ChatRouteRecord,
  ChatSessionStatus,
  CheckpointRef,
  CritiqueDecision,
  ExecutionPlanMode,
  MainChainNode,
  LlmUsageRecord,
  ModelRouteDecision,
  PendingActionRecord,
  PendingApprovalRecord,
  QueueStateRecord,
  ReviewDecision,
  SpecialistDomain,
  SubgraphId,
  TaskStatus,
  ThoughtGraphEdge,
  ThoughtGraphNode,
  WorkerDomain,
  WorkflowApprovalPolicy,
  WorkflowPresetDefinition
} from './primitives';
import type {
  LearningEvaluationRecord,
  EvaluationResult,
  EvidenceRecord,
  MemoryRecord,
  ReflectionResult,
  RuleRecord,
  SkillCard
} from './knowledge';
import type {
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  ProfilePolicyHintRecord,
  RequestedExecutionHints,
  SkillSearchStateRecord
} from './skills';
import type { ActionIntent } from './primitives';

export interface AgentState {
  taskId: string;
  goal: string;
  context?: string;
  constraints: string[];
  currentPlan: string[];
  currentStep?: string;
  toolIntent?: ActionIntent;
  approvalRequired: boolean;
  approvalStatus?: ApprovalStatus;
  observations: string[];
  retrievedMemories: MemoryRecord[];
  retrievedSkills: SkillCard[];
  evaluation?: EvaluationResult;
  reflection?: ReflectionResult;
  finalAnswer?: string;
}

export interface AgentMessage {
  id: string;
  taskId: string;
  from: AgentRole;
  to: AgentRole;
  type: 'dispatch' | 'research_result' | 'execution_result' | 'review_result' | 'summary' | 'summary_delta';
  content: string;
  createdAt: string;
}

export interface SubTaskRecord {
  id: string;
  title: string;
  description: string;
  assignedTo: AgentRole;
  status: 'pending' | 'running' | 'completed' | 'blocked';
}

export interface ManagerPlan {
  id: string;
  goal: string;
  summary: string;
  steps: string[];
  subTasks: SubTaskRecord[];
  createdAt: string;
}

export interface DispatchInstruction {
  taskId: string;
  subTaskId: string;
  from: AgentRole;
  to: AgentRole;
  kind: 'strategy' | 'ministry' | 'fallback';
  objective: string;
}

export interface GovernanceScoreRecord {
  ministry: 'libu-governance';
  score: number;
  status: 'healthy' | 'watch' | 'risky';
  summary: string;
  rationale: string[];
  recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
  trustAdjustment: 'promote' | 'hold' | 'downgrade';
  updatedAt: string;
}

export interface GovernanceReportRecord {
  ministry: 'libu-governance';
  summary: string;
  executionQuality: {
    score: number;
    summary: string;
  };
  evidenceSufficiency: {
    score: number;
    summary: string;
  };
  sandboxReliability: {
    score: number;
    summary: string;
  };
  reviewOutcome: {
    decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    summary: string;
  };
  interruptLoad: {
    interruptCount: number;
    microLoopCount: number;
    summary: string;
  };
  businessFeedback: {
    score: number;
    summary: string;
  };
  recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
  trustAdjustment: 'promote' | 'hold' | 'downgrade';
  updatedAt: string;
}

export interface BudgetGateStateRecord {
  node: 'budget_gate';
  status: 'open' | 'soft_blocked' | 'hard_blocked' | 'throttled';
  summary: string;
  queueDepth?: number;
  rateLimitKey?: string;
  triggeredAt?: string;
  updatedAt: string;
}

export interface ComplexTaskPlanRecord {
  node: 'complex_task_plan';
  status: 'pending' | 'completed' | 'blocked';
  summary: string;
  subGoals: string[];
  dependencies: Array<{
    from: string;
    to: string;
  }>;
  recoveryPoints?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlackboardStateRecord {
  node: 'blackboard_state';
  taskId: string;
  sessionId?: string;
  visibleScopes: Array<'supervisor' | 'strategy' | 'ministry' | 'fallback' | 'governance'>;
  refs: {
    traceCount: number;
    evidenceCount: number;
    checkpointId?: string;
    activeInterruptId?: string;
  };
  updatedAt: string;
}

export interface MicroLoopStateRecord {
  state: 'idle' | 'retrying' | 'exhausted' | 'completed';
  attempt: number;
  maxAttempts: number;
  exhaustedReason?: string;
  updatedAt: string;
}

export interface AgentExecutionState {
  agentId: string;
  role: AgentRole;
  goal: string;
  subTask?: string;
  plan: string[];
  toolCalls: string[];
  observations: string[];
  shortTermMemory: string[];
  longTermMemoryRefs: string[];
  evaluation?: EvaluationResult;
  finalOutput?: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed';
}

export interface AgentTokenEvent {
  taskId: string;
  role: AgentRole;
  messageId: string;
  token: string;
  model?: string;
  createdAt: string;
}

export interface ReviewRecord {
  taskId: string;
  decision: ReviewDecision;
  notes: string[];
  createdAt: string;
}

export interface LearningCandidateRecord {
  id: string;
  taskId: string;
  type: 'memory' | 'rule' | 'skill';
  summary: string;
  status: 'pending_confirmation' | 'confirmed';
  payload: MemoryRecord | RuleRecord | SkillCard;
  confidenceScore?: number;
  provenance?: EvidenceRecord[];
  autoConfirmEligible?: boolean;
  createdAt: string;
  confirmedAt?: string;
}

export interface SpecialistLeadRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
}

export interface SpecialistSupportRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
}

export interface SpecialistFindingRecord {
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
}

export interface ContextSliceRecord {
  specialistId: SpecialistDomain;
  summary?: string;
  recentTurns?: Array<{
    role: ChatRole;
    content: string;
  }>;
  relatedHistory?: string[];
  evidenceRefs?: string[];
  domainInstruction?: string;
  outputInstruction?: string;
}

export interface CritiqueResultRecord {
  contractVersion: 'critique-result.v1';
  decision: CritiqueDecision;
  summary: string;
  blockingIssues?: string[];
  constraints?: string[];
  evidenceRefs?: string[];
  shouldBlockEarly?: boolean;
}

export interface CurrentSkillExecutionRecord {
  skillId: string;
  displayName: string;
  phase: 'research' | 'execute';
  stepIndex: number;
  totalSteps: number;
  title: string;
  instruction: string;
  toolNames?: string[];
  updatedAt: string;
}

export interface EntryDecisionRecord {
  // Legacy field alias; runtime ownership is 通政司 / EntryRouter.
  requestedMode: ExecutionPlanMode;
  counselorSelector?: {
    strategy: 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag' | 'manual';
    key?: string;
    candidateIds?: string[];
    weights?: number[];
    selectedCounselorId?: string;
    selectedVersion?: string;
    featureFlag?: string;
  };
  selectionReason?: string;
  defaultCounselorId?: string;
  imperialDirectIntent?: {
    enabled: boolean;
    trigger: 'slash-exec' | 'explicit-direct-execution' | 'known-capability';
    requestedCapability?: string;
    reason?: string;
  };
}

export interface ExecutionPlanRecord {
  mode: ExecutionPlanMode;
  tokenBudget?: number;
  costBudget?: number;
  softBudgetThreshold?: number;
  hardBudgetThreshold?: number;
  modeCapabilities?: string[];
  dispatchChain?: MainChainNode[];
  filteredCapabilities?: string[];
  strategyCounselors?: SpecialistDomain[];
  executionMinistries?: WorkerDomain[];
  selectedCounselorId?: string;
  selectedVersion?: string;
  partialAggregationPolicy?: {
    allowedOutputKinds: Array<'preview' | 'low_risk_action_suggestion' | 'approved_lightweight_progress'>;
    requiresInterruptApprovalForProgress: boolean;
  };
}

export interface PartialAggregationRecord {
  kind: 'preview' | 'low_risk_action_suggestion' | 'approved_lightweight_progress';
  summary: string;
  recommendedNextStep?: string;
  requiresApproval: boolean;
  allowedCapabilities: string[];
  sourceCounselorIds?: string[];
  createdAt: string;
}

export interface ContextFilterRecord {
  node: 'context_filter';
  status: 'pending' | 'completed' | 'blocked';
  filteredContextSlice: {
    summary: string;
    historyTraceCount: number;
    evidenceCount: number;
    specialistCount: number;
    ministryCount: number;
  };
  audienceSlices?: {
    strategy: {
      summary: string;
      dispatchCount: number;
    };
    ministry: {
      summary: string;
      dispatchCount: number;
    };
    fallback: {
      summary: string;
      dispatchCount: number;
    };
  };
  dispatchOrder?: Array<'strategy' | 'ministry' | 'fallback'>;
  noiseGuards?: string[];
  hiddenTraceCount?: number;
  redactedKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FinalReviewRecord {
  node: 'final_review';
  ministry: WorkerDomain;
  decision: 'pass' | 'revise_required' | 'block';
  summary: string;
  interruptRequired: boolean;
  deliveryStatus?: 'pending' | 'delivered' | 'interrupted';
  deliveryMinistry?: WorkerDomain;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailStateRecord {
  stage: 'pre' | 'post';
  verdict: 'pass_through' | 'rewrite_required' | 'block';
  summary: string;
  eventId?: string;
  updatedAt: string;
}

export interface CriticStateRecord {
  node: 'critic';
  decision: 'pass_through' | 'rewrite_required';
  summary: string;
  blockingIssues?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SandboxStateRecord {
  node: 'sandbox';
  stage: 'gongbu' | 'bingbu' | 'review';
  status: 'idle' | 'running' | 'passed' | 'failed' | 'exhausted';
  attempt: number;
  maxAttempts: number;
  verdict?: 'safe' | 'unsafe' | 'retry';
  exhaustedReason?: string;
  updatedAt: string;
}

export interface KnowledgeIngestionStateRecord {
  node: 'knowledge_ingestion';
  store: import('./primitives').KnowledgeStore;
  sourceId?: string;
  receiptId?: string;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
  updatedAt: string;
}

export interface KnowledgeIndexStateRecord {
  node: 'knowledge_index';
  store: import('./primitives').KnowledgeStore;
  indexStatus: 'ready' | 'partial' | 'building' | 'failed';
  searchableDocumentCount?: number;
  blockedDocumentCount?: number;
  updatedAt: string;
}

export interface EvaluationReportRecord {
  id: string;
  ministry: 'libu-governance';
  score: number;
  summary: string;
  rlaifNotes: string[];
  derivedFromTaskId: string;
  derivedFromTraceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalSubAgentResult {
  agentId: string;
  status: 'continue' | 'needs_user_input' | 'needs_revision' | 'blocked';
  interactionKind?: 'plan-question' | 'supplemental-input';
  summary?: string;
  questions?: PlanQuestionRecord[];
  createdAt: string;
}

export interface CounselorSelectorConfig {
  selectorId: string;
  domain: string;
  enabled: boolean;
  strategy: 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag' | 'manual';
  candidateIds: string[];
  weights?: number[];
  featureFlag?: string;
  defaultCounselorId: string;
  createdAt: string;
  updatedAt: string;
}

export type PlanMode = 'intent' | 'implementation' | 'finalized' | 'aborted';
export type PlanQuestionType = 'direction' | 'detail' | 'tradeoff';
export type PlanDecisionResolutionSource =
  | 'user-answer'
  | 'default-assumption'
  | 'auto-resolved'
  | 'bypass-recommended'
  | 'fallback-assumption';

export interface PlanQuestionOptionRecord {
  id: string;
  label: string;
  description: string;
}

export interface PlanQuestionRecord {
  id: string;
  question: string;
  questionType: PlanQuestionType;
  options: PlanQuestionOptionRecord[];
  recommendedOptionId?: string;
  allowFreeform?: boolean;
  defaultAssumption?: string;
  whyAsked?: string;
  impactOnPlan?: string;
}

export interface PlanDecisionRecord {
  questionId: string;
  resolutionSource: PlanDecisionResolutionSource;
  selectedOptionId?: string;
  freeform?: string;
  assumedValue?: string;
  whyAsked?: string;
  decisionRationale?: string;
  impactOnPlan?: string;
  answeredAt: string;
}

export interface PlanModeTransitionRecord {
  from?: PlanMode;
  to: PlanMode;
  reason: string;
  at: string;
}

export interface PlanDraftRecord {
  summary: string;
  autoResolved: string[];
  openQuestions: string[];
  assumptions: string[];
  decisions?: PlanDecisionRecord[];
  questionSet?: {
    title?: string;
    summary?: string;
  };
  questions?: PlanQuestionRecord[];
  maxPlanTurns?: number;
  planTurnsUsed?: number;
  microBudget?: {
    readOnlyToolLimit: number;
    readOnlyToolsUsed: number;
    tokenBudgetUsd?: number;
    budgetTriggered?: boolean;
  };
}

export interface TaskRecord {
  id: string;
  goal: string;
  context?: string;
  status: TaskStatus;
  sessionId?: string;
  runId?: string;
  traceId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: WorkflowPresetDefinition;
  subgraphTrail?: SubgraphId[];
  currentNode?: string;
  currentMinistry?: WorkerDomain;
  currentWorker?: string;
  specialistLead?: SpecialistLeadRecord;
  supportingSpecialists?: SpecialistSupportRecord[];
  specialistFindings?: SpecialistFindingRecord[];
  routeConfidence?: number;
  contextSlicesBySpecialist?: ContextSliceRecord[];
  dispatches?: DispatchInstruction[];
  critiqueResult?: CritiqueResultRecord;
  chatRoute?: ChatRouteRecord;
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
  trace: import('./knowledge').ExecutionTrace[];
  approvals: ApprovalRecord[];
  result?: string;
  plan?: ManagerPlan;
  entryDecision?: EntryDecisionRecord;
  executionPlan?: ExecutionPlanRecord;
  budgetGateState?: BudgetGateStateRecord;
  complexTaskPlan?: ComplexTaskPlanRecord;
  blackboardState?: BlackboardStateRecord;
  mainChainNode?: MainChainNode;
  modeGateState?: {
    requestedMode?: ExecutionPlanMode;
    activeMode: 'plan' | 'execute' | 'imperial_direct';
    reason: string;
    updatedAt: string;
  };
  contextFilterState?: ContextFilterRecord;
  guardrailState?: GuardrailStateRecord;
  criticState?: CriticStateRecord;
  sandboxState?: SandboxStateRecord;
  finalReviewState?: FinalReviewRecord;
  governanceScore?: GovernanceScoreRecord;
  governanceReport?: GovernanceReportRecord;
  libuEvaluationReportId?: string;
  evaluationReport?: EvaluationReportRecord;
  planMode?: PlanMode;
  // Legacy execution mode aliases still deserialize here; new writes should come from executionPlan.mode.
  executionMode?: import('./primitives').ExecutionMode;
  partialAggregation?: PartialAggregationRecord;
  internalSubAgents?: InternalSubAgentResult[];
  interruptOrigin?: ApprovalInterruptRecord['origin'];
  planModeTransitions?: PlanModeTransitionRecord[];
  planDraft?: PlanDraftRecord;
  agentStates: AgentExecutionState[];
  messages: AgentMessage[];
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
  // Legacy interrupt projections; runtime ownership is 司礼监 / InterruptController.
  activeInterrupt?: ApprovalInterruptRecord;
  interruptHistory?: ApprovalInterruptRecord[];
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  capabilityAttachments?: CapabilityAttachmentRecord[];
  currentSkillExecution?: CurrentSkillExecutionRecord;
  learningEvaluation?: LearningEvaluationRecord;
  skillSearch?: SkillSearchStateRecord;
  budgetState?: import('./knowledge').BudgetState;
  knowledgeIngestionState?: KnowledgeIngestionStateRecord;
  knowledgeIndexState?: KnowledgeIndexStateRecord;
  llmUsage?: LlmUsageRecord;
  learningQueueItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckResult {
  status: 'ok';
  service: string;
  now: string;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  status: ChatSessionStatus;
  currentTaskId?: string;
  channelIdentity?: ChannelIdentity;
  compression?: {
    summary: string;
    periodOrTopic?: string;
    focuses?: string[];
    keyDeliverables?: string[];
    risks?: string[];
    nextActions?: string[];
    supportingFacts?: string[];
    condensedMessageCount: number;
    condensedCharacterCount: number;
    totalCharacterCount: number;
    previewMessages?: Array<{
      role: ChatRole;
      content: string;
    }>;
    trigger: 'message_count' | 'character_count';
    source: 'heuristic' | 'llm';
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  taskId?: string;
  linkedAgent?: AgentRole;
  card?:
    | {
        type: 'approval_request';
        intent: string;
        toolName?: string;
        reason?: string;
        riskLevel?: import('./primitives').RiskLevel;
        requestedBy?: string;
        serverId?: string;
        capabilityId?: string;
        preview?: Array<{
          label: string;
          value: string;
        }>;
      }
    | {
        type: 'plan_question';
        title: string;
        summary?: string;
        status?: 'pending' | 'answered' | 'bypassed' | 'aborted';
        interruptId?: string;
        questions: PlanQuestionRecord[];
      }
    | {
        type: 'run_cancelled';
        reason?: string;
      }
    | {
        type: 'capability_catalog';
        title: string;
        summary?: string;
        groups: Array<{
          key: string;
          label: string;
          kind: 'skill' | 'connector' | 'tool';
          items: Array<{
            id: string;
            displayName: string;
            summary?: string;
            ownerType?: string;
            ownerId?: string;
            scope?: string;
            sourceLabel?: string;
            bootstrap?: boolean;
            enabled?: boolean;
            status?: string;
            family?: string;
            capabilityType?: string;
            preferredMinistries?: string[];
            blockedReason?: string;
          }>;
        }>;
      }
    | {
        type: 'skill_draft_created';
        skillId: string;
        displayName: string;
        description: string;
        ownerType: string;
        scope: string;
        status: string;
        enabled: boolean;
        contract?: {
          requiredTools: string[];
          optionalTools: string[];
          approvalSensitiveTools: string[];
          preferredConnectors: string[];
          requiredConnectors: string[];
        };
        nextActions: string[];
      };
  createdAt: string;
}

export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: ChatEventType;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatThoughtChainItem {
  key: string;
  messageId?: string;
  thinkingDurationMs?: number;
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
}

export interface ChatThinkState {
  messageId?: string;
  thinkingDurationMs?: number;
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}

export interface ChatCheckpointRecord {
  checkpointId: string;
  sessionId: string;
  taskId: string;
  channelIdentity?: ChannelIdentity;
  context?: string;
  runId?: string;
  traceId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: WorkflowPresetDefinition;
  subgraphTrail?: SubgraphId[];
  currentNode?: string;
  currentMinistry?: WorkerDomain;
  currentWorker?: string;
  specialistLead?: SpecialistLeadRecord;
  supportingSpecialists?: SpecialistSupportRecord[];
  specialistFindings?: SpecialistFindingRecord[];
  routeConfidence?: number;
  contextSlicesBySpecialist?: ContextSliceRecord[];
  dispatches?: DispatchInstruction[];
  critiqueResult?: CritiqueResultRecord;
  chatRoute?: ChatRouteRecord;
  queueState?: QueueStateRecord;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
  approvalFeedback?: string;
  modelRoute?: ModelRouteDecision[];
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
  // Legacy interrupt projections; runtime ownership is 司礼监 / InterruptController.
  activeInterrupt?: ApprovalInterruptRecord;
  interruptHistory?: ApprovalInterruptRecord[];
  // Legacy routing projection; runtime ownership is 通政司 / EntryRouter.
  entryDecision?: EntryDecisionRecord;
  executionPlan?: ExecutionPlanRecord;
  budgetGateState?: BudgetGateStateRecord;
  complexTaskPlan?: ComplexTaskPlanRecord;
  blackboardState?: BlackboardStateRecord;
  planMode?: PlanMode;
  // Legacy execution mode aliases still deserialize here; new writes should come from executionPlan.mode.
  executionMode?: import('./primitives').ExecutionMode;
  partialAggregation?: PartialAggregationRecord;
  planModeTransitions?: PlanModeTransitionRecord[];
  planDraft?: PlanDraftRecord;
  capabilityAugmentations?: CapabilityAugmentationRecord[];
  capabilityAttachments?: CapabilityAttachmentRecord[];
  currentSkillExecution?: CurrentSkillExecutionRecord;
  learningEvaluation?: LearningEvaluationRecord;
  governanceScore?: GovernanceScoreRecord;
  governanceReport?: GovernanceReportRecord;
  skillSearch?: SkillSearchStateRecord;
  budgetState?: import('./knowledge').BudgetState;
  guardrailState?: GuardrailStateRecord;
  criticState?: CriticStateRecord;
  sandboxState?: SandboxStateRecord;
  knowledgeIngestionState?: KnowledgeIngestionStateRecord;
  knowledgeIndexState?: KnowledgeIndexStateRecord;
  llmUsage?: LlmUsageRecord;
  learningQueueItemId?: string;
  recoverability?: 'safe' | 'partial' | 'unsafe';
  traceCursor: number;
  messageCursor: number;
  approvalCursor: number;
  learningCursor: number;
  graphState: {
    status: TaskStatus;
    currentStep?: string;
    retryCount?: number;
    maxRetries?: number;
    revisionCount?: number;
    maxRevisions?: number;
    microLoopCount?: number;
    maxMicroLoops?: number;
    microLoopState?: MicroLoopStateRecord;
    revisionState?: 'idle' | 'needs_revision' | 'revising' | 'blocked' | 'completed';
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentExecutionState[];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  thoughtGraph?: {
    nodes: ThoughtGraphNode[];
    edges: ThoughtGraphEdge[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorCapabilityPolicySummary {
  approvalPolicy?: WorkflowApprovalPolicy;
  profilePolicy?: ProfilePolicyHintRecord;
  healthChecks?: ConnectorHealthRecord[];
  approvalPolicies?: ApprovalPolicyRecord[];
  checkpointRef?: CheckpointRef;
}
