import { Avatar } from 'antd';

import { EVENT_LABELS, MINISTRY_LABELS, type SessionFilter, AGENT_LABELS } from './chat-home-constants';
import { buildProjectedEventSummary } from '@/utils/chat-trajectory-projections';
import { getExecutionModeDisplayName, getMinistryDisplayName } from '@/utils/runtime-semantics';

// Legacy mode aliases are normalized to executionPlan.mode before user-facing rendering.
const INTERNAL_TERM_REPLACEMENTS = [
  [/direct_reply/gi, '直接回复'],
  [/direct-reply/gi, '直接回复'],
  [/supervisor workflow/gi, '协同处理'],
  [/supervisor/gi, '协同处理'],
  [/workflow/gi, '处理流程'],
  [/planning_readonly_guard/gi, '计划只读保护'],
  [/planning-readonly/gi, '计划模式'],
  [/standard/gi, '执行模式'],
  [/route reason/gi, '处理依据'],
  [/route/gi, '处理路径'],
  [/ministry/gi, '执行角色']
] as const;

export function getAgentLabel(role?: string) {
  if (!role) return '';
  return AGENT_LABELS[role] ?? role;
}

export function getMinistryLabel(ministry?: string) {
  if (!ministry) return '未分派';
  return getMinistryDisplayName(ministry) ?? MINISTRY_LABELS[ministry] ?? ministry;
}

export function getExecutionModeLabel(mode?: string) {
  return getExecutionModeDisplayName(mode) ?? mode ?? '--';
}

export function buildEventSummary(eventItem: { type: string; payload: Record<string, unknown> }) {
  const payload = eventItem.payload;
  const projectedSummary = buildProjectedEventSummary(eventItem);
  if (projectedSummary) return humanizeOperationalCopy(projectedSummary);
  if (typeof payload.content === 'string' && payload.content) return humanizeOperationalCopy(payload.content);
  if (typeof payload.summary === 'string' && payload.summary) return humanizeOperationalCopy(payload.summary);
  if (typeof payload.reason === 'string' && payload.reason) return humanizeOperationalCopy(payload.reason);
  if (typeof payload.error === 'string' && payload.error) return humanizeOperationalCopy(payload.error);
  if (Array.isArray(payload.candidates)) return `生成 ${payload.candidates.length} 个学习候选`;
  return '事件已记录';
}

export function humanizeOperationalCopy(value?: string) {
  if (!value) {
    return '';
  }

  let normalized = value;
  for (const [pattern, replacement] of INTERNAL_TERM_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/当前阶段是\s*直接回复[。. ]*/gi, '当前正在准备直接回复。')
    .replace(/聊天入口已选择\s*直接回复\s*流程[。. ]*/gi, '已按直接回复路径继续处理。')
    .replace(/当前仍由首辅统一协调全局[。. ]*/g, '正在统筹这轮处理并准备回复。')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProjectContextSnapshot(chat: {
  activeSession?: { title: string; status?: string };
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  pendingApprovals: unknown[];
  checkpoint?: {
    externalSources?: unknown[];
    connectorRefs?: string[];
    usedInstalledSkills?: string[];
    currentWorker?: string;
    currentMinistry?: string;
    thinkState?: { content?: string };
  };
}) {
  const latestUserMessage = [...chat.messages]
    .reverse()
    .find(message => message.role === 'user')
    ?.content.trim();
  const latestAssistantMessage = [...chat.messages]
    .reverse()
    .find(message => message.role === 'assistant')
    ?.content.trim();
  const objective = latestUserMessage || chat.activeSession?.title || '等待新的任务目标';
  const latestOutcome = humanizeOperationalCopy(
    latestAssistantMessage || chat.checkpoint?.thinkState?.content || '当前还没有沉淀出最新结论。'
  );

  return {
    objective,
    latestOutcome,
    evidenceCount: chat.checkpoint?.externalSources?.length ?? 0,
    approvalCount: chat.pendingApprovals.length,
    connectorCount: chat.checkpoint?.connectorRefs?.length ?? 0,
    skillCount: chat.checkpoint?.usedInstalledSkills?.length ?? 0,
    currentWorker: chat.checkpoint?.currentWorker,
    currentMinistry: chat.checkpoint?.currentMinistry
  };
}

export function getSessionBadgeStatus(status?: string): 'success' | 'error' | 'processing' | 'default' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'failed':
      return 'error';
    case 'waiting_approval':
    case 'waiting_interrupt':
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
    case 'waiting_interrupt':
    case 'waiting_approval':
    case 'waiting_learning_confirmation':
      return '最近运行';
    case 'completed':
      return '最近完成';
    case 'cancelled':
      return '已取消';
    case 'failed':
      return '失败';
    default:
      return '其他';
  }
}

export function getConversationTimeGroup(updatedAt?: string) {
  if (!updatedAt) {
    return '更早';
  }

  const now = new Date();
  const target = new Date(updatedAt);
  const diffMs = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return '今天';
  }
  if (diffDays < 7) {
    return '7 天内';
  }
  if (diffDays < 30) {
    return '30 天内';
  }

  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

export function getStatusPill(status?: string) {
  switch (status) {
    case 'running':
      return '运行中';
    case 'waiting_interrupt':
      return '待澄清方案';
    case 'waiting_approval':
      return '待审批';
    case 'waiting_learning_confirmation':
      return '待确认入库';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已取消';
    case 'failed':
      return '失败';
    default:
      return '未开始';
  }
}

export function matchesFilter(status: string | undefined, filter: SessionFilter) {
  switch (filter) {
    case 'running':
      return status === 'running' || status === 'waiting_learning_confirmation';
    case 'approval':
      return status === 'waiting_approval' || status === 'waiting_interrupt';
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
    return '检测到高风险操作，等待审批后继续。';
  }
  if (status === 'waiting_interrupt') {
    return '当前正在收敛方案，等待你回答计划问题。';
  }
  if (status === 'waiting_learning_confirmation') {
    return '当前轮次已完成，等待确认是否写入长期知识。';
  }
  if (status === 'running') {
    return currentStep ? `正在执行：${currentStep}` : '正在生成响应...';
  }
  return '';
}

export function getCompressionHint(session?: { compression?: { condensedMessageCount: number } }) {
  if (!session?.compression?.condensedMessageCount) return '';
  return `Earlier Context 已折叠 ${session.compression.condensedMessageCount} 条消息，背景信息已转为压缩摘要。`;
}

export function getWorkflowSummary(requiredMinistries?: string[]) {
  if (!requiredMinistries?.length) {
    return '将按通用协作流程继续执行。';
  }
  return requiredMinistries.map(ministry => getMinistryLabel(ministry)).join(' -> ');
}

export function getChatRouteFlowLabel(flow?: string) {
  switch (flow) {
    case 'direct-reply':
      return 'Direct Reply';
    case 'supervisor':
      return 'Supervisor Workflow';
    case 'approval':
      return 'Approval Recovery';
    case 'learning':
      return 'Learning Flow';
    default:
      return '未决策';
  }
}

export function getChatRouteTone(flow?: string) {
  switch (flow) {
    case 'direct-reply':
      return 'blue';
    case 'supervisor':
      return 'purple';
    case 'approval':
      return 'orange';
    case 'learning':
      return 'gold';
    default:
      return 'default';
  }
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
      title: '后端连接失败',
      description: '当前无法连到聊天后端。请确认 `agent-server` 已启动，并检查 `VITE_API_BASE_URL` 是否指向正确地址。'
    };
  }

  return {
    title: '运行提示',
    description: error
  };
}

export const CHAT_ROLE_CONFIG = {
  ai: {
    placement: 'start' as const,
    variant: 'borderless' as const
  },
  user: {
    placement: 'end' as const,
    variant: 'shadow' as const,
    shape: 'round' as const
  },
  system: {
    avatar: <Avatar style={{ background: '#7c3aed' }}>SYS</Avatar>,
    placement: 'start' as const,
    variant: 'outlined' as const,
    shape: 'round' as const
  }
};

export { EVENT_LABELS };
