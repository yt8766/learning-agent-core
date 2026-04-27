import { ExecutionRequestRecordSchema } from '@agent/core';

import type {
  CreateExecutionRequestInput,
  ExecutionFabricFactoryOptions,
  ExecutionRequestRecord
} from './execution-fabric-types';
import { normalizeExecutionRiskClass } from './execution-risk-normalizer';

function defaultCreateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveNow(options?: ExecutionFabricFactoryOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

export function createExecutionRequest(
  input: CreateExecutionRequestInput,
  options?: ExecutionFabricFactoryOptions
): ExecutionRequestRecord {
  const record: ExecutionRequestRecord = {
    requestId: (options?.createId ?? defaultCreateId)('exec_req'),
    taskId: input.taskId,
    sessionId: input.sessionId,
    nodeId: input.nodeId,
    capabilityId: input.capabilityId,
    toolName: input.toolName,
    requestedBy: input.requestedBy,
    inputPreview: input.inputPreview,
    riskClass: normalizeExecutionRiskClass(input.riskClass),
    status: 'pending_policy',
    createdAt: resolveNow(options),
    metadata: input.metadata
  };

  return ExecutionRequestRecordSchema.parse(record);
}
