import { describe, expect, it, vi } from 'vitest';

import {
  approveSkillInstallWithGovernance,
  installRemoteSkillWithGovernance
} from '../../../src/runtime/actions/runtime-skill-install-actions';
import { createDirectorySource } from './runtime-skill-install-actions.test-helpers';

describe('runtime-skill-install-actions remote', () => {
  it('forces approval for agent-chat initiated remote installs and returns failed receipts on install failures', async () => {
    const writeSkillInstallReceipt = vi.fn();
    const finalizeRemoteSkillInstall = vi.fn();

    const approvedReceipt = await installRemoteSkillWithGovernance({
      dto: { actor: 'agent-chat-user', repo: 'example/skills', skillName: 'find-skills', summary: '需要先安装' },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => [createDirectorySource()]),
      writeSkillInstallReceipt,
      finalizeRemoteSkillInstall
    });
    expect(approvedReceipt.status).toBe('approved');

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

    const approvedFailure = await approveSkillInstallWithGovernance({
      receiptId: failedReceipt.id,
      dto: { actor: 'agent-chat-user', reason: 'approved_from_chat_thread' },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      getSkillInstallReceipt: vi
        .fn()
        .mockResolvedValueOnce({
          ...failedReceipt,
          phase: 'requested',
          status: 'pending',
          result: 'waiting_for_install_approval'
        })
        .mockResolvedValueOnce(failedReceipt),
      listSkillSources: vi.fn(async () => [createDirectorySource()]),
      listSkillManifests: vi.fn(async () => []),
      writeSkillInstallReceipt: vi.fn(async () => undefined),
      finalizeSkillInstall: vi.fn(async () => undefined),
      finalizeRemoteSkillInstall: vi.fn(async () => {
        throw new Error('npx failed');
      })
    });
    expect(approvedFailure.status).toBe('failed');
  });

  it('returns failed direct remote receipts and preserves repo-only installs without inventing a skillName', async () => {
    const failedDirect = await installRemoteSkillWithGovernance({
      dto: { actor: 'agent-chat-user', repo: 'example/skills', skillName: 'find-skills', summary: '需要先安装' },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => [createDirectorySource('community')]),
      writeSkillInstallReceipt: vi.fn(),
      finalizeRemoteSkillInstall: vi.fn(async receipt => {
        receipt.status = 'failed';
        receipt.phase = 'failed';
        receipt.result = 'install_failed';
        receipt.failureCode = 'npx failed';
        throw new Error('npx failed');
      })
    });
    expect(failedDirect.status).toBe('failed');

    const repoOnly = await installRemoteSkillWithGovernance({
      dto: { actor: 'agent-chat-user', repo: 'larksuite/cli', summary: '安装 larksuite/cli' },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => [createDirectorySource()]),
      writeSkillInstallReceipt: vi.fn(),
      finalizeRemoteSkillInstall: vi.fn(async () => undefined)
    });
    expect(repoOnly.skillName).toBeUndefined();
    expect(repoOnly.skillId).toBe('remote-larksuite-cli');
  });
});
