import { z } from 'zod';

import { ExecutionResultStatusSchema } from './execution-enums.schema';

const ExecutionIdSchema = z.string().min(1);
const ExecutionTimestampSchema = z.string().datetime();

export const ExecutionResultErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().optional()
});
export type ExecutionResultError = z.infer<typeof ExecutionResultErrorSchema>;

export const ExecutionResultRecordSchema = z.object({
  resultId: ExecutionIdSchema,
  requestId: ExecutionIdSchema,
  taskId: ExecutionIdSchema,
  nodeId: ExecutionIdSchema,
  status: ExecutionResultStatusSchema,
  outputPreview: z.string().optional(),
  artifactIds: z.array(ExecutionIdSchema),
  evidenceIds: z.array(ExecutionIdSchema),
  error: ExecutionResultErrorSchema.optional(),
  durationMs: z.number().nonnegative().optional(),
  createdAt: ExecutionTimestampSchema,
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type ExecutionResultRecord = z.infer<typeof ExecutionResultRecordSchema>;
