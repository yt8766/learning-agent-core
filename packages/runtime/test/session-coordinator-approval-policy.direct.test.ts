import { describe, expect, it } from 'vitest';

import {
  buildApprovalScopeMatchInput,
  upsertSessionApprovalPolicy,
  upsertRuntimeApprovalPolicy
} from '../src/session/coordinator/session-coordinator-approval-policy';

describe('session-coordinator-approval-policy (direct)', () => {
  describe('buildApprovalScopeMatchInput', () => {
    it('returns intent from pendingApproval', () => {
      const task = {
        pendingApproval: { intent: 'tool_approval', toolName: 'bash', reasonCode: 'code_exec' },
        currentMinistry: 'gongbu-code'
      } as any;
      const result = buildApprovalScopeMatchInput(task);
      expect(result.intent).toBe('tool_approval');
      expect(result.toolName).toBe('bash');
      expect(result.riskCode).toBe('code_exec');
    });

    it('falls back to activeInterrupt for intent', () => {
      const task = {
        activeInterrupt: { intent: 'install_skill', toolName: 'skill-tool' },
        currentMinistry: 'hubu-search'
      } as any;
      const result = buildApprovalScopeMatchInput(task);
      expect(result.intent).toBe('install_skill');
      expect(result.toolName).toBe('skill-tool');
      expect(result.requestedBy).toBe('hubu-search');
    });

    it('extracts riskCode from interrupt payload', () => {
      const task = {
        activeInterrupt: {
          payload: { riskCode: 'high_risk', commandPreview: 'rm -rf /' }
        }
      } as any;
      const result = buildApprovalScopeMatchInput(task);
      expect(result.riskCode).toBe('high_risk');
      expect(result.commandPreview).toBe('rm -rf /');
    });

    it('returns undefined for missing fields', () => {
      const task = {} as any;
      const result = buildApprovalScopeMatchInput(task);
      expect(result.intent).toBeUndefined();
      expect(result.toolName).toBeUndefined();
      expect(result.riskCode).toBeUndefined();
      expect(result.requestedBy).toBeUndefined();
      expect(result.commandPreview).toBeUndefined();
    });

    it('prefers interrupt payload riskCode over pendingApproval reasonCode', () => {
      const task = {
        pendingApproval: { reasonCode: 'from_pending' },
        activeInterrupt: { payload: { riskCode: 'from_interrupt' } }
      } as any;
      const result = buildApprovalScopeMatchInput(task);
      // interrupt payload riskCode is checked first via ternary, then ?? fallback
      expect(result.riskCode).toBe('from_interrupt');
    });

    it('falls back to pendingApproval reasonCode when no interrupt payload riskCode', () => {
      const task = {
        pendingApproval: { reasonCode: 'from_pending' },
        activeInterrupt: { payload: {} }
      } as any;
      const result = buildApprovalScopeMatchInput(task);
      expect(result.riskCode).toBe('from_pending');
    });

    it('ignores non-object interrupt payload', () => {
      const task = {
        activeInterrupt: { payload: 'string-payload' }
      } as any;
      const result = buildApprovalScopeMatchInput(task);
      expect(result.commandPreview).toBeUndefined();
      expect(result.riskCode).toBeUndefined();
    });
  });

  describe('upsertSessionApprovalPolicy', () => {
    it('prepends new policy when no existing match', () => {
      const existing = [{ id: 'p1', status: 'active', scope: 'session', matchKey: 'other' }];
      const policy = { id: 'p2', status: 'active', scope: 'session', matchKey: 'key1' } as any;
      const result = upsertSessionApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('p2');
    });

    it('updates existing policy with matching scope and matchKey', () => {
      const existing = [{ id: 'p1', status: 'active', scope: 'session', matchKey: 'key1', matchCount: 0 }];
      const policy = { status: 'active', scope: 'session', matchKey: 'key1', matchCount: 5 } as any;
      const result = upsertSessionApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
      expect(result[0].matchCount).toBe(5);
    });

    it('ignores inactive policies for matching', () => {
      const existing = [{ id: 'p1', status: 'expired', scope: 'session', matchKey: 'key1' }];
      const policy = { id: 'p2', status: 'active', scope: 'session', matchKey: 'key1' } as any;
      const result = upsertSessionApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(2);
    });

    it('caps at 50 policies', () => {
      const existing = Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`,
        status: 'active',
        scope: 'session',
        matchKey: `key${i}`
      }));
      const policy = { id: 'new', status: 'active', scope: 'session', matchKey: 'new-key' } as any;
      const result = upsertSessionApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(50);
      expect(result[0].id).toBe('new');
    });
  });

  describe('upsertRuntimeApprovalPolicy', () => {
    it('prepends new policy when no existing match', () => {
      const existing = [{ id: 'p1', status: 'active', scope: 'always', matchKey: 'other' }];
      const policy = { id: 'p2', status: 'active', scope: 'always', matchKey: 'key1' } as any;
      const result = upsertRuntimeApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('p2');
    });

    it('updates existing policy with matching scope and matchKey', () => {
      const existing = [{ id: 'p1', status: 'active', scope: 'always', matchKey: 'key1', matchCount: 0 }];
      const policy = { status: 'active', scope: 'always', matchKey: 'key1', matchCount: 10 } as any;
      const result = upsertRuntimeApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
      expect(result[0].matchCount).toBe(10);
    });

    it('caps at 200 policies', () => {
      const existing = Array.from({ length: 200 }, (_, i) => ({
        id: `p${i}`,
        status: 'active',
        scope: 'always',
        matchKey: `key${i}`
      }));
      const policy = { id: 'new', status: 'active', scope: 'always', matchKey: 'new-key' } as any;
      const result = upsertRuntimeApprovalPolicy(existing as any, policy);
      expect(result).toHaveLength(200);
      expect(result[0].id).toBe('new');
    });
  });
});
