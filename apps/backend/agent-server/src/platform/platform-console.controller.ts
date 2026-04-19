import { Controller, Get, Post, Query } from '@nestjs/common';

import { ParseOptionalIntPipe } from '../common/pipes/parse-optional-int.pipe';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { PlatformConsoleQueryDto } from './dto/platform-console-query.dto';

@Controller('platform')
export class PlatformConsoleController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('console')
  getConsole(@Query() query: PlatformConsoleQueryDto, @Query('days', ParseOptionalIntPipe) days?: number) {
    const filters = {
      status: query.status,
      model: query.model,
      pricingSource: query.pricingSource,
      runtimeExecutionMode: query.runtimeExecutionMode,
      runtimeInteractionKind: query.runtimeInteractionKind,
      approvalsExecutionMode: query.approvalsExecutionMode,
      approvalsInteractionKind: query.approvalsInteractionKind
    };

    if (query.view === 'full') {
      return this.runtimeCentersService.getPlatformConsole(days, filters);
    }

    return this.runtimeCentersService.getPlatformConsoleShell(days, filters);
  }

  @Get('console-shell')
  getConsoleShell(@Query() query: PlatformConsoleQueryDto, @Query('days', ParseOptionalIntPipe) days?: number) {
    return this.runtimeCentersService.getPlatformConsoleShell(days, {
      status: query.status,
      model: query.model,
      pricingSource: query.pricingSource,
      runtimeExecutionMode: query.runtimeExecutionMode,
      runtimeInteractionKind: query.runtimeInteractionKind,
      approvalsExecutionMode: query.approvalsExecutionMode,
      approvalsInteractionKind: query.approvalsInteractionKind
    });
  }

  @Post('console/refresh-metrics')
  refreshMetricsSnapshots(@Query('days', ParseOptionalIntPipe) days?: number) {
    return this.runtimeCentersService.refreshMetricsSnapshots(days);
  }
}
