import { TrajectoryStepRecordSchema } from '@agent/core';

import type { CreateTrajectoryStepInput, TrajectoryFactoryOptions, TrajectoryStepRecord } from './trajectory-types';

const defaultNow = () => new Date().toISOString();

const defaultCreateId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const resolveTrajectoryNow = (options?: TrajectoryFactoryOptions) => options?.now?.() ?? defaultNow();

export const resolveTrajectoryId = (prefix: string, options?: TrajectoryFactoryOptions) =>
  options?.createId?.(prefix) ?? defaultCreateId(prefix);

export function createTrajectoryStep(
  input: CreateTrajectoryStepInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return TrajectoryStepRecordSchema.parse({
    stepId: resolveTrajectoryId('traj_step', options),
    taskId: input.taskId,
    sequence: input.sequence,
    type: input.type,
    title: input.title,
    summary: input.summary,
    actor: input.actor,
    status: input.status ?? 'succeeded',
    startedAt: input.startedAt ?? resolveTrajectoryNow(options),
    finishedAt: input.finishedAt,
    inputRefs: input.inputRefs ?? [],
    outputRefs: input.outputRefs ?? [],
    evidenceIds: input.evidenceIds ?? [],
    executionRequestId: input.executionRequestId,
    approvalId: input.approvalId,
    checkpointId: input.checkpointId,
    metadata: input.metadata
  });
}
