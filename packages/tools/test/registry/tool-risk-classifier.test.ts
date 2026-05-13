import { describe, expect, it } from 'vitest';

import { ToolRiskClassifier } from '../../src/registry/tool-risk-classifier';

describe('ToolRiskClassifier', () => {
  const classifier = new ToolRiskClassifier();

  describe('classify', () => {
    it('returns the risk level from the capability when provided', () => {
      expect(classifier.classify({ riskLevel: 'high' })).toBe('high');
      expect(classifier.classify({ riskLevel: 'low' })).toBe('low');
      expect(classifier.classify({ riskLevel: 'critical' })).toBe('critical');
    });

    it('returns medium when capability is undefined', () => {
      expect(classifier.classify()).toBe('medium');
    });

    it('returns medium when capability has no riskLevel property (partial object)', () => {
      expect(classifier.classify({} as any)).toBe('medium');
    });
  });

  describe('requiresApproval', () => {
    it('returns true when capability requires approval', () => {
      expect(classifier.requiresApproval({ requiresApproval: true })).toBe(true);
    });

    it('returns false when capability does not require approval', () => {
      expect(classifier.requiresApproval({ requiresApproval: false })).toBe(false);
    });

    it('returns false when capability is undefined', () => {
      expect(classifier.requiresApproval()).toBe(false);
    });

    it('returns false when capability has no requiresApproval property (partial object)', () => {
      expect(classifier.requiresApproval({} as any)).toBe(false);
    });
  });
});
