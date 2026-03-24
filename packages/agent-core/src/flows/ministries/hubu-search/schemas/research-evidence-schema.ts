import { z } from 'zod/v4';

export const ResearchEvidenceSchema = z.object({
  summary: z.string().describe('户部整理出的研究摘要'),
  observations: z.array(z.string()).max(5).default([]).describe('本轮研究中最值得执行方关注的观察结论')
});

export type ResearchEvidenceOutput = z.infer<typeof ResearchEvidenceSchema>;
