import { describe, expect, it } from 'vitest';

import { buildApprovalScopeMatchKey, matchesApprovalScopePolicy } from '../src/contracts/governance/helpers/matchers';

describe('governance-matchers', () => {
  describe('buildApprovalScopeMatchKey', () => {
    it('builds key from all fields', () => {
      const key = buildApprovalScopeMatchKey({
        intent: 'write_file',
        toolName: 'filesystem',
        riskCode: 'requires_approval_destructive',
        requestedBy: 'gongbu-code',
        commandPreview: 'rm -rf /tmp'
      });
      expect(key).toBe('write_file::filesystem::requires_approval_destructive::gongbu-code::rm -rf /tmp');
    });

    it('normalizes whitespace and joins with ::', () => {
      const key = buildApprovalScopeMatchKey({
        intent: '  write_file  ',
        toolName: ' filesystem '
      });
      expect(key).toContain('write_file');
      expect(key).toContain('filesystem');
      expect(key).toMatch(/^write_file::filesystem/);
    });

    it('handles undefined fields with empty segments', () => {
      const key = buildApprovalScopeMatchKey({});
      const parts = key.split('::');
      expect(parts).toHaveLength(5);
    });

    it('normalizes to lowercase', () => {
      const key = buildApprovalScopeMatchKey({
        intent: 'WRITE_FILE',
        toolName: 'FILESYSTEM'
      });
      expect(key).toMatch(/^write_file::filesystem/);
    });
  });

  describe('matchesApprovalScopePolicy', () => {
    it('returns true for matching active policy', () => {
      const key = buildApprovalScopeMatchKey({
        intent: 'write_file',
        toolName: 'filesystem'
      });
      const policy = { status: 'active' as const, matchKey: key };
      expect(matchesApprovalScopePolicy(policy, { intent: 'write_file', toolName: 'filesystem' })).toBe(true);
    });

    it('returns false for revoked policy', () => {
      const key = buildApprovalScopeMatchKey({
        intent: 'write_file',
        toolName: 'filesystem'
      });
      const policy = { status: 'revoked' as const, matchKey: key };
      expect(matchesApprovalScopePolicy(policy, { intent: 'write_file', toolName: 'filesystem' })).toBe(false);
    });

    it('returns false for non-matching key', () => {
      const policy = { status: 'active' as const, matchKey: 'other::key' };
      expect(matchesApprovalScopePolicy(policy, { intent: 'write_file', toolName: 'filesystem' })).toBe(false);
    });
  });
});
