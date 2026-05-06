import type { ConversationData } from '@ant-design/x-sdk';

import type { ChatSessionRecord } from '@/types/chat';

const AGENT_CHAT_CONVERSATION_KEY_PREFIX = 'session:';

export interface AgentChatConversationData extends ConversationData {
  createdAt: string;
  currentTaskId?: string;
  label: string;
  status: ChatSessionRecord['status'];
  updatedAt: string;
}

export function buildAgentChatConversationKey(sessionId: string) {
  return `${AGENT_CHAT_CONVERSATION_KEY_PREFIX}${sessionId}`;
}

export function parseAgentChatConversationKey(key?: string | null) {
  const normalizedKey = key?.trim();
  if (!normalizedKey || !normalizedKey.startsWith(AGENT_CHAT_CONVERSATION_KEY_PREFIX)) {
    return undefined;
  }
  return normalizedKey.slice(AGENT_CHAT_CONVERSATION_KEY_PREFIX.length);
}

export function toAgentChatConversationData(session: ChatSessionRecord): AgentChatConversationData {
  return {
    key: buildAgentChatConversationKey(session.id),
    label: session.title,
    status: session.status,
    createdAt: session.createdAt,
    currentTaskId: session.currentTaskId,
    updatedAt: session.updatedAt
  };
}
