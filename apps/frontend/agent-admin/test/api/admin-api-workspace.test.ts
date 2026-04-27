import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('@/api/admin-api-core', () => ({
  request: (...args: unknown[]) => requestMock(...args)
}));

import {
  approveWorkspaceSkillDraft,
  getWorkspaceCenter,
  listWorkspaceSkillDrafts,
  rejectWorkspaceSkillDraft
} from '@/api/admin-api-workspace';

describe('admin-api-workspace', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({});
  });

  it('fetches the agent workspace center projection from the platform workspace endpoint', async () => {
    requestMock.mockResolvedValueOnce({
      workspaceId: 'workspace-platform',
      generatedAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T01:00:00.000Z',
      skillDrafts: [
        {
          draftId: 'draft-1',
          status: 'shadow',
          title: 'Summarize terminal failures',
          summary: 'Capture repeated terminal failure triage as a reusable skill.',
          sourceTaskId: 'task-1',
          confidence: 0.78,
          riskLevel: 'medium',
          createdAt: '2026-04-26T00:30:00.000Z',
          updatedAt: '2026-04-26T00:45:00.000Z',
          install: {
            receiptId: 'receipt-1',
            skillId: 'workspace-draft-draft-1',
            sourceId: 'workspace-skill-drafts',
            status: 'installed',
            phase: 'installed',
            installedAt: '2026-04-26T00:50:00.000Z'
          },
          provenance: {
            sourceKind: 'workspace-draft',
            sourceTaskId: 'task-1',
            sourceEvidenceIds: ['evidence-1'],
            manifestId: 'workspace-draft-draft-1',
            manifestSourceId: 'workspace-skill-drafts'
          },
          lifecycle: {
            draftStatus: 'shadow',
            installStatus: 'installed',
            reusable: true,
            nextAction: 'ready_to_reuse'
          }
        }
      ],
      skillDraftStatusCounts: {
        shadow: 1
      },
      reuseRecords: [
        {
          id: 'reuse-1',
          workspaceId: 'workspace-platform',
          skillId: 'skill-1',
          reusedBy: {
            id: 'agent-supervisor',
            label: 'Supervisor',
            kind: 'agent'
          },
          taskId: 'task-1',
          outcome: 'succeeded',
          evidenceRefs: ['evidence-1'],
          reusedAt: '2026-04-26T00:50:00.000Z'
        }
      ]
    });

    await expect(getWorkspaceCenter()).resolves.toMatchObject({
      workspace: {
        id: 'workspace-platform',
        summary: {
          activeDraftCount: 1,
          approvedDraftCount: 0,
          reuseRecordCount: 1
        }
      },
      drafts: [
        {
          id: 'draft-1',
          workspaceId: 'workspace-platform',
          title: 'Summarize terminal failures',
          description: 'Capture repeated terminal failure triage as a reusable skill.',
          status: 'shadow',
          requiredTools: [],
          requiredConnectors: [],
          install: {
            receiptId: 'receipt-1',
            status: 'installed',
            phase: 'installed'
          },
          lifecycle: {
            reusable: true,
            nextAction: 'ready_to_reuse'
          }
        }
      ],
      reuseRecords: [
        {
          id: 'reuse-1',
          workspaceId: 'workspace-platform',
          skillId: 'skill-1',
          taskId: 'task-1',
          outcome: 'succeeded'
        }
      ]
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/platform/workspace-center',
      expect.objectContaining({
        cancelKey: 'workspace-center',
        cancelPrevious: true
      })
    );
  });

  it('fetches workspace skill drafts from the platform workspace endpoint', async () => {
    requestMock.mockResolvedValueOnce([
      {
        draftId: 'draft-2',
        status: 'draft',
        title: 'Reuse evidence citations',
        summary: 'Turn repeated citation gathering into a reusable skill.',
        confidence: 0.61,
        createdAt: '2026-04-26T02:00:00.000Z',
        updatedAt: '2026-04-26T02:10:00.000Z'
      }
    ]);

    await expect(listWorkspaceSkillDrafts()).resolves.toMatchObject([
      {
        id: 'draft-2',
        workspaceId: 'workspace-platform',
        title: 'Reuse evidence citations',
        status: 'draft',
        riskLevel: 'medium'
      }
    ]);

    expect(requestMock).toHaveBeenCalledWith(
      '/platform/workspace-center/skill-drafts',
      expect.objectContaining({
        cancelKey: 'workspace-center:skill-drafts',
        cancelPrevious: true
      })
    );
  });

  it('posts approve and reject decisions for workspace skill drafts', async () => {
    requestMock
      .mockResolvedValueOnce({
        draft: {
          draftId: 'draft-1',
          status: 'active',
          title: 'Approved workspace skill',
          summary: 'Ready for intake',
          createdAt: '2026-04-26T02:00:00.000Z',
          updatedAt: '2026-04-26T02:10:00.000Z'
        },
        intake: {
          mode: 'install-candidate',
          status: 'ready',
          candidate: {
            title: 'Approved workspace skill',
            bodyMarkdown: '# Approved',
            sourceTaskId: 'task-1',
            sourceEvidenceIds: []
          }
        }
      })
      .mockResolvedValueOnce({ draftId: 'draft-2', action: 'reject' });

    await expect(approveWorkspaceSkillDraft('draft-1', 'looks good')).resolves.toMatchObject({
      draft: {
        id: 'draft-1',
        status: 'active',
        title: 'Approved workspace skill'
      },
      intake: {
        mode: 'install-candidate',
        status: 'ready'
      }
    });
    await expect(rejectWorkspaceSkillDraft('draft-2', 'missing evidence')).resolves.toEqual({
      draftId: 'draft-2',
      action: 'reject'
    });

    expect(requestMock).toHaveBeenNthCalledWith(1, '/platform/workspace-center/skill-drafts/draft-1/approve', {
      method: 'POST',
      body: JSON.stringify({ note: 'looks good' })
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, '/platform/workspace-center/skill-drafts/draft-2/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'missing evidence' })
    });
  });
});
