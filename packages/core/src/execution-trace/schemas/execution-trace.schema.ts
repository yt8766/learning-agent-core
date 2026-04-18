import { z } from 'zod';

export const ThoughtChainStatusSchema = z.enum(['loading', 'success', 'error', 'abort']);

export const ExecutionTraceTokenUsageSchema = z.object({
  prompt: z.number().optional(),
  completion: z.number().optional(),
  total: z.number().optional()
});

export const ExecutionTraceStatusSchema = z.enum(['success', 'timeout', 'rejected', 'running', 'failed']);

export const ExecutionTraceSchema = z.object({
  node: z.string(),
  at: z.string(),
  summary: z.string(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),
  specialistId: z.string().optional(),
  role: z.string().optional(),
  latencyMs: z.number().optional(),
  tokenUsage: ExecutionTraceTokenUsageSchema.optional(),
  status: ExecutionTraceStatusSchema.optional(),
  revisionCount: z.number().optional(),
  modelUsed: z.string().optional(),
  isFallback: z.boolean().optional(),
  fallbackReason: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional()
});

export const ExecutionTraceSummaryRecordSchema = z.object({
  freshnessSourceSummary: z.string().optional(),
  citationSourceSummary: z.string().optional()
});
