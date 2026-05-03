import { z } from 'zod';

import { KnowledgeRagFallbackPolicySchema, KnowledgeRagSearchModeSchema } from './knowledge-rag-policy.schema';

export type KnowledgeRagJsonValue =
  | string
  | number
  | boolean
  | null
  | KnowledgeRagJsonValue[]
  | { [key: string]: KnowledgeRagJsonValue };

function isJsonValue(value: unknown): value is KnowledgeRagJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
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

export const KnowledgeRagJsonValueSchema = z.custom<KnowledgeRagJsonValue>(isJsonValue, {
  message: 'Expected a JSON-serializable value'
});

export const KnowledgeBaseRoutingCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  documentCount: z.number().int().nonnegative(),
  recentDocumentTitles: z.array(z.string()).default([]),
  domainSummary: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export const KnowledgeBaseRoutingDecisionSourceSchema = z.enum(['llm', 'deterministic', 'embedding', 'fallback']);

export const KnowledgeBaseRoutingDecisionSchema = z.object({
  knowledgeBaseId: z.string(),
  selected: z.boolean(),
  source: KnowledgeBaseRoutingDecisionSourceSchema,
  reason: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  score: z.number().optional()
});

export const KnowledgeRetrievalStrategyHintsSchema = z.object({
  searchMode: KnowledgeRagSearchModeSchema.optional(),
  topK: z.number().int().positive().optional(),
  contextBudgetTokens: z.number().int().positive().optional(),
  requiredTags: z.array(z.string()).optional(),
  excludedKnowledgeBaseIds: z.array(z.string()).optional()
});

export const KnowledgePlanningDiagnosticsSchema = z.object({
  planner: z.enum(['llm', 'deterministic', 'embedding', 'fallback']),
  consideredKnowledgeBaseCount: z.number().int().nonnegative(),
  rewriteApplied: z.boolean(),
  fallbackApplied: z.boolean(),
  fallbackReason: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), KnowledgeRagJsonValueSchema).optional()
});

export const KnowledgePreRetrievalPlanSchema = z.object({
  id: z.string(),
  originalQuery: z.string(),
  rewrittenQuery: z.string().optional(),
  queryVariants: z.array(z.string()).default([]),
  selectedKnowledgeBaseIds: z.array(z.string()),
  searchMode: KnowledgeRagSearchModeSchema,
  selectionReason: z.string(),
  confidence: z.number().min(0).max(1),
  fallbackPolicy: KnowledgeRagFallbackPolicySchema,
  routingDecisions: z.array(KnowledgeBaseRoutingDecisionSchema).default([]),
  strategyHints: KnowledgeRetrievalStrategyHintsSchema.optional(),
  diagnostics: KnowledgePlanningDiagnosticsSchema
});

export type KnowledgeBaseRoutingCandidate = z.infer<typeof KnowledgeBaseRoutingCandidateSchema>;
export type KnowledgeBaseRoutingDecisionSource = z.infer<typeof KnowledgeBaseRoutingDecisionSourceSchema>;
export type KnowledgeBaseRoutingDecision = z.infer<typeof KnowledgeBaseRoutingDecisionSchema>;
export type KnowledgeRetrievalStrategyHints = z.infer<typeof KnowledgeRetrievalStrategyHintsSchema>;
export type KnowledgePlanningDiagnostics = z.infer<typeof KnowledgePlanningDiagnosticsSchema>;
export type KnowledgePreRetrievalPlan = z.infer<typeof KnowledgePreRetrievalPlanSchema>;
