import type { ChatEventRecord, ChatMessageRecord, ChatSessionRecord, ChatSessionStatus } from '@/types/chat';

import { MESSAGE_VISIBLE_EVENT_TYPES, PENDING_ASSISTANT_PREFIX, PENDING_USER_PREFIX } from './chat-session-formatters';

const TRANSIENT_ASSISTANT_MESSAGE_PREFIXES = ['progress_stream_', 'direct_reply_', 'summary_stream_'] as const;

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
        message.role === nextMessage.role &&
        shouldReplacePendingPlaceholder(message, nextMessage)
    );

    if (pendingPlaceholder) {
      return current.map(message =>
        message.id === pendingPlaceholder.id
          ? {
              ...message,
              id: nextMessage.id,
              content: nextMessage.content,
              taskId: nextMessage.taskId ?? message.taskId,
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
            taskId: nextMessage.taskId ?? message.taskId,
            linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
            card: nextMessage.card ?? message.card,
            createdAt: nextMessage.createdAt
          }
        : message
    );
  }

  const nextAppendedContent = resolveAppendedContent(target.content, nextMessage.content);

  return current.map(message =>
    message.id === nextMessage.id
      ? {
          ...message,
          content: nextAppendedContent,
          taskId: nextMessage.taskId ?? message.taskId,
          linkedAgent: nextMessage.linkedAgent ?? message.linkedAgent,
          card: nextMessage.card ?? message.card
        }
      : message
  );
}

function resolveAppendedContent(currentContent: string, incomingContent: string) {
  if (!incomingContent) {
    return currentContent;
  }

  if (!currentContent) {
    return incomingContent;
  }

  if (incomingContent === currentContent) {
    return currentContent;
  }

  if (incomingContent.startsWith(currentContent)) {
    return incomingContent;
  }

  if (currentContent.endsWith(incomingContent)) {
    return currentContent;
  }

  return `${currentContent}${incomingContent}`;
}

function shouldReplacePendingPlaceholder(pendingMessage: ChatMessageRecord, nextMessage: ChatMessageRecord) {
  if (pendingMessage.id.startsWith(PENDING_USER_PREFIX)) {
    return true;
  }

  const pendingMs = Date.parse(pendingMessage.createdAt ?? '');
  const nextMs = Date.parse(nextMessage.createdAt ?? '');

  if (!Number.isFinite(pendingMs) || !Number.isFinite(nextMs)) {
    return true;
  }

  return nextMs >= pendingMs;
}

export function buildEventCard(event: ChatEventRecord): ChatMessageRecord['card'] | undefined {
  const payload = event.payload ?? {};
  if (event.type === 'conversation_compacted') {
    return {
      type: 'compression_summary',
      summary: typeof payload.summary === 'string' ? payload.summary : '',
      periodOrTopic: typeof payload.periodOrTopic === 'string' ? payload.periodOrTopic : undefined,
      focuses: sanitizeStringArray(payload.focuses, 5),
      keyDeliverables: sanitizeStringArray(payload.keyDeliverables, 5),
      risks: sanitizeStringArray(payload.risks, 4),
      nextActions: sanitizeStringArray(payload.nextActions, 4),
      supportingFacts: sanitizeStringArray(payload.supportingFacts, 4),
      condensedMessageCount:
        typeof payload.condensedMessageCount === 'number' ? payload.condensedMessageCount : undefined,
      condensedCharacterCount:
        typeof payload.condensedCharacterCount === 'number' ? payload.condensedCharacterCount : undefined,
      totalCharacterCount: typeof payload.totalCharacterCount === 'number' ? payload.totalCharacterCount : undefined,
      previewMessages: Array.isArray(payload.previewMessages)
        ? payload.previewMessages
            .filter(
              item =>
                item &&
                typeof item === 'object' &&
                ((item as { role?: unknown }).role === 'user' ||
                  (item as { role?: unknown }).role === 'assistant' ||
                  (item as { role?: unknown }).role === 'system') &&
                typeof (item as { content?: unknown }).content === 'string'
            )
            .map(item => ({
              role: (item as { role: 'user' | 'assistant' | 'system' }).role,
              content: (item as { content: string }).content
            }))
        : undefined,
      trigger: payload.trigger === 'character_count' ? 'character_count' : 'message_count',
      source: payload.source === 'llm' ? 'llm' : 'heuristic'
    };
  }

  if (event.type === 'approval_required' || event.type === 'interrupt_pending') {
    if (payload.interactionKind === 'plan-question') {
      return {
        type: 'plan_question',
        title:
          payload.questionSet &&
          typeof payload.questionSet === 'object' &&
          typeof (payload.questionSet as { title?: unknown }).title === 'string'
            ? (payload.questionSet as { title: string }).title
            : '计划问题',
        summary:
          payload.questionSet &&
          typeof payload.questionSet === 'object' &&
          typeof (payload.questionSet as { summary?: unknown }).summary === 'string'
            ? (payload.questionSet as { summary: string }).summary
            : typeof payload.reason === 'string'
              ? payload.reason
              : undefined,
        status: 'pending',
        interruptId: typeof payload.interruptId === 'string' ? payload.interruptId : undefined,
        questions: Array.isArray(payload.questions)
          ? payload.questions
              .filter(item => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string')
              .map(item => ({
                id: (item as { id: string }).id,
                question:
                  typeof (item as { question?: unknown }).question === 'string'
                    ? (item as { question: string }).question
                    : '',
                questionType:
                  (item as { questionType?: unknown }).questionType === 'direction' ||
                  (item as { questionType?: unknown }).questionType === 'detail' ||
                  (item as { questionType?: unknown }).questionType === 'tradeoff'
                    ? (item as { questionType: 'direction' | 'detail' | 'tradeoff' }).questionType
                    : 'detail',
                options: Array.isArray((item as { options?: unknown[] }).options)
                  ? ((item as { options: unknown[] }).options ?? [])
                      .filter(
                        option =>
                          option &&
                          typeof option === 'object' &&
                          typeof (option as { id?: unknown }).id === 'string' &&
                          typeof (option as { label?: unknown }).label === 'string'
                      )
                      .map(option => ({
                        id: (option as { id: string }).id,
                        label: (option as { label: string }).label,
                        description:
                          typeof (option as { description?: unknown }).description === 'string'
                            ? (option as { description: string }).description
                            : ''
                      }))
                  : [],
                recommendedOptionId:
                  typeof (item as { recommendedOptionId?: unknown }).recommendedOptionId === 'string'
                    ? (item as { recommendedOptionId: string }).recommendedOptionId
                    : undefined,
                allowFreeform:
                  typeof (item as { allowFreeform?: unknown }).allowFreeform === 'boolean'
                    ? (item as { allowFreeform: boolean }).allowFreeform
                    : undefined,
                defaultAssumption:
                  typeof (item as { defaultAssumption?: unknown }).defaultAssumption === 'string'
                    ? (item as { defaultAssumption: string }).defaultAssumption
                    : undefined,
                whyAsked:
                  typeof (item as { whyAsked?: unknown }).whyAsked === 'string'
                    ? (item as { whyAsked: string }).whyAsked
                    : undefined,
                impactOnPlan:
                  typeof (item as { impactOnPlan?: unknown }).impactOnPlan === 'string'
                    ? (item as { impactOnPlan: string }).impactOnPlan
                    : undefined
              }))
          : []
      };
    }
    return {
      type: 'approval_request',
      intent: typeof payload.intent === 'string' ? payload.intent : 'unknown',
      toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      reasonCode: typeof payload.reasonCode === 'string' ? payload.reasonCode : undefined,
      riskLevel: typeof payload.riskLevel === 'string' ? payload.riskLevel : undefined,
      riskCode: typeof payload.riskCode === 'string' ? payload.riskCode : undefined,
      riskReason: typeof payload.riskReason === 'string' ? payload.riskReason : undefined,
      commandPreview: typeof payload.commandPreview === 'string' ? payload.commandPreview : undefined,
      approvalScope:
        payload.approvalScope === 'once' || payload.approvalScope === 'session' || payload.approvalScope === 'always'
          ? payload.approvalScope
          : undefined,
      requestedBy: typeof payload.requestedBy === 'string' ? payload.requestedBy : undefined,
      status: 'pending',
      displayStatus: 'pending',
      isPrimaryActionAvailable: true,
      serverId: typeof payload.serverId === 'string' ? payload.serverId : undefined,
      capabilityId: typeof payload.capabilityId === 'string' ? payload.capabilityId : undefined,
      interruptId: typeof payload.interruptId === 'string' ? payload.interruptId : undefined,
      interruptSource:
        payload.interruptSource === 'graph' || payload.interruptSource === 'tool' ? payload.interruptSource : undefined,
      interruptMode:
        payload.interruptMode === 'blocking' || payload.interruptMode === 'non-blocking'
          ? payload.interruptMode
          : undefined,
      resumeStrategy:
        payload.resumeStrategy === 'command' || payload.resumeStrategy === 'approval-recovery'
          ? payload.resumeStrategy
          : undefined,
      interactionKind:
        payload.interactionKind === 'approval' ||
        payload.interactionKind === 'plan-question' ||
        payload.interactionKind === 'supplemental-input'
          ? payload.interactionKind
          : undefined,
      watchdog: payload.watchdog === true,
      runtimeGovernanceReasonCode:
        typeof payload.runtimeGovernanceReasonCode === 'string' ? payload.runtimeGovernanceReasonCode : undefined,
      recommendedActions: Array.isArray(payload.recommendedActions)
        ? payload.recommendedActions.filter(item => typeof item === 'string')
        : undefined,
      preview: Array.isArray(payload.preview)
        ? payload.preview
            .filter(
              item =>
                item &&
                typeof item === 'object' &&
                typeof (item as { label?: unknown }).label === 'string' &&
                typeof (item as { value?: unknown }).value === 'string'
            )
            .map(item => ({
              label: (item as { label: string }).label,
              value: (item as { value: string }).value
            }))
        : undefined
    };
  }

  if (event.type === 'run_cancelled') {
    return {
      type: 'control_notice',
      tone: 'warning',
      label: '本轮已终止'
    };
  }

  if (event.type === 'run_resumed') {
    const currentSkillExecution =
      payload.currentSkillExecution &&
      typeof payload.currentSkillExecution === 'object' &&
      typeof (payload.currentSkillExecution as { title?: unknown }).title === 'string'
        ? (payload.currentSkillExecution as { title: string })
        : undefined;
    return {
      type: 'control_notice',
      tone: 'success',
      label: currentSkillExecution ? `已恢复到 ${currentSkillExecution.title}` : '已恢复执行'
    };
  }

  if (event.type === 'approval_resolved' || event.type === 'interrupt_resumed') {
    return {
      type: 'control_notice',
      tone: 'success',
      label: '已允许继续'
    };
  }

  if (event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback') {
    return {
      type: 'control_notice',
      tone: 'warning',
      label: '已拒绝并附说明'
    };
  }

  return undefined;
}

function updateApprovalCard(current: ChatMessageRecord[], event: ChatEventRecord) {
  const intent = typeof event.payload?.intent === 'string' ? event.payload.intent : '';
  const taskId = typeof event.payload?.taskId === 'string' ? event.payload.taskId : '';
  const feedback = typeof event.payload?.feedback === 'string' ? event.payload.feedback : undefined;
  const nextDisplayStatus: 'allowed' | 'rejected' | 'rejected_with_feedback' =
    event.type === 'approval_resolved' || event.type === 'interrupt_resumed'
      ? 'allowed'
      : event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback'
        ? 'rejected_with_feedback'
        : 'rejected';
  const nextStatus: 'approved' | 'rejected' =
    event.type === 'approval_resolved' || event.type === 'interrupt_resumed' ? 'approved' : 'rejected';

  let updated = false;
  return current.map(message => {
    if (updated || message.card?.type !== 'approval_request' || message.card.status !== 'pending') {
      return message;
    }

    if (message.card.intent !== intent) {
      return message;
    }

    if (taskId && message.taskId && message.taskId !== taskId) {
      return message;
    }

    updated = true;
    return {
      ...message,
      card: {
        ...message.card,
        status: nextStatus,
        displayStatus: nextDisplayStatus,
        isPrimaryActionAvailable: false,
        reason: feedback ?? message.card.reason
      }
    };
  });
}

function updatePlanQuestionCard(current: ChatMessageRecord[], event: ChatEventRecord) {
  const interruptId = typeof event.payload?.interruptId === 'string' ? event.payload.interruptId : '';
  const nextStatus: 'answered' | 'bypassed' | 'aborted' =
    event.type === 'run_cancelled'
      ? 'aborted'
      : event.payload?.decision === 'approved' &&
          event.payload?.interactionKind === 'plan-question' &&
          event.payload?.intent === 'plan_question'
        ? 'bypassed'
        : 'answered';

  let updated = false;
  return current.map(message => {
    if (updated || message.card?.type !== 'plan_question' || message.card.status !== 'pending') {
      return message;
    }

    if (interruptId && message.card.interruptId && message.card.interruptId !== interruptId) {
      return message;
    }

    updated = true;
    return {
      ...message,
      card: {
        ...message.card,
        status: nextStatus
      }
    };
  });
}

export function buildVisibleEventMessage(event: ChatEventRecord) {
  const payload = event.payload ?? {};

  switch (event.type) {
    case 'conversation_compacted': {
      return '正在自动压缩背景信息';
    }
    case 'node_status':
    case 'node_progress':
      return buildNodeStatusCopy(payload);
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
      if (typeof payload.node === 'string' && payload.node === 'planning_readonly_guard') {
        return '计划只读保护已启用，当前已跳过 open-web、浏览器与终端研究路径。';
      }
      return typeof payload.summary === 'string' && payload.summary ? payload.summary : '收到新的阶段战报。';
    case 'subtask_dispatched':
      return typeof payload.content === 'string' && payload.content ? payload.content : '子任务已分派。';
    case 'approval_required':
    case 'interrupt_pending':
      if (payload.interactionKind === 'plan-question') {
        return buildPlanQuestionCopy(payload);
      }
      return buildApprovalRequiredCopy(payload);
    case 'approval_resolved':
    case 'interrupt_resumed':
      return '已允许继续';
    case 'approval_rejected_with_feedback':
    case 'interrupt_rejected_with_feedback':
      return typeof payload.feedback === 'string' && payload.feedback
        ? `已拒绝并附说明：${payload.feedback}`
        : '已拒绝当前处理';
    case 'run_resumed':
      if (
        payload.currentSkillExecution &&
        typeof payload.currentSkillExecution === 'object' &&
        typeof (payload.currentSkillExecution as { displayName?: unknown }).displayName === 'string' &&
        typeof (payload.currentSkillExecution as { title?: unknown }).title === 'string'
      ) {
        const currentSkillExecution = payload.currentSkillExecution as {
          displayName: string;
          title: string;
          stepIndex?: number;
          totalSteps?: number;
        };
        const stepProgress =
          typeof currentSkillExecution.stepIndex === 'number' && typeof currentSkillExecution.totalSteps === 'number'
            ? `（${currentSkillExecution.stepIndex}/${currentSkillExecution.totalSteps}）`
            : '';
        return `已恢复执行，继续 ${currentSkillExecution.displayName} 的 ${currentSkillExecution.title}${stepProgress}`;
      }
      return '已恢复执行';
    case 'run_cancelled':
      return typeof payload.reason === 'string' && payload.reason ? `本轮已终止：${payload.reason}` : '本轮已终止';
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
    if (event.type === 'approval_required' || event.type === 'interrupt_pending') {
      nextStatus = event.payload?.interactionKind === 'plan-question' ? 'waiting_interrupt' : 'waiting_approval';
    } else if (event.type === 'approval_resolved' || event.type === 'interrupt_resumed') {
      nextStatus = 'running';
    } else if (event.type === 'run_resumed') {
      nextStatus = 'running';
    } else if (event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback') {
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
      event.type === 'assistant_token' ||
      event.type === 'final_response_delta'
    ) {
      nextStatus = 'running';
    }

    const taskId = typeof event.payload?.taskId === 'string' ? (event.payload.taskId as string) : session.currentTaskId;
    const nextCompression: ChatSessionRecord['compression'] =
      event.type === 'conversation_compacted'
        ? {
            summary:
              typeof event.payload?.summary === 'string' ? event.payload.summary : (session.compression?.summary ?? ''),
            periodOrTopic:
              typeof event.payload?.periodOrTopic === 'string'
                ? event.payload.periodOrTopic
                : session.compression?.periodOrTopic,
            focuses: sanitizeStringArray(event.payload?.focuses, 5) ?? session.compression?.focuses,
            keyDeliverables:
              sanitizeStringArray(event.payload?.keyDeliverables, 5) ?? session.compression?.keyDeliverables,
            risks: sanitizeStringArray(event.payload?.risks, 4) ?? session.compression?.risks,
            nextActions: sanitizeStringArray(event.payload?.nextActions, 4) ?? session.compression?.nextActions,
            supportingFacts:
              sanitizeStringArray(event.payload?.supportingFacts, 4) ?? session.compression?.supportingFacts,
            decisionSummary:
              typeof event.payload?.decisionSummary === 'string'
                ? event.payload.decisionSummary
                : session.compression?.decisionSummary,
            confirmedPreferences:
              sanitizeStringArray(event.payload?.confirmedPreferences, 4) ?? session.compression?.confirmedPreferences,
            openLoops: sanitizeStringArray(event.payload?.openLoops, 4) ?? session.compression?.openLoops,
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
            previewMessages: Array.isArray(event.payload?.previewMessages)
              ? event.payload.previewMessages
                  .filter(
                    item =>
                      item &&
                      typeof item === 'object' &&
                      ((item as { role?: unknown }).role === 'user' ||
                        (item as { role?: unknown }).role === 'assistant' ||
                        (item as { role?: unknown }).role === 'system') &&
                      typeof (item as { content?: unknown }).content === 'string'
                  )
                  .map(item => ({
                    role: (item as { role: 'user' | 'assistant' | 'system' }).role,
                    content: (item as { content: string }).content
                  }))
              : (session.compression?.previewMessages ?? []),
            trigger: event.payload?.trigger === 'character_count' ? 'character_count' : 'message_count',
            source: event.payload?.source === 'llm' ? 'llm' : 'heuristic',
            updatedAt: event.at
          }
        : session.compression;
    const nextTitle =
      typeof event.payload?.title === 'string' && event.payload.title.trim() ? event.payload.title : session.title;

    return {
      ...session,
      title: nextTitle,
      currentTaskId: taskId,
      status: nextStatus,
      updatedAt: event.at,
      compression: nextCompression
    };
  });
}

export function syncMessageFromEvent(current: ChatMessageRecord[], event: ChatEventRecord) {
  const payload = event.payload ?? {};
  if (
    event.type !== 'assistant_message' &&
    event.type !== 'user_message' &&
    event.type !== 'assistant_token' &&
    event.type !== 'final_response_delta'
  ) {
    return current;
  }

  const messageId = typeof payload.messageId === 'string' ? payload.messageId : '';
  const content = typeof payload.content === 'string' ? payload.content : '';

  if (!messageId) {
    return current;
  }
  if (event.type !== 'assistant_token' && event.type !== 'final_response_delta' && !content) {
    return current;
  }

  const payloadRole =
    payload.role === 'user' || payload.role === 'assistant' || payload.role === 'system' ? payload.role : undefined;
  const role: ChatMessageRecord['role'] = event.type === 'user_message' ? 'user' : (payloadRole ?? 'assistant');
  const linkedAgent = typeof payload.from === 'string' ? payload.from : undefined;
  const taskId = typeof payload.taskId === 'string' ? payload.taskId : undefined;
  const card =
    payload.card && typeof payload.card === 'object' && !Array.isArray(payload.card)
      ? (payload.card as ChatMessageRecord['card'])
      : undefined;

  if (
    (event.type === 'assistant_token' || event.type === 'final_response_delta') &&
    isTransientAssistantMessageId(messageId) &&
    hasCommittedAssistantEquivalent(current, {
      id: messageId,
      role,
      content,
      taskId
    })
  ) {
    return current;
  }

  return mergeOrAppendMessage(
    current,
    {
      id: messageId,
      sessionId: event.sessionId,
      role,
      content,
      taskId,
      linkedAgent,
      card,
      createdAt: event.at
    },
    event.type === 'assistant_token' || event.type === 'final_response_delta'
  );
}

function isTransientAssistantMessageId(messageId: string) {
  return TRANSIENT_ASSISTANT_MESSAGE_PREFIXES.some(prefix => messageId.startsWith(prefix));
}

function resolveAssistantTaskIdentity(message: Pick<ChatMessageRecord, 'id' | 'taskId'>) {
  if (message.taskId) {
    return message.taskId;
  }

  for (const prefix of TRANSIENT_ASSISTANT_MESSAGE_PREFIXES) {
    if (message.id.startsWith(prefix)) {
      return message.id.slice(prefix.length);
    }
  }

  return message.id;
}

function hasCommittedAssistantEquivalent(
  current: ChatMessageRecord[],
  nextMessage: Pick<ChatMessageRecord, 'id' | 'role' | 'content' | 'taskId'>
) {
  const nextContent = nextMessage.content.trim();
  if (nextMessage.role !== 'assistant' || !nextContent) {
    return false;
  }

  const nextTaskIdentity = resolveAssistantTaskIdentity(nextMessage);
  return current.some(message => {
    if (message.role !== 'assistant' || isTransientAssistantMessageId(message.id)) {
      return false;
    }

    if (resolveAssistantTaskIdentity(message) !== nextTaskIdentity) {
      return false;
    }

    const existingContent = message.content.trim();
    return (
      existingContent === nextContent ||
      existingContent.startsWith(nextContent) ||
      nextContent.startsWith(existingContent)
    );
  });
}

export function attachEventTaskIdsToMessages(messages: ChatMessageRecord[], events: ChatEventRecord[]) {
  if (messages.length === 0 || events.length === 0) {
    return messages;
  }

  const taskIdByMessageId = new Map<string, string>();
  for (const event of events) {
    const messageId = typeof event.payload?.messageId === 'string' ? event.payload.messageId : '';
    const taskId = typeof event.payload?.taskId === 'string' ? event.payload.taskId : '';
    if (messageId && taskId) {
      taskIdByMessageId.set(messageId, taskId);
    }
  }

  if (taskIdByMessageId.size === 0) {
    return messages;
  }

  return messages.map(message => ({
    ...message,
    taskId: message.taskId ?? taskIdByMessageId.get(message.id)
  }));
}

export function syncProcessMessageFromEvent(current: ChatMessageRecord[], event: ChatEventRecord) {
  if (event.type === 'conversation_compacted') {
    return current.filter(message => message.card?.type !== 'compression_summary');
  }

  if (event.type === 'node_status' || event.type === 'node_progress') {
    const content = buildVisibleEventMessage(event);
    if (!content) {
      return current;
    }
    const messageId = `event_stream_status_${event.sessionId}`;
    return mergeOrAppendMessage(current, {
      id: messageId,
      sessionId: event.sessionId,
      role: 'system',
      content,
      createdAt: event.at
    });
  }

  if (event.type === 'run_cancelled' && event.payload?.interactionKind === 'plan-question') {
    current = updatePlanQuestionCard(current, event);
  }

  if (event.type === 'approval_resolved' || event.type === 'interrupt_resumed') {
    current =
      event.payload?.interactionKind === 'plan-question'
        ? updatePlanQuestionCard(current, event)
        : updateApprovalCard(current, event);
  }

  if (event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback') {
    current = updateApprovalCard(current, event);
  }

  if (!MESSAGE_VISIBLE_EVENT_TYPES.has(event.type)) {
    return current;
  }

  const content = buildVisibleEventMessage(event);
  if (!content) {
    return current;
  }

  if (event.type === 'conversation_compacted') {
    const nextCompressionMessage: ChatMessageRecord = {
      id: `event_${event.id}`,
      sessionId: event.sessionId,
      role: 'system',
      content,
      card: buildEventCard(event),
      createdAt: event.at
    };

    return [...current.filter(message => message.card?.type !== 'compression_summary'), nextCompressionMessage];
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

function buildApprovalRequiredCopy(payload: Record<string, unknown>) {
  const intent = typeof payload.intent === 'string' ? payload.intent : 'unknown';
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  const requestedBy = typeof payload.requestedBy === 'string' ? payload.requestedBy : '';
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const interruptMode =
    payload.interruptMode === 'blocking' || payload.interruptMode === 'non-blocking'
      ? payload.interruptMode
      : undefined;
  const interruptSource =
    payload.interruptSource === 'graph' || payload.interruptSource === 'tool' ? payload.interruptSource : undefined;
  const intentLabel = getIntentLabel(intent);
  const toolSuffix = toolName ? `，工具为 ${toolName}` : '';
  const actorSuffix = requestedBy ? `，由 ${requestedBy} 发起` : '';
  const sourceSuffix =
    interruptSource === 'graph' ? '，由图内中断触发' : interruptSource === 'tool' ? '，由工具内中断触发' : '';
  const prefix = interruptMode === 'non-blocking' ? '中断建议' : '阻塞式中断确认';
  const commandPreview = typeof payload.commandPreview === 'string' ? payload.commandPreview : '';
  const riskReason = typeof payload.riskReason === 'string' ? payload.riskReason : '';
  const approvalScope = typeof payload.approvalScope === 'string' ? payload.approvalScope : '';
  const commandSuffix = commandPreview ? ` 命令预览：${commandPreview}。` : '';
  const riskSuffix = riskReason ? ` 风险说明：${riskReason}` : '';
  const scopeSuffix = approvalScope ? ` 审批范围：${approvalScope === 'once' ? '仅本次' : approvalScope}` : '';

  if (reason) {
    return `${prefix}：准备执行${intentLabel}${toolSuffix}${actorSuffix}${sourceSuffix}。${reason}${commandSuffix}${riskSuffix}${scopeSuffix}`;
  }

  return `${prefix}：准备执行${intentLabel}${toolSuffix}${actorSuffix}${sourceSuffix}。该动作具有风险，需要你明确拍板后才能继续。${commandSuffix}${riskSuffix}${scopeSuffix}`;
}

function buildPlanQuestionCopy(payload: Record<string, unknown>) {
  const summary =
    payload.questionSet &&
    typeof payload.questionSet === 'object' &&
    typeof (payload.questionSet as { summary?: unknown }).summary === 'string'
      ? (payload.questionSet as { summary: string }).summary
      : typeof payload.reason === 'string'
        ? payload.reason
        : '存在高影响未知项，需要你先帮助我收敛方案。';
  const count = Array.isArray(payload.questions) ? payload.questions.length : 0;
  return count > 0 ? `等待方案澄清：当前有 ${count} 个计划问题需要你拍板。${summary}` : `等待方案澄清：${summary}`;
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

function sanitizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sanitized = value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return sanitized.length ? sanitized : undefined;
}

function buildNodeStatusCopy(payload: Record<string, unknown>) {
  const nodeLabel = typeof payload.nodeLabel === 'string' ? payload.nodeLabel : '当前节点';
  const detail = typeof payload.detail === 'string' ? payload.detail : '';
  const ministry = typeof payload.ministry === 'string' ? payload.ministry : '';
  const phase = payload.phase === 'end' ? 'end' : payload.phase === 'progress' ? 'progress' : 'start';
  const progressPercent = typeof payload.progressPercent === 'number' ? payload.progressPercent : undefined;
  const ministryPrefix = ministry ? `${ministry} · ` : '';
  if (phase === 'start') {
    return `${ministryPrefix}${nodeLabel} 已开始${detail ? `：${detail}` : '。'}`;
  }
  if (phase === 'progress') {
    return `${ministryPrefix}${nodeLabel} 进行中${detail ? `：${detail}` : ''}${
      typeof progressPercent === 'number' ? `（${progressPercent}%）` : ''
    }`;
  }
  return `${ministryPrefix}${nodeLabel} 已完成${detail ? `：${detail}` : '。'}`;
}
