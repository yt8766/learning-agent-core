import { ChatOpenAI } from '@langchain/openai';

import { loadSettings, type RuntimeSettings } from '@agent/config';

import { normalizeModelBaseUrl } from '../../shared/urls';

export interface ChatOpenAIModelOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
  apiKey?: string;
  baseUrl?: string;
  modelKwargs?: Record<string, unknown>;
}

export type AgentCoreModelSettings = Pick<
  RuntimeSettings,
  'zhipuApiBaseUrl' | 'zhipuApiKey' | 'zhipuModels' | 'zhipuThinking'
>;

export function getAgentCoreModelSettings(settings?: AgentCoreModelSettings) {
  return (settings ?? loadSettings()) as AgentCoreModelSettings;
}

export function createChatOpenAIModel(options: ChatOpenAIModelOptions) {
  const thinkingKwargs = options.thinking
    ? {
        thinking: {
          type: 'enabled'
        }
      }
    : undefined;

  return new ChatOpenAI({
    model: options.model,
    temperature: options.temperature ?? 0.2,
    maxTokens: options.maxTokens,
    apiKey: options.apiKey,
    configuration: options.baseUrl
      ? {
          baseURL: normalizeModelBaseUrl(options.baseUrl)
        }
      : undefined,
    modelKwargs:
      thinkingKwargs || options.modelKwargs
        ? {
            ...(thinkingKwargs ?? {}),
            ...(options.modelKwargs ?? {})
          }
        : undefined
  });
}
