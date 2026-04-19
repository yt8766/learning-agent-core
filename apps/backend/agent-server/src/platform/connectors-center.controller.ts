import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { ConfigureConnectorDto } from '@agent/core';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { RuntimeToolsService } from '../runtime/services/runtime-tools.service';

@Controller('platform')
export class ConnectorsCenterController {
  constructor(
    private readonly runtimeCentersService: RuntimeCentersService,
    private readonly runtimeToolsService: RuntimeToolsService
  ) {}

  @Get('connectors-center')
  getConnectorsCenter() {
    return this.runtimeCentersService.getConnectorsCenter();
  }

  @Get('tools-center')
  getToolsCenter() {
    return this.runtimeToolsService.getToolsCenter();
  }

  @Post('connectors-center/:connectorId/enable')
  enableConnector(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.setConnectorEnabled(connectorId, true);
  }

  @Post('connectors-center/:connectorId/disable')
  disableConnector(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.setConnectorEnabled(connectorId, false);
  }

  @Post('connectors-center/:connectorId/policy/:effect')
  setConnectorPolicy(
    @Param('connectorId') connectorId: string,
    @Param('effect') effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) {
    return this.runtimeCentersService.setConnectorApprovalPolicy(connectorId, effect);
  }

  @Post('connectors-center/:connectorId/policy/reset')
  clearConnectorPolicy(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.clearConnectorApprovalPolicy(connectorId);
  }

  @Post('connectors-center/:connectorId/capabilities/:capabilityId/policy/:effect')
  setCapabilityPolicy(
    @Param('connectorId') connectorId: string,
    @Param('capabilityId') capabilityId: string,
    @Param('effect') effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) {
    return this.runtimeCentersService.setCapabilityApprovalPolicy(connectorId, capabilityId, effect);
  }

  @Post('connectors-center/:connectorId/capabilities/:capabilityId/policy/reset')
  clearCapabilityPolicy(@Param('connectorId') connectorId: string, @Param('capabilityId') capabilityId: string) {
    return this.runtimeCentersService.clearCapabilityApprovalPolicy(connectorId, capabilityId);
  }

  @Post('connectors-center/:connectorId/close-session')
  closeConnectorSession(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.closeConnectorSession(connectorId);
  }

  @Post('connectors-center/:connectorId/refresh')
  refreshConnectorDiscovery(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.refreshConnectorDiscovery(connectorId);
  }

  @Post('connectors-center/configure')
  configureConnector(@Body() dto: ConfigureConnectorDto) {
    return this.runtimeCentersService.configureConnector(dto);
  }
}
