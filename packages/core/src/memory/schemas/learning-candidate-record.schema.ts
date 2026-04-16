import { z } from 'zod';

export const LearningCandidateRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  type: z.enum(['memory', 'rule', 'skill', 'profile_patch', 'override', 'reflection']),
  summary: z.string(),
  status: z.enum(['pending_confirmation', 'confirmed', 'resolved', 'rejected']),
  payload: z.record(z.string(), z.unknown()),
  confidenceScore: z.number().min(0).max(1).optional(),
  provenance: z.array(z.record(z.string(), z.unknown())).optional(),
  autoConfirmEligible: z.boolean().optional(),
  createdAt: z.string(),
  confirmedAt: z.string().optional(),
  resolvedAt: z.string().optional()
});

export type LearningCandidateRecord = z.infer<typeof LearningCandidateRecordSchema>;
