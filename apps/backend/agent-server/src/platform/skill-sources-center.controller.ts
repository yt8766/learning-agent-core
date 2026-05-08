import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { InstallRemoteSkillDto, InstallSkillDto, ResolveSkillInstallDto } from '@agent/core';

import { RequirePermission } from '../infrastructure/auth/decorators/require-permission.decorator';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

const GOVERNANCE_WRITE = 'governance:write';

@Controller('platform')
export class SkillSourcesCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('skill-sources-center')
  getSkillSourcesCenter() {
    return this.runtimeCentersService.getSkillSourcesCenter();
  }

  @Post('skill-sources-center/install')
  @RequirePermission(GOVERNANCE_WRITE)
  installSkill(@Body() dto: InstallSkillDto) {
    return this.runtimeCentersService.installSkill(dto);
  }

  @Post('skill-sources-center/install-remote')
  @RequirePermission(GOVERNANCE_WRITE)
  installRemoteSkill(@Body() dto: InstallRemoteSkillDto) {
    return this.runtimeCentersService.installRemoteSkill(dto);
  }

  @Post('skill-sources-center/check-installed')
  @RequirePermission(GOVERNANCE_WRITE)
  checkInstalledSkills() {
    return this.runtimeCentersService.checkInstalledSkills();
  }

  @Post('skill-sources-center/update-installed')
  @RequirePermission(GOVERNANCE_WRITE)
  updateInstalledSkills() {
    return this.runtimeCentersService.updateInstalledSkills();
  }

  @Get('skill-sources-center/receipts/:receiptId')
  getSkillInstallReceipt(@Param('receiptId') receiptId: string) {
    return this.runtimeCentersService.getSkillInstallReceipt(receiptId);
  }

  @Post('skill-sources-center/:sourceId/enable')
  @RequirePermission(GOVERNANCE_WRITE)
  enableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.setSkillSourceEnabled(sourceId, true);
  }

  @Post('skill-sources-center/:sourceId/disable')
  @RequirePermission(GOVERNANCE_WRITE)
  disableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.setSkillSourceEnabled(sourceId, false);
  }

  @Post('skill-sources-center/:sourceId/sync')
  @RequirePermission(GOVERNANCE_WRITE)
  syncSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.syncSkillSource(sourceId);
  }

  @Post('skill-sources-center/receipts/:receiptId/approve')
  @RequirePermission(GOVERNANCE_WRITE)
  approveSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeCentersService.approveSkillInstall(receiptId, dto);
  }

  @Post('skill-sources-center/receipts/:receiptId/reject')
  @RequirePermission(GOVERNANCE_WRITE)
  rejectSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeCentersService.rejectSkillInstall(receiptId, dto);
  }
}
