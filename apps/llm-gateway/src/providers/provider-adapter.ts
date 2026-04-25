export type GatewayChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface GatewayChatMessage {
  role: GatewayChatRole;
  content: string;
}

export interface GatewayChatRequest {
  id?: string;
  model: string;
  providerModel: string;
  messages: GatewayChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface GatewayUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GatewayChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage: GatewayUsage;
}

export interface GatewayChatStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: GatewayUsage;
}

export interface ProviderHealth {
  status: 'available' | 'unavailable';
  checkedAt: string;
  reason?: string;
}

export interface ProviderAdapter {
  id: string;
  complete(request: GatewayChatRequest): Promise<GatewayChatResponse>;
  stream(request: GatewayChatRequest): AsyncIterable<GatewayChatStreamChunk>;
  healthCheck(): Promise<ProviderHealth>;
}

export class GatewayProviderError extends Error {
  readonly code: 'UPSTREAM_UNAVAILABLE';
  readonly status: number;

  constructor(message = 'Upstream provider is unavailable') {
    super(message);
    this.name = 'GatewayProviderError';
    this.code = 'UPSTREAM_UNAVAILABLE';
    this.status = 503;
  }
}

export function createUnavailableProviderAdapter(id: string): ProviderAdapter {
  return {
    id,
    async complete() {
      throw new GatewayProviderError();
    },
    stream() {
      throw new GatewayProviderError();
    },
    async healthCheck() {
      return {
        status: 'unavailable',
        checkedAt: new Date().toISOString(),
        reason: 'Provider adapter is not configured'
      };
    }
  };
}
