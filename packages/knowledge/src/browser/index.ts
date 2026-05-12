import { KnowledgeApiClient, type KnowledgeApiClientOptions } from '../client';

export type KnowledgeBrowserClientOptions = KnowledgeApiClientOptions;

export function createKnowledgeBrowserClient(options: KnowledgeBrowserClientOptions): KnowledgeApiClient {
  return new KnowledgeApiClient(options);
}

export { KnowledgeApiClient, KnowledgeApiError } from '../client';
export type { KnowledgeApiClientOptions, KnowledgeRequestOptions, KnowledgeTokenStore } from '../client';

/** Browser-safe RAG stream SSE contract; avoids pulling Node-only code from the package root. */
export { KnowledgeRagStreamEventSchema } from '../rag/schemas/knowledge-rag-stream.schema';
export {
  KnowledgeAgentFlowListResponseSchema,
  KnowledgeAgentFlowRunResponseSchema,
  KnowledgeAgentFlowSaveResponseSchema
} from '../contracts/knowledge-agent-flow';
export type { KnowledgeRagStreamEvent } from '../rag/schemas/knowledge-rag-stream.schema';
export type { KnowledgeBase, KnowledgeBaseHealth, KnowledgeRagAnswer } from '../core/types';
export type {
  KnowledgeAgentFlow,
  KnowledgeAgentFlowListResponse,
  KnowledgeAgentFlowRunRequest,
  KnowledgeAgentFlowRunResponse,
  KnowledgeAgentFlowSaveRequest,
  KnowledgeAgentFlowSaveResponse
} from '../contracts/knowledge-agent-flow';
