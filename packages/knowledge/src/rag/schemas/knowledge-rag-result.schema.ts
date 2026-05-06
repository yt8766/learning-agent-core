import { z } from 'zod';

import { CitationSchema, RetrievalHitSchema } from '../../contracts';
import { RetrievalDiagnosticsSchema } from '../../runtime/types/retrieval-runtime.types';
import { KnowledgeRagSearchModeSchema } from './knowledge-rag-policy.schema';
import { KnowledgePreRetrievalPlanSchema } from './knowledge-rag-planning.schema';

export const KnowledgeRagErrorCodeSchema = z.enum([
  'planner_failed',
  'retrieval_failed',
  'answer_failed',
  'knowledge_chat_failed',
  'knowledge_permission_denied',
  'rag_model_profile_disabled',
  'rag_model_profile_not_found',
  'cancelled',
  'unknown'
]);

export const KnowledgeRagErrorSchema = z.object({
  code: KnowledgeRagErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean().optional(),
  cause: z.string().optional()
});

export const KnowledgeRagExecutedQuerySchema = z.object({
  query: z.string().min(1),
  mode: z.enum(['vector', 'keyword', 'substring']),
  hitCount: z.number().int().min(0),
  fallbackReason: z.string().min(1).optional()
});

export const KnowledgeRagEffectiveSearchModeSchema = z.enum([
  'vector',
  'keyword',
  'hybrid',
  'fallback-keyword',
  'none'
]);

const countExecutedHits = (
  diagnostics: {
    executedQueries?: Array<{ mode: 'vector' | 'keyword' | 'substring'; hitCount: number }>;
  },
  modes: Array<'vector' | 'keyword' | 'substring'>
) =>
  diagnostics.executedQueries?.some(
    executedQuery => modes.includes(executedQuery.mode) && executedQuery.hitCount > 0
  ) ?? false;

const hasVectorHit = (diagnostics: {
  executedQueries?: Array<{ mode: 'vector' | 'keyword' | 'substring'; hitCount: number }>;
  vectorHitCount?: number;
}) => (diagnostics.vectorHitCount ?? 0) > 0 || countExecutedHits(diagnostics, ['vector']);

const hasKeywordLikeHit = (diagnostics: {
  executedQueries?: Array<{ mode: 'vector' | 'keyword' | 'substring'; hitCount: number }>;
  keywordHitCount?: number;
}) => (diagnostics.keywordHitCount ?? 0) > 0 || countExecutedHits(diagnostics, ['keyword', 'substring']);

const allExecutedQueriesMissed = (diagnostics: {
  executedQueries?: Array<{ mode: 'vector' | 'keyword' | 'substring'; hitCount: number }>;
}) => diagnostics.executedQueries?.every(executedQuery => executedQuery.hitCount === 0) ?? false;

const isEffectiveSearchModeConsistent = (diagnostics: {
  executedQueries?: Array<{ mode: 'vector' | 'keyword' | 'substring'; hitCount: number }>;
  effectiveSearchMode?: 'vector' | 'keyword' | 'hybrid' | 'fallback-keyword' | 'none';
  vectorHitCount?: number;
  keywordHitCount?: number;
  finalHitCount?: number;
}) => {
  switch (diagnostics.effectiveSearchMode) {
    case undefined:
      return true;
    case 'vector':
      return hasVectorHit(diagnostics);
    case 'keyword':
    case 'fallback-keyword':
      return hasKeywordLikeHit(diagnostics);
    case 'hybrid':
      return hasVectorHit(diagnostics) && hasKeywordLikeHit(diagnostics);
    case 'none':
      return diagnostics.finalHitCount === 0 || allExecutedQueriesMissed(diagnostics);
  }
};

export const KnowledgeRagRetrievalDiagnosticsSchema = z
  .object({
    normalizedQuery: z.string().min(1).optional(),
    queryVariants: z.array(z.string().min(1)).optional(),
    executedQueries: z.array(KnowledgeRagExecutedQuerySchema).optional(),
    effectiveSearchMode: KnowledgeRagEffectiveSearchModeSchema.optional(),
    vectorHitCount: z.number().int().min(0).optional(),
    keywordHitCount: z.number().int().min(0).optional(),
    finalHitCount: z.number().int().min(0).optional()
  })
  .strict()
  .refine(diagnostics => Object.keys(diagnostics).length > 0, {
    message: 'At least one retrieval diagnostic field is required'
  })
  .refine(isEffectiveSearchModeConsistent, {
    message: 'effectiveSearchMode must match observed retrieval hits'
  });

export const KnowledgeRagRuntimeRetrievalDiagnosticsSchema = RetrievalDiagnosticsSchema.extend({
  requestedSearchMode: KnowledgeRagSearchModeSchema.optional(),
  effectiveSearchMode: KnowledgeRagEffectiveSearchModeSchema.optional()
});

export const KnowledgeRagRetrievalResultSchema = z.object({
  hits: z.array(RetrievalHitSchema),
  total: z.number().int().nonnegative().optional(),
  citations: z.array(CitationSchema),
  contextBundle: z.string().optional(),
  diagnostics: z
    .union([KnowledgeRagRetrievalDiagnosticsSchema, KnowledgeRagRuntimeRetrievalDiagnosticsSchema])
    .optional()
});

export const KnowledgeRagNoAnswerReasonSchema = z.enum([
  'no_hits',
  'low_confidence',
  'missing_citations',
  'policy_blocked',
  'insufficient_evidence'
]);

export const KnowledgeRagAnswerDiagnosticsSchema = z
  .object({
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    inputTokens: z.number().int().min(0).optional(),
    outputTokens: z.number().int().min(0).optional(),
    durationMs: z.number().min(0).optional(),
    groundedCitationCount: z.number().int().nonnegative().optional(),
    noAnswerReason: KnowledgeRagNoAnswerReasonSchema.optional()
  })
  .strict()
  .refine(diagnostics => Object.keys(diagnostics).length > 0, {
    message: 'At least one answer diagnostic field is required'
  });

export const KnowledgeRagRunAnswerSchema = z.object({
  text: z.string(),
  noAnswer: z.boolean().optional(),
  citations: z.array(CitationSchema),
  diagnostics: KnowledgeRagAnswerDiagnosticsSchema.optional()
});

export const KnowledgeRagRunDiagnosticsSchema = z.object({
  durationMs: z.number().nonnegative(),
  plannerDurationMs: z.number().nonnegative().optional(),
  retrievalDurationMs: z.number().nonnegative().optional(),
  answerDurationMs: z.number().nonnegative().optional()
});

export const KnowledgeRagResultSchema = z.object({
  runId: z.string(),
  plan: KnowledgePreRetrievalPlanSchema,
  retrieval: KnowledgeRagRetrievalResultSchema,
  answer: KnowledgeRagRunAnswerSchema,
  diagnostics: KnowledgeRagRunDiagnosticsSchema,
  error: KnowledgeRagErrorSchema.optional()
});

export type KnowledgeRagErrorCode = z.infer<typeof KnowledgeRagErrorCodeSchema>;
export type KnowledgeRagError = z.infer<typeof KnowledgeRagErrorSchema>;
export type KnowledgeRagExecutedQuery = z.infer<typeof KnowledgeRagExecutedQuerySchema>;
export type KnowledgeRagEffectiveSearchMode = z.infer<typeof KnowledgeRagEffectiveSearchModeSchema>;
export type KnowledgeRagRetrievalDiagnostics = z.infer<typeof KnowledgeRagRetrievalDiagnosticsSchema>;
export type KnowledgeRagRuntimeRetrievalDiagnostics = z.infer<typeof KnowledgeRagRuntimeRetrievalDiagnosticsSchema>;
export type KnowledgeRagRetrievalResult = z.infer<typeof KnowledgeRagRetrievalResultSchema>;
export type KnowledgeRagNoAnswerReason = z.infer<typeof KnowledgeRagNoAnswerReasonSchema>;
export type KnowledgeRagAnswerDiagnostics = z.infer<typeof KnowledgeRagAnswerDiagnosticsSchema>;
export type KnowledgeRagRunAnswer = z.infer<typeof KnowledgeRagRunAnswerSchema>;
export type KnowledgeRagRunDiagnostics = z.infer<typeof KnowledgeRagRunDiagnosticsSchema>;
export type KnowledgeRagResult = z.infer<typeof KnowledgeRagResultSchema>;
