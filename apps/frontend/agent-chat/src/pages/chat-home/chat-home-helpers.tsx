import { Avatar } from 'antd';

import { EVENT_LABELS, MINISTRY_LABELS, type SessionFilter, AGENT_LABELS } from './chat-home-constants';

export function getAgentLabel(role?: string) {
  if (!role) return '';
  return AGENT_LABELS[role] ?? role;
}

export function getMinistryLabel(ministry?: string) {
  if (!ministry) return '未分派';
  return MINISTRY_LABELS[ministry] ?? ministry;
}

export function buildEventSummary(eventItem: { type: string; payload: Record<string, unknown> }) {
  const payload = eventItem.payload;
  if (typeof payload.content === 'string' && payload.content) return payload.content;
  if (typeof payload.summary === 'string' && payload.summary) return payload.summary;
  if (typeof payload.reason === 'string' && payload.reason) return payload.reason;
  if (typeof payload.error === 'string' && payload.error) return payload.error;
  if (Array.isArray(payload.candidates)) return `生成 ${payload.candidates.length} 个学习候选`;
  return '事件已记录';
}

export function getSessionBadgeStatus(status?: string): 'success' | 'error' | 'processing' | 'default' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'failed':
      return 'error';
    case 'waiting_approval':
    case 'waiting_learning_confirmation':
      return 'warning';
    case 'running':
      return 'processing';
    default:
      return 'default';
  }
}

export function getConversationGroup(status?: string) {
  switch (status) {
    case 'running':
    case 'waiting_approval':
    case 'waiting_learning_confirmation':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已终止';
    case 'failed':
      return '失败';
    default:
      return '空闲';
  }
}

export function getStatusPill(status?: string) {
  switch (status) {
    case 'running':
      return '运行中';
    case 'waiting_approval':
      return '待审批';
    case 'waiting_learning_confirmation':
      return '待学习';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已终止';
    case 'failed':
      return '失败';
    default:
      return '空闲';
  }
}

export function matchesFilter(status: string | undefined, filter: SessionFilter) {
  switch (filter) {
    case 'running':
      return status === 'running' || status === 'waiting_learning_confirmation';
    case 'approval':
      return status === 'waiting_approval';
    case 'failed':
      return status === 'failed' || status === 'cancelled';
    case 'completed':
      return status === 'completed';
    default:
      return true;
  }
}

export function getRunningHint(status?: string, currentStep?: string) {
  if (status === 'waiting_approval') {
    return '系统已执行到高风险动作，正在等待人工审批。';
  }
  if (status === 'waiting_learning_confirmation') {
    return '本轮结果已完成，正在等待学习确认后写入长期知识。';
  }
  if (status === 'running') {
    return `正在执行 ${currentStep || '当前节点'}，稍后会继续推送 Agent 消息。`;
  }
  return '';
}

export function getCompressionHint(session?: { compression?: { condensedMessageCount: number } }) {
  if (!session?.compression?.condensedMessageCount) return '';
  return `为控制上下文长度，系统已自动压缩较早的 ${session.compression.condensedMessageCount} 条消息。`;
}

export function getWorkflowSummary(requiredMinistries?: string[]) {
  if (!requiredMinistries?.length) {
    return '首辅将按通用流程自行调度各部。';
  }
  return requiredMinistries.map(ministry => getMinistryLabel(ministry)).join(' -> ');
}

export function getRiskColor(riskLevel?: string) {
  switch (riskLevel) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'blue';
    default:
      return 'default';
  }
}

export function getMinistryTone(ministry?: string) {
  switch (ministry) {
    case 'libu':
      return 'blue';
    case 'hubu':
      return 'cyan';
    case 'libu_docs':
      return 'gold';
    case 'bingbu':
      return 'volcano';
    case 'xingbu':
      return 'red';
    case 'gongbu':
      return 'green';
    default:
      return 'default';
  }
}

export function getErrorCopy(error: string) {
  if (error === 'Network Error' || error === 'Failed to fetch') {
    return {
      title: '连接后端失败',
      description: '当前无法访问聊天后端。请确认 agent-server 已启动，并检查 `VITE_API_BASE_URL` 是否指向正确地址。'
    };
  }

  return {
    title: '工作台诊断',
    description: error
  };
}

function MenuGlyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="chatx-menu-glyph">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function RenameGlyph() {
  return (
    <MenuGlyph path="M11.7 1.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-8.2 8.2-3.2.8.8-3.2 8.2-8.2ZM10.9 3.1 4.9 9.1l-.4 1.4 1.4-.4 6-6-1-1ZM3 13h10v1H3v-1Z" />
  );
}

export function ShareGlyph() {
  return (
    <MenuGlyph path="M11.5 10a2.5 2.5 0 0 0-1.9.9L6.8 9.4a2.7 2.7 0 0 0 0-2.8l2.8-1.5a2.5 2.5 0 1 0-.5-.9L6.3 5.7a2.5 2.5 0 1 0 0 4.6l2.8 1.5a2.5 2.5 0 1 0 2.4-1.8Zm0-8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM4.5 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
  );
}

export function ArchiveGlyph() {
  return <MenuGlyph path="M3 2h10l1 2v1H2V4l1-2Zm0 4h10v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm3 2v1h4V8H6Z" />;
}

export function DeleteGlyph() {
  return <MenuGlyph path="M6 2h4l.5 1H13v1H3V3h2.5L6 2Zm-1 3h1v7H5V5Zm5 0h1v7h-1V5ZM7 5h1v7H7V5Z" />;
}

export const CHAT_ROLE_CONFIG = {
  ai: {
    avatar: <Avatar style={{ background: '#1677ff' }}>AI</Avatar>,
    placement: 'start' as const,
    variant: 'shadow' as const,
    shape: 'round' as const
  },
  user: {
    avatar: <Avatar style={{ background: '#111827' }}>你</Avatar>,
    placement: 'end' as const,
    variant: 'shadow' as const,
    shape: 'round' as const
  },
  system: {
    avatar: <Avatar style={{ background: '#7c3aed' }}>系</Avatar>,
    placement: 'start' as const,
    variant: 'outlined' as const,
    shape: 'round' as const
  }
};

export { EVENT_LABELS };
