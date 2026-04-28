import { z } from 'zod';

export const ResolutionCandidateRecordSchema = z.object({
  id: z.string(),
  conflictKind: z.enum(['semantic_conflict', 'scope_conflict', 'entity_conflict', 'override_conflict']),
  challengerId: z.string(),
  incumbentId: z.string(),
  suggestedAction: z.enum(['keep_incumbent', 'supersede_existing', 'merge_both', 'escalate_human_review']),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  requiresHumanReview: z.boolean().default(false),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  resolution: z.enum(['pending', 'accepted', 'rejected']).default('pending')
});

export type ResolutionCandidateRecord = z.infer<typeof ResolutionCandidateRecordSchema>;
