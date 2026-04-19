import { describe, expect, it, vi } from 'vitest';

import {
  createApproveSkillInstallGovernanceContext,
  createInstallRemoteSkillGovernanceContext,
  createInstallSkillGovernanceContext,
  createRejectSkillInstallGovernanceContext
} from '../../../../src/runtime/domain/skills/runtime-skill-governance-context';

describe('runtime skill governance context', () => {
  function createContext() {
    return {
      runtimeStateRepository: { load: vi.fn(), save: vi.fn() },
      getSkillInstallContext: () => ({
        installRoot: '/tmp/skills',
        receiptsRoot: '/tmp/receipts',
        remoteSkillCli: { check: vi.fn(), update: vi.fn() }
      }),
      getSkillSourcesContext: () => ({
        workspaceRoot: '/workspace',
        manifestsRoot: '/workspace/skills',
        skillSourceSyncService: { syncSource: vi.fn() }
      })
    } as any;
  }

  it('builds install and approval governance contexts with shared lifecycle closures', async () => {
    const ctx = createContext();

    const installInput = createInstallSkillGovernanceContext(ctx, { skillId: 'skill-a' });
    const remoteInput = createInstallRemoteSkillGovernanceContext(ctx, { repo: 'vercel-labs/skills' });
    const approveInput = createApproveSkillInstallGovernanceContext(ctx, 'receipt-1', {
      actor: 'tester'
    } as any);
    const rejectInput = createRejectSkillInstallGovernanceContext(ctx, 'receipt-2', {
      actor: 'tester'
    } as any);

    expect(installInput.dto).toEqual({ skillId: 'skill-a' });
    expect(remoteInput.dto).toEqual({ repo: 'vercel-labs/skills' });
    expect(approveInput.receiptId).toBe('receipt-1');
    expect(rejectInput.receiptId).toBe('receipt-2');
    expect(typeof installInput.listSkillSources).toBe('function');
    expect(typeof installInput.finalizeSkillInstall).toBe('function');
    expect(typeof remoteInput.finalizeRemoteSkillInstall).toBe('function');
    expect(typeof approveInput.getSkillInstallReceipt).toBe('function');
    expect(typeof rejectInput.writeSkillInstallReceipt).toBe('function');
  });
});
