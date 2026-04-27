import type { ExecutionRiskClass } from '@agent/core';

const EXECUTION_RISK_CLASSES = new Set<ExecutionRiskClass>(['low', 'medium', 'high', 'critical']);

export function normalizeExecutionRiskClass(value?: unknown): ExecutionRiskClass {
  if (typeof value !== 'string') {
    return 'medium';
  }

  return EXECUTION_RISK_CLASSES.has(value as ExecutionRiskClass) ? (value as ExecutionRiskClass) : 'medium';
}
