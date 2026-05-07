import { describe, expect, it, vi } from 'vitest';

import {
  assertSafeSkillsShellCommand,
  buildSkillsAddArgs,
  buildSkillsAddCommand,
  buildSkillsAddCommandPlan,
  buildSkillsCheckCommand,
  buildSkillsUpdateCommand,
  normalizeRepoForInstall
} from '../../../src/runtime/skills/runtime-skill-cli';

describe('runtime-skill-cli', () => {
  it('normalizes repos and builds add args for github shorthand and remote urls', () => {
    expect(normalizeRepoForInstall('acme/skills')).toBe('https://github.com/acme/skills');
    expect(normalizeRepoForInstall('https://skills.sh/acme/skills')).toBe('https://skills.sh/acme/skills');

    expect(buildSkillsAddArgs({ repo: 'acme/skills', skillName: 'repo-review' })).toEqual([
      'skills',
      'add',
      'acme/skills@repo-review',
      '-g',
      '-y'
    ]);

    expect(buildSkillsAddArgs({ repo: 'https://skills.sh/acme/skills', skillName: 'repo-review' })).toEqual([
      'skills',
      'add',
      'https://skills.sh/acme/skills',
      '-g',
      '-y',
      '--skill',
      'repo-review'
    ]);
  });

  it('builds an executable command plan without shell operators', () => {
    expect(buildSkillsAddCommandPlan({ repo: 'vercel-labs/skills', skillName: 'find-skills' })).toEqual({
      command: 'npx',
      args: ['skills', 'add', 'vercel-labs/skills@find-skills', '-g', '-y']
    });
  });

  it('quotes shell arguments that contain spaces and keeps simple commands unquoted', () => {
    expect(buildSkillsAddCommand({ repo: 'acme/skills', skillName: 'repo-review' })).toBe(
      'npx skills add acme/skills@repo-review -g -y'
    );
    expect(buildSkillsAddCommand({ repo: 'owner/repo with spaces', skillName: "skill'name" })).toBe(
      `npx skills add 'owner/repo with spaces@skill'"'"'name' -g -y`
    );
    expect(buildSkillsCheckCommand()).toBe('npx skills check');
    expect(buildSkillsUpdateCommand()).toBe('npx skills update');
  });

  it('accepts only safe skills shell commands', () => {
    expect(() => assertSafeSkillsShellCommand('npx skills add acme/skills@repo-review -g -y')).not.toThrow();
    expect(() => assertSafeSkillsShellCommand('npx skills check')).not.toThrow();
    expect(() => assertSafeSkillsShellCommand('npx skills update')).not.toThrow();

    expect(() => assertSafeSkillsShellCommand('')).toThrow('skills shell command is empty');
    expect(() => assertSafeSkillsShellCommand('npm skills add test')).toThrow('unsafe skills shell command');
    expect(() => assertSafeSkillsShellCommand('npx skills remove')).toThrow('unsafe skills shell command');
    expect(() => assertSafeSkillsShellCommand('npx skills add foo && rm -rf /')).toThrow('unsafe skills shell command');
  });
});
