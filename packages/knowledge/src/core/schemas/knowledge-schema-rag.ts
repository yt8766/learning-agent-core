import { z } from 'zod';

import { KnowledgeTokenUsageSchema } from './knowledge-schema-primitives';

export const KnowledgeCitationSchema = z
  .object({
    chunkId: z.string().min(1),
    documentId: z.string().min(1),
    title: z.string().min(1).optional(),
    score: z.number().min(0).max(1).optional(),
    text: z.string().min(1).optional(),
    quote: z.string().min(1).optional()
  })
  .strict();

export const KnowledgeRagRouteReasonSchema = z.enum(['mentions', 'metadata-match', 'fallback-all', 'legacy-ids']);

export const KnowledgeRetrievalModeSchema = z.enum(['keyword-only', 'vector-only', 'hybrid', 'none']);

export const KnowledgeRagRouteSchema = z
  .object({
    requestedMentions: z.array(z.string().min(1)).default([]),
    selectedKnowledgeBaseIds: z.array(z.string().min(1)).default([]),
    reason: KnowledgeRagRouteReasonSchema
  })
  .strict();

export const KnowledgeRagDiagnosticsSchema = z
  .object({
    normalizedQuery: z.string().min(1),
    queryVariants: z.array(z.string().min(1)).default([]),
    retrievalMode: KnowledgeRetrievalModeSchema,
    hitCount: z.number().int().nonnegative(),
    contextChunkCount: z.number().int().nonnegative()
  })
  .strict();

export const KnowledgeRagAnswerSchema = z
  .object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    messageId: z.string().min(1),
    answer: z.string().min(1),
    citations: z.array(KnowledgeCitationSchema).default([]),
    usage: KnowledgeTokenUsageSchema.optional(),
    route: KnowledgeRagRouteSchema.optional(),
    diagnostics: KnowledgeRagDiagnosticsSchema.optional(),
    traceId: z.string().min(1).optional()
  })
  .strict();
