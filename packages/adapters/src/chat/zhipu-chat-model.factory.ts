import {
  createChatOpenAIModel,
  getAgentCoreModelSettings,
  type AgentCoreModelSettings
} from './chat-openai-model.factory';

export type { AgentCoreModelSettings } from './chat-openai-model.factory';

export type AgentModelRole = 'manager' | 'research' | 'executor' | 'reviewer';

export interface ZhipuChatModelOptions {
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
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
