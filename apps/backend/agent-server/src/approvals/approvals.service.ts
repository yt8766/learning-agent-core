import { Injectable } from '@nestjs/common';

import { ApprovalActionDto } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class ApprovalsService {
  constructor(private readonly runtimeService: RuntimeService) {}

  listPending() {
    return this.runtimeService.listPendingApprovals();
  }

  approve(taskId: string, dto: ApprovalActionDto) {
    return this.runtimeService.approveTaskAction(taskId, dto);
  }

  reject(taskId: string, dto: ApprovalActionDto) {
    return this.runtimeService.rejectTaskAction(taskId, dto);
  }
}
