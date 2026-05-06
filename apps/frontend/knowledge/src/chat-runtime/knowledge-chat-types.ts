export type KnowledgeMessageFeedbackValue = 'default' | 'like' | 'dislike';

export interface KnowledgeFrontendChatMessageContent {
  kind: 'markdown';
  text: string;
  meta: {
    citations: Array<{ id: string; title: string; quote: string; uri?: string; score?: number }>;
    traceId?: string;
    routeReason?: string;
    feedback?: KnowledgeMessageFeedbackValue;
  };
}
