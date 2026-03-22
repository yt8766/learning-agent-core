import { ChatOpenAI } from '@langchain/openai';

import { loadSettings } from '@agent/config';

import { AgentModelRole } from './llm-provider';

interface ZhipuRuntimeSettings {
  zhipuApiKey: string;
  zhipuApiBaseUrl: string;
  zhipuModels: Record<AgentModelRole, string>;
  zhipuThinking: Record<AgentModelRole, boolean>;
}

function toBaseUrl(url: string): string {
  return url.replace(/\/chat\/completions\/?$/, '');
}

export class ZhipuChatModelFactory {
  private readonly settings = loadSettings() as ReturnType<typeof loadSettings> & ZhipuRuntimeSettings;

  isConfigured(): boolean {
    return Boolean(this.settings.zhipuApiKey);
  }

  create(
    role: AgentModelRole,
    options?: {
      temperature?: number;
      maxTokens?: number;
      thinking?: boolean;
    }
  ): ChatOpenAI {
    const thinkingEnabled = options?.thinking ?? this.settings.zhipuThinking[role];

    return new ChatOpenAI({
      model: this.settings.zhipuModels[role],
      temperature: options?.temperature ?? 0.2,
      maxTokens: options?.maxTokens,
      apiKey: this.settings.zhipuApiKey,
      configuration: {
        baseURL: toBaseUrl(this.settings.zhipuApiBaseUrl)
      },
      modelKwargs: thinkingEnabled
        ? {
            thinking: {
              type: 'enabled'
            }
          }
        : undefined
    });
  }
}
