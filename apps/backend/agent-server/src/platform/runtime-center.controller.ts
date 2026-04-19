import { Controller, Get, Param, Query } from '@nestjs/common';

import { ParseOptionalIntPipe } from '../common/pipes/parse-optional-int.pipe';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { RuntimeCenterExportQueryDto } from './dto/runtime-center-export-query.dto';
import { RuntimeCenterQueryDto } from './dto/runtime-center-query.dto';
import { RunObservatoryQueryDto } from './dto/run-observatory-query.dto';

@Controller('platform')
export class RuntimeCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('runtime-center')
  getRuntimeCenter(@Query() query: RuntimeCenterQueryDto, @Query('days', ParseOptionalIntPipe) days?: number) {
    return this.runtimeCentersService.getRuntimeCenter(days, {
      status: query.status,
      model: query.model,
      pricingSource: query.pricingSource,
      executionMode: query.executionMode,
      interactionKind: query.interactionKind
    });
  }

  @Get('runtime-center/export')
  exportRuntimeCenter(@Query() query: RuntimeCenterExportQueryDto, @Query('days', ParseOptionalIntPipe) days?: number) {
    return this.runtimeCentersService.exportRuntimeCenter({
      days,
      status: query.status,
      model: query.model,
      pricingSource: query.pricingSource,
      executionMode: query.executionMode,
      interactionKind: query.interactionKind,
      format: query.format
    });
  }

  @Get('run-observatory')
  getRunObservatory(@Query() query: RunObservatoryQueryDto) {
    return this.runtimeCentersService.getRunObservatory({
      status: query.status,
      model: query.model,
      pricingSource: query.pricingSource,
      executionMode: query.executionMode,
      interactionKind: query.interactionKind,
      q: query.q,
      hasInterrupt: query.hasInterrupt,
      hasFallback: query.hasFallback,
      hasRecoverableCheckpoint: query.hasRecoverableCheckpoint,
      limit: query.limit
    });
  }

  @Get('run-observatory/:taskId')
  getRunObservatoryDetail(@Param('taskId') taskId: string) {
    return this.runtimeCentersService.getRunObservatoryDetail(taskId);
  }
}
