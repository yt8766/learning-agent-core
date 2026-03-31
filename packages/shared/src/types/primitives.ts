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
  DELETE_FILE = 'delete_file',
  SCHEDULE_TASK = 'schedule_task',
  CALL_EXTERNAL_API = 'call_external_api',
  INSTALL_SKILL = 'install_skill',
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
  | 'waiting_interrupt'
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
  | 'interrupt_pending'
  | 'interrupt_resumed'
  | 'interrupt_rejected_with_feedback'
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
export type CanonicalMinistryId =
  | 'libu-governance'
  | 'hubu-search'
  | 'libu-delivery'
  | 'bingbu-ops'
  | 'xingbu-review'
  | 'gongbu-code';
export type LegacyMinistryIdAlias = 'libu-router' | 'libu-docs';
export type MinistryId = CanonicalMinistryId | LegacyMinistryIdAlias;
export type WorkflowApprovalPolicy = 'none' | 'high-risk-only' | 'all-actions';
export type ModelRole = 'supervisor' | 'libu' | 'hubu' | 'libu-docs' | 'bingbu' | 'xingbu' | 'gongbu';
export type WorkerDomain = MinistryId;
export type CanonicalSpecialistDomain =
  | 'general-assistant'
  | 'product-strategy'
  | 'growth-marketing'
  | 'payment-channel'
  | 'risk-compliance'
  | 'technical-architecture';
export type LegacySpecialistDomainAlias = 'live-ops';
export type SpecialistDomain = CanonicalSpecialistDomain | LegacySpecialistDomainAlias;
export type SpecialistSpanRole = 'lead' | 'support' | 'ministry';
export type CritiqueDecision = 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
export type SourcePolicyMode = 'internal-only' | 'controlled-first' | 'open-web-allowed';
export type RuntimeProfile = 'platform' | 'company' | 'personal' | 'cli';
// executionPlan.mode is canonical; `standard` / `planning-readonly` are retained for compatibility reads only.
export type ExecutionMode = 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
export type ExecutionPlanMode = 'plan' | 'execute' | 'imperial_direct';
export type InteractionKind =
  | 'approval'
  | 'plan-question'
  | 'supplemental-input'
  | 'revise-required'
  | 'micro-loop-exhausted'
  | 'mode-transition';
export type WorkerKind = 'core' | 'company' | 'installed-skill';
export type SkillSourceKind = 'marketplace' | 'internal' | 'git' | 'http-manifest';
export type SkillSourcePriority = 'workspace/internal' | 'managed/local' | 'bundled/marketplace';
export type SkillInstallStatus = 'pending' | 'approved' | 'rejected' | 'installed' | 'failed';
export type SubgraphId = 'research' | 'execution' | 'review' | 'skill-install' | 'background-runner';
export type MainChainNode =
  | 'entry_router'
  | 'mode_gate'
  | 'dispatch_planner'
  | 'context_filter'
  | 'result_aggregator'
  | 'interrupt_controller'
  | 'learning_recorder';
export type SkillSourceDiscoveryMode = 'local-dir' | 'remote-index' | 'git-registry' | 'http-manifest';
export type SkillSourceSyncStrategy = 'manual' | 'scheduled' | 'on-demand';
export type SkillSuggestionKind = 'installed' | 'manifest' | 'connector-template' | 'remote-skill';
export type SkillSuggestionAvailability =
  | 'ready'
  | 'installable'
  | 'installable-local'
  | 'installable-remote'
  | 'approval-required'
  | 'blocked';
export type SkillInstallPhase =
  | 'searching'
  | 'requested'
  | 'suggested'
  | 'approved'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'installed'
  | 'failed';
export type KnowledgeStore = 'wenyuan' | 'cangjing';
export type EmbeddingProvider = 'glm';
export type EmbeddingModel = 'Embedding-3';

export interface ModelRouteDecision {
  ministry: WorkerDomain;
  workerId: string;
  defaultModel: string;
  selectedModel: string;
  reason: string;
}

export interface QueueStateRecord {
  mode: 'foreground' | 'background';
  backgroundRun: boolean;
  status: 'queued' | 'running' | 'waiting_approval' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastTransitionAt: string;
  attempt: number;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  lastHeartbeatAt?: string;
}

export interface PendingActionRecord {
  toolName: string;
  intent: ActionIntent;
  riskLevel?: RiskLevel;
  requestedBy: WorkerDomain;
}

export interface PendingApprovalRecord extends PendingActionRecord {
  reason?: string;
  reasonCode?: string;
  feedback?: string;
  serverId?: string;
  capabilityId?: string;
  preview?: Array<{
    label: string;
    value: string;
  }>;
}

export interface WorkflowPresetDefinition {
  id: string;
  displayName: string;
  command?: string;
  version?: string;
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

export interface WorkflowVersionRecord {
  workflowId: string;
  version: string;
  status: 'draft' | 'published' | 'active';
  updatedAt: string;
  changelog: string[];
}

export interface ChatRouteRecord {
  graph: 'workflow' | 'approval-recovery' | 'learning';
  flow: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
  reason: string;
  adapter:
    | 'workflow-command'
    | 'approval-recovery'
    | 'identity-capability'
    | 'figma-design'
    | 'modification-intent'
    | 'general-prompt'
    | 'fallback';
  priority: number;
}

export interface CheckpointRef {
  sessionId: string;
  taskId?: string;
  checkpointId: string;
  checkpointCursor: number;
  recoverability: 'safe' | 'partial' | 'unsafe';
}

export interface ThoughtGraphNode {
  id: string;
  kind: 'planning' | 'research' | 'execution' | 'approval' | 'review' | 'recovery' | 'finalize' | 'failure';
  label: string;
  ministry?: WorkerDomain;
  status: 'completed' | 'running' | 'blocked' | 'failed' | 'pending';
  at?: string;
  errorCode?: string;
  checkpointRef?: CheckpointRef;
}

export interface ThoughtGraphEdge {
  from: string;
  to: string;
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
