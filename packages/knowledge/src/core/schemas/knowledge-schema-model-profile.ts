import { z } from 'zod';

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
