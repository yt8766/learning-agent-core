import type { ChatEventRecord, ChatMessageRecord, ChatSessionRecord, ChatSessionStatus } from '@/types/chat';

import {
  buildEventCard,
  parsePreviewMessages,
  sanitizeStringArray,
  updateApprovalCard,
  updatePlanQuestionCard
} from './chat-session-event-card-helpers';
import {
  buildApprovalRequiredCopy,
  buildExecutionStepEventCopy,
  buildNodeStatusCopy,
  buildPlanQuestionCopy,
  buildTaskTrajectoryEventCopy,
  buildToolStreamEventCopy,
  buildTrajectoryStepEventCopy
} from './chat-session-event-message-helpers';
import {
  attachEventTaskIdsToMessages as attachEventTaskIdsToMessagesInternal,
  syncMessageFromEvent as syncMessageFromEventInternal,
  syncProcessMessageFromEvent as syncProcessMessageFromEventInternal
} from './chat-session-message-sync-helpers';
import { PENDING_ASSISTANT_PREFIX, PENDING_USER_PREFIX } from './chat-session-formatters';

export { buildEventCard } from './chat-session-event-card-helpers';

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
              createdAt: nextMessage.createdAt,
              cognitionSnapshot: nextMessage.cognitionSnapshot ?? message.cognitionSnapshot
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
            createdAt: nextMessage.createdAt,
            cognitionSnapshot: nextMessage.cognitionSnapshot ?? message.cognitionSnapshot
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
          card: nextMessage.card ?? message.card,
          cognitionSnapshot: nextMessage.cognitionSnapshot ?? message.cognitionSnapshot
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

export function buildVisibleEventMessage(event: ChatEventRecord) {
  const payload = event.payload ?? {};

  switch (event.type) {
    case 'conversation_compacted': {
      return '正在自动压缩背景信息';
    }
    case 'node_progress':
      if (payload.projection === 'task_trajectory') {
        return buildTaskTrajectoryEventCopy(payload);
      }
      return buildNodeStatusCopy(payload);
    case 'node_status':
      return buildNodeStatusCopy(payload);
    case 'execution_step_started':
    case 'execution_step_completed':
    case 'execution_step_blocked':
    case 'execution_step_resumed':
      return buildExecutionStepEventCopy(event.type, payload);
    case 'tool_selected':
    case 'tool_stream_detected':
    case 'tool_stream_dispatched':
    case 'tool_stream_completed':
      return buildToolStreamEventCopy(event.type, payload);
    case 'trajectory_step':
      return buildTrajectoryStepEventCopy(payload);
    case 'task_trajectory':
      return buildTaskTrajectoryEventCopy(payload);
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
            previewMessages:
              parsePreviewMessages(event.payload?.previewMessages) ?? session.compression?.previewMessages ?? [],
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
  return syncMessageFromEventInternal(current, event, mergeOrAppendMessage);
}

export function attachEventTaskIdsToMessages(messages: ChatMessageRecord[], events: ChatEventRecord[]) {
  return attachEventTaskIdsToMessagesInternal(messages, events);
}

export function syncProcessMessageFromEvent(current: ChatMessageRecord[], event: ChatEventRecord) {
  return syncProcessMessageFromEventInternal(current, event, {
    buildVisibleEventMessage,
    buildEventCard,
    mergeMessage,
    mergeOrAppendMessage,
    updateApprovalCard,
    updatePlanQuestionCard
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
