import type { KnowledgeFrontendApi } from '@/api/knowledge-api-provider';

export interface KnowledgeProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface KnowledgeProviderChunk {
  content: string;
  finished?: boolean;
}

export function createKnowledgeChatProvider({ api }: { api: KnowledgeFrontendApi }) {
  return {
    async sendMessage(
      input: {
        conversationId: string;
        messages: KnowledgeProviderMessage[];
      },
      hooks: {
        onChunk: (chunk: KnowledgeProviderChunk) => void;
      }
    ) {
      let text = '';
      for await (const event of api.streamChat({
        conversationId: input.conversationId,
        messages: input.messages,
        stream: true
      })) {
        if (event.type === 'answer.delta') {
          text += event.delta;
          hooks.onChunk({ content: text });
        }
        if (event.type === 'answer.completed') {
          if (event.answer.text !== text) {
            hooks.onChunk({ content: event.answer.text, finished: true });
          }
          return event.answer;
        }
      }
      throw new Error('Knowledge stream completed without answer.completed');
    }
  };
}
