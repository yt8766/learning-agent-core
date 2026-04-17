import {
  ActionIntent as CoreActionIntentValue,
  ApprovalDecision as CoreApprovalDecisionValue,
  TaskStatus as CoreTaskStatusValue
} from '@agent/core';
import type {
  ApprovalScope as CoreApprovalScope,
  CheckpointRef as CoreCheckpointRef,
  ChatRole as CoreChatRole,
  ChatRouteRecord as CoreChatRouteRecord,
  ApprovalStatus as CoreApprovalStatus,
  ExecutionPlanMode as CoreExecutionPlanMode,
  LlmUsageModelRecord as CoreLlmUsageModelRecord,
  LlmUsageRecord as CoreLlmUsageRecord,
  ModelRouteDecision as CoreModelRouteDecision,
  PendingActionRecord as CorePendingActionRecord,
  PendingApprovalRecord as CorePendingApprovalRecord,
  QueueStateRecord as CoreQueueStateRecord,
  ReviewDecision as CoreReviewDecision,
  SkillStatus as CoreSkillStatus,
  ThoughtGraphRecord as CoreThoughtGraphRecord,
  ThoughtGraphEdge as CoreThoughtGraphEdge,
  ThoughtGraphNode as CoreThoughtGraphNode,
  TrustClass as CoreTrustClass,
  WorkflowPresetDefinition as CoreWorkflowPresetDefinition
} from '@agent/core';
export {
  ActionIntentSchema,
  ApprovalDecisionSchema,
  ApprovalScopeSchema,
  ApprovalStatusSchema,
  ChatRouteRecordSchema,
  ChatRoleSchema,
  CheckpointRefSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  SkillStatusSchema,
  TaskStatusSchema,
  ThoughtGraphEdgeSchema,
  ThoughtGraphNodeSchema,
  ThoughtGraphRecordSchema,
  TrustClassSchema,
  WorkflowPresetDefinitionSchema
} from '@agent/core';
export { LlmUsageModelRecordSchema, LlmUsageRecordSchema, QueueStateRecordSchema } from '@agent/core';

export const ActionIntent = CoreActionIntentValue;
export const ApprovalDecision = CoreApprovalDecisionValue;
export const TaskStatus = CoreTaskStatusValue;

export const SkillStatusValues = ['draft', 'lab', 'stable', 'disabled'] as const;
export type SkillStatus = CoreSkillStatus;

export const MemoryTypeValues = ['success_case', 'failure_case', 'fact', 'heuristic', 'task_summary'] as const;
export type MemoryType = (typeof MemoryTypeValues)[number];

export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];
export type ApprovalStatus = CoreApprovalStatus;
export type ApprovalScope = CoreApprovalScope;
export type ActionIntent = (typeof ActionIntent)[keyof typeof ActionIntent];
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const AgentRole = {
  MANAGER: 'manager',
  RESEARCH: 'research',
  EXECUTOR: 'executor',
  REVIEWER: 'reviewer'
} as const;

export type AgentRole = (typeof AgentRole)[keyof typeof AgentRole];

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type LearningSourceType =
  | 'execution'
  | 'document'
  | 'research'
  | 'memory'
  | 'official-docs'
  | 'repo'
  | 'community'
  | 'web'
  | 'market';
export type ReviewDecision = CoreReviewDecision;
export type TrustClass = CoreTrustClass;
export type ChatRole = CoreChatRole;
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
  | 'tool_stream_detected'
  | 'tool_stream_dispatched'
  | 'tool_stream_completed'
  | 'interrupt_pending'
  | 'interrupt_resumed'
  | 'interrupt_rejected_with_feedback'
  | 'execution_step_started'
  | 'execution_step_completed'
  | 'execution_step_blocked'
  | 'execution_step_resumed'
  | 'approval_required'
  | 'approval_resolved'
  | 'approval_rejected_with_feedback'
  | 'review_completed'
  | 'learning_pending_confirmation'
  | 'learning_confirmed'
  | 'conversation_compacted'
  | 'context_compaction_applied'
  | 'context_compaction_retried'
  | 'node_status'
  | 'node_progress'
  | 'assistant_token'
  | 'assistant_message'
  | 'run_resumed'
  | 'run_cancelled'
  | 'budget_exhausted'
  | 'preflight_governance_blocked'
  | 'background_learning_queued'
  | 'dream_task_completed'
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
export type ExecutionPlanMode = CoreExecutionPlanMode;
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

export type ModelRouteDecision = CoreModelRouteDecision;

export type QueueStateRecord = CoreQueueStateRecord;

export type PendingActionRecord = CorePendingActionRecord;

export type PendingApprovalRecord = CorePendingApprovalRecord;

export interface WorkflowPresetDefinition extends Omit<
  CoreWorkflowPresetDefinition,
  'sourcePolicy' | 'webLearningPolicy'
> {
  requiredMinistries: MinistryId[];
  explicitOnly?: boolean;
  webLearningPolicy?: {
    enabled: boolean;
    preferredSourceTypes: LearningSourceType[];
    acceptedTrustClasses: TrustClass[];
  };
  sourcePolicy?: {
    mode: SourcePolicyMode;
    preferredUrls?: string[];
  };
}

export interface WorkflowVersionRecord {
  workflowId: string;
  version: string;
  status: 'draft' | 'published' | 'active';
  updatedAt: string;
  changelog: string[];
}

export type ChatRouteRecord = CoreChatRouteRecord;

export type ExecutionStepRoute = 'direct-reply' | 'research-first' | 'workflow-execute' | 'approval-recovery';

export type ExecutionStepStage =
  | 'request-received'
  | 'route-selection'
  | 'task-planning'
  | 'research'
  | 'execution'
  | 'review'
  | 'delivery'
  | 'approval-interrupt'
  | 'recovery';

export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'blocked';

export type ExecutionStepOwner = 'session' | 'libu' | 'hubu' | 'gongbu' | 'bingbu' | 'xingbu' | 'libu-docs' | 'system';

export interface ExecutionStepRecord {
  id: string;
  route: ExecutionStepRoute;
  stage: ExecutionStepStage;
  label: string;
  owner: ExecutionStepOwner;
  status: ExecutionStepStatus;
  startedAt: string;
  completedAt?: string;
  detail?: string;
  reason?: string;
}

export type CheckpointRef = CoreCheckpointRef;

export interface ThoughtGraphNode extends Omit<CoreThoughtGraphNode, 'ministry'> {
  ministry?: WorkerDomain;
}

export type ThoughtGraphEdge = CoreThoughtGraphEdge;

export type ThoughtGraphRecord = CoreThoughtGraphRecord;

export type LlmUsageModelRecord = CoreLlmUsageModelRecord;

export interface LlmUsageRecord extends Omit<CoreLlmUsageRecord, 'models'> {
  models: LlmUsageModelRecord[];
}
