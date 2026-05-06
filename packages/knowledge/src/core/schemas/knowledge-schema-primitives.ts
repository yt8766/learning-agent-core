import { z } from 'zod';

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema)
  ])
);
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

export const KnowledgeBaseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(['private', 'workspace', 'public']),
  status: z.enum(['active', 'disabled', 'archived']),
  documentCount: z.number(),
  chunkCount: z.number(),
  readyDocumentCount: z.number(),
  failedDocumentCount: z.number(),
  latestEvalScore: z.number().optional(),
  latestQuestionCount: z.number().optional(),
  latestTraceAt: z.string().optional(),
  defaultRetrievalConfigId: z.string().optional(),
  defaultPromptTemplateId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProviderHealthSchema = z.object({
  providerId: z.string(),
  status: z.enum(['healthy', 'degraded', 'unknown']),
  checkedAt: z.string(),
  latencyMs: z.number().optional(),
  message: z.string().optional()
});

export const KnowledgeProviderHealthStatusSchema = z.enum(['ok', 'degraded', 'unconfigured']);

export const KnowledgeBaseHealthStatusSchema = z.enum(['ready', 'indexing', 'degraded', 'empty', 'error']);

export const KnowledgeBaseHealthSchema = z
  .object({
    knowledgeBaseId: z.string().min(1),
    status: KnowledgeBaseHealthStatusSchema,
    documentCount: z.number().int().nonnegative(),
    searchableDocumentCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    failedJobCount: z.number().int().nonnegative(),
    lastIndexedAt: z.string().datetime().optional(),
    lastQueriedAt: z.string().datetime().optional(),
    providerHealth: z
      .object({
        embedding: KnowledgeProviderHealthStatusSchema,
        vector: KnowledgeProviderHealthStatusSchema,
        keyword: KnowledgeProviderHealthStatusSchema,
        generation: KnowledgeProviderHealthStatusSchema
      })
      .strict(),
    warnings: z
      .array(
        z
          .object({
            code: z.string().min(1),
            message: z.string().min(1)
          })
          .strict()
      )
      .default([])
  })
  .strict();

export const KnowledgeIngestionStageSchema = z.enum([
  'uploaded',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
  'succeeded',
  'failed',
  'cancelled'
]);

export const KnowledgeIngestionJobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export const KnowledgeIngestionJobProjectionSchema = z
  .object({
    id: z.string().min(1),
    documentId: z.string().min(1),
    stage: KnowledgeIngestionStageSchema,
    status: KnowledgeIngestionJobStatusSchema,
    progress: z
      .object({
        percent: z.number().min(0).max(100),
        processedChunks: z.number().int().nonnegative().optional(),
        totalChunks: z.number().int().nonnegative().optional()
      })
      .strict(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean(),
        stage: KnowledgeIngestionStageSchema
      })
      .strict()
      .optional(),
    attempts: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional()
  })
  .strict();

export const KnowledgeTokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional()
  })
  .strict();

export const KnowledgeUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1).optional(),
    avatarUrl: z.string().url().optional(),
    currentWorkspaceId: z.string().min(1).optional(),
    roles: z.array(z.string().min(1)).default([]),
    permissions: z.array(z.string().min(1))
  })
  .strict();

export const KnowledgeAuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  refreshExpiresIn: z.number().int().positive()
});

export const KnowledgeAuthSessionSchema = z
  .object({
    user: KnowledgeUserSchema,
    tokens: KnowledgeAuthTokensSchema
  })
  .strict();

export const KnowledgeRefreshSessionSchema = z
  .object({
    tokens: KnowledgeAuthTokensSchema
  })
  .strict();

export const KnowledgeVectorSearchFiltersSchema = z
  .object({
    documentIds: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    metadata: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeVectorSearchRequestSchema = z
  .object({
    knowledgeBaseId: z.string().min(1),
    query: z.string().min(1).optional(),
    embedding: z.array(z.number()).min(1),
    topK: z.number().int().positive(),
    filters: KnowledgeVectorSearchFiltersSchema.optional()
  })
  .strict();
