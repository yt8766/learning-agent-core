import { z } from 'zod/v4';

export const DeliverySummarySchema = z.object({
  finalAnswer: z.string().describe('礼部整理给用户的最终交付答复')
});

export type DeliverySummaryOutput = z.infer<typeof DeliverySummarySchema>;
