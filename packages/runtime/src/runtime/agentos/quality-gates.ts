import type { QualityGate, QualityGateResult } from '@agent/core';

export interface EvaluateQualityGateInput {
  gate: QualityGate;
  evaluatedAt: string;
  passed: boolean;
  reason?: string;
  evidenceRefs?: string[];
}

export function evaluateQualityGate(input: EvaluateQualityGateInput): QualityGateResult {
  return {
    gateId: input.gate.gateId,
    status: input.passed ? 'passed' : input.gate.onFail === 'warn' ? 'warned' : 'failed',
    evaluatedAt: input.evaluatedAt,
    reason: input.reason,
    evidenceRefs: input.evidenceRefs ?? []
  };
}
