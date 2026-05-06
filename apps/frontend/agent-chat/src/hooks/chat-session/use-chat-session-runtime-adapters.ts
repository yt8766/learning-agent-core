import { useEffect, useState } from 'react';
import { type MessageInfo } from '@ant-design/x-sdk';

import type { AgentToolGovernanceProjection } from '@/utils/agent-tool-execution-api';
import { getAgentToolGovernanceProjection } from '@/utils/agent-tool-execution-api';
import type { ChatMessageRecord, ChatSessionRecord } from '@/types/chat';
import { parseAgentChatConversationKey, type AgentChatConversationData } from '@/chat-runtime/agent-chat-conversations';

export function useAgentToolGovernanceProjection(activeSessionId: string, activeTaskId?: string) {
  const [projection, setProjection] = useState<AgentToolGovernanceProjection | undefined>(undefined);

  useEffect(() => {
    if (!activeSessionId) {
      setProjection(undefined);
      return;
    }

    let disposed = false;

    void getAgentToolGovernanceProjection(globalThis.fetch, {
      taskId: activeTaskId,
      sessionId: activeSessionId
    })
      .then(nextProjection => {
        if (!disposed) {
          setProjection(nextProjection);
        }
      })
      .catch(() => {
        if (!disposed) {
          setProjection(undefined);
        }
      });

    return () => {
      disposed = true;
    };
  }, [activeSessionId, activeTaskId]);

  return projection;
}

export function toChatSessionRecord(conversation: AgentChatConversationData): ChatSessionRecord {
  const sessionId = parseAgentChatConversationKey(conversation.key) ?? conversation.key;
  return {
    id: sessionId,
    title: conversation.label,
    currentTaskId: conversation.currentTaskId,
    status: conversation.status,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export function toXChatMessageInfos(
  nextMessages: ChatMessageRecord[],
  currentInfos: MessageInfo<ChatMessageRecord>[]
): MessageInfo<ChatMessageRecord>[] {
  const infoByMessageId = new Map(currentInfos.map(info => [info.message.id, info]));
  return nextMessages.map(message => {
    const existing = infoByMessageId.get(message.id);
    return existing ? { ...existing, message } : { id: message.id, message, status: 'success' as const };
  });
}

export function upsertSession(current: ChatSessionRecord[], nextSession: ChatSessionRecord) {
  return [nextSession, ...current.filter(session => session.id !== nextSession.id)];
}

export function createAssistantMessageRecord(sessionId: string, messageId: string, content: string): ChatMessageRecord {
  return {
    id: messageId,
    sessionId,
    role: 'assistant',
    content,
    createdAt: new Date().toISOString()
  };
}
