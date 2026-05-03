import { z } from 'zod';

import { JsonObjectSchema } from './knowledge-schema-primitives';

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

export const KnowledgeErrorResponseSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    traceId: z.string().min(1).optional(),
    details: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeTraceOperationSchema = z.enum(['ingestion.document', 'rag.chat', 'eval.run', 'provider.health']);

export const KnowledgeTraceStatusSchema = z.enum(['running', 'succeeded', 'failed', 'canceled']);

export const KnowledgeWorkbenchTraceStatusSchema = z.enum(['ok', 'error', 'cancelled']);

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

export const KnowledgeWorkbenchSpanNameSchema = z.enum([
  'route',
  'parse',
  'chunk',
  'embed',
  'index',
  'retrieve',
  'rerank',
  'assemble-context',
  'generate',
  'evaluate'
]);

export const KnowledgeTraceSpanStatusSchema = z.union([
  KnowledgeTraceStatusSchema,
  KnowledgeWorkbenchTraceStatusSchema
]);

export const KnowledgeTraceSpanSchema = z
  .object({
    spanId: z.string().min(1),
    name: z.union([KnowledgeWorkbenchSpanNameSchema, z.string().min(1)]),
    stage: KnowledgeTraceSpanStageSchema.optional(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    status: KnowledgeTraceSpanStatusSchema.optional(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1)
      })
      .strict()
      .optional(),
    attributes: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeTraceSchema = z
  .object({
    traceId: z.string().min(1),
    requestId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    knowledgeBaseId: z.string().min(1).optional(),
    documentId: z.string().min(1).optional(),
    operation: z.union([KnowledgeTraceOperationSchema, z.string().min(1)]),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    status: z.union([KnowledgeTraceStatusSchema, KnowledgeWorkbenchTraceStatusSchema]),
    spans: z.array(KnowledgeTraceSpanSchema).default([])
  })
  .strict();

export const KnowledgeEvalCaseSchema = z
  .object({
    id: z.string().min(1),
    datasetId: z.string().min(1),
    question: z.string().min(1),
    expectedChunkIds: z.array(z.string().min(1)).optional(),
    expectedDocumentIds: z.array(z.string().min(1)).optional(),
    expectedAnswerNote: z.string().min(1).optional()
  })
  .strict();

export const KnowledgeEvalRunResultSchema = z
  .object({
    runId: z.string().min(1),
    caseId: z.string().min(1),
    answerId: z.string().min(1),
    metrics: z
      .object({
        recallAtK: z.number().min(0).max(1).optional(),
        citationAccuracy: z.number().min(0).max(1).optional(),
        answerRelevance: z.number().min(0).max(1).optional()
      })
      .strict(),
    traceId: z.string().min(1)
  })
  .strict();
