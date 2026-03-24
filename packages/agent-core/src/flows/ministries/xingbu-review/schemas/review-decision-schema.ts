import { z } from 'zod/v4';

export const ReviewDecisionSchema = z.object({
  decision: z.enum(['approved', 'retry', 'blocked']).describe('刑部给出的决策'),
  quality: z.enum(['low', 'medium', 'high']).describe('对本轮结果的质量判断'),
  shouldRetry: z.boolean().describe('是否建议重试'),
  shouldWriteMemory: z.boolean().describe('是否建议沉淀记忆'),
  shouldCreateRule: z.boolean().describe('是否建议沉淀规则'),
  shouldExtractSkill: z.boolean().describe('是否建议沉淀技能候选'),
  notes: z.array(z.string()).min(1).describe('评审备注')
});

export type ReviewDecisionOutput = z.infer<typeof ReviewDecisionSchema>;
