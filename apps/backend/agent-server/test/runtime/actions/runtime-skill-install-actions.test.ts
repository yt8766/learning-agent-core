import { describe, expect, it, vi } from 'vitest';
import type { SkillSourceRecord } from '@agent/shared';

import {
  approveSkillInstallWithGovernance,
  installRemoteSkillWithGovernance
} from '../../../src/runtime/actions/runtime-skill-install-actions';

describe('runtime-skill-install-actions', () => {
  it('forces approval for agent-chat initiated remote installs even when source is internal', async () => {
    const writeSkillInstallReceipt = vi.fn();
    const finalizeRemoteSkillInstall = vi.fn();

    const sources: SkillSourceRecord[] = [
      {
        id: 'skills-sh-directory',
        name: 'skills.sh Directory',
        kind: 'git',
        baseUrl: 'https://skills.sh',
        discoveryMode: 'git-registry',
        syncStrategy: 'on-demand',
        allowedProfiles: ['platform'],
        trustClass: 'internal',
        priority: 'bundled/marketplace',
        authMode: 'none',
        enabled: true
      }
    ];

    const receipt = await installRemoteSkillWithGovernance({
      dto: {
        actor: 'agent-chat-user',
        repo: 'example/skills',
        skillName: 'find-skills',
        summary: '需要先安装'
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => sources),
      writeSkillInstallReceipt,
      finalizeRemoteSkillInstall
    });

    expect(receipt.status).toBe('approved');
    expect(receipt.result).toBe('approved_pending_install');
    expect(finalizeRemoteSkillInstall).toHaveBeenCalled();
    expect(writeSkillInstallReceipt).toHaveBeenCalled();
  });

  it('returns failed receipt instead of throwing when approved remote install fails', async () => {
    const failedReceipt = {
      id: 'receipt_remote-vercel-labs-skills-find-skills_1',
      skillId: 'remote-vercel-labs-skills-find-skills',
      version: 'remote',
      sourceId: 'skills-sh-directory',
      phase: 'failed',
      status: 'failed',
      result: 'install_failed',
      repo: 'vercel-labs/skills',
      skillName: 'find-skills',
      failureCode: 'npx failed'
    } as const;

    const sources: SkillSourceRecord[] = [
      {
        id: 'skills-sh-directory',
        name: 'skills.sh Directory',
        kind: 'git',
        baseUrl: 'https://skills.sh',
        discoveryMode: 'git-registry',
        syncStrategy: 'on-demand',
        allowedProfiles: ['platform'],
        trustClass: 'internal',
        priority: 'bundled/marketplace',
        authMode: 'none',
        enabled: true
      }
    ];

    const getSkillInstallReceipt = vi
      .fn()
      .mockResolvedValueOnce({
        ...failedReceipt,
        phase: 'requested',
        status: 'pending',
        result: 'waiting_for_install_approval'
      })
      .mockResolvedValueOnce(failedReceipt);

    const result = await approveSkillInstallWithGovernance({
      receiptId: failedReceipt.id,
      dto: {
        actor: 'agent-chat-user',
        reason: 'approved_from_chat_thread'
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      getSkillInstallReceipt,
      listSkillSources: vi.fn(async () => sources),
      listSkillManifests: vi.fn(async () => []),
      writeSkillInstallReceipt: vi.fn(async () => undefined),
      finalizeSkillInstall: vi.fn(async () => undefined),
      finalizeRemoteSkillInstall: vi.fn(async () => {
        throw new Error('npx failed');
      })
    });

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('failed');
    expect(result.result).toBe('install_failed');
  });

  it('returns failed receipt instead of throwing when direct remote install fails', async () => {
    const writeSkillInstallReceipt = vi.fn();

    const sources: SkillSourceRecord[] = [
      {
        id: 'skills-sh-directory',
        name: 'skills.sh Directory',
        kind: 'git',
        baseUrl: 'https://skills.sh',
        discoveryMode: 'git-registry',
        syncStrategy: 'on-demand',
        allowedProfiles: ['platform'],
        trustClass: 'community',
        priority: 'bundled/marketplace',
        authMode: 'none',
        enabled: true
      }
    ];

    const receipt = await installRemoteSkillWithGovernance({
      dto: {
        actor: 'agent-chat-user',
        repo: 'example/skills',
        skillName: 'find-skills',
        summary: '需要先安装'
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => sources),
      writeSkillInstallReceipt,
      finalizeRemoteSkillInstall: vi.fn(async receiptArg => {
        receiptArg.status = 'failed';
        receiptArg.phase = 'failed';
        receiptArg.result = 'install_failed';
        receiptArg.failureCode = 'npx failed';
        throw new Error('npx failed');
      })
    });

    expect(receipt.status).toBe('failed');
    expect(receipt.phase).toBe('failed');
    expect(receipt.result).toBe('install_failed');
    expect(receipt.failureCode).toBe('npx failed');
  });

  it('does not invent a skillName for repo-only remote installs like larksuite/cli', async () => {
    const writeSkillInstallReceipt = vi.fn();
    const finalizeRemoteSkillInstall = vi.fn(async () => undefined);

    const sources: SkillSourceRecord[] = [
      {
        id: 'skills-sh-directory',
        name: 'skills.sh Directory',
        kind: 'git',
        baseUrl: 'https://skills.sh',
        discoveryMode: 'git-registry',
        syncStrategy: 'on-demand',
        allowedProfiles: ['platform'],
        trustClass: 'internal',
        priority: 'bundled/marketplace',
        authMode: 'none',
        enabled: true
      }
    ];

    const receipt = await installRemoteSkillWithGovernance({
      dto: {
        actor: 'agent-chat-user',
        repo: 'larksuite/cli',
        summary: '安装 larksuite/cli'
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => sources),
      writeSkillInstallReceipt,
      finalizeRemoteSkillInstall
    });

    expect(receipt.skillName).toBeUndefined();
    expect(receipt.skillId).toBe('remote-larksuite-cli');
  });
});
