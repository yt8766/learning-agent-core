import { describe, expect, it } from 'vitest';

import {
  isDangerousPath,
  matchesAny,
  shouldInvokeClassifier,
  GOVERNANCE_INTENTS,
  DESTRUCTIVE_COMMAND_PATTERNS,
  SAFE_TERMINAL_COMMAND_PATTERNS,
  HIGH_RISK_TARGET_PATTERNS
} from '../src/governance/approval/approval-rules';
import { ActionIntent } from '@agent/core';

describe('approval-rules (direct)', () => {
  describe('GOVERNANCE_INTENTS', () => {
    it('contains expected intents', () => {
      expect(GOVERNANCE_INTENTS.has(ActionIntent.PROMOTE_SKILL)).toBe(true);
      expect(GOVERNANCE_INTENTS.has(ActionIntent.ENABLE_PLUGIN)).toBe(true);
      expect(GOVERNANCE_INTENTS.has(ActionIntent.MODIFY_RULE)).toBe(true);
    });
  });

  describe('DESTRUCTIVE_COMMAND_PATTERNS', () => {
    it('matches rm -rf', () => {
      expect(DESTRUCTIVE_COMMAND_PATTERNS.some(p => p.test('rm -rf /tmp'))).toBe(true);
    });

    it('matches git reset --hard', () => {
      expect(DESTRUCTIVE_COMMAND_PATTERNS.some(p => p.test('git reset --hard HEAD'))).toBe(true);
    });

    it('matches git clean -f', () => {
      expect(DESTRUCTIVE_COMMAND_PATTERNS.some(p => p.test('git clean -fd'))).toBe(true);
    });

    it('does not match safe commands', () => {
      expect(DESTRUCTIVE_COMMAND_PATTERNS.some(p => p.test('ls -la'))).toBe(false);
    });
  });

  describe('SAFE_TERMINAL_COMMAND_PATTERNS', () => {
    it('matches pnpm build', () => {
      expect(SAFE_TERMINAL_COMMAND_PATTERNS.some(p => p.test('pnpm build'))).toBe(true);
    });

    it('matches pnpm test', () => {
      expect(SAFE_TERMINAL_COMMAND_PATTERNS.some(p => p.test('pnpm test'))).toBe(true);
    });

    it('matches npm run lint', () => {
      expect(SAFE_TERMINAL_COMMAND_PATTERNS.some(p => p.test('npm run lint'))).toBe(true);
    });

    it('matches tsc', () => {
      expect(SAFE_TERMINAL_COMMAND_PATTERNS.some(p => p.test('tsc --noEmit'))).toBe(true);
    });

    it('matches vitest', () => {
      expect(SAFE_TERMINAL_COMMAND_PATTERNS.some(p => p.test('vitest run'))).toBe(true);
    });
  });

  describe('HIGH_RISK_TARGET_PATTERNS', () => {
    it('matches main', () => {
      expect(HIGH_RISK_TARGET_PATTERNS.some(p => p.test('main'))).toBe(true);
    });

    it('matches production', () => {
      expect(HIGH_RISK_TARGET_PATTERNS.some(p => p.test('production'))).toBe(true);
    });

    it('matches release', () => {
      expect(HIGH_RISK_TARGET_PATTERNS.some(p => p.test('release'))).toBe(true);
    });
  });

  describe('isDangerousPath', () => {
    it('returns true for absolute paths', () => {
      expect(isDangerousPath('/etc/passwd')).toBe(true);
    });

    it('returns true for paths with ..', () => {
      expect(isDangerousPath('src/../../../etc/passwd')).toBe(true);
    });

    it('returns true for .git directory', () => {
      expect(isDangerousPath('.git/config')).toBe(true);
    });

    it('returns true for empty path', () => {
      expect(isDangerousPath('')).toBe(true);
    });

    it('returns true for whitespace path', () => {
      expect(isDangerousPath('   ')).toBe(true);
    });

    it('returns false for safe relative paths', () => {
      expect(isDangerousPath('src/index.ts')).toBe(false);
    });

    it('returns true for .svn directory', () => {
      expect(isDangerousPath('.svn/entries')).toBe(true);
    });
  });

  describe('matchesAny', () => {
    it('returns true when value matches at least one pattern', () => {
      expect(matchesAny('rm -rf /tmp', DESTRUCTIVE_COMMAND_PATTERNS)).toBe(true);
    });

    it('returns false when value matches no patterns', () => {
      expect(matchesAny('ls -la', DESTRUCTIVE_COMMAND_PATTERNS)).toBe(false);
    });

    it('returns false for empty patterns', () => {
      expect(matchesAny('anything', [])).toBe(false);
    });
  });

  describe('shouldInvokeClassifier', () => {
    it('returns true for non-safe terminal commands', () => {
      const tool = { name: 'run_terminal', family: 'terminal' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { command: 'curl https://evil.com' })).toBe(true);
    });

    it('returns false for safe terminal commands', () => {
      const tool = { name: 'run_terminal', family: 'terminal' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { command: 'pnpm build' })).toBe(false);
    });

    it('returns false for empty terminal command', () => {
      const tool = { name: 'run_terminal', family: 'terminal' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { command: '' })).toBe(false);
    });

    it('returns true for filesystem write with path', () => {
      const tool = { name: 'write_file', family: 'filesystem' } as any;
      expect(shouldInvokeClassifier(ActionIntent.WRITE_FILE, tool, { path: 'src/index.ts' })).toBe(true);
    });

    it('returns false for filesystem write without path', () => {
      const tool = { name: 'write_file', family: 'filesystem' } as any;
      expect(shouldInvokeClassifier(ActionIntent.WRITE_FILE, tool, {})).toBe(false);
    });

    it('returns true for http POST request', () => {
      const tool = { name: 'http_request', family: 'http' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { method: 'POST' })).toBe(true);
    });

    it('returns false for http GET request', () => {
      const tool = { name: 'http_request', family: 'http' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { method: 'GET' })).toBe(false);
    });

    it('returns true for http DELETE request', () => {
      const tool = { name: 'http_request', family: 'http' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { method: 'DELETE' })).toBe(true);
    });

    it('returns false for unknown tool type', () => {
      const tool = { name: 'unknown', family: 'unknown' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool)).toBe(false);
    });
  });
});
