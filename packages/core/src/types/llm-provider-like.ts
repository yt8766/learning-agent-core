import type { ZodType } from 'zod/v4';

export type LlmProviderLikeRole = 'system' | 'user' | 'assistant';
export type LlmProviderLikeAgentRole = 'manager' | 'research' | 'executor' | 'reviewer';
export type LlmProviderLikeCapability =
  | 'text'
  | 'vision'
  | 'audio'
  | 'image-gen'
  | 'video-gen'
  | 'tts'
  | 'asr'
  | 'realtime'
  | 'tool-call'
  | 'thinking';

export interface LlmProviderLikeMessage {
  role: LlmProviderLikeRole;
  content: string;
}

export interface LlmProviderLikeModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  contextWindow: number;
  maxOutput: number;
  capabilities: LlmProviderLikeCapability[];
  pricing?: {
    inputPer1k: number;
    outputPer1k: number;
    currency: string;
  };
}

export interface LlmProviderLikeOptions {
  role: LlmProviderLikeAgentRole;
  modelId?: string;
  taskId?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
  disableRetry?: boolean;
  budgetState?: {
    costConsumedUsd?: number;
    costBudgetUsd?: number;
    fallbackModelId?: string;
    overBudget?: boolean;
  };
  onUsage?: (usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model?: string;
    estimated?: boolean;
    costUsd?: number;
    costCny?: number;
  }) => void;
}

export interface LlmProviderLike {
  readonly providerId: string;
  readonly displayName: string;
  supportedModels(): LlmProviderLikeModelInfo[];
  isConfigured(): boolean;
  generateText(messages: LlmProviderLikeMessage[], options: LlmProviderLikeOptions): Promise<string>;
  streamText(
    messages: LlmProviderLikeMessage[],
    options: LlmProviderLikeOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string>;
  generateObject<T>(
    messages: LlmProviderLikeMessage[],
    schema: ZodType<T>,
    options: LlmProviderLikeOptions
  ): Promise<T>;
}
