import { Injectable } from '@nestjs/common';

import { ApprovalActionDto } from '@agent/shared';

import { RuntimeTaskService } from '../runtime/services/runtime-task.service';

@Injectable()
export class ApprovalsService {
  constructor(private readonly runtimeTaskService: RuntimeTaskService) {}

  listPending() {
    return this.runtimeTaskService.listPendingApprovals();
  }

  approve(taskId: string, dto: ApprovalActionDto) {
    return this.runtimeTaskService.approveTaskAction(taskId, dto);
  }

  reject(taskId: string, dto: ApprovalActionDto) {
    return this.runtimeTaskService.rejectTaskAction(taskId, dto);
  }
}
