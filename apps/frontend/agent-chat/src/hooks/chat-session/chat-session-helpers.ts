import type {
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionStatus
} from '../../types/chat';

export const STARTER_PROMPT = '';
export const PENDING_ASSISTANT_PREFIX = 'pending_assistant_';
export const PENDING_USER_PREFIX = 'pending_user_';

export const CHECKPOINT_REFRESH_EVENT_TYPES = new Set<ChatEventRecord['type']>([
  'decree_received',
  'skill_resolved',
  'skill_stage_started',
  'skill_stage_completed',
  'approval_required',
  'approval_resolved',
  'approval_rejected_with_feedback',
  'run_cancelled',
  'learning_pending_confirmation',
  'learning_confirmed',
  'final_response_completed',
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
      return '回复中';
    case 'waiting_approval':
      return '待确认';
    case 'waiting_learning_confirmation':
      return '待写入';
    case 'cancelled':
      return '已停止';
    case 'completed':
      return '已完成';
    case 'failed':
      return '异常';
    default:
      return '其他';
  }
}

export function getMessageRoleLabel(role: ChatMessageRecord['role']) {
  switch (role) {
    case 'user':
      return '你';
    case 'assistant':
      return 'AI';
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
    return current.map(message =>
      message.id === nextMessage.id
        ? {
            ...message,
            content: nextMessage.content,
            linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
            card: nextMessage.card ?? message.card,
            createdAt: nextMessage.createdAt
          }
        : message
    );
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
      return '已接收你的请求，正在判断这一轮该如何处理。';
    case 'skill_resolved':
      return typeof payload.skillId === 'string' ? `已解析流程模板：${payload.skillId}` : '已解析本轮流程模板。';
    case 'skill_stage_started':
    case 'skill_stage_completed':
      return typeof payload.skillStage === 'string' ? `流程阶段更新：${payload.skillStage}` : '流程阶段已更新。';
    case 'supervisor_planned':
    case 'manager_planned':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '这一轮的处理计划已生成。';
    case 'libu_routed':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '已完成本轮路由分派。';
    case 'ministry_started':
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '已开始处理这一轮任务。';
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
        : '你已打回当前处理。';
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
      event.type === 'final_response_completed' ||
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

  if (!messageId) {
    return current;
  }
  // assistant_token 允许空串分片，否则会漏掉首包/心跳，导致消息永远不创建
  if (event.type !== 'assistant_token' && !content) {
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

export function syncCheckpointMessages(
  current: ChatMessageRecord[],
  checkpoint: ChatCheckpointRecord | undefined,
  sessionId: string
) {
  if (!checkpoint || !sessionId) {
    return current;
  }

  let nextMessages = current;
  for (const message of buildCheckpointMessages(checkpoint, sessionId)) {
    nextMessages = mergeOrAppendMessage(nextMessages, message);
  }

  return nextMessages;
}

export function deriveSessionStatusFromCheckpoint(
  checkpoint: ChatCheckpointRecord | undefined,
  fallback: ChatSessionStatus = 'idle'
): ChatSessionStatus {
  if (!checkpoint) {
    return fallback;
  }

  if (checkpoint.pendingApprovals?.length || checkpoint.pendingApproval) {
    return 'waiting_approval';
  }

  if (checkpoint.graphState?.status === 'failed') {
    return 'failed';
  }

  if (checkpoint.graphState?.status === 'cancelled') {
    return 'cancelled';
  }

  if (checkpoint.graphState?.status === 'completed') {
    return 'completed';
  }

  if (checkpoint.graphState?.status === 'blocked' && checkpoint.graphState?.currentStep?.includes('learning')) {
    return 'waiting_learning_confirmation';
  }

  if (checkpoint.graphState?.status === 'running' || checkpoint.graphState?.status === 'queued') {
    return 'running';
  }

  return fallback;
}

export function syncSessionFromCheckpoint(
  sessions: ChatSessionRecord[],
  checkpoint: ChatCheckpointRecord | undefined
): ChatSessionRecord[] {
  if (!checkpoint) {
    return sessions;
  }

  return sessions.map(session =>
    session.id === checkpoint.sessionId
      ? {
          ...session,
          currentTaskId: checkpoint.taskId,
          status: deriveSessionStatusFromCheckpoint(checkpoint, session.status),
          updatedAt: checkpoint.updatedAt
        }
      : session
  );
}

function buildCheckpointMessages(checkpoint: ChatCheckpointRecord, sessionId: string): ChatMessageRecord[] {
  const messages: ChatMessageRecord[] = [];
  const llmFallbackNotes = (checkpoint.agentStates ?? [])
    .flatMap(state => state.observations ?? [])
    .filter(note => note.startsWith('LLM '));

  if (checkpoint.externalSources?.length) {
    messages.push({
      id: `checkpoint_sources_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: `本轮已收集 ${checkpoint.externalSources.length} 条来源证据。`,
      card: {
        type: 'evidence_digest',
        sources: checkpoint.externalSources.slice(0, 6).map(source => ({
          id: source.id,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          trustClass: source.trustClass,
          summary: source.summary,
          fetchedAt: source.fetchedAt,
          detail: source.detail
        }))
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (checkpoint.learningEvaluation) {
    messages.push({
      id: `checkpoint_learning_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: `本轮学习评估分数 ${checkpoint.learningEvaluation.score}，置信度 ${checkpoint.learningEvaluation.confidence}。`,
      card: {
        type: 'learning_summary',
        score: checkpoint.learningEvaluation.score,
        confidence: checkpoint.learningEvaluation.confidence,
        notes: checkpoint.learningEvaluation.notes,
        skillGovernanceRecommendations: checkpoint.learningEvaluation.skillGovernanceRecommendations ?? [],
        recommendedCount: checkpoint.learningEvaluation.recommendedCandidateIds.length,
        autoConfirmCount: checkpoint.learningEvaluation.autoConfirmCandidateIds.length
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (
    checkpoint.skillSearch &&
    (checkpoint.skillSearch.capabilityGapDetected || checkpoint.skillSearch.suggestions.length)
  ) {
    messages.push({
      id: `checkpoint_skill_search_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: checkpoint.skillSearch.capabilityGapDetected
        ? `已检测到能力缺口，本地技能库返回 ${checkpoint.skillSearch.suggestions.length} 个候选。`
        : `当前本地技能库命中了 ${checkpoint.skillSearch.suggestions.length} 个可用候选。`,
      card: {
        type: 'skill_suggestions',
        capabilityGapDetected: checkpoint.skillSearch.capabilityGapDetected,
        status: checkpoint.skillSearch.status,
        safetyNotes: checkpoint.skillSearch.safetyNotes,
        suggestions: checkpoint.skillSearch.suggestions.slice(0, 5)
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (
    checkpoint.reusedSkills?.length ||
    checkpoint.usedInstalledSkills?.length ||
    checkpoint.usedCompanyWorkers?.length
  ) {
    messages.push({
      id: `checkpoint_skills_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: '本轮已复用既有技能和公司专员。',
      card: {
        type: 'skill_reuse',
        reusedSkills: checkpoint.reusedSkills ?? [],
        usedInstalledSkills: checkpoint.usedInstalledSkills ?? [],
        usedCompanyWorkers: checkpoint.usedCompanyWorkers ?? []
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (llmFallbackNotes.length) {
    messages.push({
      id: `checkpoint_runtime_issue_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: '本轮模型调用未正常返回，当前回复已回退到兜底内容。',
      card: {
        type: 'runtime_issue',
        severity: 'warning',
        title: 'LLM Direct Reply Fallback',
        notes: llmFallbackNotes.slice(0, 3)
      },
      createdAt: checkpoint.updatedAt
    });
  }

  if (checkpoint.currentWorker || checkpoint.currentMinistry) {
    const currentRoute = checkpoint.modelRoute?.find(route => route.ministry === checkpoint.currentMinistry);
    messages.push({
      id: `checkpoint_dispatch_${checkpoint.taskId}`,
      sessionId,
      role: 'system',
      content: checkpoint.currentWorker
        ? `当前由 ${checkpoint.currentMinistry ?? '某位尚书'} 下的 ${checkpoint.currentWorker} 继续推进。`
        : '当前执行路线已经确认，正在等待具体执行官推进。',
      card: {
        type: 'worker_dispatch',
        currentMinistry: checkpoint.currentMinistry,
        currentWorker: checkpoint.currentWorker,
        routeReason: checkpoint.chatRoute
          ? `聊天入口命中 ${checkpoint.chatRoute.adapter}，当前按 ${checkpoint.chatRoute.flow} 路线推进。`
          : currentRoute?.reason,
        chatRoute: checkpoint.chatRoute
          ? {
              flow: checkpoint.chatRoute.flow,
              reason: checkpoint.chatRoute.reason,
              adapter: checkpoint.chatRoute.adapter,
              priority: checkpoint.chatRoute.priority
            }
          : undefined,
        usedInstalledSkills: checkpoint.usedInstalledSkills ?? [],
        usedCompanyWorkers: checkpoint.usedCompanyWorkers ?? []
      },
      createdAt: checkpoint.updatedAt
    });
  }

  return messages;
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
