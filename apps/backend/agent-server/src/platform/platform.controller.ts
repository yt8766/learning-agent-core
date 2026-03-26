import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { ConfigureConnectorDto, InstallSkillDto, ResolveSkillInstallDto } from '@agent/shared';

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

  @Get('browser-replays/:sessionId')
  getBrowserReplay(@Param('sessionId') sessionId: string) {
    return this.runtimeService.getBrowserReplay(sessionId);
  }

  @Get('connectors-center')
  async getConnectorsCenter() {
    return this.runtimeService.getConnectorsCenter();
  }

  @Get('skill-sources-center')
  async getSkillSourcesCenter() {
    return this.runtimeService.getSkillSourcesCenter();
  }

  @Post('skill-sources-center/install')
  installSkill(@Body() dto: InstallSkillDto) {
    return this.runtimeService.installSkill(dto);
  }

  @Post('skill-sources-center/:sourceId/enable')
  enableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeService.setSkillSourceEnabled(sourceId, true);
  }

  @Post('skill-sources-center/:sourceId/disable')
  disableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeService.setSkillSourceEnabled(sourceId, false);
  }

  @Post('skill-sources-center/:sourceId/sync')
  syncSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeService.syncSkillSource(sourceId);
  }

  @Post('skill-sources-center/receipts/:receiptId/approve')
  approveSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeService.approveSkillInstall(receiptId, dto);
  }

  @Post('skill-sources-center/receipts/:receiptId/reject')
  rejectSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeService.rejectSkillInstall(receiptId, dto);
  }

  @Get('company-agents-center')
  getCompanyAgentsCenter() {
    return this.runtimeService.getCompanyAgentsCenter();
  }

  @Post('company-agents-center/:workerId/enable')
  enableCompanyAgent(@Param('workerId') workerId: string) {
    return this.runtimeService.setCompanyAgentEnabled(workerId, true);
  }

  @Post('company-agents-center/:workerId/disable')
  disableCompanyAgent(@Param('workerId') workerId: string) {
    return this.runtimeService.setCompanyAgentEnabled(workerId, false);
  }

  @Post('connectors-center/:connectorId/enable')
  enableConnector(@Param('connectorId') connectorId: string) {
    return this.runtimeService.setConnectorEnabled(connectorId, true);
  }

  @Post('connectors-center/:connectorId/disable')
  disableConnector(@Param('connectorId') connectorId: string) {
    return this.runtimeService.setConnectorEnabled(connectorId, false);
  }

  @Post('connectors-center/:connectorId/policy/:effect')
  setConnectorPolicy(
    @Param('connectorId') connectorId: string,
    @Param('effect') effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) {
    return this.runtimeService.setConnectorApprovalPolicy(connectorId, effect);
  }

  @Post('connectors-center/:connectorId/policy/reset')
  clearConnectorPolicy(@Param('connectorId') connectorId: string) {
    return this.runtimeService.clearConnectorApprovalPolicy(connectorId);
  }

  @Post('connectors-center/:connectorId/capabilities/:capabilityId/policy/:effect')
  setCapabilityPolicy(
    @Param('connectorId') connectorId: string,
    @Param('capabilityId') capabilityId: string,
    @Param('effect') effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) {
    return this.runtimeService.setCapabilityApprovalPolicy(connectorId, capabilityId, effect);
  }

  @Post('connectors-center/:connectorId/capabilities/:capabilityId/policy/reset')
  clearCapabilityPolicy(@Param('connectorId') connectorId: string, @Param('capabilityId') capabilityId: string) {
    return this.runtimeService.clearCapabilityApprovalPolicy(connectorId, capabilityId);
  }

  @Post('connectors-center/:connectorId/close-session')
  async closeConnectorSession(@Param('connectorId') connectorId: string) {
    return this.runtimeService.closeConnectorSession(connectorId);
  }

  @Post('connectors-center/:connectorId/refresh')
  refreshConnectorDiscovery(@Param('connectorId') connectorId: string) {
    return this.runtimeService.refreshConnectorDiscovery(connectorId);
  }

  @Post('connectors-center/configure')
  configureConnector(@Body() dto: ConfigureConnectorDto) {
    return this.runtimeService.configureConnector(dto);
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
