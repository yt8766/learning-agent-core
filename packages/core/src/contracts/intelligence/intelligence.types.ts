import type { z } from 'zod/v4';

import type {
  IntelligenceCandidateTypeSchema,
  IntelligenceChannelSchema,
  IntelligenceChannelSummarySchema,
  IntelligenceConfidenceSchema,
  IntelligenceKnowledgeCandidateSchema,
  IntelligenceKnowledgeDecisionSchema,
  IntelligenceOverviewProjectionSchema,
  IntelligencePrioritySchema,
  IntelligenceReviewStatusSchema,
  IntelligenceSignalSchema,
  IntelligenceSourceGroupSchema,
  IntelligenceSourceSchema,
  IntelligenceStatusSchema
} from './intelligence.schemas';

export type IntelligenceChannel = z.infer<typeof IntelligenceChannelSchema>;
export type IntelligencePriority = z.infer<typeof IntelligencePrioritySchema>;
export type IntelligenceConfidence = z.infer<typeof IntelligenceConfidenceSchema>;
export type IntelligenceStatus = z.infer<typeof IntelligenceStatusSchema>;
export type IntelligenceKnowledgeDecision = z.infer<typeof IntelligenceKnowledgeDecisionSchema>;
export type IntelligenceCandidateType = z.infer<typeof IntelligenceCandidateTypeSchema>;
export type IntelligenceReviewStatus = z.infer<typeof IntelligenceReviewStatusSchema>;
export type IntelligenceSourceGroup = z.infer<typeof IntelligenceSourceGroupSchema>;
export type IntelligenceSource = z.infer<typeof IntelligenceSourceSchema>;
export type IntelligenceSignal = z.infer<typeof IntelligenceSignalSchema>;
export type IntelligenceKnowledgeCandidate = z.infer<typeof IntelligenceKnowledgeCandidateSchema>;
export type IntelligenceChannelSummary = z.infer<typeof IntelligenceChannelSummarySchema>;
export type IntelligenceOverviewProjection = z.infer<typeof IntelligenceOverviewProjectionSchema>;
