import { ExecutionPolicyDecisionRecordSchema } from '@agent/core';

import type {
  CreateExecutionPolicyDecisionInput,
  ExecutionFabricFactoryOptions,
  ExecutionPolicyDecisionRecord
} from './execution-fabric-types';

function defaultCreateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveNow(options?: ExecutionFabricFactoryOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

export function createExecutionPolicyDecision(
  input: CreateExecutionPolicyDecisionInput,
  options?: ExecutionFabricFactoryOptions
): ExecutionPolicyDecisionRecord {
  const record: ExecutionPolicyDecisionRecord = {
    decisionId: (options?.createId ?? defaultCreateId)('exec_policy'),
    requestId: input.requestId,
    decision: input.decision,
    reasonCode: input.reasonCode,
    reason: input.reason,
    matchedPolicyIds: input.matchedPolicyIds ?? [],
    requiresApproval: input.decision === 'require_approval',
    approvalScope: input.approvalScope,
    riskClass: input.riskClass,
    createdAt: resolveNow(options)
  };

  return ExecutionPolicyDecisionRecordSchema.parse(record);
}
