import { z } from 'zod/v4';
import { SpecialistFindingSchema } from '@agent/core';

export const ResearchEvidenceSchema = z.object({
  contractVersion: z.literal('research-evidence.v1'),
  summary: z.string().describe('户部整理出的研究摘要'),
  observations: z.array(z.string()).max(5).default([]).describe('本轮研究中最值得执行方关注的观察结论'),
  specialistFinding: SpecialistFindingSchema.omit({
    contractVersion: true,
    source: true,
    stage: true
  })
    .optional()
    .describe('户部对当前主导/支撑专家形成的结构化研究判断')
});

export type ResearchEvidenceOutput = z.infer<typeof ResearchEvidenceSchema>;
