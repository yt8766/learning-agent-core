import type { ChatEventRecord, ChatMessageRecord } from '@/types/chat';

import { MESSAGE_VISIBLE_EVENT_TYPES } from './chat-session-formatters';

const TRANSIENT_ASSISTANT_MESSAGE_PREFIXES = ['progress_stream_', 'direct_reply_', 'summary_stream_'] as const;

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

export function syncMessageFromEvent(
  current: ChatMessageRecord[],
  event: ChatEventRecord,
  mergeOrAppendMessage: (
    currentMessages: ChatMessageRecord[],
    nextMessage: ChatMessageRecord,
    appendContent?: boolean
  ) => ChatMessageRecord[]
) {
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

export function syncProcessMessageFromEvent(
  current: ChatMessageRecord[],
  event: ChatEventRecord,
  deps: {
    buildVisibleEventMessage: (eventItem: ChatEventRecord) => string;
    buildEventCard: (eventItem: ChatEventRecord) => ChatMessageRecord['card'] | undefined;
    mergeMessage: (currentMessages: ChatMessageRecord[], nextMessage: ChatMessageRecord) => ChatMessageRecord[];
    mergeOrAppendMessage: (
      currentMessages: ChatMessageRecord[],
      nextMessage: ChatMessageRecord,
      appendContent?: boolean
    ) => ChatMessageRecord[];
    updateApprovalCard: (currentMessages: ChatMessageRecord[], eventItem: ChatEventRecord) => ChatMessageRecord[];
    updatePlanQuestionCard: (currentMessages: ChatMessageRecord[], eventItem: ChatEventRecord) => ChatMessageRecord[];
  }
) {
  if (event.type === 'conversation_compacted') {
    return current.filter(message => message.card?.type !== 'compression_summary');
  }

  if (event.type === 'node_status' || event.type === 'node_progress') {
    const content = deps.buildVisibleEventMessage(event);
    if (!content) {
      return current;
    }
    const messageId = `event_stream_status_${event.sessionId}`;
    return deps.mergeOrAppendMessage(current, {
      id: messageId,
      sessionId: event.sessionId,
      role: 'system',
      content,
      createdAt: event.at
    });
  }

  if (event.type === 'run_cancelled' && event.payload?.interactionKind === 'plan-question') {
    current = deps.updatePlanQuestionCard(current, event);
  }

  if (event.type === 'approval_resolved' || event.type === 'interrupt_resumed') {
    current =
      event.payload?.interactionKind === 'plan-question'
        ? deps.updatePlanQuestionCard(current, event)
        : deps.updateApprovalCard(current, event);
  }

  if (event.type === 'approval_rejected_with_feedback' || event.type === 'interrupt_rejected_with_feedback') {
    current = deps.updateApprovalCard(current, event);
  }

  if (!MESSAGE_VISIBLE_EVENT_TYPES.has(event.type)) {
    return current;
  }

  const content = deps.buildVisibleEventMessage(event);
  if (!content) {
    return current;
  }

  return deps.mergeMessage(current, {
    id: `event_${event.id}`,
    sessionId: event.sessionId,
    role: 'system',
    content,
    card: deps.buildEventCard(event),
    createdAt: event.at
  });
}
