import { describe, expect, it, vi } from 'vitest';

const {
  autoInstallLocalManifestMock,
  finalizeRemoteSkillInstallMock,
  finalizeSkillInstallMock,
  writeSkillInstallReceiptMock,
  resolveTaskSkillSearchMock,
  searchLocalSkillSuggestionsMock,
  listSkillSourcesMock
} = vi.hoisted(() => ({
  autoInstallLocalManifestMock: vi.fn(),
  finalizeRemoteSkillInstallMock: vi.fn(),
  finalizeSkillInstallMock: vi.fn(),
  writeSkillInstallReceiptMock: vi.fn(),
  resolveTaskSkillSearchMock: vi.fn(),
  searchLocalSkillSuggestionsMock: vi.fn(),
  listSkillSourcesMock: vi.fn()
}));

vi.mock('../../src/runtime/skills/runtime-skill-install.service', () => ({
  autoInstallLocalManifest: autoInstallLocalManifestMock,
  finalizeRemoteSkillInstall: finalizeRemoteSkillInstallMock,
  finalizeSkillInstall: finalizeSkillInstallMock,
  writeSkillInstallReceipt: writeSkillInstallReceiptMock
}));

vi.mock('../../src/runtime/skills/runtime-skill-sources.service', () => ({
  resolveTaskSkillSearch: resolveTaskSkillSearchMock,
  searchLocalSkillSuggestions: searchLocalSkillSuggestionsMock,
  listSkillSources: listSkillSourcesMock
}));

import {
  bindServiceMethods,
  completeRemoteSkillInstall,
  completeSkillInstall,
  createSkillInstallContext,
  createSkillSourcesContext,
  persistSkillInstallReceipt,
  resolvePreExecutionSkillIntervention,
  resolveRuntimeSkillIntervention,
  resolveSkillInstallApproval,
  resolveTaskSkillSuggestions,
  syncInstalledSkillWorkers
} from '../../src/runtime/runtime.service.helpers';

describe('runtime.service.helpers', () => {
  it('binds service methods to the source instance', () => {
    const source = {
      value: 7,
      readValue() {
        return this.value;
      }
    };
    const target: Record<string, unknown> = {};

    bindServiceMethods(target, source, ['readValue']);

    expect((target.readValue as () => number)()).toBe(7);
  });

  it('creates skill install and skill source contexts with delegated helpers', async () => {
    autoInstallLocalManifestMock.mockResolvedValueOnce({ installed: true });
    listSkillSourcesMock.mockResolvedValueOnce([{ id: 'source-1' }]);

    const input = {
      settings: { workspaceRoot: '/workspace' },
      toolRegistry: {},
      skillRegistry: {},
      skillSourceSyncService: {},
      remoteSkillDiscoveryService: {
        installRemoteSkill: vi.fn(async params => ({ ...params, status: 'installed' })),
        checkInstalledSkills: vi.fn(async () => ({ stdout: 'check', stderr: '' })),
        updateInstalledSkills: vi.fn(async () => ({ stdout: 'update', stderr: '' }))
      },
      getDisabledSkillSourceIds: vi.fn(async () => ['disabled-1'])
    };

    const installContext = createSkillInstallContext({
      settings: { workspaceRoot: '/workspace', skillReceiptsRoot: '/receipts', skillPackagesRoot: '/packages' },
      skillRegistry: { publishToLab: vi.fn() },
      skillArtifactFetcher: { fetchToStaging: vi.fn(), promoteFromStaging: vi.fn() },
      remoteSkillDiscoveryService: input.remoteSkillDiscoveryService,
      getSkillSourcesContext: () => ({ listSkillSources: async () => [{ id: 'source-2' }] }) as any,
      registerSkillWorker: vi.fn()
    });

    expect(await installContext.listSkillSources()).toEqual([{ id: 'source-2' }]);
    await expect(installContext.remoteSkillCli?.check()).resolves.toEqual({ stdout: 'check', stderr: '' });
    await expect(installContext.remoteSkillCli?.update()).resolves.toEqual({ stdout: 'update', stderr: '' });
    await expect(installContext.remoteSkillCli?.install({ repo: 'owner/repo', skillName: 'skill-a' })).resolves.toEqual(
      expect.objectContaining({ repo: 'owner/repo', skillName: 'skill-a', status: 'installed' })
    );

    const skillSourcesContext = createSkillSourcesContext({
      ...input,
      getSkillInstallContext: () => installContext
    });

    expect(await skillSourcesContext.getDisabledSkillSourceIds()).toEqual(['disabled-1']);
    await expect(skillSourcesContext.autoInstallLocalManifest?.({ id: 'manifest-1' } as any)).resolves.toEqual({
      installed: true
    });
    expect(await skillSourcesContext.listSkillSources?.()).toEqual([{ id: 'source-1' }]);
  });

  it('handles pre-execution intervention happy path, pending approval, ignored candidates and failures', async () => {
    resolveTaskSkillSearchMock.mockResolvedValue({ suggestions: [{ id: 'refreshed' }] });
    const centersService = {
      installRemoteSkill: vi
        .fn()
        .mockResolvedValueOnce({ id: 'receipt-pending', status: 'pending' })
        .mockResolvedValueOnce({ id: 'receipt-auto', status: 'pending', skillId: 'skill-auto' })
        .mockResolvedValueOnce({ id: 'receipt-failed', status: 'failed' })
        .mockRejectedValueOnce(new Error('boom')),
      approveSkillInstall: vi
        .fn()
        .mockResolvedValueOnce({ id: 'receipt-pending', status: 'pending' })
        .mockResolvedValueOnce({ id: 'receipt-auto', status: 'installed', skillId: 'skill-auto' })
    };
    const getSkillSourcesContext = () => ({}) as any;
    const candidate = {
      kind: 'remote-skill',
      availability: 'installable-remote',
      repo: 'vercel-labs/awesome-skill',
      displayName: 'Awesome Skill',
      skillName: 'awesome',
      installCommand: 'npx skills add',
      sourceLabel: 'skills.sh',
      triggerReason: 'capability_gap_detected'
    };

    const skipped = await resolvePreExecutionSkillIntervention({
      settings: { policy: { skillInstallMode: 'manual' } },
      centersService,
      getSkillSourcesContext,
      goal: 'do work',
      skillSearch: { suggestions: [candidate] }
    });
    expect(skipped).toBeUndefined();

    const pending = await resolvePreExecutionSkillIntervention({
      settings: { policy: { skillInstallMode: 'low-risk-auto' } },
      centersService,
      getSkillSourcesContext,
      goal: 'do work',
      skillSearch: {
        suggestions: [{ ...candidate, repo: 'someone/else', sourceLabel: 'skills.sh' }]
      }
    });
    expect(pending).toEqual(
      expect.objectContaining({
        pendingApproval: expect.objectContaining({ toolName: 'npx skills add' }),
        pendingExecution: expect.objectContaining({ receiptId: 'receipt-pending' })
      })
    );

    const success = await resolvePreExecutionSkillIntervention({
      settings: { policy: { skillInstallMode: 'low-risk-auto' } },
      centersService,
      getSkillSourcesContext,
      goal: 'do work',
      usedInstalledSkills: ['existing'],
      skillSearch: { suggestions: [candidate] }
    });
    expect(success).toEqual(
      expect.objectContaining({
        usedInstalledSkills: ['installed-skill:skill-auto'],
        skillSearch: { suggestions: [{ id: 'refreshed' }] }
      })
    );

    const failedStatus = await resolvePreExecutionSkillIntervention({
      settings: { policy: { skillInstallMode: 'low-risk-auto' } },
      centersService,
      getSkillSourcesContext,
      goal: 'do work',
      skillSearch: { suggestions: [{ ...candidate, repo: 'vercel-labs/second-skill' }] }
    });
    expect(failedStatus).toEqual(
      expect.objectContaining({
        traceSummary: expect.stringContaining('当前安装状态为 failed')
      })
    );

    const failedError = await resolvePreExecutionSkillIntervention({
      settings: { policy: { skillInstallMode: 'low-risk-auto' } },
      centersService,
      getSkillSourcesContext,
      goal: 'do work',
      skillSearch: { suggestions: [{ ...candidate, repo: 'vercel-labs/third-skill' }] }
    });
    expect(failedError).toEqual(
      expect.objectContaining({
        traceSummary: expect.stringContaining('安装失败：boom')
      })
    );
  });

  it('handles approval continuation, runtime-stage wrapping, local skill suggestions and sync', async () => {
    resolveTaskSkillSearchMock.mockResolvedValueOnce({ suggestions: [{ id: 'after-approval' }] });
    searchLocalSkillSuggestionsMock.mockResolvedValueOnce([{ id: 'local-skill' }]);
    const centersService = {
      approveSkillInstall: vi
        .fn()
        .mockResolvedValueOnce({ id: 'receipt-1', status: 'installed', skillId: 'skill-1' })
        .mockResolvedValueOnce({ id: 'receipt-2', status: 'pending', skillId: 'skill-2' })
    };

    const approved = await resolveSkillInstallApproval({
      centersService,
      getSkillSourcesContext: () => ({}) as any,
      task: { goal: 'do work', usedInstalledSkills: ['existing'] },
      pending: { receiptId: 'receipt-1', usedInstalledSkills: ['pending-existing'], skillDisplayName: 'Skill One' }
    });
    expect(approved).toEqual(
      expect.objectContaining({
        usedInstalledSkills: ['installed-skill:skill-1'],
        skillSearch: { suggestions: [{ id: 'after-approval' }] }
      })
    );

    const pending = await resolveSkillInstallApproval({
      centersService,
      getSkillSourcesContext: () => ({}) as any,
      task: { goal: 'do work' },
      pending: { receiptId: 'receipt-2', skillDisplayName: 'Skill Two' }
    });
    expect(pending).toEqual(
      expect.objectContaining({
        traceSummary: expect.stringContaining('状态仍为 pending')
      })
    );
    await expect(
      resolveSkillInstallApproval({
        centersService,
        getSkillSourcesContext: () => ({}) as any,
        task: { goal: 'do work' },
        pending: {}
      })
    ).resolves.toBeUndefined();

    const runtimeWrapped = await resolveRuntimeSkillIntervention({
      settings: { policy: { skillInstallMode: 'low-risk-auto' } },
      centersService: {
        installRemoteSkill: vi.fn().mockResolvedValue({ id: 'receipt-x', status: 'pending' })
      },
      getSkillSourcesContext: () => ({}) as any,
      goal: 'do work',
      currentStep: 'direct_reply',
      skillSearch: {
        suggestions: [
          {
            kind: 'remote-skill',
            availability: 'installable-remote',
            repo: 'someone/else',
            displayName: 'Skill X',
            sourceLabel: 'skills.sh'
          }
        ]
      }
    });
    expect(runtimeWrapped).toEqual(
      expect.objectContaining({
        traceSummary: expect.stringContaining('直答阶段')
      })
    );

    expect(await resolveTaskSkillSuggestions(() => ({ context: true }) as any, 'goal', { limit: 2 })).toEqual([
      { id: 'local-skill' }
    ]);

    const registerSkillWorker = vi.fn();
    await syncInstalledSkillWorkers({
      skillRegistry: {
        list: vi.fn(async () => [
          { id: 'installed-1', installReceiptId: 'r1' },
          { id: 'installed-2', sourceId: 's2' },
          { id: 'skip-me' }
        ])
      },
      registerSkillWorker
    });
    expect(registerSkillWorker).toHaveBeenCalledTimes(2);
  });

  it('delegates completion helpers to the install service module', async () => {
    const installContext = { id: 'install-context' } as any;
    const getSkillInstallContext = () => installContext;

    await completeSkillInstall({
      getSkillInstallContext,
      manifest: { id: 'manifest-1' },
      source: { id: 'source-1' },
      receipt: { id: 'receipt-1' }
    });
    await completeRemoteSkillInstall({
      getSkillInstallContext,
      receipt: { id: 'receipt-2' }
    });
    await persistSkillInstallReceipt({
      getSkillInstallContext,
      receipt: { id: 'receipt-3' }
    });

    expect(finalizeSkillInstallMock).toHaveBeenCalledWith(
      installContext,
      { id: 'manifest-1' },
      { id: 'source-1' },
      { id: 'receipt-1' }
    );
    expect(finalizeRemoteSkillInstallMock).toHaveBeenCalledWith(installContext, { id: 'receipt-2' });
    expect(writeSkillInstallReceiptMock).toHaveBeenCalledWith(installContext, { id: 'receipt-3' });
  });
});
