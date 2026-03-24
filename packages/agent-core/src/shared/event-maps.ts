import { AgentMessage, ChatEventRecord } from '@agent/shared';

export const TRACE_EVENT_MAP: Record<string, ChatEventRecord['type']> = {
  decree_received: 'decree_received',
  supervisor_planned: 'supervisor_planned',
  libu_routed: 'libu_routed',
  ministry_started: 'ministry_started',
  ministry_reported: 'ministry_reported',
  skill_resolved: 'skill_resolved',
  skill_stage_started: 'skill_stage_started',
  skill_stage_completed: 'skill_stage_completed',
  manager_plan: 'manager_planned',
  manager_replan: 'manager_planned',
  dispatch: 'subtask_dispatched',
  research: 'research_progress',
  execute: 'tool_called',
  review: 'review_completed',
  approval_gate: 'approval_required',
  approval_rejected_with_feedback: 'approval_rejected_with_feedback',
  budget_exhausted: 'budget_exhausted',
  run_resumed: 'run_resumed',
  run_cancelled: 'run_cancelled',
  final_response_completed: 'final_response_completed',
  finish: 'session_finished',
  memory_write: 'learning_pending_confirmation',
  rule_write: 'learning_pending_confirmation',
  skill_extract: 'learning_pending_confirmation'
};

export const TASK_MESSAGE_EVENT_MAP: Record<Exclude<AgentMessage['type'], 'summary_delta'>, ChatEventRecord['type']> = {
  dispatch: 'subtask_dispatched',
  research_result: 'research_progress',
  execution_result: 'tool_called',
  review_result: 'review_completed',
  summary: 'assistant_message'
};
