import { ExecutionResultRecordSchema } from '@agent/core';

import type {
  CreateExecutionResultInput,
  ExecutionFabricFactoryOptions,
  ExecutionResultRecord
} from './execution-fabric-types';

function defaultCreateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveNow(options?: ExecutionFabricFactoryOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

function calculateDurationMs(startedAt: string | undefined, finishedAt: string | undefined): number | undefined {
  if (!startedAt || !finishedAt) {
    return undefined;
  }

  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (Number.isNaN(started) || Number.isNaN(finished)) {
    return undefined;
  }

  return Math.max(0, finished - started);
}

export function createExecutionResult(
  input: CreateExecutionResultInput,
  options?: ExecutionFabricFactoryOptions
): ExecutionResultRecord {
  const record: ExecutionResultRecord = {
    resultId: (options?.createId ?? defaultCreateId)('exec_result'),
    requestId: input.requestId,
    taskId: input.taskId,
    nodeId: input.nodeId,
    status: input.status,
    outputPreview: input.outputPreview,
    artifactIds: input.artifactIds ?? [],
    evidenceIds: input.evidenceIds ?? [],
    error: input.error,
    durationMs: calculateDurationMs(input.startedAt, input.finishedAt),
    createdAt: resolveNow(options),
    metadata: input.metadata
  };

  return ExecutionResultRecordSchema.parse(record);
}
