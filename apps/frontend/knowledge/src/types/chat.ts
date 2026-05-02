import type { ID, ISODateTime } from './common';
import type { KnowledgeRagAnswer } from '@agent/knowledge';

export interface Citation {
  id: ID;
  documentId: ID;
  chunkId: ID;
  title: string;
  uri?: string;
  quote: string;
  score?: number;
  page?: number;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type OpenAIChatMessageRole = 'developer' | 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIChatTextContentPart {
  type: 'text';
  text: string;
}

export interface OpenAIChatMessage {
  role: OpenAIChatMessageRole;
  content: string | OpenAIChatTextContentPart[];
}

export type FeedbackCategory =
  | 'helpful'
  | 'not_helpful'
  | 'wrong_citation'
  | 'hallucination'
  | 'missing_knowledge'
  | 'too_slow'
  | 'unsafe'
  | 'other';

export interface MessageFeedbackSummary {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
}

export interface ChatMessage {
  id: ID;
  conversationId: ID;
  role: ChatMessageRole;
  content: string;
  citations?: Citation[];
  traceId?: ID;
  route?: KnowledgeRagAnswer['route'];
  diagnostics?: KnowledgeRagAnswer['diagnostics'];
  feedback?: MessageFeedbackSummary;
  createdAt: ISODateTime;
}

export interface ChatRequest {
  model?: string;
  messages?: OpenAIChatMessage[];
  metadata?: {
    conversationId?: ID;
    knowledgeBaseId?: ID;
    knowledgeBaseIds?: ID[];
    mentions?: Array<{
      type: 'knowledge_base';
      id?: ID;
      label?: string;
    }>;
    debug?: boolean;
  };
  stream?: boolean;
  conversationId?: ID;
  knowledgeBaseIds?: ID[];
  message?: string;
  retrievalConfigId?: ID;
  promptTemplateId?: ID;
  debug?: boolean;
}

export interface ChatResponse {
  conversationId: ID;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  answer: string;
  citations: Citation[];
  traceId: ID;
  route?: KnowledgeRagAnswer['route'];
  diagnostics?: KnowledgeRagAnswer['diagnostics'];
  usage?: TokenUsage;
}

export interface CreateFeedbackRequest {
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
}

export interface FeedbackRecord {
  id: ID;
  workspaceId: ID;
  traceId?: ID;
  messageId?: ID;
  rating: 'positive' | 'negative';
  category?: FeedbackCategory;
  comment?: string;
  createdBy: ID;
  createdAt: ISODateTime;
}
