import { describe, expect, it, vi } from 'vitest';

import { refreshWorkspaceAfterDraftApproval } from '@/pages/dashboard/dashboard-center-content';

describe('dashboard center workspace approval refresh', () => {
  it('refreshes workspace and skill sources when approve returns an install candidate intake', async () => {
    const refreshWorkspaceCenter = vi.fn(async () => undefined);
    const dashboard = {
      refreshPageCenter: vi.fn(async () => undefined)
    };

    await refreshWorkspaceAfterDraftApproval(
      {
        intake: {
          mode: 'install-candidate',
          status: 'ready'
        }
      },
      dashboard as never,
      refreshWorkspaceCenter
    );

    expect(refreshWorkspaceCenter).toHaveBeenCalledTimes(1);
    expect(dashboard.refreshPageCenter).toHaveBeenCalledWith('skillSources');
  });

  it('only refreshes workspace when approve response has no install candidate intake', async () => {
    const refreshWorkspaceCenter = vi.fn(async () => undefined);
    const dashboard = {
      refreshPageCenter: vi.fn(async () => undefined)
    };

    await refreshWorkspaceAfterDraftApproval({}, dashboard as never, refreshWorkspaceCenter);

    expect(refreshWorkspaceCenter).toHaveBeenCalledTimes(1);
    expect(dashboard.refreshPageCenter).not.toHaveBeenCalled();
  });
});
