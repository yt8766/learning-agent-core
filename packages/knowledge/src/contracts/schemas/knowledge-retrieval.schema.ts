import { z } from 'zod';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const KnowledgeSourceTypeSchema = z.enum([
  'workspace-docs',
  'repo-docs',
  'connector-manifest',
  'catalog-sync',
  'user-upload',
  'web-curated'
]);

export const KnowledgeTrustClassSchema = z.enum(['official', 'curated', 'community', 'unverified', 'internal']);

const JsonValueSchema = z.custom<JsonValue>(value => isJsonValue(value), {
  message: 'Expected a JSON-safe metadata value'
});

export const KnowledgeChunkMetadataSchema = z
  .object({
    docType: z.string().optional(),
    status: z.string().optional(),
    allowedRoles: z.array(z.string()).optional(),
    parentId: z.string().optional(),
    prevChunkId: z.string().optional(),
    nextChunkId: z.string().optional(),
    sectionId: z.string().optional(),
    sectionTitle: z.string().optional()
  })
  .catchall(JsonValueSchema);

export const KnowledgeRetrievalFiltersSchema = z.object({
  sourceTypes: z.array(KnowledgeSourceTypeSchema).optional(),
  sourceIds: z.array(z.string()).optional(),
  knowledgeBaseIds: z.array(z.string().trim().min(1)).optional(),
  documentIds: z.array(z.string()).optional(),
  minTrustClass: KnowledgeTrustClassSchema.optional(),
  trustClasses: z.array(KnowledgeTrustClassSchema).optional(),
  searchableOnly: z.boolean().optional(),
  docTypes: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  allowedRoles: z.array(z.string()).optional()
});

export const HybridKnowledgeSearchModeSchema = z.enum(['keyword-only', 'vector-only', 'hybrid']);

export const OpenSearchIndexConfigSchema = z.object({
  name: z.string().min(1),
  idField: z.string().min(1),
  textField: z.string().min(1),
  metadataField: z.string().min(1).optional()
});

export const OpenSearchClientConfigSchema = z.object({
  clientRef: z.string().min(1).optional(),
  endpoint: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().positive().optional()
});

export const OpenSearchKnowledgeConfigSchema = z.object({
  index: OpenSearchIndexConfigSchema,
  client: OpenSearchClientConfigSchema
});

export const ChromaCollectionConfigSchema = z.object({
  name: z.string().min(1),
  embeddingDimension: z.number().int().positive().optional(),
  idField: z.string().min(1).optional(),
  documentField: z.string().min(1).optional(),
  metadataField: z.string().min(1).optional()
});

export const ChromaClientConfigSchema = z.object({
  clientRef: z.string().min(1).optional(),
  endpoint: z.string().min(1).optional(),
  tenant: z.string().min(1).optional(),
  database: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().positive().optional()
});

export const ChromaKnowledgeConfigSchema = z.object({
  collection: ChromaCollectionConfigSchema,
  client: ChromaClientConfigSchema
});

export const HybridKnowledgeSearchDiagnosticsConfigSchema = z.object({
  enabled: z.boolean(),
  includeProviderTimings: z.boolean().optional(),
  includeProviderHealth: z.boolean().optional(),
  redactClientEndpoints: z.boolean().optional()
});

export const HybridKnowledgeSearchHealthConfigSchema = z.object({
  enabled: z.boolean(),
  checkOnStartup: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  degradedAfterConsecutiveFailures: z.number().int().positive().optional()
});

export const HybridKnowledgeSearchProductionConfigSchema = z
  .object({
    mode: HybridKnowledgeSearchModeSchema,
    keyword: z
      .object({
        opensearch: OpenSearchKnowledgeConfigSchema
      })
      .optional(),
    vector: z
      .object({
        chroma: ChromaKnowledgeConfigSchema
      })
      .optional(),
    diagnostics: HybridKnowledgeSearchDiagnosticsConfigSchema.optional(),
    health: HybridKnowledgeSearchHealthConfigSchema.optional()
  })
  .superRefine((config, ctx) => {
    if ((config.mode === 'keyword-only' || config.mode === 'hybrid') && !config.keyword) {
      ctx.addIssue({
        code: 'custom',
        path: ['keyword'],
        message: `${config.mode} mode requires keyword OpenSearch configuration`
      });
    }

    if ((config.mode === 'vector-only' || config.mode === 'hybrid') && !config.vector) {
      ctx.addIssue({
        code: 'custom',
        path: ['vector'],
        message: `${config.mode} mode requires vector Chroma configuration`
      });
    }
  });

export const KnowledgeSourceSchema = z.object({
  id: z.string(),
  sourceType: KnowledgeSourceTypeSchema,
  uri: z.string(),
  title: z.string(),
  trustClass: KnowledgeTrustClassSchema,
  version: z.string().optional(),
  updatedAt: z.string()
});

export const KnowledgeChunkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  documentId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  searchable: z.boolean(),
  tokenCount: z.number().int().nonnegative().optional(),
  metadata: KnowledgeChunkMetadataSchema.optional(),
  updatedAt: z.string()
});

export const CitationSchema = z.object({
  sourceId: z.string(),
  chunkId: z.string(),
  title: z.string(),
  uri: z.string(),
  quote: z.string().optional(),
  sourceType: KnowledgeSourceTypeSchema,
  trustClass: KnowledgeTrustClassSchema
});

export const PostRetrievalFilterReasonSchema = z.enum([
  'low-score',
  'duplicate-chunk',
  'duplicate-parent',
  'low-context-value',
  'unsafe-content',
  'conflict-risk'
]);

const PostRetrievalCountSchema = z.number().int().nonnegative();

export const PostRetrievalFilterDiagnosticsSchema = z.object({
  enabled: z.boolean(),
  beforeCount: PostRetrievalCountSchema,
  afterCount: PostRetrievalCountSchema,
  droppedCount: PostRetrievalCountSchema,
  maskedCount: PostRetrievalCountSchema.optional(),
  reasons: z.partialRecord(PostRetrievalFilterReasonSchema, PostRetrievalCountSchema)
});

export const PostRetrievalRankingSignalSchema = z.enum([
  'retrieval-score',
  'authority',
  'recency',
  'context-fit',
  'exact-constraint',
  'semantic-rerank',
  'alignment'
]);

export const PostRetrievalRankingStrategySchema = z.enum([
  'deterministic-signals',
  'deterministic-signals+semantic-rerank'
]);

export const PostRetrievalRankingDiagnosticsSchema = z.object({
  enabled: z.boolean(),
  strategy: PostRetrievalRankingStrategySchema,
  scoredCount: PostRetrievalCountSchema,
  signals: z.array(PostRetrievalRankingSignalSchema)
});

export const PostRetrievalDiversificationStrategySchema = z.enum(['source-parent-section-coverage']);

export const PostRetrievalDiversificationDiagnosticsSchema = z.object({
  enabled: z.boolean(),
  strategy: PostRetrievalDiversificationStrategySchema,
  beforeCount: PostRetrievalCountSchema,
  afterCount: PostRetrievalCountSchema,
  maxPerSource: PostRetrievalCountSchema,
  maxPerParent: PostRetrievalCountSchema
});

export const PostRetrievalDiagnosticsSchema = z.object({
  filtering: PostRetrievalFilterDiagnosticsSchema,
  ranking: PostRetrievalRankingDiagnosticsSchema,
  diversification: PostRetrievalDiversificationDiagnosticsSchema
});

export const RetrievalRequestSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
  filters: KnowledgeRetrievalFiltersSchema.optional(),
  allowedSourceTypes: z.array(KnowledgeSourceTypeSchema).optional(),
  minTrustClass: KnowledgeTrustClassSchema.optional(),
  includeContextWindow: z.boolean().optional()
});

export const RetrievalHitSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  sourceId: z.string(),
  knowledgeBaseId: z.string().optional(),
  title: z.string(),
  uri: z.string(),
  sourceType: KnowledgeSourceTypeSchema,
  trustClass: KnowledgeTrustClassSchema,
  content: z.string(),
  score: z.number(),
  metadata: KnowledgeChunkMetadataSchema.optional(),
  citation: CitationSchema
});

export const RetrievalResultSchema = z.object({
  hits: z.array(RetrievalHitSchema),
  total: z.number().int().nonnegative()
});

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}
