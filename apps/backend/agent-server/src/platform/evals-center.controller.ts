import { Controller, Get, Query } from '@nestjs/common';

import { ParseOptionalIntPipe } from '../common/pipes/parse-optional-int.pipe';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { EvalsCenterQueryDto } from './dto/evals-center-query.dto';

@Controller('platform')
export class EvalsCenterController {
  constructor(private readonly runtimeCentersService: RuntimeCentersService) {}

  @Get('evals-center')
  getEvalsCenter(@Query() query: EvalsCenterQueryDto, @Query('days', ParseOptionalIntPipe) days?: number) {
    return this.runtimeCentersService.getEvalsCenter(days, {
      scenarioId: query.scenarioId,
      outcome: query.outcome
    });
  }

  @Get('evals-center/export')
  exportEvalsCenter(@Query() query: EvalsCenterQueryDto, @Query('days', ParseOptionalIntPipe) days?: number) {
    return this.runtimeCentersService.exportEvalsCenter({
      days,
      scenarioId: query.scenarioId,
      outcome: query.outcome,
      format: query.format
    });
  }
}
