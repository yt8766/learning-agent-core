import { describe, expect, it } from 'vitest';

import {
  normalizeRuntimeCritiqueResult,
  normalizeRuntimeSpecialistFinding
} from '../src/runtime/runtime-review-records';

describe('runtime-review-records (direct)', () => {
  describe('normalizeRuntimeCritiqueResult', () => {
    it('creates a valid critique result with pass decision', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'pass' });
      expect(result.decision).toBe('pass');
      expect(result.summary).toContain('通过');
      expect(result.contractVersion).toBe('critique-result.v1');
    });

    it('creates a valid critique result with block decision', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'block' });
      expect(result.decision).toBe('block');
      expect(result.shouldBlockEarly).toBe(true);
    });

    it('uses provided summary over fallback', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'pass',
        summary: 'Custom summary'
      });
      expect(result.summary).toBe('Custom summary');
    });

    it('falls back to decision-based summary when summary is empty', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'revise_required', summary: '  ' });
      expect(result.summary).toContain('修订');
    });

    it('normalizes blockingIssues list', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'block',
        blockingIssues: ['issue1', 'issue2']
      });
      expect(result.blockingIssues).toEqual(['issue1', 'issue2']);
    });

    it('filters empty strings from blockingIssues', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'block',
        blockingIssues: ['issue1', '', '  ', 'issue2']
      });
      expect(result.blockingIssues).toEqual(['issue1', 'issue2']);
    });

    it('sets blockingIssues to undefined when all empty', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'block',
        blockingIssues: ['', '  ']
      });
      expect(result.blockingIssues).toBeUndefined();
    });

    it('sets shouldBlockEarly from input', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'pass',
        shouldBlockEarly: true
      });
      expect(result.shouldBlockEarly).toBe(true);
    });

    it('normalizes constraints', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'revise_required',
        constraints: ['c1', 'c2']
      });
      expect(result.constraints).toEqual(['c1', 'c2']);
    });

    it('normalizes evidenceRefs', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'pass',
        evidenceRefs: ['ref1', 'ref2']
      });
      expect(result.evidenceRefs).toEqual(['ref1', 'ref2']);
    });

    it('deduplicates values in lists', () => {
      const result = normalizeRuntimeCritiqueResult({
        decision: 'block',
        blockingIssues: ['issue1', 'issue1', 'issue2']
      });
      expect(result.blockingIssues).toEqual(['issue1', 'issue2']);
    });

    it('always uses critique-result.v1 contractVersion', () => {
      const result = normalizeRuntimeCritiqueResult({ decision: 'pass' });
      expect(result.contractVersion).toBe('critique-result.v1');
    });
  });

  describe('normalizeRuntimeSpecialistFinding', () => {
    it('creates a valid specialist finding with lead role', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 'test-specialist',
        role: 'lead'
      });
      expect(finding.specialistId).toBe('test-specialist');
      expect(finding.role).toBe('lead');
      expect(finding.contractVersion).toBe('specialist-finding.v1');
      expect(finding.source).toBe('route');
      expect(finding.stage).toBe('planning');
    });

    it('uses fallback summary for lead role', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 'specialist-1',
        role: 'lead'
      });
      expect(finding.summary).toContain('主导结论');
    });

    it('uses fallback summary for support role', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 'specialist-1',
        role: 'support'
      });
      expect(finding.summary).toContain('专项判断');
    });

    it('uses provided summary', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 'specialist-1',
        role: 'lead',
        summary: 'Custom finding summary'
      });
      expect(finding.summary).toBe('Custom finding summary');
    });

    it('normalizes riskLevel', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 'specialist-1',
        role: 'lead',
        riskLevel: 'high'
      });
      expect(finding.riskLevel).toBe('high');
    });

    it('clamps confidence to 0-1 range', () => {
      const high = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        confidence: 2
      });
      expect(high.confidence).toBe(1);

      const low = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        confidence: -0.5
      });
      expect(low.confidence).toBe(0);
    });

    it('sets confidence to undefined when not a number', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        confidence: undefined
      });
      expect(finding.confidence).toBeUndefined();
    });

    it('defaults domain to specialistId', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 'my-specialist',
        role: 'lead'
      });
      expect(finding.domain).toBe('my-specialist');
    });

    it('uses provided domain', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        domain: 'custom-domain'
      });
      expect(finding.domain).toBe('custom-domain');
    });

    it('normalizes blockingIssues', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        blockingIssues: ['b1', 'b2']
      });
      expect(finding.blockingIssues).toEqual(['b1', 'b2']);
    });

    it('normalizes constraints', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        constraints: ['c1']
      });
      expect(finding.constraints).toEqual(['c1']);
    });

    it('normalizes suggestions', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        suggestions: ['s1', 's2']
      });
      expect(finding.suggestions).toEqual(['s1', 's2']);
    });

    it('normalizes evidenceRefs', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        evidenceRefs: ['e1']
      });
      expect(finding.evidenceRefs).toEqual(['e1']);
    });

    it('sets source and stage from input', () => {
      const finding = normalizeRuntimeSpecialistFinding({
        specialistId: 's1',
        role: 'lead',
        source: 'critique',
        stage: 'review'
      });
      expect(finding.source).toBe('critique');
      expect(finding.stage).toBe('review');
    });
  });
});
