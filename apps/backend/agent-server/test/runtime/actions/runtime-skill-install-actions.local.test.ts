import { describe, expect, it, vi } from 'vitest';

import {
  approveSkillInstallWithGovernance,
  installSkillWithGovernance,
  rejectSkillInstallWithGovernance
} from '../../../src/runtime/actions/runtime-skill-install-actions';
import { createInternalSkillSource } from './runtime-skill-install-actions.test-helpers';

describe('runtime-skill-install-actions local', () => {
  it('requests approval or installs immediately for local manifests and rejects invalid dependencies', async () => {
    const source = createInternalSkillSource();
    const manifest = { id: 'manifest-1', sourceId: 'source-1', version: '1.2.3', integrity: 'sha256-abc' } as never;
    const writeSkillInstallReceipt = vi.fn(async () => undefined);
    const finalizeSkillInstall = vi.fn(async () => undefined);

    const installed = await installSkillWithGovernance({
      dto: { manifestId: 'manifest-1', actor: 'agent-admin-user' } as never,
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => [source]),
      listSkillManifests: vi.fn(async () => [manifest]),
      evaluateSkillManifestSafety: vi.fn(() => ({ verdict: 'allow' })),
      writeSkillInstallReceipt,
      finalizeSkillInstall
    });
    expect(installed.status).toBe('installed');

    const pending = await installSkillWithGovernance({
      dto: { manifestId: 'manifest-1', actor: 'agent-admin-user' } as never,
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      listSkillSources: vi.fn(async () => [{ ...source, trustClass: 'community' }]),
      listSkillManifests: vi.fn(async () => [manifest]),
      evaluateSkillManifestSafety: vi.fn(() => ({ verdict: 'needs-approval' })),
      writeSkillInstallReceipt,
      finalizeSkillInstall
    });
    expect(pending.status).toBe('pending');

    await expect(
      installSkillWithGovernance({
        dto: { manifestId: 'missing-manifest' } as never,
        runtimeStateRepository: {
          load: vi.fn(async () => ({ governanceAudit: [] })),
          save: vi.fn(async () => undefined)
        },
        listSkillSources: vi.fn(async () => [source]),
        listSkillManifests: vi.fn(async () => []),
        evaluateSkillManifestSafety: vi.fn(() => ({ verdict: 'allow' })),
        writeSkillInstallReceipt,
        finalizeSkillInstall
      })
    ).rejects.toThrow(/Skill manifest missing-manifest not found/);
  });

  it('approves, rejects, and short-circuits local install receipts', async () => {
    const source = createInternalSkillSource();
    const installed = {
      id: 'receipt-installed',
      skillId: 'manifest-1',
      sourceId: 'source-1',
      status: 'installed'
    } as never;

    await expect(
      approveSkillInstallWithGovernance({
        receiptId: installed.id,
        dto: {} as never,
        runtimeStateRepository: {
          load: vi.fn(async () => ({ governanceAudit: [] })),
          save: vi.fn(async () => undefined)
        },
        getSkillInstallReceipt: vi.fn(async () => installed),
        listSkillSources: vi.fn(async () => [source]),
        listSkillManifests: vi.fn(async () => []),
        writeSkillInstallReceipt: vi.fn(async () => undefined),
        finalizeSkillInstall: vi.fn(async () => undefined),
        finalizeRemoteSkillInstall: vi.fn(async () => undefined)
      })
    ).resolves.toBe(installed);

    const getSkillInstallReceipt = vi
      .fn()
      .mockResolvedValueOnce({ id: 'receipt-local', skillId: 'manifest-1', sourceId: 'source-1', status: 'pending' })
      .mockResolvedValueOnce({ id: 'receipt-reject', skillId: 'manifest-1', sourceId: 'source-1', status: 'pending' });
    const writeSkillInstallReceipt = vi.fn(async () => undefined);

    const approved = await approveSkillInstallWithGovernance({
      receiptId: 'receipt-local',
      dto: { actor: 'reviewer-a' } as never,
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      getSkillInstallReceipt,
      listSkillSources: vi.fn(async () => [source]),
      listSkillManifests: vi.fn(async () => [{ id: 'manifest-1', sourceId: 'source-1' } as never]),
      writeSkillInstallReceipt,
      finalizeSkillInstall: vi.fn(async () => {
        throw new Error('install failed');
      }),
      finalizeRemoteSkillInstall: vi.fn(async () => undefined)
    });
    expect(approved).toEqual(expect.objectContaining({ id: 'receipt-reject' }));

    const rejected = await rejectSkillInstallWithGovernance({
      receiptId: 'receipt-reject',
      dto: { actor: 'reviewer-b', reason: 'manual rejection' } as never,
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governanceAudit: [] })),
        save: vi.fn(async () => undefined)
      },
      getSkillInstallReceipt: vi.fn(async () => ({
        id: 'receipt-reject',
        skillId: 'manifest-1',
        sourceId: 'source-1',
        status: 'pending'
      })),
      writeSkillInstallReceipt
    });
    expect(rejected).toEqual(expect.objectContaining({ status: 'rejected', result: 'manual rejection' }));
  });
});
