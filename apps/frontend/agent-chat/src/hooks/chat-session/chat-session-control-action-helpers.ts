import type { ChatCheckpointRecord, ChatMessageRecord } from '@/types/chat';

import { PENDING_ASSISTANT_PREFIX } from './chat-session-formatters';

export const OPTIMISTIC_CONTROL_MESSAGE_PREFIX = 'optimistic_control_';

export function createOptimisticThinkingCheckpoint(
  current: ChatCheckpointRecord | undefined,
  sessionId: string,
  updatedAt: string,
  pendingAssistantId?: string
): ChatCheckpointRecord {
  const optimisticTaskId = `optimistic_${sessionId}`;
  const thinkState = {
    messageId: pendingAssistantId,
    thinkingDurationMs: 0,
    title: '正在准备回复',
    content: '正在梳理你刚刚的消息，整理最合适的回复和下一步动作。',
    loading: true,
    blink: true
  };

  if (current?.sessionId === sessionId) {
    return {
      ...current,
      taskId: optimisticTaskId,
      pendingApproval: undefined,
      pendingApprovals: [],
      activeInterrupt: undefined,
      graphState: {
        ...current.graphState,
        status: 'running',
        currentStep: 'drafting_reply'
      },
      thoughtChain: [],
      thinkState,
      updatedAt
    };
  }

  return {
    sessionId,
    taskId: optimisticTaskId,
    traceCursor: 0,
    messageCursor: 0,
    approvalCursor: 0,
    learningCursor: 0,
    pendingApprovals: [],
    agentStates: [],
    graphState: {
      status: 'running',
      currentStep: 'drafting_reply'
    },
    thoughtChain: [],
    thinkState,
    createdAt: updatedAt,
    updatedAt
  };
}

export function clearOptimisticThinkingCheckpoint(
  current: ChatCheckpointRecord | undefined,
  sessionId: string,
  pendingAssistantId?: string
) {
  if (!current || current.sessionId !== sessionId) {
    return current;
  }

  if (current.taskId === `optimistic_${sessionId}`) {
    return undefined;
  }

  return {
    ...current,
    thinkState: current.thinkState?.messageId === pendingAssistantId ? undefined : current.thinkState
  };
}

export function buildOptimisticControlMessage(sessionId: string, content: string): ChatMessageRecord {
  const isSuccess = /恢复执行|开始安装|已安装/.test(content);
  const label = content.includes('恢复执行') ? '已恢复执行' : content.includes('安装') ? 'Skill 状态' : '本轮已终止';

  return {
    id: `${OPTIMISTIC_CONTROL_MESSAGE_PREFIX}${sessionId}`,
    sessionId,
    role: 'system',
    content,
    card: {
      type: 'control_notice',
      tone: isSuccess ? 'success' : 'warning',
      label
    },
    createdAt: new Date().toISOString()
  };
}

export function buildCancelledCheckpointState(
  current: ChatCheckpointRecord | undefined,
  sessionId: string,
  updatedAt: string
) {
  if (!current || current.sessionId !== sessionId) {
    return current;
  }

  return {
    ...current,
    graphState: {
      ...current.graphState,
      status: 'cancelled',
      currentStep: 'cancelled'
    },
    thinkState: undefined,
    updatedAt
  };
}

export function buildRecoveredCheckpointState(
  current: ChatCheckpointRecord | undefined,
  sessionId: string,
  updatedAt: string
) {
  if (!current || current.sessionId !== sessionId) {
    return current;
  }

  return {
    ...current,
    graphState: {
      ...(current.graphState ?? {}),
      status: 'running',
      currentStep: current.graphState?.currentStep ?? 'recovering'
    },
    thinkState: {
      messageId: current.thinkState?.messageId,
      thinkingDurationMs: 0,
      title: '正在恢复执行',
      content: current.currentSkillExecution
        ? `正在恢复 ${current.currentSkillExecution.displayName} 的 ${current.currentSkillExecution.title}。`
        : '正在基于当前上下文恢复本轮处理。',
      loading: true,
      blink: true
    },
    updatedAt
  };
}

export function mapReceiptStatus(status: 'pending' | 'approved' | 'rejected' | 'installed' | 'failed', phase?: string) {
  if (status === 'approved' && phase === 'installing') {
    return 'installing' as const;
  }
  if (status === 'approved' && phase === 'approved') {
    return 'approved' as const;
  }
  if (status === 'pending') {
    return 'pending' as const;
  }
  if (status === 'installed') {
    return 'installed' as const;
  }
  if (status === 'failed') {
    return 'failed' as const;
  }
  if (status === 'rejected') {
    return 'rejected' as const;
  }
  return 'approved' as const;
}

export function isPendingAssistantMessageId(messageId: string | undefined, sessionId: string) {
  return messageId === `${PENDING_ASSISTANT_PREFIX}${sessionId}`;
}
