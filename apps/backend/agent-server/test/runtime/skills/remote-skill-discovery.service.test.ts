import { describe, expect, it } from 'vitest';

import {
  RemoteSkillDiscoveryService,
  determineSkillTriggerReason
} from '../../../src/runtime/skills/remote-skill-discovery.service';
import { assertSafeSkillsShellCommand } from '../../../src/runtime/skills/runtime-skill-cli';

describe('RemoteSkillDiscoveryService', () => {
  it('detects explicit user-requested skill intent', () => {
    expect(determineSkillTriggerReason('帮我去 skills.sh 找一个 skill', false)).toBe('user_requested');
  });

  it('detects domain specialization need from professional goals', () => {
    expect(determineSkillTriggerReason('请做一次支付风控架构审查', false)).toBe('domain_specialization_needed');
  });

  it('merges parsed remote candidates when local skills are insufficient', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout:
        'Top result: https://skills.sh/vercel-labs/skills/find-skills\nInstall with: npx skills add vercel-labs/skills@find-skills -g -y',
      stderr: ''
    }));

    const result = await service.discover({
      goal: '请找一个能处理 OpenClaw 架构分析的 skill',
      installedSkills: [],
      manifests: [],
      sources: [],
      profile: 'platform',
      limit: 5
    });

    expect(result.triggerReason).toBe('user_requested');
    expect(result.suggestions.some(item => item.kind === 'remote-skill')).toBe(true);
    expect(result.remoteSearch?.results[0]).toEqual(
      expect.objectContaining({
        repo: 'vercel-labs/skills',
        skillName: 'find-skills',
        discoverySource: 'skills.sh'
      })
    );
  });

  it('filters placeholder install examples so owner/repo and npx are not treated as a real skill', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout:
        'Install with npx skills add <owner/repo@skill>\nInstall with: npx skills add https://github.com/owner/repo --skill npx',
      stderr: ''
    }));

    const result = await service.discover({
      goal: '帮我找一个 skill',
      installedSkills: [],
      manifests: [],
      sources: [],
      profile: 'platform',
      limit: 5
    });

    expect(result.remoteSearch?.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: 'vercel-labs/skills',
          skillName: 'find-skills'
        })
      ])
    );
    expect(result.remoteSearch?.results.some(item => item.repo === 'owner/repo')).toBe(false);
    expect(result.remoteSearch?.results.some(item => item.skillName === 'npx')).toBe(false);
  });

  it('uses owner/repo@skill shorthand for GitHub installs', async () => {
    let called: { command: string; args: string[] } | undefined;
    const service = new RemoteSkillDiscoveryService(async (command, args) => {
      called = { command, args };
      return {
        stdout: '',
        stderr: ''
      };
    });

    const result = await service.installRemoteSkill({
      repo: 'larksuite/cli',
      skillName: 'find-skills'
    });

    expect(result).toEqual({ stdout: '', stderr: '' });
    expect(called).toEqual({
      command: 'npx',
      args: ['skills', 'add', 'larksuite/cli@find-skills', '-g', '-y']
    });
  });

  it('forwards skills check and update commands', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const service = new RemoteSkillDiscoveryService(async (command, args) => {
      calls.push({ command, args });
      return {
        stdout: 'ok',
        stderr: ''
      };
    });

    await service.checkInstalledSkills();
    await service.updateInstalledSkills();

    expect(calls).toEqual([
      { command: 'npx', args: ['skills', 'check'] },
      { command: 'npx', args: ['skills', 'update'] }
    ]);
  });

  it('rejects dangerous shell fragments even if a command string is injected', () => {
    expect(() => assertSafeSkillsShellCommand('npx skills add larksuite/cli@find-skills -g -y && rm -rf /')).toThrow(
      /unsafe skills shell command/
    );
    expect(() => assertSafeSkillsShellCommand('npx skills check | cat')).toThrow(/unsafe skills shell command/);
    expect(() => assertSafeSkillsShellCommand('bash -lc rm -rf /')).toThrow(/unsafe skills shell command/);
  });
});
