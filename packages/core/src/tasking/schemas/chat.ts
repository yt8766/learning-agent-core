import { z } from 'zod';

import { ApprovalScopeSchema, ChatRoleSchema, RiskLevelSchema } from '../../primitives';
import { PlanQuestionRecordSchema } from './planning';
import { ChatMessageFeedbackRecordSchema } from './session';

const AgentRoleSchema = z.enum(['manager', 'research', 'executor', 'reviewer']);
export const ChatCapabilityCatalogItemSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  summary: z.string().optional(),
  ownerType: z.string().optional(),
  ownerId: z.string().optional(),
  scope: z.string().optional(),
  sourceLabel: z.string().optional(),
  bootstrap: z.boolean().optional(),
  enabled: z.boolean().optional(),
  status: z.string().optional(),
  family: z.string().optional(),
  capabilityType: z.string().optional(),
  preferredMinistries: z.array(z.string()).optional(),
  blockedReason: z.string().optional()
});
export const ChatCapabilityCatalogGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['skill', 'connector', 'tool']),
  items: z.array(ChatCapabilityCatalogItemSchema)
});
export const ChatSkillDraftContractSchema = z.object({
  requiredTools: z.array(z.string()),
  optionalTools: z.array(z.string()),
  approvalSensitiveTools: z.array(z.string()),
  preferredConnectors: z.array(z.string()),
  requiredConnectors: z.array(z.string())
});
export const ChatApprovalRequestPreviewItemSchema = z.object({
  label: z.string(),
  value: z.string()
});
export const ChatPlanQuestionCardStatusSchema = z.enum(['pending', 'answered', 'bypassed', 'aborted']);

export const ApprovalRequestChatMessageCardSchema = z.object({
  type: z.literal('approval_request'),
  intent: z.string(),
  toolName: z.string().optional(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  riskLevel: RiskLevelSchema.optional(),
  riskCode: z.string().optional(),
  riskReason: z.string().optional(),
  commandPreview: z.string().optional(),
  approvalScope: ApprovalScopeSchema.optional(),
  requestedBy: z.string().optional(),
  serverId: z.string().optional(),
  capabilityId: z.string().optional(),
  preview: z.array(ChatApprovalRequestPreviewItemSchema).optional()
});

export const PlanQuestionChatMessageCardSchema = z.object({
  type: z.literal('plan_question'),
  title: z.string(),
  summary: z.string().optional(),
  status: ChatPlanQuestionCardStatusSchema.optional(),
  interruptId: z.string().optional(),
  questions: z.array(PlanQuestionRecordSchema)
});

export const RunCancelledChatMessageCardSchema = z.object({
  type: z.literal('run_cancelled'),
  reason: z.string().optional()
});

export const CapabilityCatalogChatMessageCardSchema = z.object({
  type: z.literal('capability_catalog'),
  title: z.string(),
  summary: z.string().optional(),
  groups: z.array(ChatCapabilityCatalogGroupSchema)
});

export const SkillDraftCreatedChatMessageCardSchema = z.object({
  type: z.literal('skill_draft_created'),
  skillId: z.string(),
  displayName: z.string(),
  description: z.string(),
  ownerType: z.string(),
  scope: z.string(),
  status: z.string(),
  enabled: z.boolean(),
  contract: ChatSkillDraftContractSchema.optional(),
  nextActions: z.array(z.string())
});

export const ChatMessageCardSchema = z.discriminatedUnion('type', [
  ApprovalRequestChatMessageCardSchema,
  PlanQuestionChatMessageCardSchema,
  RunCancelledChatMessageCardSchema,
  CapabilityCatalogChatMessageCardSchema,
  SkillDraftCreatedChatMessageCardSchema
]);

export const ChatMessageRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: ChatRoleSchema,
  content: z.string(),
  taskId: z.string().optional(),
  linkedAgent: AgentRoleSchema.optional(),
  card: ChatMessageCardSchema.optional(),
  feedback: ChatMessageFeedbackRecordSchema.optional(),
  createdAt: z.string()
});

export const ChatEventRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: z.enum([
    'decree_received',
    'session_started',
    'user_message',
    'supervisor_planned',
    'libu_routed',
    'ministry_started',
    'ministry_reported',
    'skill_resolved',
    'skill_stage_started',
    'skill_stage_completed',
    'manager_planned',
    'subtask_dispatched',
    'research_progress',
    'tool_selected',
    'tool_called',
    'tool_stream_detected',
    'tool_stream_dispatched',
    'tool_stream_completed',
    'interrupt_pending',
    'interrupt_resumed',
    'interrupt_rejected_with_feedback',
    'execution_step_started',
    'execution_step_completed',
    'execution_step_blocked',
    'execution_step_resumed',
    'approval_required',
    'approval_resolved',
    'approval_rejected_with_feedback',
    'review_completed',
    'learning_pending_confirmation',
    'learning_confirmed',
    'message_feedback_learning_candidate',
    'conversation_compacted',
    'context_compaction_applied',
    'context_compaction_retried',
    'node_status',
    'node_progress',
    'assistant_token',
    'assistant_message',
    'run_resumed',
    'run_cancelled',
    'budget_exhausted',
    'preflight_governance_blocked',
    'background_learning_queued',
    'dream_task_completed',
    'final_response_delta',
    'final_response_completed',
    'session_finished',
    'session_failed'
  ]),
  at: z.string(),
  payload: z.record(z.string(), z.unknown())
});

export const ChatThoughtChainItemSchema = z.object({
  key: z.string(),
  messageId: z.string().optional(),
  thinkingDurationMs: z.number().optional(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  footer: z.string().optional(),
  status: z.enum(['loading', 'success', 'error', 'abort']).optional(),
  collapsible: z.boolean().optional(),
  blink: z.boolean().optional()
});

export const ChatThinkStateSchema = z.object({
  messageId: z.string().optional(),
  thinkingDurationMs: z.number().optional(),
  title: z.string(),
  content: z.string(),
  loading: z.boolean().optional(),
  blink: z.boolean().optional()
});
