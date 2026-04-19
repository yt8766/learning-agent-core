import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { CounselorSelectorConfig } from '@agent/core';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Controller('platform')
export class LearningCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('learning-center')
  getLearningCenter() {
    return this.runtimeCentersService.getLearningCenter();
  }

  @Get('learning-center/counselor-selectors')
  getCounselorSelectorConfigs() {
    return this.runtimeCentersService.getCounselorSelectorConfigs();
  }

  @Post('learning-center/counselor-selectors')
  upsertCounselorSelectorConfig(
    @Body()
    dto: Pick<CounselorSelectorConfig, 'selectorId' | 'domain' | 'strategy' | 'candidateIds' | 'defaultCounselorId'> &
      Partial<Pick<CounselorSelectorConfig, 'enabled' | 'weights' | 'featureFlag'>>
  ) {
    return this.runtimeCentersService.upsertCounselorSelectorConfig(dto);
  }

  @Post('learning-center/counselor-selectors/:selectorId/enable')
  enableCounselorSelector(@Param('selectorId') selectorId: string) {
    return this.runtimeCentersService.setCounselorSelectorEnabled(selectorId, true);
  }

  @Post('learning-center/counselor-selectors/:selectorId/disable')
  disableCounselorSelector(@Param('selectorId') selectorId: string) {
    return this.runtimeCentersService.setCounselorSelectorEnabled(selectorId, false);
  }

  @Post('learning-center/conflicts/:conflictId/:status')
  setLearningConflictStatus(
    @Param('conflictId') conflictId: string,
    @Param('status') status: 'open' | 'merged' | 'dismissed' | 'escalated',
    @Body() body?: { preferredMemoryId?: string }
  ) {
    return this.runtimeCentersService.setLearningConflictStatus(conflictId, status, body?.preferredMemoryId);
  }
}
