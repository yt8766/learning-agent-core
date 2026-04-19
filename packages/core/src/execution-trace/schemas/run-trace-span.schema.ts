import { z } from 'zod';

import { RunStageSchema, RunSpanStatusSchema } from '../../tasking/schemas/run-observability-semantics';

export const RunTraceSpanTokenUsageSchema = z.object({
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional()
});

export const RunTraceSpanRecordSchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  node: z.string(),
  stage: RunStageSchema,
  role: z.string().optional(),
  ministry: z.string().optional(),
  worker: z.string().optional(),
  specialistId: z.string().optional(),
  status: RunSpanStatusSchema,
  summary: z.string(),
  detail: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  latencyMs: z.number().optional(),
  modelUsed: z.string().optional(),
  tokenUsage: RunTraceSpanTokenUsageSchema.optional(),
  isFallback: z.boolean().optional(),
  fallbackReason: z.string().optional(),
  checkpointId: z.string().optional(),
  evidenceIds: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});
