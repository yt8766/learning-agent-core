import {
  ChromaVectorSearchProvider,
  createOpenSearchKeywordSearchProvider,
  createRuntimeEmbeddingProvider
} from '@agent/adapters';
import type {
  OpenSearchKeywordHealthCheckParams,
  OpenSearchKeywordSearchParams,
  QueryEmbeddingProvider
} from '@agent/adapters';
import type { VectorSearchProvider } from '@agent/knowledge';
import type { KnowledgeSearchService } from '@agent/knowledge';

import type {
  RuntimeKnowledgeProviderFactoryConfig,
  RuntimeKnowledgeRetrievalMode
} from './runtime-knowledge-search-factory';

export interface RuntimeKnowledgeProviderOptions {
  config?: RuntimeKnowledgeProviderFactoryConfig;
  keywordSearchService?: KnowledgeSearchService;
  knowledgeVectorSearchProvider?: VectorSearchProvider;
}

type RuntimeKnowledgeProviderEnv = NodeJS.ProcessEnv;

export function createRuntimeKnowledgeProviderOptionsFromEnv(
  env: RuntimeKnowledgeProviderEnv = process.env
): RuntimeKnowledgeProviderOptions {
  const retrievalMode = parseRetrievalMode(env.KNOWLEDGE_RETRIEVAL_MODE);
  const keywordProviderId = normalizeEnvValue(env.KNOWLEDGE_KEYWORD_PROVIDER);
  const vectorProviderId = normalizeEnvValue(env.KNOWLEDGE_VECTOR_PROVIDER);
  const vectorEnabled = parseBooleanEnv(env.KNOWLEDGE_VECTOR_ENABLED) ?? Boolean(vectorProviderId);
  const keywordSearchService =
    keywordProviderId === 'opensearch' ? createOpenSearchKeywordSearchProviderFromEnv(env) : undefined;
  const health = resolveHealthConfig(env);
  const config: RuntimeKnowledgeProviderFactoryConfig = {
    ...(retrievalMode ? { retrievalMode } : {}),
    ...(keywordProviderId
      ? {
          keyword: {
            providerId: keywordProviderId
          }
        }
      : {}),
    ...(vectorEnabled || vectorProviderId
      ? {
          vector: {
            enabled: vectorEnabled,
            providerId: vectorProviderId ?? 'env'
          }
        }
      : {}),
    ...(health ? { health } : {})
  };

  if (vectorProviderId !== 'chroma') {
    return {
      config: hasRuntimeKnowledgeProviderConfig(config) ? config : undefined,
      ...(keywordSearchService ? { keywordSearchService } : {})
    };
  }

  const knowledgeVectorSearchProvider = createChromaVectorSearchProviderFromEnv(env);
  return {
    config: {
      ...config,
      retrievalMode: retrievalMode ?? 'hybrid',
      vector: {
        enabled: true,
        providerId: 'chroma'
      }
    },
    ...(keywordSearchService ? { keywordSearchService } : {}),
    ...(knowledgeVectorSearchProvider ? { knowledgeVectorSearchProvider } : {})
  };
}

function createOpenSearchKeywordSearchProviderFromEnv(
  env: RuntimeKnowledgeProviderEnv
): KnowledgeSearchService | undefined {
  const endpoint = normalizeEnvValue(env.KNOWLEDGE_OPENSEARCH_ENDPOINT);
  const indexName = normalizeEnvValue(env.KNOWLEDGE_OPENSEARCH_INDEX);

  if (!endpoint || !indexName) {
    return undefined;
  }

  return createOpenSearchKeywordSearchProvider({
    indexName,
    client: createOpenSearchKeywordSearchClient({
      endpoint,
      apiKey: normalizeEnvValue(env.KNOWLEDGE_OPENSEARCH_API_KEY)
    })
  });
}

function createOpenSearchKeywordSearchClient(options: { endpoint: string; apiKey?: string }) {
  return {
    async search(params: OpenSearchKeywordSearchParams | OpenSearchKeywordHealthCheckParams) {
      const response = await fetch(resolveOpenSearchSearchUrl(options.endpoint, params.index), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {})
        },
        body: JSON.stringify({
          size: params.size,
          query: params.query
        })
      });

      if (!response.ok) {
        throw new Error(`OpenSearch search failed with HTTP ${response.status}`);
      }

      return response.json();
    }
  };
}

function resolveOpenSearchSearchUrl(endpoint: string, indexName: string): string {
  const normalizedEndpoint = endpoint.replace(/\/+$/, '');
  const encodedIndex = encodeURIComponent(indexName);
  return `${normalizedEndpoint}/${encodedIndex}/_search`;
}

function createChromaVectorSearchProviderFromEnv(env: RuntimeKnowledgeProviderEnv): VectorSearchProvider | undefined {
  const collectionName = normalizeEnvValue(env.KNOWLEDGE_CHROMA_COLLECTION);
  const embeddingsEndpoint = normalizeEnvValue(env.KNOWLEDGE_EMBEDDINGS_ENDPOINT);
  const embeddingsModel = normalizeEnvValue(env.KNOWLEDGE_EMBEDDINGS_MODEL);

  if (!collectionName || !embeddingsEndpoint || !embeddingsModel) {
    return undefined;
  }

  return new ChromaVectorSearchProvider({
    collectionName,
    clientOptions: {
      path: normalizeEnvValue(env.KNOWLEDGE_CHROMA_ENDPOINT),
      fetchOptions: resolveFetchOptions(env.KNOWLEDGE_CHROMA_API_KEY)
    },
    embeddingProvider: createRuntimeEmbeddingProvider({
      embeddings: {
        endpoint: embeddingsEndpoint,
        model: embeddingsModel,
        dimensions: parsePositiveIntegerEnv(env.KNOWLEDGE_EMBEDDINGS_DIMENSIONS),
        apiKey: normalizeEnvValue(env.KNOWLEDGE_EMBEDDINGS_API_KEY)
      },
      zhipuApiKey: normalizeEnvValue(env.ZHIPU_API_KEY),
      mcp: {
        bigmodelApiKey: normalizeEnvValue(env.MCP_BIGMODEL_API_KEY)
      }
    }) as QueryEmbeddingProvider
  });
}

function resolveHealthConfig(env: RuntimeKnowledgeProviderEnv): RuntimeKnowledgeProviderFactoryConfig['health'] {
  const ttlMs = parseNonNegativeIntegerEnv(env.KNOWLEDGE_PROVIDER_HEALTH_TTL_MS);
  const timeoutMs = parsePositiveIntegerEnv(env.KNOWLEDGE_PROVIDER_HEALTH_TIMEOUT_MS);
  const degradedAfterConsecutiveFailures = parsePositiveIntegerEnv(
    env.KNOWLEDGE_PROVIDER_HEALTH_DEGRADED_AFTER_FAILURES
  );

  if (ttlMs === undefined && timeoutMs === undefined && degradedAfterConsecutiveFailures === undefined) {
    return undefined;
  }

  return {
    ...(ttlMs !== undefined ? { ttlMs } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(degradedAfterConsecutiveFailures !== undefined ? { degradedAfterConsecutiveFailures } : {})
  };
}

function resolveFetchOptions(apiKey: string | undefined): RequestInit | undefined {
  if (!apiKey) {
    return undefined;
  }

  return {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  };
}

function hasRuntimeKnowledgeProviderConfig(config: RuntimeKnowledgeProviderFactoryConfig) {
  return Boolean(config.retrievalMode || config.keyword || config.vector || config.health);
}

function parseRetrievalMode(value: string | undefined): RuntimeKnowledgeRetrievalMode | undefined {
  const normalized = normalizeEnvValue(value);
  if (normalized === 'keyword-only' || normalized === 'vector-only' || normalized === 'hybrid') {
    return normalized;
  }
  return undefined;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  const normalized = normalizeEnvValue(value)?.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return undefined;
}

function parsePositiveIntegerEnv(value: string | undefined): number | undefined {
  const parsed = parseNonNegativeIntegerEnv(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

function parseNonNegativeIntegerEnv(value: string | undefined): number | undefined {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
