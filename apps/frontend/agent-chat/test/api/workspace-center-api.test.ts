import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      request: requestMock
    }))
  }
}));

import { getWorkspaceCenterReadiness, normalizeWorkspaceCenterReadiness } from '@/api/workspace-center-api';

describe('workspace-center-api', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('requests the workspace-center projection through the same-origin api facade', async () => {
    requestMock.mockResolvedValueOnce({
      data: {
        workspaceId: 'workspace-platform',
        generatedAt: '2026-04-26T08:00:00.000Z',
        updatedAt: '2026-04-26T08:10:00.000Z',
        skillDrafts: [],
        reuseRecords: []
      }
    });

    await expect(getWorkspaceCenterReadiness()).resolves.toEqual(
      expect.objectContaining({
        workspaceId: 'workspace-platform',
        updatedAt: '2026-04-26T08:10:00.000Z'
      })
    );

    expect(vi.mocked(axios.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: '/api'
      })
    );
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/platform/workspace-center',
        method: 'GET',
        timeout: 5000
      })
    );
  });

  it('normalizes only whitelisted readiness fields from runtime and full projections', () => {
    const summary = normalizeWorkspaceCenterReadiness({
      workspace: {
        id: 'workspace-platform',
        name: 'Agent Workspace',
        status: 'active',
        summary: {
          activeDraftCount: 2,
          approvedDraftCount: 1,
          reuseRecordCount: 3,
          updatedAt: '2026-04-26T08:10:00.000Z'
        }
      },
      drafts: [
        {
          id: 'draft-1',
          title: 'Repo Analyzer',
          description: 'SHOULD_NOT_LEAK',
          bodyMarkdown: 'PRIVATE_BODY_SHOULD_NOT_LEAK',
          status: 'draft',
          confidence: 0.92,
          install: { status: 'pending' }
        },
        {
          id: 'draft-2',
          title: 'Review Helper',
          status: 'trusted',
          confidence: 0.75,
          install: { status: 'installed' }
        },
        {
          id: 'draft-3',
          title: 'Broken Candidate',
          status: 'rejected',
          confidence: 0.4,
          install: { status: 'failed' }
        }
      ],
      reuseRecords: [{ id: 'reuse-1' }]
    });

    expect(summary).toEqual({
      workspaceId: 'workspace-platform',
      workspaceName: 'Agent Workspace',
      workspaceStatus: 'active',
      updatedAt: '2026-04-26T08:10:00.000Z',
      skillDraftCount: 3,
      activeDraftCount: 2,
      approvedDraftCount: 1,
      installedDraftCount: 1,
      failedDraftCount: 1,
      pendingInstallCount: 1,
      highConfidenceDraftCount: 1,
      reuseRecordCount: 1,
      topDraftTitles: ['Repo Analyzer', 'Review Helper', 'Broken Candidate']
    });
    expect(JSON.stringify(summary)).not.toContain('PRIVATE_BODY_SHOULD_NOT_LEAK');
    expect(JSON.stringify(summary)).not.toContain('SHOULD_NOT_LEAK');
  });
});
