import {
  appendMessage,
  createSession,
  createSessionStream,
  getCheckpoint,
  listEvents,
  listMessages,
  listSessions,
  selectSession
} from '@/api/chat-api';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

import { parseAgentChatConversationKey, toAgentChatConversationData } from './agent-chat-conversations';

export interface AgentChatActionsApi {
  appendMessage: (sessionId: string, message: string, options?: { modelId?: string }) => Promise<ChatMessageRecord>;
  createSession: (message?: string, title?: string) => Promise<ChatSessionRecord>;
  createSessionStream: (sessionId: string) => EventSource;
  getCheckpoint: (sessionId: string) => Promise<ChatCheckpointRecord | undefined>;
  listEvents: (sessionId: string) => Promise<ChatEventRecord[]>;
  listMessages: (sessionId: string) => Promise<ChatMessageRecord[]>;
  listSessions: () => Promise<ChatSessionRecord[]>;
  selectSession: (sessionId: string) => Promise<ChatSessionRecord>;
}

const defaultAgentChatActionsApi: AgentChatActionsApi = {
  appendMessage,
  createSession,
  createSessionStream,
  getCheckpoint,
  listEvents,
  listMessages,
  listSessions,
  selectSession
};

export function createAgentChatActions({
  api = defaultAgentChatActionsApi
}: {
  api?: AgentChatActionsApi;
} = {}) {
  return {
    async listConversations() {
      const sessions = await api.listSessions();
      return sessions.map(toAgentChatConversationData);
    },

    async ensureSession(conversationKey?: string, initialUserText?: string) {
      const sessionId = parseAgentChatConversationKey(conversationKey);
      if (sessionId) {
        return api.selectSession(sessionId);
      }

      return api.createSession(initialUserText);
    },

    listMessages(sessionId: string) {
      return api.listMessages(sessionId);
    },

    listEvents(sessionId: string) {
      return api.listEvents(sessionId);
    },

    getCheckpoint(sessionId: string) {
      return api.getCheckpoint(sessionId);
    },

    appendMessage(sessionId: string, message: string, options?: { modelId?: string }) {
      return api.appendMessage(sessionId, message, options);
    },

    createSessionStream(sessionId: string) {
      return api.createSessionStream(sessionId);
    }
  };
}
