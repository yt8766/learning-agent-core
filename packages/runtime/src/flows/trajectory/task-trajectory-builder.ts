import { TaskTrajectoryRecordSchema } from '@agent/core';

import type { BuildTaskTrajectoryInput, TaskTrajectoryRecord, TrajectoryFactoryOptions } from './trajectory-types';
import { resolveTrajectoryId, resolveTrajectoryNow } from './trajectory-step-factory';

const TERMINAL_TRAJECTORY_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'replayed']);

const uniqueStrings = (values: string[]) => Array.from(new Set(values));

export function buildTaskTrajectory(
  input: BuildTaskTrajectoryInput,
  options?: TrajectoryFactoryOptions
): TaskTrajectoryRecord {
  const updatedAt = resolveTrajectoryNow(options);
  const steps = [...input.steps].sort((left, right) => left.sequence - right.sequence);
  const stepEvidenceIds = steps.flatMap(step => step.evidenceIds);
  const firstStartedAt = steps[0]?.startedAt;

  return TaskTrajectoryRecordSchema.parse({
    trajectoryId: resolveTrajectoryId('trajectory', options),
    taskId: input.taskId,
    sessionId: input.sessionId,
    origin: input.origin ?? {},
    intent: input.intent,
    status: input.status,
    steps,
    artifactIds: uniqueStrings(input.artifactIds ?? []),
    evidenceIds: uniqueStrings([...(input.evidenceIds ?? []), ...stepEvidenceIds]),
    summary: input.summary,
    replay: input.replay,
    createdAt: firstStartedAt ?? updatedAt,
    updatedAt,
    finalizedAt: TERMINAL_TRAJECTORY_STATUSES.has(input.status) ? updatedAt : undefined,
    metadata: input.metadata
  });
}
