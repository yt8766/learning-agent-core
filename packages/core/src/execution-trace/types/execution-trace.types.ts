import { z } from 'zod';

import {
  ExecutionTraceSchema,
  ExecutionTraceSummaryRecordSchema,
  ExecutionTraceStatusSchema,
  ExecutionTraceTokenUsageSchema,
  ThoughtChainStatusSchema
} from '../schemas/execution-trace.schema';

export type ThoughtChainStatus = z.infer<typeof ThoughtChainStatusSchema>;
export type ExecutionTraceTokenUsage = z.infer<typeof ExecutionTraceTokenUsageSchema>;
export type ExecutionTraceStatus = z.infer<typeof ExecutionTraceStatusSchema>;
export type ExecutionTrace = z.infer<typeof ExecutionTraceSchema>;
export type ExecutionTraceSummaryRecord = z.infer<typeof ExecutionTraceSummaryRecordSchema>;
