import { Controller, Get, Param, Post, Query } from '@nestjs/common';

import { RuntimeService } from '../runtime/runtime.service';

@Controller('platform')
export class PlatformController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Get('console')
  async getConsole(@Query('days') days?: string) {
    return this.runtimeService.getPlatformConsole(days ? Number(days) : undefined);
  }

  @Get('runtime-center')
  getRuntimeCenter(
    @Query('days') days?: string,
    @Query('status') status?: string,
    @Query('model') model?: string,
    @Query('pricingSource') pricingSource?: string
  ) {
    return this.runtimeService.getRuntimeCenter(days ? Number(days) : undefined, {
      status,
      model,
      pricingSource
    });
  }

  @Get('approvals-center')
  getApprovalsCenter() {
    return this.runtimeService.getApprovalsCenter();
  }

  @Get('learning-center')
  getLearningCenter() {
    return this.runtimeService.getLearningCenter();
  }

  @Get('evidence-center')
  getEvidenceCenter() {
    return this.runtimeService.getEvidenceCenter();
  }

  @Get('connectors-center')
  async getConnectorsCenter() {
    return this.runtimeService.getConnectorsCenter();
  }

  @Post('connectors-center/:connectorId/close-session')
  async closeConnectorSession(@Param('connectorId') connectorId: string) {
    return this.runtimeService.closeConnectorSession(connectorId);
  }

  @Get('evals-center')
  getEvalsCenter(
    @Query('days') days?: string,
    @Query('scenarioId') scenarioId?: string,
    @Query('outcome') outcome?: string
  ) {
    return this.runtimeService.getEvalsCenter(days ? Number(days) : undefined, {
      scenarioId,
      outcome
    });
  }

  @Get('runtime-center/export')
  exportRuntimeCenter(
    @Query('days') days?: string,
    @Query('status') status?: string,
    @Query('model') model?: string,
    @Query('pricingSource') pricingSource?: string,
    @Query('format') format?: string
  ) {
    return this.runtimeService.exportRuntimeCenter({
      days: days ? Number(days) : undefined,
      status,
      model,
      pricingSource,
      format
    });
  }

  @Get('evals-center/export')
  exportEvalsCenter(
    @Query('days') days?: string,
    @Query('scenarioId') scenarioId?: string,
    @Query('outcome') outcome?: string,
    @Query('format') format?: string
  ) {
    return this.runtimeService.exportEvalsCenter({
      days: days ? Number(days) : undefined,
      scenarioId,
      outcome,
      format
    });
  }
}
