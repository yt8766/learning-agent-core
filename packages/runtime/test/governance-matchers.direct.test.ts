import { describe, expect, it } from 'vitest';

import { buildApprovalScopeMatchKey, matchesApprovalScopePolicy } from '../src/contracts/governance/helpers/matchers';

describe('governance-matchers (direct)', () => {
  describe('buildApprovalScopeMatchKey', () => {
    it('builds key from all fields', () => {
      const key = buildApprovalScopeMatchKey({
        intent: 'tool_approval',
        toolName: 'bash',
        riskCode: 'requires_approval_destructive',
        requestedBy: 'gongbu-code',
        commandPreview: 'rm -rf /tmp'
      });
      expect(key).toContain('tool_approval');
      expect(key).toContain('bash');
      expect(key).toContain('requires_approval_destructive');
      expect(key).toContain('gongbu-code');
      expect(key).toContain('rm -rf /tmp');
    });

    it('normalizes whitespace and case', () => {
      const key = buildApprovalScopeMatchKey({
        intent: '  Tool_Approval  ',
        toolName: 'BASH',
        riskCode: undefined,
        requestedBy: undefined,
        commandPreview: undefined
      });
      expect(key).toContain('tool_approval');
      expect(key).toContain('bash');
    });

    it('handles undefined fields', () => {
      const key = buildApprovalScopeMatchKey({});
      // All 5 fields normalize to empty, joined by ::
      expect(key.split('::').length).toBeGreaterThanOrEqual(5);
    });

    it('collapses multiple spaces', () => {
      const key = buildApprovalScopeMatchKey({
        intent: 'tool   approval',
        toolName: 'multi   space'
      });
      expect(key).toContain('tool approval');
      expect(key).toContain('multi space');
      expect(key).not.toContain('   ');
    });
  });

  describe('matchesApprovalScopePolicy', () => {
    it('returns true when policy is active and matchKey matches', () => {
      const policy = {
        status: 'active',
        matchKey: buildApprovalScopeMatchKey({ intent: 'tool_approval', toolName: 'bash' })
      };
      const input = { intent: 'tool_approval', toolName: 'bash' };
      expect(matchesApprovalScopePolicy(policy as any, input)).toBe(true);
    });

    it('returns false when policy is not active', () => {
      const policy = {
        status: 'expired',
        matchKey: buildApprovalScopeMatchKey({ intent: 'tool_approval', toolName: 'bash' })
      };
      const input = { intent: 'tool_approval', toolName: 'bash' };
      expect(matchesApprovalScopePolicy(policy as any, input)).toBe(false);
    });

    it('returns false when matchKey does not match', () => {
      const policy = {
        status: 'active',
        matchKey: 'tool_approval::bash::::'
      };
      const input = { intent: 'tool_approval', toolName: 'npm' };
      expect(matchesApprovalScopePolicy(policy as any, input)).toBe(false);
    });

    it('matches with normalized values', () => {
      const policy = {
        status: 'active',
        matchKey: buildApprovalScopeMatchKey({ intent: 'Tool_Approval', toolName: 'BASH' })
      };
      const input = { intent: '  tool_approval  ', toolName: 'bash' };
      expect(matchesApprovalScopePolicy(policy as any, input)).toBe(true);
    });
  });
});
