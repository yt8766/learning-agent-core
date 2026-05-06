import type { KnowledgeFrontendApi } from '@/api/knowledge-api-provider';
import type { ChatMessage, CreateFeedbackRequest } from '@/types/api';

import { toKnowledgeConversationData } from './knowledge-conversations';

export function createKnowledgeChatActions({ api }: { api: KnowledgeFrontendApi }) {
  return {
    async listConversations() {
      const result = await api.listConversations();
      return result.items.map(toKnowledgeConversationData);
    },

    async listMessages(conversationId: string): Promise<ChatMessage[]> {
      const result = await api.listConversationMessages(conversationId);
      return result.items;
    },

    createFeedback(messageId: string, input: CreateFeedbackRequest) {
      return api.createFeedback(messageId, input);
    }
  };
}
