import type { ConversationData } from '@ant-design/x-sdk';

import type { ChatSessionRecord } from '@/types/chat';

const AGENT_CHAT_CONVERSATION_KEY_PREFIX = 'session:';

export interface AgentChatConversationData extends ConversationData {
  createdAt: string;
  label: string;
  status: ChatSessionRecord['status'];
  updatedAt: string;
}

export function buildAgentChatConversationKey(sessionId: string) {
  return `${AGENT_CHAT_CONVERSATION_KEY_PREFIX}${sessionId}`;
}

export function parseAgentChatConversationKey(key?: string | null) {
  const normalizedKey = key?.trim();
  if (!normalizedKey) {
    return undefined;
  }

  return normalizedKey.startsWith(AGENT_CHAT_CONVERSATION_KEY_PREFIX)
    ? normalizedKey.slice(AGENT_CHAT_CONVERSATION_KEY_PREFIX.length)
    : normalizedKey;
}

export function toAgentChatConversationData(session: ChatSessionRecord): AgentChatConversationData {
  return {
    key: buildAgentChatConversationKey(session.id),
    label: session.title,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}
