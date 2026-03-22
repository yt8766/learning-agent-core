import { AgentMessage, ChatEventRecord } from '@agent/shared';

export const TRACE_EVENT_MAP: Record<string, ChatEventRecord['type']> = {
  manager_plan: 'manager_planned',
  manager_replan: 'manager_planned',
  dispatch: 'subtask_dispatched',
  research: 'research_progress',
  execute: 'tool_called',
  review: 'review_completed',
  approval_gate: 'approval_required',
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
