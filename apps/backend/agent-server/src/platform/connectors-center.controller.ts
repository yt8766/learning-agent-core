import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { ConfigureConnectorDto } from '@agent/core';

import { RequirePermission } from '../infrastructure/auth/decorators/require-permission.decorator';
import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { RuntimeToolsService } from '../runtime/services/runtime-tools.service';

const GOVERNANCE_WRITE = 'governance:write';

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
  @RequirePermission(GOVERNANCE_WRITE)
  enableConnector(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.setConnectorEnabled(connectorId, true);
  }

  @Post('connectors-center/:connectorId/disable')
  @RequirePermission(GOVERNANCE_WRITE)
  disableConnector(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.setConnectorEnabled(connectorId, false);
  }

  @Post('connectors-center/:connectorId/policy/:effect')
  @RequirePermission(GOVERNANCE_WRITE)
  setConnectorPolicy(
    @Param('connectorId') connectorId: string,
    @Param('effect') effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) {
    return this.runtimeCentersService.setConnectorApprovalPolicy(connectorId, effect);
  }

  @Post('connectors-center/:connectorId/policy/reset')
  @RequirePermission(GOVERNANCE_WRITE)
  clearConnectorPolicy(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.clearConnectorApprovalPolicy(connectorId);
  }

  @Post('connectors-center/:connectorId/capabilities/:capabilityId/policy/:effect')
  @RequirePermission(GOVERNANCE_WRITE)
  setCapabilityPolicy(
    @Param('connectorId') connectorId: string,
    @Param('capabilityId') capabilityId: string,
    @Param('effect') effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) {
    return this.runtimeCentersService.setCapabilityApprovalPolicy(connectorId, capabilityId, effect);
  }

  @Post('connectors-center/:connectorId/capabilities/:capabilityId/policy/reset')
  @RequirePermission(GOVERNANCE_WRITE)
  clearCapabilityPolicy(@Param('connectorId') connectorId: string, @Param('capabilityId') capabilityId: string) {
    return this.runtimeCentersService.clearCapabilityApprovalPolicy(connectorId, capabilityId);
  }

  @Post('connectors-center/:connectorId/close-session')
  @RequirePermission(GOVERNANCE_WRITE)
  closeConnectorSession(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.closeConnectorSession(connectorId);
  }

  @Post('connectors-center/:connectorId/refresh')
  @RequirePermission(GOVERNANCE_WRITE)
  refreshConnectorDiscovery(@Param('connectorId') connectorId: string) {
    return this.runtimeCentersService.refreshConnectorDiscovery(connectorId);
  }

  @Post('connectors-center/configure')
  @RequirePermission(GOVERNANCE_WRITE)
  configureConnector(@Body() dto: ConfigureConnectorDto) {
    return this.runtimeCentersService.configureConnector(dto);
  }
}
