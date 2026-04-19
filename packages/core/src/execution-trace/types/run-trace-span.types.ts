import { z } from 'zod';

import { RunTraceSpanRecordSchema, RunTraceSpanTokenUsageSchema } from '../schemas/run-trace-span.schema';

export type RunTraceSpanTokenUsage = z.infer<typeof RunTraceSpanTokenUsageSchema>;
export type RunTraceSpanRecord = z.infer<typeof RunTraceSpanRecordSchema>;
