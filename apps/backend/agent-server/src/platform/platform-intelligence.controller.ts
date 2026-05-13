import { BadRequestException, Controller, Get, Param, Post } from '@nestjs/common';
import { IntelligenceChannelSchema } from '@agent/core';

import { RuntimeHost } from '../runtime/core/runtime.host';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Controller('platform')
export class PlatformIntelligenceController {
  constructor(
    private readonly runtimeCentersService: RuntimeCentersService,
    private readonly runtimeHost: RuntimeHost
  ) {}

  @Get('workflow-presets')
  getWorkflowPresets() {
    return this.runtimeHost.listWorkflowPresets();
  }

  @Get('intelligence/overview')
  getIntelligenceOverview() {
    return this.runtimeCentersService.getIntelligenceOverview();
  }

  @Post('intelligence/:channel/force-run')
  forceIntelligenceRun(@Param('channel') channel: string) {
    const parsed = IntelligenceChannelSchema.safeParse(channel);
    if (!parsed.success) {
      throw new BadRequestException(`Unsupported intelligence channel: ${channel}`);
    }

    return this.runtimeCentersService.forceIntelligenceRun(parsed.data);
  }
}
