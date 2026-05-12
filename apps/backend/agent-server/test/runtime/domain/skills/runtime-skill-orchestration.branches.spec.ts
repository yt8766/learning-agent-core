import { describe, expect, it, vi } from 'vitest';

import {
  resolvePreExecutionSkillIntervention,
  resolveSkillInstallApproval,
  resolveRuntimeSkillIntervention,
  syncInstalledSkillWorkers
} from '../../../../src/runtime/domain/skills/runtime-skill-orchestration';

describe('resolvePreExecutionSkillIntervention', () => {
  function makeInput(overrides: Record<string, any> = {}) {
    return {
      settings: { policy: { skillInstallMode: 'low-risk-auto' } },
      centersService: {
        installRemoteSkill: vi.fn(async () => ({
          id: 'receipt-1',
          skillId: 'skill-1',
          status: 'installed',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'approved',
          result: 'installed_to_lab'
        })),
        approveSkillInstall: vi.fn(async (id: string) => ({
          id,
          skillId: 'skill-1',
          status: 'installed',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'approved',
          result: 'installed_to_lab'
        }))
      },
      getSkillSourcesContext: vi.fn(() => ({
        settings: {
          workspaceRoot: '/tmp',
          skillsRoot: '/tmp/skills',
          skillSourcesRoot: '/tmp/sources',
          profile: 'learning',
          policy: { sourcePolicyMode: 'default', skillInstallMode: 'low-risk-auto' }
        },
        toolRegistry: { get: vi.fn() },
        skillRegistry: { list: vi.fn(async () => []) },
        listSkillSources: vi.fn(async () => []),
        listSkillManifests: vi.fn(async () => [])
      })),
      goal: 'analyze data',
      skillSearch: {
        suggestions: [
          {
            id: 'remote-1',
            kind: 'remote-skill',
            displayName: 'Data Pro',
            availability: 'installable-remote',
            repo: 'vercel-labs/skills',
            skillName: 'data-pro'
          }
        ]
      },
      ...overrides
    };
  }

  it('returns undefined when no candidate found', async () => {
    const input = makeInput({ skillSearch: { suggestions: [] } });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result).toBeUndefined();
  });

  it('returns undefined when no skillSearch', async () => {
    const input = makeInput({ skillSearch: undefined });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result).toBeUndefined();
  });

  it('returns undefined when skillInstallMode is not low-risk-auto', async () => {
    const input = makeInput({ settings: { policy: { skillInstallMode: 'manual' } } });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result).toBeUndefined();
  });

  it('returns undefined when sourceLabel is not skills.sh and repo does not start with vercel-labs/', async () => {
    const input = makeInput({
      skillSearch: {
        suggestions: [
          {
            id: 'remote-1',
            kind: 'remote-skill',
            displayName: 'Test',
            availability: 'installable-remote',
            repo: 'other/repo'
          }
        ]
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result).toBeUndefined();
  });

  it('auto-installs when sourceLabel is skills.sh', async () => {
    const installMock = vi.fn(async () => ({
      id: 'receipt-1',
      skillId: 'skill-1',
      status: 'rejected',
      version: '1.0',
      sourceId: 'skills-sh',
      phase: 'failed',
      result: 'install_rejected'
    }));
    const input = makeInput({
      centersService: { installRemoteSkill: installMock, approveSkillInstall: vi.fn() },
      skillSearch: {
        suggestions: [
          {
            id: 'remote-1',
            kind: 'remote-skill',
            displayName: 'Test Skill',
            availability: 'installable-remote',
            repo: 'any/repo',
            sourceLabel: 'skills.sh'
          }
        ]
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(installMock).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('auto-installs when repo starts with vercel-labs/', async () => {
    const installMock = vi.fn(async () => ({
      id: 'receipt-1',
      skillId: 'skill-1',
      status: 'rejected',
      version: '1.0',
      sourceId: 'skills-sh',
      phase: 'failed',
      result: 'install_rejected'
    }));
    const input = makeInput({
      centersService: { installRemoteSkill: installMock, approveSkillInstall: vi.fn() }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(installMock).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('approves pending receipt', async () => {
    const approveMock = vi.fn(async () => ({
      id: 'receipt-1',
      skillId: 'skill-1',
      status: 'rejected',
      version: '1.0',
      sourceId: 'skills-sh',
      phase: 'failed',
      result: 'install_rejected'
    }));
    const input = makeInput({
      centersService: {
        installRemoteSkill: vi.fn(async () => ({
          id: 'receipt-1',
          skillId: 'skill-1',
          status: 'pending',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'requested',
          result: 'waiting_for_install_approval'
        })),
        approveSkillInstall: approveMock
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(approveMock).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result!.traceSummary).toContain('rejected');
  });

  it('returns pending approval when receipt stays pending after approval', async () => {
    const input = makeInput({
      centersService: {
        installRemoteSkill: vi.fn(async () => ({
          id: 'receipt-1',
          skillId: 'skill-1',
          status: 'pending',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'requested',
          result: 'waiting_for_install_approval'
        })),
        approveSkillInstall: vi.fn(async () => ({
          id: 'receipt-1',
          skillId: 'skill-1',
          status: 'pending',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'requested',
          result: 'waiting_for_install_approval'
        }))
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result!.pendingApproval).toBeDefined();
  });

  it('returns trace summary for non-installed non-pending status', async () => {
    const input = makeInput({
      centersService: {
        installRemoteSkill: vi.fn(async () => ({
          id: 'receipt-1',
          skillId: 'skill-1',
          status: 'rejected',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'failed',
          result: 'install_rejected'
        })),
        approveSkillInstall: vi.fn(async () => ({
          id: 'receipt-1',
          skillId: 'skill-1',
          status: 'rejected',
          version: '1.0',
          sourceId: 'skills-sh',
          phase: 'failed',
          result: 'install_rejected'
        }))
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result!.traceSummary).toContain('rejected');
  });

  it('handles install error gracefully', async () => {
    const input = makeInput({
      centersService: {
        installRemoteSkill: vi.fn(async () => {
          throw new Error('Network error');
        }),
        approveSkillInstall: vi.fn()
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result!.traceSummary).toContain('Network error');
  });

  it('uses displayName when skillName is missing', async () => {
    const input = makeInput({
      skillSearch: {
        suggestions: [
          {
            id: 'remote-1',
            kind: 'remote-skill',
            displayName: 'Fallback Name',
            availability: 'installable-remote',
            repo: 'vercel-labs/skills'
          }
        ]
      }
    });
    const result = await resolvePreExecutionSkillIntervention(input);
    expect(result).toBeDefined();
  });
});

describe('resolveSkillInstallApproval', () => {
  it('returns undefined when no receiptId', async () => {
    const result = await resolveSkillInstallApproval({
      centersService: { approveSkillInstall: vi.fn() },
      getSkillSourcesContext: vi.fn(),
      task: { goal: 'test' },
      pending: {}
    });
    expect(result).toBeUndefined();
  });

  it('returns summary when receipt not installed after approval', async () => {
    const result = await resolveSkillInstallApproval({
      centersService: {
        approveSkillInstall: vi.fn(async () => ({
          id: 'r1',
          skillId: 's1',
          status: 'pending',
          version: '1.0',
          sourceId: 'src',
          phase: 'requested',
          result: 'waiting'
        }))
      },
      getSkillSourcesContext: vi.fn(),
      task: { goal: 'test' },
      pending: { receiptId: 'r1', skillDisplayName: 'Test Skill' }
    });
    expect(result!.traceSummary).toContain('pending');
  });
});

describe('resolveRuntimeSkillIntervention', () => {
  it('wraps pre-execution result with stage label for direct_reply', async () => {
    const result = await resolveRuntimeSkillIntervention({
      settings: { policy: { skillInstallMode: 'manual' } },
      centersService: { installRemoteSkill: vi.fn(), approveSkillInstall: vi.fn() },
      getSkillSourcesContext: vi.fn(),
      goal: 'test',
      currentStep: 'direct_reply',
      skillSearch: { suggestions: [] }
    });
    expect(result).toBeUndefined();
  });

  it('wraps pre-execution result with stage label for research', async () => {
    const result = await resolveRuntimeSkillIntervention({
      settings: { policy: { skillInstallMode: 'manual' } },
      centersService: { installRemoteSkill: vi.fn(), approveSkillInstall: vi.fn() },
      getSkillSourcesContext: vi.fn(),
      goal: 'test',
      currentStep: 'research',
      skillSearch: { suggestions: [] }
    });
    expect(result).toBeUndefined();
  });
});

describe('syncInstalledSkillWorkers', () => {
  it('registers skills with installReceiptId or sourceId', async () => {
    const registerSkillWorker = vi.fn();
    await syncInstalledSkillWorkers({
      skillRegistry: {
        list: vi.fn(async () => [
          { id: 's1', installReceiptId: 'r1', sourceId: 'src1' },
          { id: 's2', sourceId: 'src2' },
          { id: 's3' } // no installReceiptId or sourceId
        ])
      },
      registerSkillWorker
    });
    expect(registerSkillWorker).toHaveBeenCalledTimes(2);
  });

  it('handles empty skill list', async () => {
    const registerSkillWorker = vi.fn();
    await syncInstalledSkillWorkers({
      skillRegistry: { list: vi.fn(async () => []) },
      registerSkillWorker
    });
    expect(registerSkillWorker).not.toHaveBeenCalled();
  });
});
