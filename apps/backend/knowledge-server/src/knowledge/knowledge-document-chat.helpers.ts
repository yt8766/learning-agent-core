import type { KnowledgeChatRequest } from './domain/knowledge-document.types';
import { KnowledgeServiceError } from './knowledge.errors';

export interface NormalizedKnowledgeChatRequest {
  conversationId?: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  mentions?: KnowledgeChatRequest['metadata']['mentions'];
  message: string;
}

export function normalizeChatRequest(input: KnowledgeChatRequest): NormalizedKnowledgeChatRequest {
  const message = input.message?.trim() || latestUserMessage(input.messages);
  if (!message) {
    throw new KnowledgeServiceError('knowledge_chat_message_required', '消息不能为空');
  }
  return {
    conversationId: input.metadata?.conversationId ?? input.conversationId,
    knowledgeBaseId: input.metadata?.knowledgeBaseId ?? input.knowledgeBaseId,
    knowledgeBaseIds: normalizeKnowledgeBaseIds(input.metadata?.knowledgeBaseIds ?? input.knowledgeBaseIds),
    mentions: input.metadata?.mentions,
    message
  };
}

function latestUserMessage(messages: KnowledgeChatRequest['messages']): string | undefined {
  const message = [...(messages ?? [])].reverse().find(item => item.role === 'user');
  if (!message) {
    return undefined;
  }
  if (typeof message.content === 'string') {
    return message.content.trim();
  }
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim();
}

function normalizeKnowledgeBaseIds(value: string[] | string | undefined): string[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  return value
    ?.split(',')
    .map(item => item.trim())
    .filter(isPresent);
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}
