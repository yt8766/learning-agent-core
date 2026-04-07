import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

import { loadSettings, type RuntimeSettings } from '@agent/config';

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
}

export interface OpenAIEmbeddingModelOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions?: number;
  batchSize?: number;
}

export interface EmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export type AgentCoreModelSettings = Pick<
  RuntimeSettings,
  'zhipuApiBaseUrl' | 'zhipuApiKey' | 'zhipuModels' | 'zhipuThinking'
>;

export interface EmbeddingRuntimeSettings {
  embeddings: {
    endpoint: string;
    model: string;
    dimensions?: number;
    apiKey?: string;
  };
  zhipuApiKey?: string;
  mcp?: {
    bigmodelApiKey?: string;
  };
}

export function getAgentCoreModelSettings(settings?: AgentCoreModelSettings) {
  return (settings ?? loadSettings()) as AgentCoreModelSettings;
}

export function normalizeModelBaseUrl(url: string) {
  return url.endsWith('/chat/completions') ? url.replace(/\/chat\/completions$/, '') : url;
}

export function normalizeEmbeddingBaseUrl(url: string) {
  return url.endsWith('/embeddings') ? url.replace(/\/embeddings$/, '') : url;
}

export function createChatOpenAIModel(options: ChatOpenAIModelOptions) {
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
    modelKwargs: options.thinking
      ? {
          thinking: {
            type: 'enabled'
          }
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

function shouldSuppressDimensions(baseUrl?: string) {
  return (baseUrl ?? '').toLowerCase().includes('open.bigmodel.cn/api/coding/paas/v4/embeddings');
}

export function createOpenAIEmbeddingModel(options: OpenAIEmbeddingModelOptions): EmbeddingProvider {
  return new OpenAIEmbeddings({
    model: options.model,
    dimensions: options.dimensions && !shouldSuppressDimensions(options.baseUrl) ? options.dimensions : undefined,
    apiKey: options.apiKey,
    batchSize: Math.max(1, options.batchSize ?? 16),
    configuration: options.baseUrl
      ? {
          baseURL: normalizeEmbeddingBaseUrl(options.baseUrl)
        }
      : undefined
  });
}

export function createRuntimeEmbeddingProvider(settings: EmbeddingRuntimeSettings) {
  return createOpenAIEmbeddingModel({
    model: settings.embeddings.model,
    dimensions: settings.embeddings.dimensions,
    baseUrl: settings.embeddings.endpoint,
    apiKey: resolveRuntimeEmbeddingApiKey(settings)
  });
}

export function resolveRuntimeEmbeddingApiKey(settings: EmbeddingRuntimeSettings) {
  return settings.embeddings.apiKey || settings.mcp?.bigmodelApiKey || settings.zhipuApiKey || undefined;
}
