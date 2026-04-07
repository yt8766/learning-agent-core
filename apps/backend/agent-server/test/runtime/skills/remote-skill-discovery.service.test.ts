import { describe, expect, it, vi } from 'vitest';

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

  it('falls back to capability-gap trigger for generic goals', () => {
    expect(determineSkillTriggerReason('请继续推进当前任务', true)).toBe('capability_gap_detected');
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

  it('installs remote repos without a skill suffix when skillName is omitted', async () => {
    let called: { command: string; args: string[] } | undefined;
    const service = new RemoteSkillDiscoveryService(async (command, args) => {
      called = { command, args };
      return {
        stdout: '',
        stderr: ''
      };
    });

    const result = await service.installRemoteSkill({
      repo: 'vercel-labs/skills'
    });

    expect(result).toEqual({ stdout: '', stderr: '' });
    expect(called).toEqual({
      command: 'npx',
      args: ['skills', 'add', 'https://github.com/vercel-labs/skills', '-g', '-y']
    });
  });

  it('falls back to find-skills guidance when remote search fails or yields no parseable candidates', async () => {
    const failedService = new RemoteSkillDiscoveryService(async () => {
      throw new Error('network down');
    });
    const failed = await failedService.searchRemoteCandidates('请找 skill', 'user_requested', 3);
    expect(failed.results).toEqual([
      expect.objectContaining({
        repo: 'vercel-labs/skills',
        skillName: 'find-skills',
        reason: expect.stringContaining('network down')
      })
    ]);

    const emptyService = new RemoteSkillDiscoveryService(async () => ({
      stdout: 'no valid results here',
      stderr: ''
    }));
    const empty = await emptyService.searchRemoteCandidates('请找 skill', 'user_requested', 3);
    expect(empty.results).toEqual([
      expect.objectContaining({
        repo: 'vercel-labs/skills',
        skillName: 'find-skills'
      })
    ]);

    const unknownFailureService = new RemoteSkillDiscoveryService(async () => {
      throw 'boom';
    });
    const unknownFailure = await unknownFailureService.searchRemoteCandidates(
      '请找 skill',
      'capability_gap_detected',
      3
    );
    expect(unknownFailure.results).toEqual([
      expect.objectContaining({
        repo: 'vercel-labs/skills',
        skillName: 'find-skills',
        reason: expect.stringContaining('remote_skill_search_failed')
      })
    ]);
  });

  it('parses quoted skill names and applies specialization/query-match scoring', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout:
        'Use the "architecture-review" skill from github.com/acme/platform-skills --skill architecture-review for payment architecture review',
      stderr: ''
    }));

    const result = await service.searchRemoteCandidates(
      'payment architecture review',
      'domain_specialization_needed',
      5
    );

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        repo: 'acme/platform-skills',
        skillName: 'architecture-review',
        reason: '当前问题进入专业领域，建议引入更专业的 skill 再继续回答。'
      })
    );
    expect(result.results[0]?.score).toBeCloseTo(0.85, 5);
  });

  it('dedupes repeated remote results and boosts requested skill plus connector affinity', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout: [
        'https://skills.sh/acme/platform-skills/repo-review',
        'github.com/acme/platform-skills --skill repo-review',
        'github.com/acme/platform-skills --skill browser-helper'
      ].join('\n'),
      stderr: ''
    }));

    const result = await service.discover({
      goal: '请帮我 review repo 架构并接入 github connector',
      installedSkills: [],
      manifests: [],
      sources: [],
      profile: 'platform',
      requestedHints: {
        requestedSkill: 'repo-review',
        requestedConnectorTemplate: 'github'
      } as any,
      specialistDomain: 'technical-architecture',
      limit: 5
    });

    const repoReview = result.suggestions.find(item => item.skillName === 'repo-review');
    expect(result.suggestions.filter(item => item.skillName === 'repo-review')).toHaveLength(1);
    expect(repoReview).toEqual(
      expect.objectContaining({
        repo: 'acme/platform-skills',
        skillName: 'repo-review'
      })
    );
    expect(repoReview?.score ?? 0).toBeGreaterThan(0.8);
  });

  it('parses skills.sh direct urls and ignores placeholder "skills" entries', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout: [
        'Top result: https://skills.sh/team/repo/browser-audit',
        'Install with: npx skills add https://github.com/team/repo --skill skills'
      ].join('\n'),
      stderr: ''
    }));

    const result = await service.searchRemoteCandidates('browser audit', 'user_requested', 5);
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: 'team/repo',
          skillName: 'browser-audit',
          detailsUrl: 'https://skills.sh/team/repo/browser-audit'
        })
      ])
    );
    expect(result.results.some(item => item.skillName === 'skills')).toBe(false);
  });

  it('ignores owner/repo@skill placeholder lines even when a real repo token is also present', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout:
        'github.com/acme/platform-skills --skill repo-review owner/repo@skill\nhttps://skills.sh/team/repo/browser-audit',
      stderr: ''
    }));

    const result = await service.searchRemoteCandidates('browser audit', 'user_requested', 5);
    expect(result.results.some(item => item.repo === 'acme/platform-skills' && item.skillName === 'repo-review')).toBe(
      false
    );
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repo: 'team/repo',
          skillName: 'browser-audit'
        })
      ])
    );
  });

  it('uses capability-gap fallback copy and base score when query text does not match the remote line', async () => {
    const service = new RemoteSkillDiscoveryService(async () => ({
      stdout: 'github.com/acme/platform-skills --skill ops-helper',
      stderr: ''
    }));

    const result = await service.searchRemoteCandidates('totally unrelated query', 'capability_gap_detected', 5);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        repo: 'acme/platform-skills',
        reason: '当前能力链路存在缺口，已建议从 skills.sh 补充远程 skill。'
      })
    );
    expect(result.results[0]?.score).toBeCloseTo(0.62, 5);
  });

  it('rejects dangerous shell fragments even if a command string is injected', () => {
    expect(() => assertSafeSkillsShellCommand('npx skills add larksuite/cli@find-skills -g -y && rm -rf /')).toThrow(
      /unsafe skills shell command/
    );
    expect(() => assertSafeSkillsShellCommand('npx skills check | cat')).toThrow(/unsafe skills shell command/);
    expect(() => assertSafeSkillsShellCommand('bash -lc rm -rf /')).toThrow(/unsafe skills shell command/);
  });
});
