import { TrajectoryArtifactRecordSchema } from '@agent/core';

import type {
  CreateTrajectoryArtifactInput,
  TrajectoryArtifactRecord,
  TrajectoryFactoryOptions
} from './trajectory-types';
import { resolveTrajectoryId, resolveTrajectoryNow } from './trajectory-step-factory';

export function createTrajectoryArtifact(
  input: CreateTrajectoryArtifactInput,
  options?: TrajectoryFactoryOptions
): TrajectoryArtifactRecord {
  return TrajectoryArtifactRecordSchema.parse({
    artifactId: resolveTrajectoryId('traj_artifact', options),
    taskId: input.taskId,
    kind: input.kind,
    uri: input.uri,
    title: input.title,
    summary: input.summary,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    checksum: input.checksum,
    createdAt: resolveTrajectoryNow(options),
    metadata: input.metadata
  });
}
