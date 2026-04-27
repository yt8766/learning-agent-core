import { describe, expect, it, vi } from 'vitest';

import { WorkspaceCenterController } from '../../src/platform/workspace-center.controller';

describe('workspace center controller', () => {
  it('delegates workspace center reads and skill draft decisions', async () => {
    const runtimeCentersService = {
      getWorkspaceCenter: vi.fn(async () => ({ scope: 'workspace' })),
      listWorkspaceSkillDrafts: vi.fn(async () => [{ draftId: 'draft-1' }]),
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
    };
    const controller = new WorkspaceCenterController(runtimeCentersService);

    await expect(controller.getWorkspaceCenter()).resolves.toEqual({ scope: 'workspace' });
    await expect(
      controller.listWorkspaceSkillDrafts({
        status: 'draft',
        sourceTaskId: 'task-1',
        sessionId: 'session-1',
        limit: '10',
        cursor: 'Mg=='
      })
    ).resolves.toEqual([{ draftId: 'draft-1' }]);
    await expect(controller.approveWorkspaceSkillDraft('draft-1', { note: 'ship it' })).resolves.toEqual({
      draftId: 'draft-1',
      action: 'approve',
      dto: { note: 'ship it' }
    });
    await expect(controller.rejectWorkspaceSkillDraft('draft-2', { reason: 'needs evidence' })).resolves.toEqual({
      draftId: 'draft-2',
      action: 'reject',
      dto: { reason: 'needs evidence' }
    });

    expect(runtimeCentersService.getWorkspaceCenter).toHaveBeenCalledTimes(1);
    expect(runtimeCentersService.listWorkspaceSkillDrafts).toHaveBeenCalledWith({
      status: 'draft',
      sourceTaskId: 'task-1',
      sessionId: 'session-1',
      limit: '10',
      cursor: 'Mg=='
    });
    expect(runtimeCentersService.approveWorkspaceSkillDraft).toHaveBeenCalledWith('draft-1', { note: 'ship it' });
    expect(runtimeCentersService.rejectWorkspaceSkillDraft).toHaveBeenCalledWith('draft-2', {
      reason: 'needs evidence'
    });
  });
});
