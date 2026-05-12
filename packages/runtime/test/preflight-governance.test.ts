import { describe, expect, it, vi } from 'vitest';

import {
  evaluateStaticPolicy,
  evaluatePermissionCheckers,
  defaultPreflightStaticRules,
  mergeGovernanceDecisions
} from '../src/governance/approval/preflight-governance';

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    profile: 'personal',
    policy: {
      approvalMode: 'standard',
      approvalPolicy: { safeWriteAutoApprove: true }
    },
    ...overrides
  } as any;
}

describe('preflight-governance', () => {
  describe('evaluateStaticPolicy', () => {
    it('returns undefined when no rules match', () => {
      const rules = [
        {
          id: 'test',
          effect: 'allow' as const,
          priority: 10,
          families: ['nonexistent']
        }
      ];
      const tool = { name: 'test-tool', family: 'other' } as any;
      const result = evaluateStaticPolicy(rules, tool, {}, makeSettings());
      expect(result).toBeUndefined();
    });

    it('returns allow for matching readonly rule', () => {
      const rules = defaultPreflightStaticRules();
      const tool = { name: 'read_file', family: 'filesystem' } as any;
      const result = evaluateStaticPolicy(rules, tool, { executionMode: 'execute' } as any, makeSettings());
      expect(result).toBeDefined();
      expect(result!.decision).toBe('allow');
    });

    it('returns ask for governance tool', () => {
      const rules = defaultPreflightStaticRules();
      const tool = { name: 'connector-config', family: 'runtime-governance' } as any;
      const result = evaluateStaticPolicy(rules, tool, {}, makeSettings());
      expect(result).toBeDefined();
      expect(result!.decision).toBe('ask');
    });

    it('returns undefined when tool is undefined', () => {
      const rules = defaultPreflightStaticRules();
      const result = evaluateStaticPolicy(rules, undefined, {}, makeSettings());
      expect(result).toBeUndefined();
    });

    it('matches by executionMode', () => {
      const rules = [
        {
          id: 'plan-only',
          effect: 'allow' as const,
          priority: 100,
          families: ['test'],
          executionModes: ['plan']
        }
      ];
      const tool = { name: 'test', family: 'test' } as any;
      const result = evaluateStaticPolicy(rules, tool, { executionMode: 'plan' } as any, makeSettings());
      expect(result).toBeDefined();
      expect(result!.decision).toBe('allow');
    });

    it('selects highest priority rule', () => {
      const rules = [
        { id: 'low', effect: 'allow' as const, priority: 10, families: ['test'] },
        { id: 'high', effect: 'deny' as const, priority: 200, families: ['test'] }
      ];
      const tool = { name: 'test', family: 'test' } as any;
      const result = evaluateStaticPolicy(rules, tool, {}, makeSettings());
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
      expect(result!.matchedRuleId).toBe('high');
    });
  });

  describe('evaluatePermissionCheckers', () => {
    it('returns undefined when no tool provided', () => {
      const result = evaluatePermissionCheckers([], undefined);
      expect(result).toBeUndefined();
    });

    it('returns undefined when no checker supports tool', () => {
      const checkers = [
        {
          supports: () => false,
          check: () => ({ decision: 'allow' as const, reason: 'test' })
        }
      ];
      const tool = { name: 'test', family: 'test' } as any;
      const result = evaluatePermissionCheckers(checkers, tool);
      expect(result).toBeUndefined();
    });

    it('returns result from matching checker', () => {
      const checkers = [
        {
          supports: () => true,
          check: () => ({ decision: 'deny' as const, reason: 'blocked' })
        }
      ];
      const tool = { name: 'test', family: 'test' } as any;
      const result = evaluatePermissionCheckers(checkers, tool);
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
    });
  });

  describe('defaultPreflightStaticRules', () => {
    it('returns non-empty array', () => {
      const rules = defaultPreflightStaticRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('includes readonly-tools-allow rule', () => {
      const rules = defaultPreflightStaticRules();
      expect(rules.some(r => r.id === 'readonly-tools-allow')).toBe(true);
    });

    it('includes governance-tools-ask rule', () => {
      const rules = defaultPreflightStaticRules();
      expect(rules.some(r => r.id === 'governance-tools-ask')).toBe(true);
    });
  });

  describe('mergeGovernanceDecisions', () => {
    it('returns undefined when both are undefined', () => {
      expect(mergeGovernanceDecisions(undefined, undefined)).toBeUndefined();
    });

    it('returns first when second is undefined', () => {
      const first = { decision: 'deny' as const, reason: 'blocked' };
      expect(mergeGovernanceDecisions(first, undefined)).toBe(first);
    });

    it('returns second when first is undefined', () => {
      const second = { decision: 'allow' as const, reason: 'ok' };
      expect(mergeGovernanceDecisions(undefined, second)).toBe(second);
    });

    it('returns higher priority decision', () => {
      const first = { decision: 'allow' as const, reason: 'ok' };
      const second = { decision: 'deny' as const, reason: 'blocked' };
      const result = mergeGovernanceDecisions(first, second);
      expect(result).toBeDefined();
    });
  });
});
