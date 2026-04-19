import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { InstallRemoteSkillDto, InstallSkillDto, ResolveSkillInstallDto } from '@agent/core';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Controller('platform')
export class SkillSourcesCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('skill-sources-center')
  getSkillSourcesCenter() {
    return this.runtimeCentersService.getSkillSourcesCenter();
  }

  @Post('skill-sources-center/install')
  installSkill(@Body() dto: InstallSkillDto) {
    return this.runtimeCentersService.installSkill(dto);
  }

  @Post('skill-sources-center/install-remote')
  installRemoteSkill(@Body() dto: InstallRemoteSkillDto) {
    return this.runtimeCentersService.installRemoteSkill(dto);
  }

  @Post('skill-sources-center/check-installed')
  checkInstalledSkills() {
    return this.runtimeCentersService.checkInstalledSkills();
  }

  @Post('skill-sources-center/update-installed')
  updateInstalledSkills() {
    return this.runtimeCentersService.updateInstalledSkills();
  }

  @Get('skill-sources-center/receipts/:receiptId')
  getSkillInstallReceipt(@Param('receiptId') receiptId: string) {
    return this.runtimeCentersService.getSkillInstallReceipt(receiptId);
  }

  @Post('skill-sources-center/:sourceId/enable')
  enableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.setSkillSourceEnabled(sourceId, true);
  }

  @Post('skill-sources-center/:sourceId/disable')
  disableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.setSkillSourceEnabled(sourceId, false);
  }

  @Post('skill-sources-center/:sourceId/sync')
  syncSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.syncSkillSource(sourceId);
  }

  @Post('skill-sources-center/receipts/:receiptId/approve')
  approveSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeCentersService.approveSkillInstall(receiptId, dto);
  }

  @Post('skill-sources-center/receipts/:receiptId/reject')
  rejectSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeCentersService.rejectSkillInstall(receiptId, dto);
  }
}
