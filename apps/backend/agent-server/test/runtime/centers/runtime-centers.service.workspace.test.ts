import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeCentersGovernanceService } from '../../../src/runtime/centers/runtime-centers-governance.service';
import { RuntimeCentersQueryService } from '../../../src/runtime/centers/runtime-centers-query.service';
import { RuntimeCentersService } from '../../../src/runtime/centers/runtime-centers.service';
import {
  createRuntimeWorkspaceDraftStore,
  resetRuntimeWorkspaceDraftStore
} from '../../../src/runtime/centers/runtime-centers-workspace-drafts';

describe('RuntimeCentersService workspace methods', () => {
  afterEach(() => {
    resetRuntimeWorkspaceDraftStore();
  });

  it('binds workspace center query and skill draft governance methods onto the facade', async () => {
    const queryService = {
      getWorkspaceCenter: vi.fn(() => ({ workspaceId: 'workspace-platform' })),
      listWorkspaceSkillDrafts: vi.fn(async () => [{ draftId: 'draft-1', status: 'draft' }])
    } as unknown as RuntimeCentersQueryService;
    const governanceService = {
      approveWorkspaceSkillDraft: vi.fn(async (draftId: string, dto: { note?: string }) => ({
        draftId,
        action: 'approve',
        dto
      })),
      rejectWorkspaceSkillDraft: vi.fn(async (draftId: string, dto: { reason?: string }) => ({
        draftId,
        action: 'reject',
        dto
      }))
    } as unknown as RuntimeCentersGovernanceService;

    const service = new RuntimeCentersService(() => ({}) as any, queryService, governanceService);

    expect(service.getWorkspaceCenter()).toEqual({ workspaceId: 'workspace-platform' });
    expect(await service.listWorkspaceSkillDrafts({ status: 'draft', limit: '1' })).toEqual([
      { draftId: 'draft-1', status: 'draft' }
    ]);
    expect(await service.approveWorkspaceSkillDraft('draft-1', { note: 'ship it' })).toEqual({
      draftId: 'draft-1',
      action: 'approve',
      dto: { note: 'ship it' }
    });
    expect(await service.rejectWorkspaceSkillDraft('draft-2', { reason: 'needs evidence' })).toEqual({
      draftId: 'draft-2',
      action: 'reject',
      dto: { reason: 'needs evidence' }
    });

    expect(queryService.getWorkspaceCenter).toHaveBeenCalledTimes(1);
    expect(queryService.listWorkspaceSkillDrafts).toHaveBeenCalledWith({ status: 'draft', limit: '1' });
    expect(governanceService.approveWorkspaceSkillDraft).toHaveBeenCalledWith('draft-1', { note: 'ship it' });
    expect(governanceService.rejectWorkspaceSkillDraft).toHaveBeenCalledWith('draft-2', {
      reason: 'needs evidence'
    });
  });

  it('updates workspace skill draft decisions through the backend draft store', async () => {
    const workspaceDraftStore = createRuntimeWorkspaceDraftStore();
    const service = new RuntimeCentersService(
      () =>
        ({
          settings: { profile: 'platform' },
          workspaceDraftStore
        }) as any
    );

    const [draftToApprove, draftToReject] = await Promise.all([
      workspaceDraftStore.seedDraft({
        workspaceId: 'workspace-platform',
        title: 'Approve this skill',
        bodyMarkdown: '# Approve',
        sourceTaskId: 'task-approve',
        source: 'workspace-vault'
      }),
      workspaceDraftStore.seedDraft({
        workspaceId: 'workspace-platform',
        title: 'Reject this skill',
        bodyMarkdown: '# Reject',
        sourceTaskId: 'task-reject',
        source: 'workspace-vault'
      })
    ]);

    await expect(
      service.approveWorkspaceSkillDraft(draftToApprove.draftId, { note: 'ship it' })
    ).resolves.toMatchObject({
      draft: {
        draftId: draftToApprove.draftId,
        status: 'active',
        decidedBy: 'agent-admin-user'
      },
      intake: {
        mode: 'install-candidate',
        status: 'ready',
        candidate: {
          title: 'Approve this skill',
          bodyMarkdown: '# Approve',
          sourceTaskId: 'task-approve',
          sourceEvidenceIds: []
        }
      }
    });
    await expect(
      service.rejectWorkspaceSkillDraft(draftToReject.draftId, { reason: 'needs more evidence' })
    ).resolves.toMatchObject({
      draftId: draftToReject.draftId,
      status: 'rejected',
      decidedBy: 'agent-admin-user'
    });
  });
});
