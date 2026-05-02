import { KnowledgeApiClient, type KnowledgeApiClientOptions } from '../client';

export type KnowledgeBrowserClientOptions = KnowledgeApiClientOptions;

export function createKnowledgeBrowserClient(options: KnowledgeBrowserClientOptions): KnowledgeApiClient {
  return new KnowledgeApiClient(options);
}

export { KnowledgeApiClient, KnowledgeApiError } from '../client';
export type { KnowledgeApiClientOptions, KnowledgeRequestOptions, KnowledgeTokenStore } from '../client';
