import { z } from 'zod';

import {
  TrajectoryStepActorSchema,
  TrajectoryStepStatusSchema,
  TrajectoryStepTypeSchema
} from './trajectory-enums.schema';
import { TrajectoryPublicIdSchema, TrajectoryTimestampSchema } from './trajectory-scalars.schema';

export const TrajectoryStepRecordSchema = z.object({
  stepId: TrajectoryPublicIdSchema,
  taskId: TrajectoryPublicIdSchema,
  sequence: z.number().int().nonnegative(),
  type: TrajectoryStepTypeSchema,
  title: z.string(),
  summary: z.string().optional(),
  actor: TrajectoryStepActorSchema,
  status: TrajectoryStepStatusSchema,
  startedAt: TrajectoryTimestampSchema,
  finishedAt: TrajectoryTimestampSchema.optional(),
  inputRefs: z.array(TrajectoryPublicIdSchema),
  outputRefs: z.array(TrajectoryPublicIdSchema),
  evidenceIds: z.array(TrajectoryPublicIdSchema),
  executionRequestId: TrajectoryPublicIdSchema.optional(),
  approvalId: TrajectoryPublicIdSchema.optional(),
  checkpointId: TrajectoryPublicIdSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type TrajectoryStepRecord = z.infer<typeof TrajectoryStepRecordSchema>;
