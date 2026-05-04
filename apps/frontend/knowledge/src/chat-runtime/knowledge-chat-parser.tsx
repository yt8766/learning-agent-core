import type { BubbleItemType } from '@ant-design/x/es/bubble';

import type { ChatMessage, KnowledgeChatStreamState } from '@/types/api';

import type { KnowledgeFrontendChatMessageContent, KnowledgeMessageFeedbackValue } from './knowledge-chat-types';

export function toKnowledgeBubbleItems(input: {
  messages: ChatMessage[];
  feedbackByMessageId: Record<string, KnowledgeMessageFeedbackValue>;
  streamState: KnowledgeChatStreamState;
  isRequesting: boolean;
}): BubbleItemType[] {
  const isStreamActive =
    input.isRequesting &&
    input.streamState.runId !== undefined &&
    !['idle', 'completed', 'error'].includes(input.streamState.phase);

  return input.messages.map(message => ({
    key: message.id,
    role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
    loading:
      message.role === 'assistant' &&
      isStreamActive &&
      (message.traceId === input.streamState.runId || message.id === `stream_assistant_${input.streamState.runId}`),
    content:
      message.role === 'assistant'
        ? ({
            kind: 'markdown',
            text: message.content,
            meta: {
              citations: (message.citations ?? []).map(citation => ({
                id: citation.id,
                title: citation.title,
                quote: citation.quote,
                uri: citation.uri,
                score: citation.score
              })),
              traceId: message.traceId,
              routeReason: message.route?.reason,
              feedback: input.feedbackByMessageId[message.id] ?? 'default'
            }
          } satisfies KnowledgeFrontendChatMessageContent)
        : message.content
  }));
}
