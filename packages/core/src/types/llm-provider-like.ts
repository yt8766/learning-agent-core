import type {
  ILLMProvider,
  LlmProviderAgentRole,
  LlmProviderCapability,
  LlmProviderMessage,
  LlmProviderModelInfo,
  LlmProviderOptions,
  LlmProviderRole
} from '../providers';

export type LlmProviderLikeRole = LlmProviderRole;
export type LlmProviderLikeAgentRole = LlmProviderAgentRole;
export type LlmProviderLikeCapability = LlmProviderCapability;
export type LlmProviderLikeMessage = LlmProviderMessage;
export type LlmProviderLikeModelInfo = LlmProviderModelInfo;
export type LlmProviderLikeOptions = LlmProviderOptions;

export interface LlmProviderLike extends ILLMProvider {
  isConfigured(): boolean;
}
