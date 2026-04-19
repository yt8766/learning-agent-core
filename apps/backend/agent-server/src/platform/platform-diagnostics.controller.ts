import { Controller, Get, Query } from '@nestjs/common';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';

@Controller('platform')
export class PlatformDiagnosticsController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('console/log-analysis')
  getPlatformConsoleLogAnalysis(@Query('days') days?: string) {
    return this.runtimeCentersService.getPlatformConsoleLogAnalysis(days ? Number(days) : undefined);
  }
}
