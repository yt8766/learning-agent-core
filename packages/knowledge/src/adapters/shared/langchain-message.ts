import type { KnowledgeChatMessage } from '../../core';

export interface LangChainMessageLike {
  role: string;
  content: string;
  name?: string;
}

export function toLangChainMessages(messages: readonly KnowledgeChatMessage[]): LangChainMessageLike[] {
  return messages.map(message => ({
    role: message.role,
    content: message.content,
    ...(message.name === undefined ? {} : { name: message.name })
  }));
}

export function extractLangChainText(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (!isRecord(result)) {
    return '';
  }

  const content = result.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (isRecord(item) && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
