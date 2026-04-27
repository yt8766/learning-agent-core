import { describe, expect, it, vi } from 'vitest';

const { listSkillSourcesMock, listSkillManifestsMock, readInstalledSkillRecordsMock, readSkillInstallReceiptsMock } =
  vi.hoisted(() => ({
    listSkillSourcesMock: vi.fn(async () => [{ id: 'workspace-skills' }]),
    listSkillManifestsMock: vi.fn(async () => [
      { id: 'find-skills', displayName: 'find-skills' },
      {
        id: 'workspace-draft-draft-1',
        sourceId: 'workspace-skill-drafts',
        name: 'Approved workspace draft',
        version: '20260426010000'
      }
    ]),
    readInstalledSkillRecordsMock: vi.fn(async () => [
      { skillId: 'remote-vercel-labs-skills-find-skills', installedAt: '2026-04-01T09:00:00.000Z' }
    ]),
    readSkillInstallReceiptsMock: vi.fn(async () => [
      { receiptId: 'receipt-1', installedAt: '2026-04-01T09:00:00.000Z' }
    ])
  }));

vi.mock('../../../../src/runtime/skills/runtime-skill-sources.service', () => ({
  listSkillSources: listSkillSourcesMock,
  listSkillManifests: listSkillManifestsMock
}));

vi.mock('../../../../src/runtime/skills/runtime-skill-install.service', () => ({
  readInstalledSkillRecords: readInstalledSkillRecordsMock,
  readSkillInstallReceipts: readSkillInstallReceiptsMock
}));

import { loadSkillSourcesCenterRecord } from '../../../../src/runtime/domain/skills/runtime-skill-sources-center-loader';

describe('runtime skill sources center loader', () => {
  it('loads sources, manifests, install records, receipts, skill cards, and tasks into the center projection', async () => {
    const result = await loadSkillSourcesCenterRecord({
      getSkillSourcesContext: () => ({ workspaceRoot: '/workspace' }),
      getSkillInstallContext: () => ({ installRoot: '/workspace/data/skills' }),
      skillRegistry: {
        list: vi.fn(async () => [
          {
            id: 'remote-vercel-labs-skills-find-skills',
            governanceRecommendation: 'allow',
            compatibility: { profile: 'platform' }
          }
        ])
      },
      orchestrator: {
        listTasks: () => [
          {
            id: 'task-1',
            status: 'completed',
            usedInstalledSkills: ['installed-skill:remote-vercel-labs-skills-find-skills'],
            trace: []
          }
        ]
      }
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        sources: [{ id: 'workspace-skills' }],
        manifests: [
          expect.objectContaining({ id: 'find-skills' }),
          expect.objectContaining({
            id: 'workspace-draft-draft-1',
            sourceId: 'workspace-skill-drafts'
          })
        ],
        installed: expect.any(Array),
        receipts: [expect.objectContaining({ receiptId: 'receipt-1' })]
      })
    );
  });
});
