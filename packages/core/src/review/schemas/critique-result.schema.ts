import { z } from 'zod/v4';

export const CritiqueResultSchema = z.object({
  contractVersion: z.literal('critique-result.v1'),
  decision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']),
  summary: z.string().trim().min(1),
  blockingIssues: z.array(z.string().trim().min(1)).optional(),
  constraints: z.array(z.string().trim().min(1)).optional(),
  evidenceRefs: z.array(z.string().trim().min(1)).optional(),
  shouldBlockEarly: z.boolean().optional()
});
