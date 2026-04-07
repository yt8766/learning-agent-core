import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import {
  ConfigureConnectorDto,
  CounselorSelectorConfig,
  InstallRemoteSkillDto,
  InstallSkillDto,
  ResolveSkillInstallDto
} from '@agent/shared';

import { RuntimeCentersService } from '../runtime/centers/runtime-centers.service';
import { RuntimeToolsService } from '../runtime/services/runtime-tools.service';

@Controller('platform')
export class PlatformController {
  constructor(
    private readonly runtimeCentersService: RuntimeCentersService,
    private readonly runtimeToolsService: RuntimeToolsService
  ) {}

  @Get('console')
  async getConsole(
    @Query('days') days?: string,
    @Query('status') status?: string,
    @Query('model') model?: string,
    @Query('pricingSource') pricingSource?: string,
    @Query('runtimeExecutionMode') runtimeExecutionMode?: string,
    @Query('runtimeInteractionKind') runtimeInteractionKind?: string,
    @Query('approvalsExecutionMode') approvalsExecutionMode?: string,
    @Query('approvalsInteractionKind') approvalsInteractionKind?: string
  ) {
    return this.runtimeCentersService.getPlatformConsole(days ? Number(days) : undefined, {
      status,
      model,
      pricingSource,
      runtimeExecutionMode,
      runtimeInteractionKind,
      approvalsExecutionMode,
      approvalsInteractionKind
    });
  }

  @Get('runtime-center')
  getRuntimeCenter(
    @Query('days') days?: string,
    @Query('status') status?: string,
    @Query('model') model?: string,
    @Query('pricingSource') pricingSource?: string,
    @Query('executionMode') executionMode?: string,
    @Query('interactionKind') interactionKind?: string
  ) {
    return this.runtimeCentersService.getRuntimeCenter(days ? Number(days) : undefined, {
      status,
      model,
      pricingSource,
      executionMode,
      interactionKind
    });
  }

  @Get('briefings/runs')
  getBriefingRuns(@Query('days') days?: string, @Query('category') category?: string) {
    return this.runtimeCentersService.getBriefingRuns(
      days ? Number(days) : undefined,
      category as
        | 'frontend-security'
        | 'general-security'
        | 'devtool-security'
        | 'ai-tech'
        | 'frontend-tech'
        | 'backend-tech'
        | 'cloud-infra-tech'
        | undefined
    );
  }

  @Post('briefings/:category/force-run')
  forceBriefingRun(
    @Param('category')
    category:
      | 'frontend-security'
      | 'general-security'
      | 'devtool-security'
      | 'ai-tech'
      | 'frontend-tech'
      | 'backend-tech'
      | 'cloud-infra-tech'
  ) {
    return this.runtimeCentersService.forceBriefingRun(category);
  }

  @Post('briefings/feedback')
  recordBriefingFeedback(
    @Body()
    body: {
      messageKey: string;
      category:
        | 'frontend-security'
        | 'general-security'
        | 'devtool-security'
        | 'ai-tech'
        | 'frontend-tech'
        | 'backend-tech'
        | 'cloud-infra-tech';
      feedbackType: 'helpful' | 'notHelpful';
      reasonTag?: 'too-noisy' | 'irrelevant' | 'too-late' | 'useful-actionable';
    }
  ) {
    return this.runtimeCentersService.recordBriefingFeedback(body);
  }

  @Get('approvals-center')
  getApprovalsCenter(
    @Query('executionMode') executionMode?: string,
    @Query('interactionKind') interactionKind?: string
  ) {
    return this.runtimeCentersService.getApprovalsCenter({
      executionMode,
      interactionKind
    });
  }

  @Get('approval-policies')
  listApprovalScopePolicies() {
    return this.runtimeCentersService.listApprovalScopePolicies();
  }

  @Post('approval-policies/:policyId/revoke')
  revokeApprovalScopePolicy(@Param('policyId') policyId: string) {
    return this.runtimeCentersService.revokeApprovalScopePolicy(policyId);
  }

  @Get('learning-center')
  getLearningCenter() {
    return this.runtimeCentersService.getLearningCenter();
  }

  @Get('learning-center/counselor-selectors')
  getCounselorSelectorConfigs() {
    return this.runtimeCentersService.getCounselorSelectorConfigs();
  }

  @Post('learning-center/counselor-selectors')
  upsertCounselorSelectorConfig(
    @Body()
    dto: Pick<CounselorSelectorConfig, 'selectorId' | 'domain' | 'strategy' | 'candidateIds' | 'defaultCounselorId'> &
      Partial<Pick<CounselorSelectorConfig, 'enabled' | 'weights' | 'featureFlag'>>
  ) {
    return this.runtimeCentersService.upsertCounselorSelectorConfig(dto);
  }

  @Post('learning-center/counselor-selectors/:selectorId/enable')
  enableCounselorSelector(@Param('selectorId') selectorId: string) {
    return this.runtimeCentersService.setCounselorSelectorEnabled(selectorId, true);
  }

  @Post('learning-center/counselor-selectors/:selectorId/disable')
  disableCounselorSelector(@Param('selectorId') selectorId: string) {
    return this.runtimeCentersService.setCounselorSelectorEnabled(selectorId, false);
  }

  @Post('learning-center/conflicts/:conflictId/:status')
  setLearningConflictStatus(
    @Param('conflictId') conflictId: string,
    @Param('status') status: 'open' | 'merged' | 'dismissed' | 'escalated',
    @Body() body?: { preferredMemoryId?: string }
  ) {
    return this.runtimeCentersService.setLearningConflictStatus(conflictId, status, body?.preferredMemoryId);
  }

  @Get('evidence-center')
  getEvidenceCenter() {
    return this.runtimeCentersService.getEvidenceCenter();
  }

  @Get('browser-replays/:sessionId')
  getBrowserReplay(@Param('sessionId') sessionId: string) {
    return this.runtimeCentersService.getBrowserReplay(sessionId);
  }

  @Get('connectors-center')
  async getConnectorsCenter() {
    return this.runtimeCentersService.getConnectorsCenter();
  }

  @Get('tools-center')
  getToolsCenter() {
    return this.runtimeToolsService.getToolsCenter();
  }

  @Get('skill-sources-center')
  async getSkillSourcesCenter() {
    return this.runtimeCentersService.getSkillSourcesCenter();
  }

  @Post('skill-sources-center/install')
  installSkill(@Body() dto: InstallSkillDto) {
    return this.runtimeCentersService.installSkill(dto);
  }

  @Post('skill-sources-center/install-remote')
  installRemoteSkill(@Body() dto: InstallRemoteSkillDto) {
    return this.runtimeCentersService.installRemoteSkill(dto);
  }

  @Post('skill-sources-center/check-installed')
  checkInstalledSkills() {
    return this.runtimeCentersService.checkInstalledSkills();
  }

  @Post('skill-sources-center/update-installed')
  updateInstalledSkills() {
    return this.runtimeCentersService.updateInstalledSkills();
  }

  @Get('skill-sources-center/receipts/:receiptId')
  getSkillInstallReceipt(@Param('receiptId') receiptId: string) {
    return this.runtimeCentersService.getSkillInstallReceipt(receiptId);
  }

  @Post('skill-sources-center/:sourceId/enable')
  enableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.setSkillSourceEnabled(sourceId, true);
  }

  @Post('skill-sources-center/:sourceId/disable')
  disableSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.setSkillSourceEnabled(sourceId, false);
  }

  @Post('skill-sources-center/:sourceId/sync')
  syncSkillSource(@Param('sourceId') sourceId: string) {
    return this.runtimeCentersService.syncSkillSource(sourceId);
  }

  @Post('skill-sources-center/receipts/:receiptId/approve')
  approveSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeCentersService.approveSkillInstall(receiptId, dto);
  }

  @Post('skill-sources-center/receipts/:receiptId/reject')
  rejectSkillInstall(@Param('receiptId') receiptId: string, @Body() dto: ResolveSkillInstallDto) {
    return this.runtimeCentersService.rejectSkillInstall(receiptId, dto);
  }

  @Get('company-agents-center')
  getCompanyAgentsCenter() {
    return this.runtimeCentersService.getCompanyAgentsCenter();
  }

  @Post('company-agents-center/:workerId/enable')
  enableCompanyAgent(@Param('workerId') workerId: string) {
    return this.runtimeCentersService.setCompanyAgentEnabled(workerId, true);
  }

  @Post('company-agents-center/:workerId/disable')
  disableCompanyAgent(@Param('workerId') workerId: string) {
    return this.runtimeCentersService.setCompanyAgentEnabled(workerId, false);
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
  async closeConnectorSession(@Param('connectorId') connectorId: string) {
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

  @Get('evals-center')
  getEvalsCenter(
    @Query('days') days?: string,
    @Query('scenarioId') scenarioId?: string,
    @Query('outcome') outcome?: string
  ) {
    return this.runtimeCentersService.getEvalsCenter(days ? Number(days) : undefined, {
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
    @Query('executionMode') executionMode?: string,
    @Query('interactionKind') interactionKind?: string,
    @Query('format') format?: string
  ) {
    return this.runtimeCentersService.exportRuntimeCenter({
      days: days ? Number(days) : undefined,
      status,
      model,
      pricingSource,
      executionMode,
      interactionKind,
      format
    });
  }

  @Get('approvals-center/export')
  exportApprovalsCenter(
    @Query('executionMode') executionMode?: string,
    @Query('interactionKind') interactionKind?: string,
    @Query('format') format?: string
  ) {
    return this.runtimeCentersService.exportApprovalsCenter({
      executionMode,
      interactionKind,
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
    return this.runtimeCentersService.exportEvalsCenter({
      days: days ? Number(days) : undefined,
      scenarioId,
      outcome,
      format
    });
  }
}
