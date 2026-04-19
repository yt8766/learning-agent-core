import { Controller, Get, Param, Post, Query } from '@nestjs/common';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { ApprovalsCenterExportQueryDto } from './dto/approvals-center-export-query.dto';
import { ApprovalsCenterQueryDto } from './dto/approvals-center-query.dto';

@Controller('platform')
export class ApprovalsCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('approvals-center')
  getApprovalsCenter(@Query() query: ApprovalsCenterQueryDto) {
    return this.runtimeCentersService.getApprovalsCenter({
      executionMode: query.executionMode,
      interactionKind: query.interactionKind
    });
  }

  @Get('approvals-center/export')
  exportApprovalsCenter(@Query() query: ApprovalsCenterExportQueryDto) {
    return this.runtimeCentersService.exportApprovalsCenter({
      executionMode: query.executionMode,
      interactionKind: query.interactionKind,
      format: query.format
    });
  }

  @Get('approval-policies')
  listApprovalScopePolicies() {
    return this.runtimeCentersService.listApprovalScopePolicies();
  }

  @Post('approval-policies/:policyId/revoke')
  revokeApprovalScopePolicy(@Param('policyId') policyId: string) {
    return this.runtimeCentersService.revokeApprovalScopePolicy(policyId);
  }
}
