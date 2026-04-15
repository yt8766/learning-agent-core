import { ChatOpenAI } from '@langchain/openai';

import { loadSettings, type RuntimeSettings } from '@agent/config';

import { normalizeModelBaseUrl } from '../providers/base-url';

export type AgentModelRole = 'manager' | 'research' | 'executor' | 'reviewer';

export interface ZhipuChatModelOptions {
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
}

export interface ChatOpenAIModelOptions extends ZhipuChatModelOptions {
  model: string;
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

export function createZhipuChatModel(
  role: AgentModelRole,
  options?: ZhipuChatModelOptions,
  settings?: AgentCoreModelSettings
) {
  const resolvedSettings = getAgentCoreModelSettings(settings);
  const thinkingEnabled = options?.thinking ?? resolvedSettings.zhipuThinking[role];

  return createChatOpenAIModel({
    model: resolvedSettings.zhipuModels[role],
    temperature: options?.temperature ?? 0.2,
    maxTokens: options?.maxTokens,
    apiKey: resolvedSettings.zhipuApiKey,
    baseUrl: resolvedSettings.zhipuApiBaseUrl,
    thinking: thinkingEnabled
  });
}
