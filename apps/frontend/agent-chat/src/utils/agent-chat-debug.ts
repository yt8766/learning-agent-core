import type { ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

const AGENT_CHAT_DEBUG_FLAG = 'agent-chat-debug';

type DebuggablePayload = Record<string, unknown> | Array<unknown> | string | number | boolean | null | undefined;

function readWindowDebugFlag() {
  const win = globalThis as typeof globalThis & {
    __AGENT_CHAT_DEBUG__?: boolean;
  };
  return win.__AGENT_CHAT_DEBUG__ === true;
}

function readStorageDebugFlag() {
  if (typeof globalThis.localStorage === 'undefined') {
    return false;
  }

  const value = globalThis.localStorage.getItem(AGENT_CHAT_DEBUG_FLAG);
  return value === '1' || value === 'true';
}

export function isAgentChatDebugEnabled() {
  return readWindowDebugFlag() || readStorageDebugFlag();
}

export function debugAgentChat(label: string, payload?: DebuggablePayload) {
  if (!isAgentChatDebugEnabled()) {
    return;
  }

  if (payload === undefined) {
    console.log(`[agent-chat-debug] ${label}`);
    return;
  }

  console.log(`[agent-chat-debug] ${label}`, payload);
}

export function summarizeDebugMessage(message: ChatMessageRecord) {
  const content = typeof message.content === 'string' ? message.content : '';

  return {
    id: message.id,
    role: message.role,
    taskId: message.taskId,
    cardType: message.card?.type,
    contentPreview: content.slice(0, 120),
    createdAt: message.createdAt
  };
}

export function summarizeDebugMessages(messages: ChatMessageRecord[]) {
  return messages.map(summarizeDebugMessage);
}

export function summarizeDebugEvent(event: ChatEventRecord) {
  return {
    id: event.id,
    type: event.type,
    sessionId: event.sessionId,
    at: event.at,
    messageId: typeof event.payload?.messageId === 'string' ? event.payload.messageId : undefined,
    taskId: typeof event.payload?.taskId === 'string' ? event.payload.taskId : undefined,
    contentPreview: typeof event.payload?.content === 'string' ? event.payload.content.slice(0, 120) : undefined
  };
}

export function summarizeDebugSessions(sessions: ChatSessionRecord[]) {
  return sessions.map(session => ({
    id: session.id,
    title: session.title,
    status: session.status,
    currentTaskId: session.currentTaskId,
    updatedAt: session.updatedAt
  }));
}
