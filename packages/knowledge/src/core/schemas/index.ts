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
