import { describe, expect, it } from 'vitest';
import { evaluateQualityGate } from '../src/runtime/agentos';
import { QualityGateResultSchema } from '@agent/core';
import type { QualityGate } from '@agent/core';

describe('evaluateQualityGate', () => {
  it('passes a schema gate when the candidate parses', () => {
    const gate: QualityGate = {
      gateId: 'schema-output',
      hook: 'post_action',
      requiredForRisk: ['low', 'medium', 'high', 'critical'],
      evaluator: 'schema',
      onFail: 'block'
    };

    const result = evaluateQualityGate({
      gate,
      evaluatedAt: '2026-05-03T08:00:00.000Z',
      evidenceRefs: ['ev-1'],
      passed: true
    });

    expect(result.status).toBe('passed');
    expect(result.evidenceRefs).toEqual(['ev-1']);
  });

  it('returns failed result with reason when a gate blocks', () => {
    const result = evaluateQualityGate({
      gate: {
        gateId: 'policy-high-risk',
        hook: 'pre_action',
        requiredForRisk: ['high', 'critical'],
        evaluator: 'policy',
        onFail: 'require_approval'
      },
      evaluatedAt: '2026-05-03T08:00:00.000Z',
      passed: false,
      reason: 'Missing PolicyDecision for high-risk action'
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Missing PolicyDecision');
  });

  it('records non-blocking warning gates as warned', () => {
    const result = evaluateQualityGate({
      gate: {
        gateId: 'source-freshness',
        hook: 'pre_delivery',
        requiredForRisk: ['medium', 'high'],
        evaluator: 'source_check',
        onFail: 'warn'
      },
      evaluatedAt: '2026-05-03T08:00:00.000Z',
      passed: false,
      reason: 'Source freshness is unknown'
    });

    expect(QualityGateResultSchema.parse(result)).toEqual(result);
    expect(result.status).toBe('warned');
  });
});
