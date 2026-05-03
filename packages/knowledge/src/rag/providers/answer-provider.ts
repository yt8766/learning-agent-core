import { z } from 'zod';

import { CitationSchema } from '../../contracts';
import { KnowledgeRagJsonValueSchema } from '../schemas/knowledge-rag-planning.schema';
import { KnowledgeRagFallbackPolicySchema, KnowledgeRagSearchModeSchema } from '../schemas/knowledge-rag-policy.schema';

export const KnowledgeAnswerProviderMetadataSchema = z.object({
  planId: z.string(),
  searchMode: KnowledgeRagSearchModeSchema,
  fallbackPolicy: KnowledgeRagFallbackPolicySchema,
  selectedKnowledgeBaseIds: z.array(z.string()),
  retrievalTotal: z.number().int().nonnegative(),
  hitCount: z.number().int().nonnegative(),
  citationCount: z.number().int().nonnegative(),
  extra: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export const KnowledgeAnswerProviderInputSchema = z.object({
  originalQuery: z.string(),
  rewrittenQuery: z.string(),
  contextBundle: z.string(),
  citations: z.array(CitationSchema),
  selectedKnowledgeBaseIds: z.array(z.string()),
  metadata: KnowledgeAnswerProviderMetadataSchema
});

export const KnowledgeAnswerProviderResultSchema = z.object({
  text: z.string(),
  citations: z.array(CitationSchema).optional(),
  metadata: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export const KnowledgeAnswerProviderDeltaSchema = z.object({
  textDelta: z.string().optional(),
  result: KnowledgeAnswerProviderResultSchema.optional(),
  metadata: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export type KnowledgeAnswerProviderMetadata = z.infer<typeof KnowledgeAnswerProviderMetadataSchema>;
export type KnowledgeAnswerProviderInput = z.infer<typeof KnowledgeAnswerProviderInputSchema>;
export type KnowledgeAnswerProviderResult = z.infer<typeof KnowledgeAnswerProviderResultSchema>;
export type KnowledgeAnswerProviderDelta = z.infer<typeof KnowledgeAnswerProviderDeltaSchema>;

export interface KnowledgeAnswerProvider {
  generate(input: KnowledgeAnswerProviderInput): Promise<KnowledgeAnswerProviderResult>;
  stream?(input: KnowledgeAnswerProviderInput): AsyncIterable<KnowledgeAnswerProviderDelta>;
}
