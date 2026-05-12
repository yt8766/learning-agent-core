import { describe, expect, it, vi } from 'vitest';

import {
  assertSafeSkillsShellCommand,
  assertSafeSkillsArgs,
  buildSkillsAddArgs,
  buildSkillsAddCommand,
  normalizeRepoForInstall,
  buildSkillsCheckCommandPlan,
  buildSkillsUpdateCommandPlan
} from '../../../src/runtime/skills/runtime-skill-cli';

describe('runtime-skill-cli - branch coverage', () => {
  describe('normalizeRepoForInstall', () => {
    it('passes through http URLs', () => {
      expect(normalizeRepoForInstall('http://example.com/repo')).toBe('http://example.com/repo');
    });

    it('passes through https URLs', () => {
      expect(normalizeRepoForInstall('https://github.com/org/repo')).toBe('https://github.com/org/repo');
    });

    it('prepends github for shorthand', () => {
      expect(normalizeRepoForInstall('org/repo')).toBe('https://github.com/org/repo');
    });
  });

  describe('buildSkillsAddArgs', () => {
    it('builds args without skillName', () => {
      const result = buildSkillsAddArgs({ repo: 'org/repo' });
      expect(result).toEqual(['skills', 'add', 'https://github.com/org/repo', '-g', '-y']);
    });

    it('builds args with remote URL and skillName', () => {
      const result = buildSkillsAddArgs({ repo: 'https://skills.sh/org/repo', skillName: 'my-skill' });
      expect(result).toContain('--skill');
      expect(result).toContain('my-skill');
    });

    it('builds args with shorthand and skillName', () => {
      const result = buildSkillsAddArgs({ repo: 'org/repo', skillName: 'my-skill' });
      expect(result[2]).toBe('org/repo@my-skill');
    });
  });

  describe('assertSafeSkillsShellCommand', () => {
    it('rejects empty command', () => {
      expect(() => assertSafeSkillsShellCommand('')).toThrow('empty');
      expect(() => assertSafeSkillsShellCommand('   ')).toThrow('empty');
    });

    it('rejects dangerous fragments', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills add foo && bar')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add foo || bar')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add foo; bar')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add foo | bar')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add foo > bar')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add foo < bar')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add $(foo)')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add `foo`')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add\nfoo')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills add\rfoo')).toThrow('unsafe');
    });

    it('rejects when first token is not npx', () => {
      expect(() => assertSafeSkillsShellCommand('node skills add foo')).toThrow('unsafe');
    });

    it('rejects when second token is not skills', () => {
      expect(() => assertSafeSkillsShellCommand('npx tools add foo')).toThrow('unsafe');
    });

    it('rejects when subcommand is not add/check/update', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills remove foo')).toThrow('unsafe');
      expect(() => assertSafeSkillsShellCommand('npx skills')).toThrow('unsafe');
    });

    it('rejects rm -rf pattern', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills add rm -rf /')).toThrow('unsafe');
    });

    it('rejects del /s pattern', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills add del /s')).toThrow('unsafe');
    });

    it('accepts valid add command', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills add org/repo -g -y')).not.toThrow();
    });

    it('accepts valid check command', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills check')).not.toThrow();
    });

    it('accepts valid update command', () => {
      expect(() => assertSafeSkillsShellCommand('npx skills update')).not.toThrow();
    });
  });

  describe('assertSafeSkillsArgs', () => {
    it('rejects args with less than 2 elements', () => {
      expect(() => assertSafeSkillsArgs(['skills'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs([])).toThrow('unsafe');
    });

    it('rejects when first arg is not skills', () => {
      expect(() => assertSafeSkillsArgs(['tools', 'add'])).toThrow('unsafe');
    });

    it('rejects when subcommand is not add/check/update', () => {
      expect(() => assertSafeSkillsArgs(['skills', 'remove'])).toThrow('unsafe');
    });

    it('rejects dangerous fragments in args', () => {
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo&&bar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo||bar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo;bar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo|bar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo>bar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo<bar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', '$(foo)'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', '`foo`'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo\nbar'])).toThrow('unsafe');
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'foo\rbar'])).toThrow('unsafe');
    });

    it('rejects rm -rf pattern in args', () => {
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'rm -rf /'])).toThrow('unsafe');
    });

    it('rejects del /s pattern in args', () => {
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'del /s'])).toThrow('unsafe');
    });

    it('accepts valid args', () => {
      expect(() => assertSafeSkillsArgs(['skills', 'add', 'org/repo', '-g', '-y'])).not.toThrow();
      expect(() => assertSafeSkillsArgs(['skills', 'check'])).not.toThrow();
      expect(() => assertSafeSkillsArgs(['skills', 'update'])).not.toThrow();
    });
  });

  describe('command plans', () => {
    it('builds check command plan', () => {
      const plan = buildSkillsCheckCommandPlan();
      expect(plan.command).toBe('npx');
      expect(plan.args).toEqual(['skills', 'check']);
    });

    it('builds update command plan', () => {
      const plan = buildSkillsUpdateCommandPlan();
      expect(plan.command).toBe('npx');
      expect(plan.args).toEqual(['skills', 'update']);
    });
  });
});
