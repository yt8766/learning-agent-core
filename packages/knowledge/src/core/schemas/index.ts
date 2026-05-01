export * from './knowledge-schema-primitives';
export * from './knowledge-schema-rag';
export * from './knowledge-schema-eval-trace';
export * from './knowledge-schema-model-profile';
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

export const KnowledgeCitationSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  title: z.string().min(1).optional(),
  score: z.number().min(0).max(1).optional(),
  text: z.string().min(1).optional()
});

export const KnowledgeTokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional()
});

export const KnowledgeRagAnswerSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  answer: z.string().min(1),
  citations: z.array(KnowledgeCitationSchema).default([]),
  usage: KnowledgeTokenUsageSchema.optional()
});

export const KnowledgeEvalRunMetricsSchema = z.object({
  recallAtK: z.number().min(0).max(1).optional(),
  precisionAtK: z.number().min(0).max(1).optional(),
  mrr: z.number().min(0).max(1).optional(),
  ndcg: z.number().min(0).max(1).optional(),
  faithfulness: z.number().min(0).max(1).optional(),
  answerRelevance: z.number().min(0).max(1).optional(),
  citationAccuracy: z.number().min(0).max(1).optional()
});

export const KnowledgeEvalRunSchema = z.object({
  id: z.string().min(1),
  datasetId: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  metrics: KnowledgeEvalRunMetricsSchema.default({})
});

export const KnowledgeTraceStatusSchema = z.enum(['running', 'succeeded', 'failed', 'canceled']);

export const KnowledgeTraceSpanStageSchema = z.enum([
  'query_rewrite',
  'embedding',
  'keyword_search',
  'vector_search',
  'hybrid_merge',
  'rerank',
  'context_assembly',
  'generation',
  'citation_check',
  'eval_judge'
]);

export const KnowledgeTraceSpanSchema = z.object({
  spanId: z.string().min(1),
  name: z.string().min(1),
  stage: KnowledgeTraceSpanStageSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  status: KnowledgeTraceStatusSchema.optional(),
  attributes: JsonObjectSchema.optional()
});

export const KnowledgeTraceSchema = z.object({
  traceId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  knowledgeBaseId: z.string().min(1).optional(),
  operation: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  status: KnowledgeTraceStatusSchema,
  spans: z.array(KnowledgeTraceSpanSchema).default([])
});

export const KnowledgeModelAdapterSchema = z.string().min(1);

export const KnowledgeModelBindingSchema = z
  .object({
    providerId: z.string().min(1),
    adapter: KnowledgeModelAdapterSchema,
    model: z.string().min(1),
    baseUrl: z.string().url().optional(),
    dimensions: z.number().int().positive().optional()
  })
  .strict();

export const KnowledgeRerankModelBindingSchema = KnowledgeModelBindingSchema.extend({
  enabled: z.boolean().default(true)
}).strict();

export const KnowledgeModelProfileSchema = z
  .object({
    embedding: KnowledgeModelBindingSchema,
    chat: KnowledgeModelBindingSchema,
    rerank: KnowledgeRerankModelBindingSchema.optional()
  })
  .strict();
