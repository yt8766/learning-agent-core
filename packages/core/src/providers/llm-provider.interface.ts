import type { ZodType } from 'zod/v4';

import type { ProviderBudgetState, ProviderUsage } from './provider.types';

export type LlmProviderRole = 'system' | 'user' | 'assistant';
export type LlmProviderAgentRole = 'manager' | 'research' | 'executor' | 'reviewer';
export type LlmProviderCapability =
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

export interface LlmProviderMessage {
  role: LlmProviderRole;
  content: string;
}

export interface LlmProviderModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  contextWindow: number;
  maxOutput: number;
  capabilities: LlmProviderCapability[];
  pricing?: {
    inputPer1k: number;
    outputPer1k: number;
    currency: string;
  };
}

export interface LlmProviderOptions {
  role: LlmProviderAgentRole;
  modelId?: string;
  taskId?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
  disableRetry?: boolean;
  budgetState?: ProviderBudgetState;
  onUsage?: (usage: ProviderUsage) => void;
}

export interface ILLMProvider {
  readonly providerId: string;
  readonly displayName: string;
  supportedModels(): LlmProviderModelInfo[];
  isConfigured(): boolean;
  generateText(messages: LlmProviderMessage[], options: LlmProviderOptions): Promise<string>;
  streamText(
    messages: LlmProviderMessage[],
    options: LlmProviderOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string>;
  generateObject<T>(messages: LlmProviderMessage[], schema: ZodType<T>, options: LlmProviderOptions): Promise<T>;
}
