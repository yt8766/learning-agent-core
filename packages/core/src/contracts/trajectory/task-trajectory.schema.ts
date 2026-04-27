import { z } from 'zod';

import { TrajectoryStatusSchema } from './trajectory-enums.schema';
import { TrajectoryReplayRecordSchema } from './trajectory-replay.schema';
import { TrajectoryPublicIdSchema, TrajectoryTimestampSchema } from './trajectory-scalars.schema';
import { TrajectoryStepRecordSchema } from './trajectory-step.schema';

export const TaskTrajectoryOriginSchema = z.object({
  channel: z.string().optional(),
  principalId: TrajectoryPublicIdSchema.optional(),
  requestId: TrajectoryPublicIdSchema.optional()
});
export type TaskTrajectoryOrigin = z.infer<typeof TaskTrajectoryOriginSchema>;

export const TaskTrajectoryIntentSchema = z.object({
  summary: z.string(),
  rawMessage: z.string().optional()
});
export type TaskTrajectoryIntent = z.infer<typeof TaskTrajectoryIntentSchema>;

export const TaskTrajectorySummarySchema = z.object({
  title: z.string(),
  outcome: z.string(),
  failurePointStepId: TrajectoryPublicIdSchema.optional()
});
export type TaskTrajectorySummary = z.infer<typeof TaskTrajectorySummarySchema>;

export const TaskTrajectoryRecordSchema = z.object({
  trajectoryId: TrajectoryPublicIdSchema,
  taskId: TrajectoryPublicIdSchema,
  sessionId: TrajectoryPublicIdSchema.optional(),
  origin: TaskTrajectoryOriginSchema,
  intent: TaskTrajectoryIntentSchema,
  status: TrajectoryStatusSchema,
  steps: z.array(TrajectoryStepRecordSchema),
  artifactIds: z.array(TrajectoryPublicIdSchema),
  evidenceIds: z.array(TrajectoryPublicIdSchema),
  summary: TaskTrajectorySummarySchema.optional(),
  replay: TrajectoryReplayRecordSchema.optional(),
  createdAt: TrajectoryTimestampSchema,
  updatedAt: TrajectoryTimestampSchema,
  finalizedAt: TrajectoryTimestampSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type TaskTrajectoryRecord = z.infer<typeof TaskTrajectoryRecordSchema>;
