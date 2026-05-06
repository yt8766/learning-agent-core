import { z } from 'zod';

export const KnowledgeRagSearchModeSchema = z.enum(['hybrid', 'vector-only', 'keyword-only']);
export const KnowledgeRagFallbackPolicySchema = z.enum(['selected-only', 'expand-to-top-n', 'search-all-accessible']);
export const KnowledgeRagPlannerFallbackSchema = z.enum(['deterministic', 'embedding', 'search-all-accessible']);
export const KnowledgeRagLowConfidenceFallbackSchema = z.enum([
  'expand-to-top-n',
  'search-all-accessible',
  'ask-clarifying-question'
]);
export const KnowledgeNoAnswerResponseStyleSchema = z.enum([
  'explicit-insufficient-evidence',
  'brief-insufficient-evidence',
  'ask-clarifying-question'
]);

export const KnowledgeNoAnswerPolicySchema = z.object({
  minHitCount: z.number().int().nonnegative(),
  minTopScore: z.number().min(0).max(1).optional(),
  allowAnswerWithoutCitation: z.boolean(),
  responseStyle: KnowledgeNoAnswerResponseStyleSchema
});

export const KnowledgeRagPolicySchema = z.object({
  maxSelectedKnowledgeBases: z.number().int().positive(),
  minPlannerConfidence: z.number().min(0).max(1),
  defaultSearchMode: KnowledgeRagSearchModeSchema,
  fallbackWhenPlannerFails: KnowledgeRagPlannerFallbackSchema,
  fallbackWhenLowConfidence: KnowledgeRagLowConfidenceFallbackSchema,
  maxQueryVariants: z.number().int().positive(),
  retrievalTopK: z.number().int().positive(),
  contextBudgetTokens: z.number().int().positive(),
  requireGroundedCitations: z.boolean(),
  noAnswer: KnowledgeNoAnswerPolicySchema
});

export type KnowledgeRagSearchMode = z.infer<typeof KnowledgeRagSearchModeSchema>;
export type KnowledgeRagFallbackPolicy = z.infer<typeof KnowledgeRagFallbackPolicySchema>;
export type KnowledgeRagPlannerFallback = z.infer<typeof KnowledgeRagPlannerFallbackSchema>;
export type KnowledgeRagLowConfidenceFallback = z.infer<typeof KnowledgeRagLowConfidenceFallbackSchema>;
export type KnowledgeNoAnswerResponseStyle = z.infer<typeof KnowledgeNoAnswerResponseStyleSchema>;
export type KnowledgeNoAnswerPolicy = z.infer<typeof KnowledgeNoAnswerPolicySchema>;
export type KnowledgeRagPolicy = z.infer<typeof KnowledgeRagPolicySchema>;
