declare module '@agent/knowledge/node' {
  export interface KnowledgeSdkRuntime {
    chatProvider: unknown;
    embeddingProvider: unknown;
    vectorStore: unknown;
  }

  export interface KnowledgeSdkRuntimeConfig {
    chat: {
      provider: 'openai-compatible';
      apiKey?: string;
      model: string;
      baseURL?: string;
      maxTokens?: number;
    };
    embedding: {
      provider: 'openai-compatible';
      apiKey?: string;
      model: string;
      baseURL?: string;
      dimensions?: number;
      batchSize?: number;
    };
    vectorStore?: {
      client: {
        rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown | null; error: unknown | null }>;
      };
    };
  }

  export function createDefaultKnowledgeSdkRuntime(config: KnowledgeSdkRuntimeConfig): KnowledgeSdkRuntime;
}
