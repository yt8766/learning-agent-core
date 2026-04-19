import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { listWorkflowPresets } from '@agent/agents-supervisor';

import { ParseOptionalIntPipe } from '../common/pipes/parse-optional-int.pipe';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { BriefingCategory, BriefingFeedbackDto } from './dto/briefing-feedback.dto';

@Controller('platform')
export class PlatformBriefingsController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('workflow-presets')
  getWorkflowPresets() {
    return listWorkflowPresets();
  }

  @Get('briefings/runs')
  getBriefingRuns(@Query('days', ParseOptionalIntPipe) days?: number, @Query('category') category?: BriefingCategory) {
    return this.runtimeCentersService.getBriefingRuns(days, category);
  }

  @Post('briefings/:category/force-run')
  forceBriefingRun(@Param('category') category: BriefingCategory) {
    return this.runtimeCentersService.forceBriefingRun(category);
  }

  @Post('briefings/feedback')
  recordBriefingFeedback(@Body() body: BriefingFeedbackDto) {
    return this.runtimeCentersService.recordBriefingFeedback(body);
  }
}
