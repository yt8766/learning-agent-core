import { z } from 'zod';

export const ThoughtChainStatusSchema = z.enum(['loading', 'success', 'error', 'abort']);

export const ExecutionTraceSummaryRecordSchema = z.object({
  freshnessSourceSummary: z.string().optional(),
  citationSourceSummary: z.string().optional()
});
