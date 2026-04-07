import { describe, expect, it, vi } from 'vitest';

import type { ApprovalActionDto } from '@agent/shared';

import { ApprovalsService } from '../../src/approvals/approvals.service';

describe('ApprovalsService', () => {
  it('delegates listPending to RuntimeTaskService', () => {
    const runtimeTaskService = {
      listPendingApprovals: vi.fn().mockReturnValue([{ id: 'task-1' }]),
      approveTaskAction: vi.fn(),
      rejectTaskAction: vi.fn()
    };
    const service = new ApprovalsService(runtimeTaskService as any);

    expect(service.listPending()).toEqual([{ id: 'task-1' }]);
    expect(runtimeTaskService.listPendingApprovals).toHaveBeenCalledTimes(1);
  });

  it('delegates approve and reject to RuntimeTaskService', () => {
    const runtimeTaskService = {
      listPendingApprovals: vi.fn(),
      approveTaskAction: vi.fn(),
      rejectTaskAction: vi.fn()
    };
    const service = new ApprovalsService(runtimeTaskService as any);
    const dto: ApprovalActionDto = { intent: 'approve-tool', actor: 'tester' };

    service.approve('task-approve', dto);
    service.reject('task-reject', dto);

    expect(runtimeTaskService.approveTaskAction).toHaveBeenCalledWith('task-approve', dto);
    expect(runtimeTaskService.rejectTaskAction).toHaveBeenCalledWith('task-reject', dto);
  });
});
