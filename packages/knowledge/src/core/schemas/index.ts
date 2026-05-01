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

export const KnowledgeTokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional()
});

export const KnowledgeModelAdapterSchema = z.union([
  z.literal('langchain-chat-openai'),
  z.literal('langchain-openai-embeddings'),
  z.literal('openai-compatible'),
  z.string().min(1)
]);

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
  enabled: z.boolean()
}).strict();

export const KnowledgeModelProfileSchema = z
  .object({
    embedding: KnowledgeModelBindingSchema,
    chat: KnowledgeModelBindingSchema,
    rerank: KnowledgeRerankModelBindingSchema.optional(),
    judge: KnowledgeModelBindingSchema.optional()
  })
  .strict();
