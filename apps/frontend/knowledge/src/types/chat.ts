import type { ID, ISODateTime } from './common';
import type { KnowledgeRagAnswer, KnowledgeRagStreamEvent as SdkKnowledgeRagStreamEvent } from '@agent/knowledge';

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
  userId?: ID;
  role: ChatMessageRole;
  content: string;
  modelProfileId?: ID;
  citations?: Citation[];
  traceId?: ID;
  route?: KnowledgeRagAnswer['route'];
  diagnostics?: KnowledgeRagAnswer['diagnostics'];
  feedback?: MessageFeedbackSummary;
  createdAt: ISODateTime;
}

export type RagModelProfileUseCase = 'coding' | 'daily' | 'balanced';

export interface RagModelProfileSummary {
  id: ID;
  label: string;
  description?: string;
  useCase: RagModelProfileUseCase;
  enabled: boolean;
}

export interface ChatConversation {
  id: ID;
  userId: ID;
  title: string;
  activeModelProfileId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
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
    reasoningMode?: 'standard' | 'deep';
    webSearchMode?: 'off' | 'allowed';
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

export type KnowledgeRagStreamEvent = SdkKnowledgeRagStreamEvent;

export type KnowledgeChatStreamPhase = 'idle' | 'planner' | 'retrieval' | 'answer' | 'completed' | 'error';

export interface KnowledgeChatStreamState {
  answerText: string;
  citations: Citation[];
  events: KnowledgeRagStreamEvent[];
  phase: KnowledgeChatStreamPhase;
  runId?: ID;
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
