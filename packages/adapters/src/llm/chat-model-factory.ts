import { ChatOpenAI } from '@langchain/openai';

import { loadSettings } from '@agent/config';

import { createZhipuChatModel } from '../runtime/chat-model-factory';
import { AgentModelRole } from './llm-provider';

interface ZhipuRuntimeSettings {
  zhipuApiKey: string;
  zhipuApiBaseUrl: string;
  zhipuModels: Record<AgentModelRole, string>;
  zhipuThinking: Record<AgentModelRole, boolean>;
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
    return createZhipuChatModel(role, options, this.settings);
  }
}
