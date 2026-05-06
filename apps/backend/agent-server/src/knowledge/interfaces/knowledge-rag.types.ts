import type { KnowledgeChatMessageRecord } from './knowledge-records.types';

export const KNOWLEDGE_RAG_DEFAULT_TENANT_ID = 'ws_1';
export const KNOWLEDGE_RAG_DEFAULT_CREATED_BY = 'user_demo';
export const KNOWLEDGE_RAG_DEFAULT_TOP_K = 5;
export const KNOWLEDGE_RAG_NO_EVIDENCE_ANSWER = '未在当前知识库中找到足够依据。';

export interface KnowledgeRagChatInput {
  conversationId?: string;
  message?: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  tenantId?: string;
  createdBy?: string;
  topK?: number;
}

export interface KnowledgeRagCitation extends Record<string, unknown> {
  id: string;
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  text: string;
  quote: string;
  title: string;
  contentPreview: string;
  score: number;
  rank: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeRagRetrievalResult {
  matches: KnowledgeRagCitation[];
  topK: number;
}

export interface KnowledgeRagRetriever {
  retrieve(
    input: Required<Pick<KnowledgeRagChatInput, 'tenantId' | 'message' | 'topK'>> & {
      knowledgeBaseId?: string;
    }
  ): Promise<KnowledgeRagRetrievalResult>;
}

export interface KnowledgeRagGeneratorInput {
  message: string;
  citations: KnowledgeRagCitation[];
}

export interface KnowledgeRagGeneratorResult {
  answer: string;
}

export interface KnowledgeRagGenerator {
  generate(input: KnowledgeRagGeneratorInput): Promise<KnowledgeRagGeneratorResult>;
}

export interface KnowledgeRagChatResult {
  conversationId: string;
  answer: string;
  traceId: string;
  userMessage: KnowledgeChatMessageRecord;
  assistantMessage: KnowledgeChatMessageRecord & { traceId: string };
  citations: KnowledgeRagCitation[];
  retrieval: KnowledgeRagRetrievalResult;
}
