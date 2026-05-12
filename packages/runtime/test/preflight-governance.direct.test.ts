import { describe, expect, it } from 'vitest';

import {
  evaluateStaticPolicy,
  evaluatePermissionCheckers,
  defaultPreflightStaticRules,
  TerminalToolPermissionChecker,
  WorkspacePathPermissionChecker,
  HttpMethodPermissionChecker,
  mergeGovernanceDecisions
} from '../src/governance/approval/preflight-governance';

function makeTool(overrides: Record<string, unknown> = {}) {
  return { name: 'test-tool', family: 'test', ...overrides } as any;
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return { profile: 'standard', ...overrides } as any;
}

describe('preflight-governance (direct)', () => {
  describe('evaluateStaticPolicy', () => {
    it('returns undefined when no rules match', () => {
      const result = evaluateStaticPolicy([], makeTool(), {}, makeSettings());
      expect(result).toBeUndefined();
    });

    it('returns allow for matching allow rule', () => {
      const rules = [{ id: 'r1', effect: 'allow', priority: 10, reason: 'Allowed', families: ['test'] }];
      const result = evaluateStaticPolicy(rules as any, makeTool(), {}, makeSettings());
      expect(result).toBeDefined();
      expect(result!.decision).toBe('allow');
      expect(result!.reasonCode).toBe('static_policy_allow');
    });

    it('returns deny for matching deny rule', () => {
      const rules = [{ id: 'r1', effect: 'deny', priority: 10, reason: 'Denied', toolNames: ['test-tool'] }];
      const result = evaluateStaticPolicy(rules as any, makeTool(), {}, makeSettings());
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
      expect(result!.reasonCode).toBe('static_policy_deny');
    });

    it('returns ask for matching ask rule', () => {
      const rules = [{ id: 'r1', effect: 'ask', priority: 10, reason: 'Ask', families: ['test'] }];
      const result = evaluateStaticPolicy(rules as any, makeTool(), {}, makeSettings());
      expect(result!.decision).toBe('ask');
      expect(result!.reasonCode).toBe('static_policy_ask');
    });

    it('sorts by priority (highest first)', () => {
      const rules = [
        { id: 'low', effect: 'allow', priority: 10, reason: 'Low', families: ['test'] },
        { id: 'high', effect: 'deny', priority: 100, reason: 'High', families: ['test'] }
      ];
      const result = evaluateStaticPolicy(rules as any, makeTool(), {}, makeSettings());
      expect(result!.decision).toBe('deny');
      expect(result!.matchedRuleId).toBe('high');
    });

    it('returns undefined when tool is undefined and rule requires toolNames', () => {
      const rules = [{ id: 'r1', effect: 'deny', priority: 10, reason: 'Denied', toolNames: ['test-tool'] }];
      const result = evaluateStaticPolicy(rules as any, undefined, {}, makeSettings());
      expect(result).toBeUndefined();
    });

    it('matches by command pattern', () => {
      const rules = [
        {
          id: 'r1',
          effect: 'deny',
          priority: 10,
          reason: 'Dangerous',
          toolNames: ['run_terminal'],
          commandPatterns: ['\\brm\\s+-[rf]']
        }
      ];
      const result = evaluateStaticPolicy(
        rules as any,
        makeTool({ name: 'run_terminal' }),
        { command: 'rm -rf /' },
        makeSettings()
      );
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
    });

    it('returns undefined when command pattern does not match', () => {
      const rules = [
        {
          id: 'r1',
          effect: 'deny',
          priority: 10,
          reason: 'Dangerous',
          toolNames: ['run_terminal'],
          commandPatterns: ['\\brm\\s+-[rf]']
        }
      ];
      const result = evaluateStaticPolicy(
        rules as any,
        makeTool({ name: 'run_terminal' }),
        { command: 'ls -la' },
        makeSettings()
      );
      expect(result).toBeUndefined();
    });

    it('matches by profile', () => {
      const rules = [
        { id: 'r1', effect: 'deny', priority: 10, reason: 'Strict', families: ['test'], profiles: ['strict'] }
      ];
      expect(evaluateStaticPolicy(rules as any, makeTool(), {}, makeSettings({ profile: 'strict' }))).toBeDefined();
      expect(evaluateStaticPolicy(rules as any, makeTool(), {}, makeSettings({ profile: 'standard' }))).toBeUndefined();
    });
  });

  describe('evaluatePermissionCheckers', () => {
    it('returns undefined when tool is undefined', () => {
      const result = evaluatePermissionCheckers([], undefined);
      expect(result).toBeUndefined();
    });

    it('returns undefined when no checker supports the tool', () => {
      const checker = { supports: () => false, check: () => ({ decision: 'deny' }) as any };
      const result = evaluatePermissionCheckers([checker as any], makeTool());
      expect(result).toBeUndefined();
    });

    it('returns result from matching checker', () => {
      const expected = { decision: 'deny', reason: 'test' };
      const checker = { supports: () => true, check: () => expected };
      const result = evaluatePermissionCheckers([checker as any], makeTool());
      expect(result).toBe(expected);
    });

    it('returns undefined when checker returns undefined', () => {
      const checker = { supports: () => true, check: () => undefined };
      const result = evaluatePermissionCheckers([checker as any], makeTool());
      expect(result).toBeUndefined();
    });
  });

  describe('defaultPreflightStaticRules', () => {
    it('returns array of rules', () => {
      const rules = defaultPreflightStaticRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('includes readonly allow rule', () => {
      const rules = defaultPreflightStaticRules();
      const readonly = rules.find(r => r.id === 'readonly-tools-allow');
      expect(readonly).toBeDefined();
      expect(readonly!.effect).toBe('allow');
    });

    it('includes governance ask rule', () => {
      const rules = defaultPreflightStaticRules();
      const governance = rules.find(r => r.id === 'governance-tools-ask');
      expect(governance).toBeDefined();
      expect(governance!.effect).toBe('ask');
    });

    it('includes destructive terminal deny rule', () => {
      const rules = defaultPreflightStaticRules();
      const destructive = rules.find(r => r.id === 'destructive-terminal-deny');
      expect(destructive).toBeDefined();
      expect(destructive!.effect).toBe('deny');
    });
  });

  describe('TerminalToolPermissionChecker', () => {
    const checker = new TerminalToolPermissionChecker();

    it('supports run_terminal tool', () => {
      expect(checker.supports({ name: 'run_terminal', family: 'terminal' } as any)).toBe(true);
    });

    it('does not support other tools', () => {
      expect(checker.supports({ name: 'other', family: 'terminal' } as any)).toBe(false);
    });

    it('asks for empty command', () => {
      const result = checker.check(makeTool({ name: 'run_terminal' }), { command: '' });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('ask');
    });

    it('denies rm -rf command', () => {
      const result = checker.check(makeTool({ name: 'run_terminal' }), { command: 'rm -rf /tmp' });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
    });

    it('returns undefined for safe command', () => {
      const result = checker.check(makeTool({ name: 'run_terminal' }), { command: 'ls -la' });
      expect(result).toBeUndefined();
    });
  });

  describe('WorkspacePathPermissionChecker', () => {
    const checker = new WorkspacePathPermissionChecker();

    it('supports filesystem family', () => {
      expect(checker.supports({ name: 'write_file', family: 'filesystem' } as any)).toBe(true);
    });

    it('supports scaffold family', () => {
      expect(checker.supports({ name: 'scaffold', family: 'scaffold' } as any)).toBe(true);
    });

    it('denies absolute path', () => {
      const result = checker.check(makeTool({ family: 'filesystem' }), { path: '/etc/passwd' });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
    });

    it('denies path with ~', () => {
      const result = checker.check(makeTool({ family: 'filesystem' }), { path: '~/secret' });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
    });

    it('denies path with ..', () => {
      const result = checker.check(makeTool({ family: 'filesystem' }), { path: 'src/../../../etc' });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('deny');
    });

    it('returns undefined for safe path', () => {
      const result = checker.check(makeTool({ family: 'filesystem' }), { path: 'src/index.ts' });
      expect(result).toBeUndefined();
    });

    it('returns undefined when no path fields provided', () => {
      const result = checker.check(makeTool({ family: 'filesystem' }), {});
      expect(result).toBeUndefined();
    });
  });

  describe('HttpMethodPermissionChecker', () => {
    const checker = new HttpMethodPermissionChecker();

    it('supports http_request tool', () => {
      expect(checker.supports({ name: 'http_request', family: 'http' } as any)).toBe(true);
    });

    it('supports mcp family', () => {
      expect(checker.supports({ name: 'other', family: 'mcp' } as any)).toBe(true);
    });

    it('asks for POST request', () => {
      const result = checker.check(makeTool({ name: 'http_request' }), {
        method: 'POST',
        url: 'https://api.example.com'
      });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('ask');
    });

    it('asks for DELETE request', () => {
      const result = checker.check(makeTool({ name: 'http_request' }), { method: 'DELETE' });
      expect(result).toBeDefined();
      expect(result!.decision).toBe('ask');
    });

    it('returns undefined for GET request', () => {
      const result = checker.check(makeTool({ name: 'http_request' }), { method: 'GET' });
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-http_request tool even with mcp family', () => {
      const result = checker.check(makeTool({ name: 'other', family: 'mcp' }), { method: 'POST' });
      expect(result).toBeUndefined();
    });
  });

  describe('mergeGovernanceDecisions', () => {
    it('returns undefined when no results', () => {
      expect(mergeGovernanceDecisions()).toBeUndefined();
    });

    it('returns the single result when only one', () => {
      const result = { decision: 'allow' as const, reason: 'test' };
      expect(mergeGovernanceDecisions(result)).toBe(result);
    });

    it('returns highest priority decision', () => {
      const allow = { decision: 'allow' as const, reason: 'allow' };
      const deny = { decision: 'deny' as const, reason: 'deny' };
      expect(mergeGovernanceDecisions(allow, deny)!.decision).toBe('deny');
    });

    it('prioritizes ask over allow', () => {
      const allow = { decision: 'allow' as const, reason: 'allow' };
      const ask = { decision: 'ask' as const, reason: 'ask' };
      expect(mergeGovernanceDecisions(allow, ask)!.decision).toBe('ask');
    });

    it('filters out undefined results', () => {
      const deny = { decision: 'deny' as const, reason: 'deny' };
      expect(mergeGovernanceDecisions(undefined, deny, undefined)!.decision).toBe('deny');
    });
  });
});
