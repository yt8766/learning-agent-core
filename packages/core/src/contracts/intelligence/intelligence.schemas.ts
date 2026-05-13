import { z } from 'zod/v4';

export const IntelligenceChannelSchema = z.enum([
  'frontend-tech',
  'frontend-security',
  'llm-releases',
  'skills-agent-tools',
  'ai-security',
  'ai-product-platform'
]);

export const IntelligencePrioritySchema = z.enum(['P0', 'P1', 'P2']);
export const IntelligenceConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const IntelligenceStatusSchema = z.enum(['pending', 'confirmed', 'closed']);
export const IntelligenceKnowledgeDecisionSchema = z.enum(['candidate', 'rejected', 'needs_review', 'ingested']);
export const IntelligenceCandidateTypeSchema = z.enum(['knowledge', 'skill_card', 'evidence_only']);
export const IntelligenceReviewStatusSchema = z.enum(['pending', 'approved', 'rejected', 'ingested', 'failed']);
export const IntelligenceSourceGroupSchema = z.enum(['official', 'authority', 'community', 'unknown']);

export const IntelligenceSourceSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().optional(),
  url: z.string().min(1),
  sourceGroup: IntelligenceSourceGroupSchema,
  snippet: z.string().min(1),
  publishedAt: z.string().optional(),
  capturedAt: z.string().min(1)
});

export const IntelligenceSignalSchema = z.object({
  id: z.string().min(1),
  channel: IntelligenceChannelSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: IntelligencePrioritySchema,
  confidence: IntelligenceConfidenceSchema,
  status: IntelligenceStatusSchema,
  firstSeenAt: z.string().min(1),
  lastSeenAt: z.string().min(1),
  sourceCount: z.number().int().nonnegative(),
  knowledgeDecision: IntelligenceKnowledgeDecisionSchema.optional()
});

export const IntelligenceKnowledgeCandidateSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  candidateType: IntelligenceCandidateTypeSchema,
  decision: IntelligenceKnowledgeDecisionSchema,
  decisionReason: z.string().min(1),
  ttlDays: z.number().int().positive().optional(),
  reviewStatus: IntelligenceReviewStatusSchema,
  createdAt: z.string().min(1)
});

export const IntelligenceChannelSummarySchema = z.object({
  channel: IntelligenceChannelSchema,
  label: z.string().min(1),
  lastRunAt: z.string().optional(),
  signalCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  failedQueryCount: z.number().int().nonnegative()
});

export const IntelligenceOverviewProjectionSchema = z.object({
  generatedAt: z.string().min(1),
  channels: z.array(IntelligenceChannelSummarySchema),
  recentSignals: z.array(IntelligenceSignalSchema),
  pendingCandidates: z.array(IntelligenceKnowledgeCandidateSchema)
});
