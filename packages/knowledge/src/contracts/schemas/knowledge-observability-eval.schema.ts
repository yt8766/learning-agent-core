import { z } from 'zod';

import { CitationSchema } from './knowledge-retrieval.schema';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const JsonValueSchema = z.custom<JsonValue>(value => isJsonValue(value), {
  message: 'Expected a JSON-safe observability value'
});

const JsonObjectSchema = z.record(z.string().min(1), JsonValueSchema).superRefine((attributes, ctx) => {
  for (const key of collectSensitiveAttributePaths(attributes)) {
    if (isSensitiveAttributeKey(key)) {
      ctx.addIssue({
        code: 'custom',
        path: key.split('.'),
        message: 'Trace attributes must not include raw secret-bearing keys'
      });
    }
  }
});

export const KnowledgeRagEventNameSchema = z.enum([
  'runtime.query.receive',
  'runtime.query.preprocess',
  'runtime.retrieval.start',
  'runtime.retrieval.complete',
  'runtime.post_retrieval.select',
  'runtime.context_assembly.complete',
  'runtime.generation.complete',
  'runtime.run.fail',
  'indexing.run.start',
  'indexing.load.complete',
  'indexing.chunk.complete',
  'indexing.embed.complete',
  'indexing.store.complete',
  'indexing.run.fail'
]);

export const KnowledgeRagTraceOperationSchema = z.enum([
  'indexing.run',
  'retrieval.run',
  'generation.run',
  'rag.run',
  'eval.sample'
]);

export const KnowledgeRagTraceStatusSchema = z.enum(['running', 'succeeded', 'failed', 'canceled']);

export const KnowledgeRagTraceRetrievalModeSchema = z.enum(['keyword-only', 'vector-only', 'hybrid', 'none']);

export const KnowledgeRagEventStageSchema = z.enum([
  'indexing',
  'pre-retrieval',
  'retrieval',
  'post-retrieval',
  'context-assembly',
  'generation',
  'eval'
]);

export const KnowledgeRagFeedbackLabelSchema = z.enum([
  'positive',
  'negative',
  'grounded',
  'ungrounded',
  'irrelevant',
  'no-answer-correct',
  'no-answer-incorrect'
]);

export const KnowledgeRagFeedbackSourceSchema = z.enum(['user', 'evaluator', 'system']);

export const KnowledgeRagQuerySnapshotSchema = z
  .object({
    text: z.string().min(1),
    normalizedText: z.string().min(1).optional(),
    variants: z.array(z.string().min(1)).optional()
  })
  .strict();

export const KnowledgeRagTraceSelectionTraceEntrySchema = z
  .object({
    chunkId: z.string().min(1),
    sourceId: z.string().min(1),
    selected: z.boolean(),
    stage: z.string().min(1),
    reason: z.string().min(1),
    score: z.number().optional(),
    order: z.number().int().nonnegative().optional()
  })
  .strict();

export const KnowledgeRagTraceRetrievalDiagnosticsSchema = z
  .object({
    retrievalMode: KnowledgeRagTraceRetrievalModeSchema.optional(),
    enabledRetrievers: z.array(z.enum(['keyword', 'vector'])).optional(),
    failedRetrievers: z.array(z.enum(['keyword', 'vector'])).optional(),
    fusionStrategy: z.string().min(1).optional(),
    candidateCount: z.number().int().nonnegative().optional(),
    selectedCount: z.number().int().nonnegative().optional(),
    latencyMs: z.number().nonnegative().optional(),
    warnings: z.array(z.string().min(1)).optional(),
    dropReasons: z.record(z.string(), z.number().int().nonnegative()).optional(),
    selectionTrace: z.array(KnowledgeRagTraceSelectionTraceEntrySchema).optional()
  })
  .strict();

export const KnowledgeRagRetrievalHitSnapshotSchema = z
  .object({
    chunkId: z.string().min(1),
    documentId: z.string().min(1),
    sourceId: z.string().min(1),
    knowledgeBaseId: z.string().min(1).optional(),
    rank: z.number().int().positive().optional(),
    score: z.number().optional(),
    title: z.string().min(1).optional(),
    uri: z.string().min(1).optional(),
    citation: CitationSchema.optional()
  })
  .strict();

export const KnowledgeRagRetrievalSnapshotSchema = z
  .object({
    requestedTopK: z.number().int().positive().optional(),
    hits: z.array(KnowledgeRagRetrievalHitSnapshotSchema).default([]),
    citations: z.array(CitationSchema).default([]),
    diagnostics: KnowledgeRagTraceRetrievalDiagnosticsSchema.optional()
  })
  .strict();

export const KnowledgeRagGenerationSnapshotSchema = z
  .object({
    answerId: z.string().min(1).optional(),
    answerText: z.string().optional(),
    citedChunkIds: z.array(z.string().min(1)).optional(),
    groundedCitationRate: z.number().min(0).max(1).optional()
  })
  .strict();

export const KnowledgeRagIndexingSnapshotSchema = z
  .object({
    knowledgeBaseId: z.string().min(1).optional(),
    documentId: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    loadedDocumentCount: z.number().int().nonnegative().optional(),
    chunkCount: z.number().int().nonnegative().optional(),
    embeddedChunkCount: z.number().int().nonnegative().optional(),
    storedChunkCount: z.number().int().nonnegative().optional()
  })
  .strict();

export const KnowledgeRagFeedbackSchema = z
  .object({
    label: KnowledgeRagFeedbackLabelSchema,
    source: KnowledgeRagFeedbackSourceSchema,
    userId: z.string().min(1).optional(),
    comment: z.string().min(1).optional()
  })
  .strict();

export const KnowledgeRagErrorRecordSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean().optional(),
    stage: KnowledgeRagEventStageSchema.optional()
  })
  .strict();

export const KnowledgeRagMetricUnitSchema = z.enum(['ms', 'count', 'tokens', 'ratio', 'bytes']);

export const KnowledgeRagMetricSchema = z
  .object({
    traceId: z.string().min(1),
    name: z.string().min(1),
    value: z.number().finite(),
    unit: KnowledgeRagMetricUnitSchema.optional(),
    stage: KnowledgeRagEventStageSchema.optional(),
    attributes: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeRagEventSchema = z
  .object({
    eventId: z.string().min(1),
    traceId: z.string().min(1),
    parentEventId: z.string().min(1).optional(),
    name: KnowledgeRagEventNameSchema,
    stage: KnowledgeRagEventStageSchema,
    occurredAt: z.string().datetime(),
    query: KnowledgeRagQuerySnapshotSchema.optional(),
    retrieval: KnowledgeRagRetrievalSnapshotSchema.optional(),
    generation: KnowledgeRagGenerationSnapshotSchema.optional(),
    indexing: KnowledgeRagIndexingSnapshotSchema.optional(),
    diagnostics: KnowledgeRagTraceRetrievalDiagnosticsSchema.optional(),
    feedback: KnowledgeRagFeedbackSchema.optional(),
    error: KnowledgeRagErrorRecordSchema.optional(),
    attributes: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeRagTraceSchema = z
  .object({
    traceId: z.string().min(1),
    runId: z.string().min(1).optional(),
    operation: KnowledgeRagTraceOperationSchema,
    status: KnowledgeRagTraceStatusSchema,
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    query: KnowledgeRagQuerySnapshotSchema.optional(),
    events: z.array(KnowledgeRagEventSchema).default([]),
    retrieval: KnowledgeRagRetrievalSnapshotSchema.optional(),
    generation: KnowledgeRagGenerationSnapshotSchema.optional(),
    indexing: KnowledgeRagIndexingSnapshotSchema.optional(),
    diagnostics: KnowledgeRagTraceRetrievalDiagnosticsSchema.optional(),
    feedback: KnowledgeRagFeedbackSchema.optional(),
    metrics: z.array(KnowledgeRagMetricSchema).optional(),
    attributes: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeEvalExpectedAnswerSchema = z
  .object({
    chunkIds: z.array(z.string().min(1)).default([]),
    documentIds: z.array(z.string().min(1)).default([]),
    citations: z.array(CitationSchema).default([]),
    answerFacts: z.array(z.string().min(1)).default([]),
    noAnswer: z.boolean().optional()
  })
  .strict();

export const KnowledgeEvalObservedAnswerSchema = z
  .object({
    retrievalHits: z.array(KnowledgeRagRetrievalHitSnapshotSchema).default([]),
    citations: z.array(CitationSchema).default([]),
    answerText: z.string().optional(),
    diagnostics: KnowledgeRagTraceRetrievalDiagnosticsSchema.optional()
  })
  .strict();

export const KnowledgeEvalSampleSchema = z
  .object({
    sampleId: z.string().min(1),
    datasetId: z.string().min(1).optional(),
    traceId: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    query: KnowledgeRagQuerySnapshotSchema,
    expected: KnowledgeEvalExpectedAnswerSchema,
    observed: KnowledgeEvalObservedAnswerSchema.optional(),
    feedback: KnowledgeRagFeedbackSchema.optional(),
    attributes: JsonObjectSchema.optional()
  })
  .strict();

export const KnowledgeEvalMetricSummarySchema = z
  .object({
    sampleCount: z.number().int().nonnegative(),
    topK: z.number().int().positive().optional(),
    recallAtK: z.number().min(0).max(1).optional(),
    mrr: z.number().min(0).max(1).optional(),
    emptyRetrievalRate: z.number().min(0).max(1).optional(),
    groundedCitationRate: z.number().min(0).max(1).optional(),
    noAnswerAccuracy: z.number().min(0).max(1).optional()
  })
  .strict();

function isSensitiveAttributeKey(key: string): boolean {
  return /secret|token|password|authorization|api[-_]?key/i.test(key);
}

function collectSensitiveAttributePaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectSensitiveAttributePaths(item, `${prefix}.${index}`));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...collectSensitiveAttributePaths(child, path)];
  });
}

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
