import { z } from 'zod';

import { GeneratedMediaBundleSchema } from './company-live-media.schema';

export const CompanyLiveNodeTraceSchema = z.object({
  nodeId: z.string().min(1),
  status: z.enum(['succeeded', 'failed', 'skipped']),
  durationMs: z.number().int().nonnegative(),
  inputSnapshot: z.record(z.string(), z.unknown()),
  outputSnapshot: z.record(z.string(), z.unknown()),
  errorMessage: z.string().optional()
});

export const CompanyLiveGenerateResultSchema = z.object({
  bundle: GeneratedMediaBundleSchema,
  trace: z.array(CompanyLiveNodeTraceSchema)
});

export type CompanyLiveNodeTrace = z.infer<typeof CompanyLiveNodeTraceSchema>;
export type CompanyLiveGenerateResult = z.infer<typeof CompanyLiveGenerateResultSchema>;
