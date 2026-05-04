import type { ConversationData } from '@ant-design/x-sdk';

import type { ChatConversation } from '@/types/api';

export function toKnowledgeConversationData(conversation: ChatConversation): ConversationData {
  return {
    key: conversation.id,
    label: conversation.title,
    group: conversation.activeModelProfileId ?? 'knowledge-rag'
  };
}
