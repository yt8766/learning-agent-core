import type { ChatEventRecord, ChatMessageRecord } from '@/types/chat';

export const STARTER_PROMPT = '';
export const PENDING_ASSISTANT_PREFIX = 'pending_assistant_';
export const PENDING_USER_PREFIX = 'pending_user_';

export const CHECKPOINT_REFRESH_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'manager_planned',
  'skill_resolved',
  'libu_routed',
  'ministry_started',
  'ministry_reported',
  'research_progress',
  'interrupt_pending',
  'interrupt_resumed',
  'interrupt_rejected_with_feedback',
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'learning_pending_confirmation',
  'learning_confirmed',
  'node_status',
  'node_progress',
  'final_response_completed',
  'session_finished',
  'session_failed'
]);

export const MESSAGE_VISIBLE_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'conversation_compacted',
  'node_status',
  'node_progress',
  'interrupt_pending',
  'interrupt_resumed',
  'interrupt_rejected_with_feedback',
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'run_resumed'
]);

export function formatSessionTime(value?: string) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString();
}

export function getSessionStatusLabel(status?: string) {
  switch (status) {
    case 'running':
      return '运行中';
    case 'waiting_interrupt':
      return '待澄清方案';
    case 'waiting_approval':
      return '待审批';
    case 'waiting_learning_confirmation':
      return '待确认入库';
    case 'cancelled':
      return '已取消';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '未开始';
  }
}

export function getMessageRoleLabel(role: ChatMessageRecord['role']) {
  switch (role) {
    case 'user':
      return '用户';
    case 'assistant':
      return 'AI';
    default:
      return '系统';
  }
}
