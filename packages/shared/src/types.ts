export const SkillStatusValues = ['draft', 'lab', 'stable', 'disabled'] as const;
export type SkillStatus = (typeof SkillStatusValues)[number];

export const MemoryTypeValues = ['success_case', 'failure_case', 'fact', 'heuristic', 'task_summary'] as const;
export type MemoryType = (typeof MemoryTypeValues)[number];

export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  BLOCKED = 'blocked',
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
export type LearningSourceType = 'execution' | 'document';
export type ReviewDecision = 'approved' | 'retry' | 'blocked';
export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'waiting_learning_confirmation'
  | 'completed'
  | 'failed';
export type ChatEventType =
  | 'session_started'
  | 'user_message'
  | 'manager_planned'
  | 'subtask_dispatched'
  | 'research_progress'
  | 'tool_selected'
  | 'tool_called'
  | 'approval_required'
  | 'approval_resolved'
  | 'review_completed'
  | 'learning_pending_confirmation'
  | 'learning_confirmed'
  | 'conversation_compacted'
  | 'assistant_token'
  | 'assistant_message'
  | 'session_finished'
  | 'session_failed';
export type LearningCandidateType = 'memory' | 'rule' | 'skill';

export interface CreateTaskDto {
  goal: string;
  context?: string;
  constraints?: string[];
  sessionId?: string;
}

export interface CreateChatSessionDto {
  message: string;
  title?: string;
}

export interface AppendChatMessageDto {
  message: string;
}

export interface SearchMemoryDto {
  query: string;
  limit?: number;
}

export interface CreateDocumentLearningJobDto {
  documentUri: string;
  title?: string;
}

export interface ApprovalActionDto {
  intent: ActionIntent;
  reason?: string;
  actor?: string;
}

export interface SessionApprovalDto extends ApprovalActionDto {
  sessionId: string;
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
  createdAt: string;
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  conditions: string[];
  action: string;
  sourceTaskId?: string;
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
  summary?: string;
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
  createdAt: string;
  confirmedAt?: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: TaskStatus;
  sessionId?: string;
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
  createdAt: string;
}

export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: ChatEventType;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
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
  createdAt: string;
  updatedAt: string;
}
