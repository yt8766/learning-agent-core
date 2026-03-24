import type { ChatEventRecord, ChatMessageRecord, ChatSessionRecord, ChatSessionStatus } from '../../types/chat';

export const STARTER_PROMPT = '';
export const PENDING_ASSISTANT_PREFIX = 'pending_assistant_';
export const PENDING_USER_PREFIX = 'pending_user_';

export const CHECKPOINT_REFRESH_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'skill_resolved',
  'skill_stage_started',
  'skill_stage_completed',
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'learning_pending_confirmation',
  'learning_confirmed',
  'session_finished',
  'session_failed'
]);

export const MESSAGE_VISIBLE_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'session_failed',
  'session_finished'
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
      return '执行中';
    case 'waiting_approval':
      return '等待审批';
    case 'waiting_learning_confirmation':
      return '等待学习确认';
    case 'cancelled':
      return '已终止';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '空闲';
  }
}

export function getMessageRoleLabel(role: ChatMessageRecord['role']) {
  switch (role) {
    case 'user':
      return '你';
    case 'assistant':
      return 'Agent';
    default:
      return '系统';
  }
}

export function mergeEvent(current: ChatEventRecord[], nextEvent: ChatEventRecord) {
  if (current.some(event => event.id === nextEvent.id)) {
    return current;
  }

  return [...current, nextEvent];
}

export function mergeMessage(current: ChatMessageRecord[], nextMessage: ChatMessageRecord) {
  if (current.some(message => message.id === nextMessage.id)) {
    return current;
  }

  return [...current, nextMessage];
}

export function mergeOrAppendMessage(
  current: ChatMessageRecord[],
  nextMessage: ChatMessageRecord,
  appendContent = false
) {
  const target = current.find(message => message.id === nextMessage.id);
  if (!target) {
    const pendingPlaceholder = current.find(
      message =>
        (message.id.startsWith(PENDING_ASSISTANT_PREFIX) || message.id.startsWith(PENDING_USER_PREFIX)) &&
        message.sessionId === nextMessage.sessionId &&
        message.role === nextMessage.role
    );

    if (pendingPlaceholder) {
      return current.map(message =>
        message.id === pendingPlaceholder.id
          ? {
              ...message,
              id: nextMessage.id,
              content: nextMessage.content,
              linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
              card: nextMessage.card ?? message.card,
              createdAt: nextMessage.createdAt
            }
          : message
      );
    }

    return [...current, nextMessage];
  }

  if (!appendContent) {
    return current;
  }

  return current.map(message =>
    message.id === nextMessage.id
      ? {
          ...message,
          content: `${message.content}${nextMessage.content}`,
          linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
          card: nextMessage.card ?? message.card
        }
      : message
  );
}

export function buildEventCard(event: ChatEventRecord): ChatMessageRecord['card'] | undefined {
  const payload = event.payload ?? {};
  if (event.type === 'approval_required') {
    return {
      type: 'approval_request',
      intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
      toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      riskLevel: typeof payload.riskLevel === 'string' ? payload.riskLevel : undefined,
      requestedBy: typeof payload.requestedBy === 'string' ? payload.requestedBy : undefined
    };
  }

  if (event.type === 'run_cancelled') {
    return {
      type: 'run_cancelled',
      reason: typeof payload.reason === 'string' ? payload.reason : undefined
    };
  }

  return undefined;
}

export function buildVisibleEventMessage(event: ChatEventRecord) {
  const payload = event.payload ?? {};

  switch (event.type) {
    case 'decree_received':
      return '已接收你的任务，首辅正在判断本轮应该走哪条协作流程。';
    case 'skill_resolved':
      return typeof payload.skillId === 'string' ? `已解析流程模板：${payload.skillId}` : '已解析本轮流程模板。';
    case 'skill_stage_started':
    case 'skill_stage_completed':
      return typeof payload.skillStage === 'string' ? `流程阶段更新：${payload.skillStage}` : '流程阶段已更新。';
    case 'supervisor_planned':
    case 'manager_planned':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '首辅已完成本轮规划。';
    case 'libu_routed':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '吏部已完成路由分派。';
    case 'ministry_started':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '某位尚书已开始执行。';
    case 'ministry_reported':
    case 'research_progress':
    case 'tool_called':
    case 'review_completed':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '收到新的阶段战报。';
    case 'subtask_dispatched':
      return typeof payload.content === 'string' && payload.content ? payload.content : '子任务已分派。';
    case 'approval_required':
      return buildApprovalRequiredCopy(payload);
    case 'approval_resolved':
      return '审批已通过，系统继续执行。';
    case 'approval_rejected_with_feedback':
      return typeof payload.feedback === 'string' && payload.feedback
        ? `你已打回并附批注：${payload.feedback}`
        : '你已打回当前奏折。';
    case 'run_resumed':
      return '系统已根据你的决定恢复执行。';
    case 'run_cancelled':
      return typeof payload.reason === 'string' && payload.reason
        ? `已终止当前执行：${payload.reason}`
        : '已终止当前执行。';
    case 'session_failed':
      return typeof payload.error === 'string' && payload.error ? payload.error : '当前会话执行失败。';
    case 'session_finished':
      return '本轮协作已完成，正在整理最终回复。';
    default:
      return '';
  }
}

export function syncSessionFromEvent(sessions: ChatSessionRecord[], event: ChatEventRecord): ChatSessionRecord[] {
  return sessions.map(session => {
    if (session.id !== event.sessionId) {
      return session;
    }

    let nextStatus: ChatSessionStatus = session.status;
    if (event.type === 'approval_required') {
      nextStatus = 'waiting_approval';
    } else if (event.type === 'approval_resolved') {
      nextStatus = 'running';
    } else if (event.type === 'approval_rejected_with_feedback') {
      nextStatus = 'failed';
    } else if (event.type === 'learning_pending_confirmation') {
      nextStatus = 'waiting_learning_confirmation';
    } else if (
      event.type === 'learning_confirmed' ||
      event.type === 'session_finished' ||
      event.type === 'assistant_message'
    ) {
      nextStatus = 'completed';
    } else if (event.type === 'run_cancelled') {
      nextStatus = 'cancelled';
    } else if (event.type === 'session_failed') {
      nextStatus = 'failed';
    } else if (
      event.type === 'skill_resolved' ||
      event.type === 'skill_stage_started' ||
      event.type === 'skill_stage_completed' ||
      event.type === 'manager_planned' ||
      event.type === 'subtask_dispatched' ||
      event.type === 'research_progress' ||
      event.type === 'tool_called' ||
      event.type === 'review_completed' ||
      event.type === 'assistant_token'
    ) {
      nextStatus = 'running';
    }

    const taskId = typeof event.payload?.taskId === 'string' ? (event.payload.taskId as string) : session.currentTaskId;
    const nextCompression: ChatSessionRecord['compression'] =
      event.type === 'conversation_compacted'
        ? {
            summary:
              typeof event.payload?.summary === 'string' ? event.payload.summary : (session.compression?.summary ?? ''),
            condensedMessageCount:
              typeof event.payload?.condensedMessageCount === 'number'
                ? event.payload.condensedMessageCount
                : (session.compression?.condensedMessageCount ?? 0),
            condensedCharacterCount:
              typeof event.payload?.condensedCharacterCount === 'number'
                ? event.payload.condensedCharacterCount
                : (session.compression?.condensedCharacterCount ?? 0),
            totalCharacterCount:
              typeof event.payload?.totalCharacterCount === 'number'
                ? event.payload.totalCharacterCount
                : (session.compression?.totalCharacterCount ?? 0),
            trigger: event.payload?.trigger === 'character_count' ? 'character_count' : 'message_count',
            source: event.payload?.source === 'llm' ? 'llm' : 'heuristic',
            updatedAt: event.at
          }
        : session.compression;

    return {
      ...session,
      currentTaskId: taskId,
      status: nextStatus,
      updatedAt: event.at,
      compression: nextCompression
    };
  });
}

export function syncMessageFromEvent(current: ChatMessageRecord[], event: ChatEventRecord) {
  const payload = event.payload ?? {};
  if (event.type !== 'assistant_message' && event.type !== 'user_message' && event.type !== 'assistant_token') {
    return current;
  }

  const messageId = typeof payload.messageId === 'string' ? payload.messageId : '';
  const content = typeof payload.content === 'string' ? payload.content : '';

  if (!messageId || !content) {
    return current;
  }

  const role: ChatMessageRecord['role'] = event.type === 'user_message' ? 'user' : 'assistant';
  const linkedAgent = typeof payload.from === 'string' ? payload.from : undefined;

  return mergeOrAppendMessage(
    current,
    {
      id: messageId,
      sessionId: event.sessionId,
      role,
      content,
      linkedAgent,
      createdAt: event.at
    },
    event.type === 'assistant_token'
  );
}

export function syncProcessMessageFromEvent(current: ChatMessageRecord[], event: ChatEventRecord) {
  if (!MESSAGE_VISIBLE_EVENT_TYPES.has(event.type)) {
    return current;
  }

  const content = buildVisibleEventMessage(event);
  if (!content) {
    return current;
  }

  return mergeMessage(current, {
    id: `event_${event.id}`,
    sessionId: event.sessionId,
    role: 'system',
    content,
    card: buildEventCard(event),
    createdAt: event.at
  });
}

function buildApprovalRequiredCopy(payload: Record<string, unknown>) {
  const intent = typeof payload.intent === 'string' ? payload.intent : 'unknown';
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  const requestedBy = typeof payload.requestedBy === 'string' ? payload.requestedBy : '';
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const intentLabel = getIntentLabel(intent);
  const toolSuffix = toolName ? `，工具为 ${toolName}` : '';
  const actorSuffix = requestedBy ? `，由 ${requestedBy} 发起` : '';

  if (reason) {
    return `等待审批：准备执行${intentLabel}${toolSuffix}${actorSuffix}。${reason}`;
  }

  return `等待审批：准备执行${intentLabel}${toolSuffix}${actorSuffix}。该动作具有风险，需要你明确拍板后才能继续。`;
}

function getIntentLabel(intent: string) {
  switch (intent) {
    case 'write_file':
      return '文件写入';
    case 'call_external_api':
      return '外部请求';
    case 'read_file':
      return '文件读取';
    default:
      return intent;
  }
}

export function removePendingMessages(
  current: ChatMessageRecord[],
  pendingAssistantId?: string,
  pendingUserId?: string
) {
  if (!pendingAssistantId && !pendingUserId) {
    return current;
  }

  return current.filter(message => message.id !== pendingAssistantId && message.id !== pendingUserId);
}
