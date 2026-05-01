import {
  DefaultKnowledgeSearchService,
  HybridRetrievalDiagnosticsSchema,
  HybridKnowledgeSearchService,
  VectorKnowledgeSearchService,
  runKnowledgeRetrieval
} from '@agent/knowledge';
import type { RuntimeKnowledgeSearchDiagnosticsSnapshot, RuntimeKnowledgeSearchService } from '@agent/runtime';
import type { KnowledgeSearchService, VectorSearchProvider } from '@agent/knowledge';

import { normalizeRuntimeKnowledgeDiagnostics } from './runtime-knowledge-diagnostics';
import {
  createKeywordProviderHealthChecker,
  createVectorProviderHealthChecker,
  type RuntimeKnowledgeProviderHealth,
  type RuntimeKnowledgeProviderHealthConfig
} from './runtime-knowledge-provider-health';
import {
  SnapshotKnowledgeChunkRepository,
  SnapshotKnowledgeSourceRepository,
  type RuntimeKnowledgeSettings
} from './runtime-knowledge-search-repositories';

export type { RuntimeKnowledgeProviderHealth } from './runtime-knowledge-provider-health';

export type RuntimeKnowledgeRetrievalMode = 'keyword-only' | 'vector-only' | 'hybrid';

export type RuntimeKnowledgeProviderDiagnosticSeverity = 'info' | 'warning';

export interface RuntimeKnowledgeProviderDiagnostic {
  code: string;
  severity: RuntimeKnowledgeProviderDiagnosticSeverity;
  message: string;
}

export interface RuntimeKnowledgeProviderFactoryConfig {
  knowledgeRoot?: string;
  retrievalMode?: RuntimeKnowledgeRetrievalMode;
  keyword?: {
    providerId?: string;
  };
  vector?: {
    enabled?: boolean;
    providerId?: string;
  };
  health?: RuntimeKnowledgeProviderHealthConfig;
}

export interface RuntimeKnowledgeSearchFactoryHost {
  settings: RuntimeKnowledgeSettings;
  config?: RuntimeKnowledgeProviderFactoryConfig;
  keywordSearchService?: KnowledgeSearchService;
  knowledgeVectorSearchProvider?: VectorSearchProvider;
  knowledgeVectorSearchClient?: VectorSearchProvider;
}

export interface RuntimeKnowledgeProviderFactoryResult {
  keywordSearchService: KnowledgeSearchService;
  vectorSearchProvider?: VectorSearchProvider;
  hybridSearchService?: KnowledgeSearchService;
  searchService: KnowledgeSearchService;
  configuredMode: RuntimeKnowledgeRetrievalMode;
  effectiveMode: RuntimeKnowledgeRetrievalMode;
  vectorProviderId?: string;
  vectorConfigured: boolean;
  diagnostics: RuntimeKnowledgeProviderDiagnostic[];
  keywordProviderId?: string;
  checkKeywordProviderHealth?: () => Promise<RuntimeKnowledgeProviderHealth>;
  checkVectorProviderHealth?: () => Promise<RuntimeKnowledgeProviderHealth>;
}

export interface RuntimeKnowledgeSearchStatus {
  configuredMode: RuntimeKnowledgeRetrievalMode;
  effectiveMode: RuntimeKnowledgeRetrievalMode;
  vectorProviderId?: string;
  vectorConfigured: boolean;
  hybridEnabled: boolean;
  vectorProviderHealth?: RuntimeKnowledgeProviderHealth;
  keywordProviderHealth?: RuntimeKnowledgeProviderHealth;
  diagnostics: RuntimeKnowledgeProviderDiagnostic[];
  checkedAt: string;
}

export function createRuntimeKnowledgeSearchService(host: RuntimeKnowledgeSearchFactoryHost): KnowledgeSearchService {
  return createRuntimeKnowledgeProviderFactory(host).searchService;
}

export function createRuntimeKnowledgeProviderFactory(
  host: RuntimeKnowledgeSearchFactoryHost
): RuntimeKnowledgeProviderFactoryResult {
  const sourceRepository = new SnapshotKnowledgeSourceRepository(host.settings);
  const chunkRepository = new SnapshotKnowledgeChunkRepository(host.settings);
  const keywordService =
    host.keywordSearchService ?? new DefaultKnowledgeSearchService(sourceRepository, chunkRepository);
  const keywordProviderId = host.config?.keyword?.providerId;
  const checkKeywordProviderHealth = isHealthCheckProvider(keywordService)
    ? createKeywordProviderHealthChecker(keywordService, host.config?.health)
    : undefined;
  const vectorProvider = host.knowledgeVectorSearchProvider ?? host.knowledgeVectorSearchClient;
  const diagnostics: RuntimeKnowledgeProviderDiagnostic[] = [];
  const retrievalMode = host.config?.retrievalMode ?? (vectorProvider ? 'hybrid' : 'keyword-only');
  const vectorEnabled = host.config?.vector?.enabled ?? retrievalMode === 'hybrid';
  const providerId = host.config?.vector?.providerId ?? 'explicit';
  const vectorConfigured = vectorEnabled && retrievalMode !== 'keyword-only';

  if (!vectorEnabled || retrievalMode === 'keyword-only') {
    return {
      keywordSearchService: keywordService,
      searchService: keywordService,
      configuredMode: retrievalMode,
      effectiveMode: 'keyword-only',
      vectorProviderId: providerId,
      vectorConfigured,
      keywordProviderId,
      checkKeywordProviderHealth,
      diagnostics
    };
  }

  if (!vectorProvider) {
    diagnostics.push({
      code: 'knowledge.vector_provider.missing_client',
      severity: 'warning',
      message: `Knowledge vector provider "${providerId}" is enabled, but no explicit provider/client instance was supplied; falling back to keyword-only search.`
    });

    return {
      keywordSearchService: keywordService,
      searchService: keywordService,
      configuredMode: retrievalMode,
      effectiveMode: 'keyword-only',
      vectorProviderId: providerId,
      vectorConfigured,
      keywordProviderId,
      checkKeywordProviderHealth,
      diagnostics
    };
  }

  const vectorSearchService = new VectorKnowledgeSearchService(vectorProvider, chunkRepository, sourceRepository);

  if (retrievalMode === 'vector-only') {
    diagnostics.push({
      code: 'knowledge.vector_provider.ready',
      severity: 'info',
      message: `Knowledge vector provider "${providerId}" was supplied explicitly.`
    });
    diagnostics.push({
      code: 'knowledge.retrieval.vector_only.ready',
      severity: 'info',
      message: 'Knowledge vector-only search is enabled with an explicit vector provider.'
    });

    return {
      keywordSearchService: keywordService,
      vectorSearchProvider: vectorProvider,
      searchService: vectorSearchService,
      configuredMode: retrievalMode,
      effectiveMode: 'vector-only',
      vectorProviderId: providerId,
      vectorConfigured,
      keywordProviderId,
      checkKeywordProviderHealth,
      diagnostics,
      checkVectorProviderHealth: createVectorProviderHealthChecker(vectorProvider, host.config?.health)
    };
  }

  diagnostics.push({
    code: 'knowledge.vector_provider.ready',
    severity: 'info',
    message: `Knowledge vector provider "${providerId}" was supplied explicitly.`
  });

  const hybridSearchService = new HybridKnowledgeSearchService(keywordService, vectorSearchService);

  diagnostics.push({
    code: 'knowledge.retrieval.hybrid.ready',
    severity: 'info',
    message: 'Knowledge hybrid search is enabled with keyword and vector providers.'
  });

  return {
    keywordSearchService: keywordService,
    vectorSearchProvider: vectorProvider,
    hybridSearchService,
    searchService: hybridSearchService,
    configuredMode: retrievalMode,
    effectiveMode: 'hybrid',
    vectorProviderId: providerId,
    vectorConfigured,
    keywordProviderId,
    checkKeywordProviderHealth,
    diagnostics,
    checkVectorProviderHealth: createVectorProviderHealthChecker(vectorProvider, host.config?.health)
  };
}

export function createRuntimeKnowledgeSearchStatus(
  factory: RuntimeKnowledgeProviderFactoryResult,
  checkedAt = new Date().toISOString()
): RuntimeKnowledgeSearchStatus {
  return {
    configuredMode: factory.configuredMode,
    effectiveMode: factory.effectiveMode,
    vectorProviderId: factory.vectorProviderId,
    vectorConfigured: factory.vectorConfigured,
    hybridEnabled: factory.effectiveMode === 'hybrid',
    vectorProviderHealth: factory.vectorConfigured
      ? {
          status: 'unknown',
          checkedAt,
          message: factory.checkVectorProviderHealth
            ? 'Vector provider health has not been checked yet.'
            : 'Vector provider does not expose a health check.'
        }
      : undefined,
    keywordProviderHealth: factory.checkKeywordProviderHealth
      ? {
          status: 'unknown',
          checkedAt,
          message: 'Keyword provider health has not been checked yet.'
        }
      : undefined,
    diagnostics: factory.diagnostics,
    checkedAt
  };
}

export async function createRuntimeKnowledgeSearchStatusWithHealth(
  factory: RuntimeKnowledgeProviderFactoryResult,
  checkedAt = new Date().toISOString()
): Promise<RuntimeKnowledgeSearchStatus> {
  const status = createRuntimeKnowledgeSearchStatus(factory, checkedAt);
  const keywordProviderHealth = factory.checkKeywordProviderHealth
    ? await factory.checkKeywordProviderHealth()
    : undefined;
  const vectorProviderHealth =
    factory.vectorConfigured && factory.checkVectorProviderHealth
      ? await factory.checkVectorProviderHealth()
      : status.vectorProviderHealth;
  const healthDiagnostics: RuntimeKnowledgeProviderDiagnostic[] = [];

  if (keywordProviderHealth?.status === 'degraded') {
    healthDiagnostics.push({
      code: 'knowledge.keyword_provider.health_degraded',
      severity: 'warning',
      message: keywordProviderHealth.message ?? 'Knowledge keyword provider health check failed.'
    });
  }
  if (vectorProviderHealth?.status === 'degraded') {
    healthDiagnostics.push({
      code: 'knowledge.vector_provider.health_degraded',
      severity: 'warning',
      message: vectorProviderHealth.message ?? 'Knowledge vector provider health check failed.'
    });
  }

  return {
    ...status,
    keywordProviderHealth,
    vectorProviderHealth,
    diagnostics: healthDiagnostics.length ? [...status.diagnostics, ...healthDiagnostics] : status.diagnostics
  };
}

export function createRuntimeKnowledgeSearchBridge(service: KnowledgeSearchService): RuntimeKnowledgeSearchService {
  let lastDiagnostics: RuntimeKnowledgeSearchDiagnosticsSnapshot | undefined;

  return {
    search: async (query, limit = 5) => {
      let rawTotal: number | undefined;
      const rawDiagnostics: Record<string, unknown>[] = [];
      const diagnosticSearchService: KnowledgeSearchService = {
        search: async request => {
          const result = await service.search(request);
          rawTotal = rawTotal === undefined ? result.total : Math.max(rawTotal, result.total);
          const diagnostics = resolveRetrievalDiagnostics(result);
          if (diagnostics) {
            rawDiagnostics.push(diagnostics);
          }
          return diagnostics && !isHybridRetrievalDiagnostics(diagnostics)
            ? { ...result, diagnostics: undefined }
            : result;
        }
      };
      const result = await runKnowledgeRetrieval({
        request: { query, limit },
        searchService: diagnosticSearchService,
        includeDiagnostics: true
      });
      const diagnostics = resolveRuntimeRetrievalDiagnostics(rawDiagnostics, result.diagnostics);
      lastDiagnostics = {
        query,
        limit,
        hitCount: result.hits.length,
        total: rawTotal ?? result.total,
        ...(diagnostics ? { diagnostics } : {}),
        searchedAt: new Date().toISOString()
      };
      return result.hits.map(hit => ({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        sourceId: hit.sourceId,
        uri: hit.uri,
        title: hit.title,
        sourceType: hit.sourceType,
        content: hit.content,
        score: hit.score
      }));
    },
    getLastDiagnostics: () => lastDiagnostics
  };
}

function resolveRuntimeRetrievalDiagnostics(
  rawDiagnostics: Record<string, unknown>[],
  retrievalDiagnostics: unknown
): Record<string, unknown> | undefined {
  const diagnostics = isRecord(retrievalDiagnostics) ? retrievalDiagnostics : undefined;
  const legacyDiagnostics = rawDiagnostics[0];
  const normalizedLegacyDiagnostics = normalizeRuntimeKnowledgeDiagnostics(legacyDiagnostics);
  const normalizedRetrievalDiagnostics = normalizeRuntimeKnowledgeDiagnostics(diagnostics);

  if (!normalizedLegacyDiagnostics) {
    return normalizedRetrievalDiagnostics;
  }

  return normalizedRetrievalDiagnostics
    ? { ...normalizedLegacyDiagnostics, ...normalizedRetrievalDiagnostics }
    : normalizedLegacyDiagnostics;
}

function resolveRetrievalDiagnostics(result: unknown): Record<string, unknown> | undefined {
  const diagnostics = (result as { diagnostics?: unknown }).diagnostics;
  return isRecord(diagnostics) ? diagnostics : undefined;
}

function isHybridRetrievalDiagnostics(value: unknown): boolean {
  return HybridRetrievalDiagnosticsSchema.safeParse(value).success;
}

function isHealthCheckProvider(value: KnowledgeSearchService): value is KnowledgeSearchService & {
  healthCheck: () => Promise<{ status: 'healthy' | 'degraded'; message?: string }>;
} {
  return typeof (value as { healthCheck?: unknown }).healthCheck === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
