import type { z } from 'zod';

import type {
  JsonObjectSchema,
  JsonValueSchema,
  KnowledgeAuthTokensSchema,
  KnowledgeRefreshSessionSchema,
  KnowledgeAuthSessionSchema,
  KnowledgeBaseSchema,
  KnowledgeCitationSchema,
  KnowledgeEvalRunMetricsSchema,
  KnowledgeEvalRunSchema,
  KnowledgeModelAdapterSchema,
  KnowledgeModelBindingSchema,
  KnowledgeModelProfileSchema,
  KnowledgeRagAnswerSchema,
  KnowledgeRerankModelBindingSchema,
  KnowledgeTokenUsageSchema,
  KnowledgeTraceSchema,
  KnowledgeTraceSpanSchema,
  KnowledgeTraceSpanStageSchema,
  KnowledgeTraceStatusSchema,
  KnowledgeUserSchema,
  KnowledgeVectorSearchFiltersSchema,
  KnowledgeVectorSearchRequestSchema,
  ProviderHealthSchema
} from '../schemas';

export type JsonValue = z.infer<typeof JsonValueSchema>;
export type JsonObject = z.infer<typeof JsonObjectSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;
export type KnowledgeUser = z.infer<typeof KnowledgeUserSchema>;
export type KnowledgeAuthTokens = z.infer<typeof KnowledgeAuthTokensSchema>;
export type KnowledgeAuthSession = z.infer<typeof KnowledgeAuthSessionSchema>;
export type KnowledgeRefreshSession = z.infer<typeof KnowledgeRefreshSessionSchema>;
export type KnowledgeVectorSearchFilters = z.infer<typeof KnowledgeVectorSearchFiltersSchema>;
export type KnowledgeVectorSearchRequest = z.infer<typeof KnowledgeVectorSearchRequestSchema>;
export type KnowledgeCitation = z.infer<typeof KnowledgeCitationSchema>;
export type KnowledgeTokenUsage = z.infer<typeof KnowledgeTokenUsageSchema>;
export type KnowledgeRagAnswer = z.infer<typeof KnowledgeRagAnswerSchema>;
export type KnowledgeEvalRunMetrics = z.infer<typeof KnowledgeEvalRunMetricsSchema>;
export type KnowledgeEvalRun = z.infer<typeof KnowledgeEvalRunSchema>;
export type KnowledgeTraceStatus = z.infer<typeof KnowledgeTraceStatusSchema>;
export type KnowledgeTraceSpanStage = z.infer<typeof KnowledgeTraceSpanStageSchema>;
export type KnowledgeTraceSpan = z.infer<typeof KnowledgeTraceSpanSchema>;
export type KnowledgeTrace = z.infer<typeof KnowledgeTraceSchema>;
export type KnowledgeModelAdapter = z.infer<typeof KnowledgeModelAdapterSchema>;
export type KnowledgeModelBinding = z.infer<typeof KnowledgeModelBindingSchema>;
export type KnowledgeRerankModelBinding = z.infer<typeof KnowledgeRerankModelBindingSchema>;
export type KnowledgeModelProfile = z.infer<typeof KnowledgeModelProfileSchema>;
