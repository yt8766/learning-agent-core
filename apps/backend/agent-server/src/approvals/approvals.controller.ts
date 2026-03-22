import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ApprovalActionDto } from '@agent/shared';

import { ApprovalsService } from './approvals.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('approvals/pending')
  listPending() {
    return this.approvalsService.listPending();
  }

  @Post('tasks/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ApprovalActionDto) {
    return this.approvalsService.approve(id, dto);
  }

  @Post('tasks/:id/reject')
  reject(@Param('id') id: string, @Body() dto: ApprovalActionDto) {
    return this.approvalsService.reject(id, dto);
  }
}
