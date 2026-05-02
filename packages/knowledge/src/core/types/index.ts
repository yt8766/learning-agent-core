import type { z } from 'zod';

import type {
  JsonObjectSchema,
  JsonValueSchema,
  KnowledgeAuthSessionSchema,
  KnowledgeAuthTokensSchema,
  KnowledgeBaseHealthSchema,
  KnowledgeBaseHealthStatusSchema,
  KnowledgeBaseSchema,
  KnowledgeCitationSchema,
  KnowledgeErrorResponseSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalRunResultSchema,
  KnowledgeEvalRunMetricsSchema,
  KnowledgeEvalRunSchema,
  KnowledgeIngestionJobProjectionSchema,
  KnowledgeIngestionJobStatusSchema,
  KnowledgeIngestionStageSchema,
  KnowledgeModelAdapterSchema,
  KnowledgeModelBindingSchema,
  KnowledgeModelProfileSchema,
  KnowledgeProviderHealthStatusSchema,
  KnowledgeRagAnswerSchema,
  KnowledgeRagDiagnosticsSchema,
  KnowledgeRagRouteReasonSchema,
  KnowledgeRagRouteSchema,
  KnowledgeRefreshSessionSchema,
  KnowledgeRerankModelBindingSchema,
  KnowledgeRetrievalModeSchema,
  KnowledgeTokenUsageSchema,
  KnowledgeTraceOperationSchema,
  KnowledgeTraceSchema,
  KnowledgeTraceSpanSchema,
  KnowledgeTraceSpanStageSchema,
  KnowledgeTraceSpanStatusSchema,
  KnowledgeTraceStatusSchema,
  KnowledgeUserSchema,
  KnowledgeVectorSearchFiltersSchema,
  KnowledgeVectorSearchRequestSchema,
  KnowledgeWorkbenchSpanNameSchema,
  KnowledgeWorkbenchTraceStatusSchema,
  ProviderHealthSchema
} from '../schemas';

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;
export type KnowledgeProviderHealthStatus = z.infer<typeof KnowledgeProviderHealthStatusSchema>;
export type KnowledgeBaseHealthStatus = z.infer<typeof KnowledgeBaseHealthStatusSchema>;
export type KnowledgeBaseHealth = z.infer<typeof KnowledgeBaseHealthSchema>;
export type KnowledgeIngestionStage = z.infer<typeof KnowledgeIngestionStageSchema>;
export type KnowledgeIngestionJobStatus = z.infer<typeof KnowledgeIngestionJobStatusSchema>;
export type KnowledgeIngestionJobProjection = z.infer<typeof KnowledgeIngestionJobProjectionSchema>;
export type KnowledgeUser = z.infer<typeof KnowledgeUserSchema>;
export type KnowledgeAuthTokens = z.infer<typeof KnowledgeAuthTokensSchema>;
export type KnowledgeAuthSession = z.infer<typeof KnowledgeAuthSessionSchema>;
export type KnowledgeRefreshSession = z.infer<typeof KnowledgeRefreshSessionSchema>;
export type KnowledgeVectorSearchFilters = z.infer<typeof KnowledgeVectorSearchFiltersSchema>;
export type KnowledgeVectorSearchRequest = z.infer<typeof KnowledgeVectorSearchRequestSchema>;
export type KnowledgeCitation = z.infer<typeof KnowledgeCitationSchema>;
export type KnowledgeRagRouteReason = z.infer<typeof KnowledgeRagRouteReasonSchema>;
export type KnowledgeRetrievalMode = z.infer<typeof KnowledgeRetrievalModeSchema>;
export type KnowledgeRagRoute = z.infer<typeof KnowledgeRagRouteSchema>;
export type KnowledgeRagDiagnostics = z.infer<typeof KnowledgeRagDiagnosticsSchema>;
export type KnowledgeRagAnswer = z.infer<typeof KnowledgeRagAnswerSchema>;
export type KnowledgeEvalRunMetrics = z.infer<typeof KnowledgeEvalRunMetricsSchema>;
export type KnowledgeEvalRun = z.infer<typeof KnowledgeEvalRunSchema>;
export type KnowledgeErrorResponse = z.infer<typeof KnowledgeErrorResponseSchema>;
export type KnowledgeTraceOperation = z.infer<typeof KnowledgeTraceOperationSchema>;
export type KnowledgeTraceStatus = z.infer<typeof KnowledgeTraceStatusSchema>;
export type KnowledgeWorkbenchTraceStatus = z.infer<typeof KnowledgeWorkbenchTraceStatusSchema>;
export type KnowledgeTraceSpanStage = z.infer<typeof KnowledgeTraceSpanStageSchema>;
export type KnowledgeWorkbenchSpanName = z.infer<typeof KnowledgeWorkbenchSpanNameSchema>;
export type KnowledgeTraceSpanStatus = z.infer<typeof KnowledgeTraceSpanStatusSchema>;
export type KnowledgeTraceSpan = z.infer<typeof KnowledgeTraceSpanSchema>;
export type KnowledgeTrace = z.infer<typeof KnowledgeTraceSchema>;
export type KnowledgeEvalCase = z.infer<typeof KnowledgeEvalCaseSchema>;
export type KnowledgeEvalRunResult = z.infer<typeof KnowledgeEvalRunResultSchema>;
export type KnowledgeModelAdapter = z.infer<typeof KnowledgeModelAdapterSchema>;
export type KnowledgeModelBinding = z.infer<typeof KnowledgeModelBindingSchema>;
export type KnowledgeRerankModelBinding = z.infer<typeof KnowledgeRerankModelBindingSchema>;
export type KnowledgeModelProfile = z.infer<typeof KnowledgeModelProfileSchema>;
export type KnowledgeTokenUsage = z.infer<typeof KnowledgeTokenUsageSchema>;
