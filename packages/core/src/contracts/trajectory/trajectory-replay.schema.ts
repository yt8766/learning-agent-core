import { z } from 'zod';

import { TrajectoryReplayModeSchema, TrajectoryReplayStatusSchema } from './trajectory-enums.schema';
import { TrajectoryPublicIdSchema, TrajectoryTimestampSchema } from './trajectory-scalars.schema';

export const TrajectoryReplayRecordSchema = z.object({
  replayId: TrajectoryPublicIdSchema,
  taskId: TrajectoryPublicIdSchema,
  mode: TrajectoryReplayModeSchema,
  status: TrajectoryReplayStatusSchema,
  sourceTrajectoryId: TrajectoryPublicIdSchema.optional(),
  startedAt: TrajectoryTimestampSchema.optional(),
  finishedAt: TrajectoryTimestampSchema.optional(),
  resultTrajectoryId: TrajectoryPublicIdSchema.optional(),
  nonReplayableReasons: z.array(z.string().min(1)),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type TrajectoryReplayRecord = z.infer<typeof TrajectoryReplayRecordSchema>;
