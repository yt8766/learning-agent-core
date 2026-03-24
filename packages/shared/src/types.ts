export const SkillStatusValues = ['draft', 'lab', 'stable', 'disabled'] as const;
export type SkillStatus = (typeof SkillStatusValues)[number];

export const MemoryTypeValues = ['success_case', 'failure_case', 'fact', 'heuristic', 'task_summary'] as const;
export type MemoryType = (typeof MemoryTypeValues)[number];

export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ApprovalDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export type ApprovalStatus = ApprovalDecision | 'pending';

export enum ActionIntent {
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_file',
  CALL_EXTERNAL_API = 'call_external_api',
  PUBLISH_SKILL = 'publish_skill',
  PROMOTE_SKILL = 'promote_skill',
  ENABLE_PLUGIN = 'enable_plugin',
  MODIFY_RULE = 'modify_rule'
}

export enum AgentRole {
  MANAGER = 'manager',
  RESEARCH = 'research',
  EXECUTOR = 'executor',
  REVIEWER = 'reviewer'
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type LearningSourceType = 'execution' | 'document' | 'research';
export type ReviewDecision = 'approved' | 'retry' | 'blocked';
export type TrustClass = 'official' | 'curated' | 'community' | 'unverified' | 'internal';
export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'waiting_learning_confirmation'
  | 'cancelled'
  | 'completed'
  | 'failed';
export type ChatEventType =
  | 'decree_received'
  | 'session_started'
  | 'user_message'
  | 'supervisor_planned'
  | 'libu_routed'
  | 'ministry_started'
  | 'ministry_reported'
  | 'skill_resolved'
  | 'skill_stage_started'
  | 'skill_stage_completed'
  | 'manager_planned'
  | 'subtask_dispatched'
  | 'research_progress'
  | 'tool_selected'
  | 'tool_called'
  | 'approval_required'
  | 'approval_resolved'
  | 'approval_rejected_with_feedback'
  | 'review_completed'
  | 'learning_pending_confirmation'
  | 'learning_confirmed'
  | 'conversation_compacted'
  | 'assistant_token'
  | 'assistant_message'
  | 'run_resumed'
  | 'run_cancelled'
  | 'budget_exhausted'
  | 'final_response_delta'
  | 'final_response_completed'
  | 'session_finished'
  | 'session_failed';
export type LearningCandidateType = 'memory' | 'rule' | 'skill';
export type MinistryId = 'libu-router' | 'hubu-search' | 'libu-docs' | 'bingbu-ops' | 'xingbu-review' | 'gongbu-code';
export type WorkflowApprovalPolicy = 'none' | 'high-risk-only' | 'all-actions';
export type ModelRole = 'supervisor' | 'libu' | 'hubu' | 'libu-docs' | 'bingbu' | 'xingbu' | 'gongbu';
export type WorkerDomain = MinistryId;
export type SourcePolicyMode = 'internal-only' | 'controlled-first' | 'open-web-allowed';

export interface WorkerDefinition {
  id: string;
  ministry: WorkerDomain;
  displayName: string;
  defaultModel: string;
  supportedCapabilities: string[];
  reviewPolicy: 'none' | 'self-check' | 'mandatory-xingbu';
}

export interface ModelRouteDecision {
  ministry: WorkerDomain;
  workerId: string;
  defaultModel: string;
  selectedModel: string;
  reason: string;
}

export interface PendingActionRecord {
  toolName: string;
  intent: ActionIntent;
  riskLevel?: RiskLevel;
  requestedBy: WorkerDomain;
}

export interface PendingApprovalRecord extends PendingActionRecord {
  reason?: string;
  feedback?: string;
}

export interface WorkflowPresetDefinition {
  id: string;
  displayName: string;
  command?: string;
  intentPatterns: string[];
  requiredMinistries: MinistryId[];
  allowedCapabilities: string[];
  approvalPolicy: WorkflowApprovalPolicy;
  webLearningPolicy?: {
    enabled: boolean;
    preferredSourceTypes: string[];
    acceptedTrustClasses: TrustClass[];
  };
  sourcePolicy?: {
    mode: SourcePolicyMode;
    preferredUrls?: string[];
  };
  autoPersistPolicy?: {
    memory: 'manual' | 'high-confidence';
    rule: 'manual' | 'suggest';
    skill: 'manual' | 'suggest';
  };
  outputContract: {
    type: string;
    requiredSections: string[];
  };
}

export interface CreateTaskDto {
  goal: string;
  context?: string;
  constraints?: string[];
  sessionId?: string;
}

export interface CreateChatSessionDto {
  message?: string;
  title?: string;
}

export interface UpdateChatSessionDto {
  title: string;
}

export interface AppendChatMessageDto {
  message: string;
}

export interface SearchMemoryDto {
  query: string;
  limit?: number;
}

export interface InvalidateKnowledgeDto {
  reason: string;
}

export interface SupersedeKnowledgeDto {
  replacementId: string;
  reason: string;
}

export interface RetireKnowledgeDto {
  reason: string;
}

export interface LlmUsageModelRecord {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
  costCny?: number;
  pricingSource?: 'provider' | 'estimated';
  callCount: number;
}

export interface LlmUsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
  measuredCallCount: number;
  estimatedCallCount: number;
  models: LlmUsageModelRecord[];
  updatedAt: string;
}

export interface CreateDocumentLearningJobDto {
  documentUri: string;
  title?: string;
}

export interface CreateResearchLearningJobDto {
  goal: string;
  title?: string;
  workflowId?: string;
  preferredUrls?: string[];
}

export interface ApprovalActionDto {
  intent: ActionIntent;
  reason?: string;
  actor?: string;
  feedback?: string;
}

export interface SessionApprovalDto extends ApprovalActionDto {
  sessionId: string;
}

export interface SessionCancelDto {
  sessionId: string;
  actor?: string;
  reason?: string;
}

export interface LearningConfirmationDto {
  sessionId: string;
  candidateIds?: string[];
  actor?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'knowledge' | 'system' | 'action' | 'memory';
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  timeoutMs: number;
  sandboxProfile: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolExecutionRequest {
  taskId: string;
  toolName: string;
  intent: ActionIntent;
  input: Record<string, unknown>;
  requestedBy: 'agent' | 'user';
}

export interface ToolExecutionResult {
  ok: boolean;
  outputSummary: string;
  rawOutput?: unknown;
  exitCode?: number;
  errorMessage?: string;
  durationMs: number;
}

export interface ApprovalRecord {
  taskId: string;
  intent: ActionIntent;
  actor?: string;
  reason?: string;
  decision: ApprovalStatus;
  decidedAt: string;
}

export interface ExecutionTrace {
  node: string;
  at: string;
  summary: string;
  data?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  taskId?: string;
  summary: string;
  content: string;
  tags: string[];
  embeddingRef?: string;
  qualityScore?: number;
  status?: 'active' | 'invalidated' | 'superseded' | 'retired';
  invalidatedAt?: string;
  invalidationReason?: string;
  conflictWithIds?: string[];
  supersededAt?: string;
  supersededById?: string;
  retiredAt?: string;
  restoredAt?: string;
  createdAt: string;
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  conditions: string[];
  action: string;
  sourceTaskId?: string;
  status?: 'active' | 'invalidated' | 'superseded' | 'retired';
  invalidatedAt?: string;
  invalidationReason?: string;
  supersededAt?: string;
  supersededById?: string;
  retiredAt?: string;
  restoredAt?: string;
  createdAt: string;
}

export interface SkillStep {
  title: string;
  instruction: string;
  toolNames: string[];
}

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  applicableGoals: string[];
  requiredTools: string[];
  steps: SkillStep[];
  constraints: string[];
  successSignals: string[];
  riskLevel: RiskLevel;
  source: LearningSourceType;
  status: SkillStatus;
  previousStatus?: SkillStatus;
  disabledReason?: string;
  retiredAt?: string;
  restoredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDraft {
  id: string;
  name: string;
  description: string;
  manifest: Record<string, unknown>;
  code?: string;
  status: 'draft' | 'lab' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecutionTrace {
  skillId: string;
  taskId: string;
  success: boolean;
  durationMs: number;
  failureReason?: string;
  reviewedByHuman?: boolean;
  createdAt: string;
}

export interface SkillEvalResult {
  skillId: string;
  pass: boolean;
  consecutiveSuccesses: number;
  severeIncidents: number;
  notes: string[];
}

export interface EvaluationResult {
  success: boolean;
  quality: 'low' | 'medium' | 'high';
  shouldRetry: boolean;
  shouldWriteMemory: boolean;
  shouldCreateRule: boolean;
  shouldExtractSkill: boolean;
  notes: string[];
}

export interface BudgetState {
  stepBudget: number;
  stepsConsumed: number;
  retryBudget: number;
  retriesConsumed: number;
  sourceBudget: number;
  sourcesConsumed: number;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: TrustClass;
  summary: string;
  detail?: Record<string, unknown>;
  linkedRunId?: string;
  createdAt: string;
}

export interface LearningEvaluationRecord {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  notes: string[];
  governanceWarnings?: string[];
  recommendedCandidateIds: string[];
  autoConfirmCandidateIds: string[];
  sourceSummary: {
    externalSourceCount: number;
    internalSourceCount: number;
    reusedMemoryCount: number;
    reusedRuleCount: number;
    reusedSkillCount: number;
  };
}

export interface ReflectionResult {
  failureReason?: string;
  rootCause?: string;
  whatWorked: string[];
  whatFailed: string[];
  nextAttemptAdvice: string[];
  memoryCandidate?: MemoryRecord;
}

export interface LearningJob {
  id: string;
  sourceType: LearningSourceType;
  status: 'queued' | 'running' | 'completed' | 'failed';
  documentUri: string;
  goal?: string;
  workflowId?: string;
  summary?: string;
  sources?: EvidenceRecord[];
  trustSummary?: Partial<Record<TrustClass, number>>;
  learningEvaluation?: LearningEvaluationRecord;
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

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
  objective: string;
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
  type: LearningCandidateType;
  summary: string;
  status: 'pending_confirmation' | 'confirmed';
  payload: MemoryRecord | RuleRecord | SkillCard;
  confidenceScore?: number;
  provenance?: EvidenceRecord[];
  autoConfirmEligible?: boolean;
  createdAt: string;
  confirmedAt?: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: TaskStatus;
  sessionId?: string;
  runId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: WorkflowPresetDefinition;
  currentNode?: string;
  currentMinistry?: WorkerDomain;
  currentWorker?: string;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
  approvalFeedback?: string;
  modelRoute?: ModelRouteDecision[];
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  trace: ExecutionTrace[];
  approvals: ApprovalRecord[];
  result?: string;
  plan?: ManagerPlan;
  agentStates: AgentExecutionState[];
  messages: AgentMessage[];
  review?: ReviewRecord;
  learningCandidates?: LearningCandidateRecord[];
  externalSources?: EvidenceRecord[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  learningEvaluation?: LearningEvaluationRecord;
  budgetState?: BudgetState;
  llmUsage?: LlmUsageRecord;
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
  compression?: {
    summary: string;
    condensedMessageCount: number;
    condensedCharacterCount: number;
    totalCharacterCount: number;
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
  linkedAgent?: AgentRole;
  card?:
    | {
        type: 'approval_request';
        intent: string;
        toolName?: string;
        reason?: string;
        riskLevel?: RiskLevel;
        requestedBy?: string;
      }
    | {
        type: 'run_cancelled';
        reason?: string;
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
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
}

export interface ChatThinkState {
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}

export interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  runId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: WorkflowPresetDefinition;
  currentNode?: string;
  currentMinistry?: WorkerDomain;
  currentWorker?: string;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
  approvalFeedback?: string;
  modelRoute?: ModelRouteDecision[];
  externalSources?: EvidenceRecord[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  learningEvaluation?: LearningEvaluationRecord;
  budgetState?: BudgetState;
  llmUsage?: LlmUsageRecord;
  traceCursor: number;
  messageCursor: number;
  approvalCursor: number;
  learningCursor: number;
  graphState: {
    status: TaskStatus;
    currentStep?: string;
    retryCount?: number;
    maxRetries?: number;
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentExecutionState[];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  createdAt: string;
  updatedAt: string;
}
