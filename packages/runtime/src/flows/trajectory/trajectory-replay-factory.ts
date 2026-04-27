import { TrajectoryReplayRecordSchema } from '@agent/core';

import type { CreateTrajectoryReplayInput, TrajectoryFactoryOptions, TrajectoryReplayRecord } from './trajectory-types';
import { resolveTrajectoryId } from './trajectory-step-factory';

export function createTrajectoryReplay(
  input: CreateTrajectoryReplayInput,
  options?: TrajectoryFactoryOptions
): TrajectoryReplayRecord {
  return TrajectoryReplayRecordSchema.parse({
    replayId: resolveTrajectoryId('traj_replay', options),
    taskId: input.taskId,
    mode: input.mode,
    status: input.status,
    sourceTrajectoryId: input.sourceTrajectoryId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    resultTrajectoryId: input.resultTrajectoryId,
    nonReplayableReasons: input.nonReplayableReasons ?? [],
    metadata: input.metadata
  });
}
