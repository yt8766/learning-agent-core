import { describe, expect, it } from 'vitest';

import {
  normalizeRuntimeCritiqueResult,
  normalizeRuntimeSpecialistFinding
} from '../src/runtime/runtime-review-records';

describe('runtime-review-records', () => {
  describe('normalizeRuntimeCritiqueResult', () => {
    it('produces a valid critique result with all provided fields', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'pass',
        summary: '审查通过。',
        blockingIssues: ['issue-1'],
        constraints: ['constraint-1'],
        evidenceRefs: ['ref-1'],
        shouldBlockEarly: false
      });

      expect(result.decision).toBe('pass');
      expect(result.summary).toBe('审查通过。');
      expect(result.blockingIssues).toEqual(['issue-1']);
      expect(result.constraints).toEqual(['constraint-1']);
      expect(result.evidenceRefs).toEqual(['ref-1']);
      expect(result.shouldBlockEarly).toBe(false);
      expect(result.contractVersion).toBe('critique-result.v1');
    });

    it('uses fallback summary when summary is empty', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'pass', summary: '' });
      expect(result.summary).toBe('刑部审查通过。');
    });

    it('uses fallback for block decision', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'block' });
      expect(result.summary).toBe('刑部判定当前方案存在阻断问题。');
      expect(result.shouldBlockEarly).toBe(true);
    });

    it('uses fallback for revise_required decision', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'revise_required' });
      expect(result.summary).toBe('刑部认为当前草稿仍需修订。');
    });

    it('uses fallback for needs_human_approval decision', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'needs_human_approval' });
      expect(result.summary).toBe('刑部认为当前动作需要人工审批后才能继续。');
    });

    it('defaults shouldBlockEarly to true for block decision', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'block' });
      expect(result.shouldBlockEarly).toBe(true);
    });

    it('normalizes string lists by deduping and trimming', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'pass',
        blockingIssues: ['  issue-1  ', 'issue-1', 'issue-2', '']
      });
      expect(result.blockingIssues).toEqual(['issue-1', 'issue-2']);
    });

    it('returns undefined for empty normalized lists', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'pass',
        blockingIssues: ['', '  ']
      });
      expect(result.blockingIssues).toBeUndefined();
    });
  });

  describe('normalizeRuntimeSpecialistFinding', () => {
    it('produces a valid specialist finding with all provided fields', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'technical-architecture',
        role: 'lead',
        source: 'critique',
        stage: 'review',
        summary: '技术架构审查结论。',
        domain: 'technical-architecture',
        riskLevel: 'low',
        blockingIssues: [],
        constraints: ['constraint-1'],
        suggestions: ['suggestion-1'],
        evidenceRefs: ['ref-1'],
        confidence: 0.85
      });

      expect(result.specialistId).toBe('technical-architecture');
      expect(result.role).toBe('lead');
      expect(result.source).toBe('critique');
      expect(result.stage).toBe('review');
      expect(result.summary).toBe('技术架构审查结论。');
      expect(result.domain).toBe('technical-architecture');
      expect(result.riskLevel).toBe('low');
      expect(result.constraints).toEqual(['constraint-1']);
      expect(result.suggestions).toEqual(['suggestion-1']);
      expect(result.evidenceRefs).toEqual(['ref-1']);
      expect(result.confidence).toBe(0.85);
      expect(result.contractVersion).toBe('specialist-finding.v1');
    });

    it('uses fallback summary for lead role when summary is empty', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'risk-compliance',
        role: 'lead'
      });
      expect(result.summary).toBe('risk-compliance 已形成主导结论。');
    });

    it('uses fallback summary for support role when summary is empty', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'payment-channel',
        role: 'support'
      });
      expect(result.summary).toBe('payment-channel 已补充专项判断。');
    });

    it('defaults source to route', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'test',
        role: 'lead'
      });
      expect(result.source).toBe('route');
    });

    it('defaults stage to planning', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'test',
        role: 'lead'
      });
      expect(result.stage).toBe('planning');
    });

    it('defaults domain to specialistId', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'my-domain',
        role: 'lead'
      });
      expect(result.domain).toBe('my-domain');
    });

    it('clamps confidence between 0 and 1', () => {
      const high = normalizeRuntimeSpecialistFinding({
        specialistId: 'test',
        role: 'lead',
        confidence: 5
      });
      expect(high.confidence).toBe(1);

      const low = normalizeRuntimeSpecialistFinding({
        specialistId: 'test',
        role: 'lead',
        confidence: -3
      });
      expect(low.confidence).toBe(0);
    });

    it('returns undefined confidence when not provided', () => {
      const result = normalizeRuntimeSpecialistFinding({
        specialistId: 'test',
        role: 'lead'
      });
      expect(result.confidence).toBeUndefined();
    });
  });
});
