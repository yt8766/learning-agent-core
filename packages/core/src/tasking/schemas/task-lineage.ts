import { z } from 'zod';

export const TaskLaunchReasonSchema = z.enum(['manual', 'retry', 'replay', 'diagnosis']);

export const TaskLineageRecordSchema = z.object({
  parentTaskId: z.string().optional(),
  launchReason: TaskLaunchReasonSchema.optional(),
  replaySourceLabel: z.string().optional(),
  replayScoped: z.boolean().optional(),
  baselineTaskId: z.string().optional()
});
