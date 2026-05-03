import type { ChatMessage, KnowledgeBase } from '../../types/api';

export interface KnowledgeBaseMention {
  type: 'knowledge_base';
  id?: string;
  label: string;
}

export interface ChatLabConversation {
  id: string;
  title: string;
  activeModelProfileId?: string;
  persisted?: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export function parseKnowledgeMentions(
  message: string,
  knowledgeBases: readonly Pick<KnowledgeBase, 'id' | 'name'>[]
): KnowledgeBaseMention[] {
  const mentions = new Map<string, KnowledgeBaseMention>();
  for (const base of knowledgeBases) {
    if (message.includes(`@${base.name}`)) {
      mentions.set(base.id, { type: 'knowledge_base', id: base.id, label: base.name });
    }
  }
  return [...mentions.values()];
}

export function stripKnowledgeMentions(
  message: string,
  knowledgeBases: readonly Pick<KnowledgeBase, 'name'>[]
): string {
  return knowledgeBases
    .reduce((nextMessage, base) => nextMessage.replaceAll(`@${base.name}`, ''), message)
    .replace(/\s+/g, ' ')
    .trim();
}

export function replaceCurrentKnowledgeMentionToken(message: string, knowledgeBaseName: string): string {
  const mention = `@${knowledgeBaseName}`;
  const matchedToken = /(^|\s)@[\S]*$/.exec(message);
  if (!matchedToken) {
    return `${message}${message.endsWith(' ') || message.length === 0 ? '' : ' '}${mention} `;
  }
  const tokenStart = matchedToken.index + matchedToken[1].length;
  return `${message.slice(0, tokenStart)}${mention} `;
}

export function removeCurrentKnowledgeMentionToken(message: string): string {
  const matchedToken = /(^|\s)@[\S]*$/.exec(message);
  if (!matchedToken) {
    return message;
  }
  const tokenStart = matchedToken.index + matchedToken[1].length;
  return message.slice(0, tokenStart).trimEnd();
}

export function uniqueKnowledgeMentions(mentions: readonly KnowledgeBaseMention[]): KnowledgeBaseMention[] {
  const uniqueMentions = new Map<string, KnowledgeBaseMention>();
  for (const mention of mentions) {
    const key = mention.id ?? mention.label;
    uniqueMentions.set(key, mention);
  }
  return [...uniqueMentions.values()];
}

export function createChatLabConversation(seedMessage?: string): ChatLabConversation {
  const now = new Date().toISOString();
  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: deriveConversationTitle(seedMessage),
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

export function deriveConversationTitle(message?: string): string {
  const normalized = message?.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新会话';
  }
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}
