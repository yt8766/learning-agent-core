import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  GatewayAuthFileBatchUploadRequestSchema,
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileDeleteRequestSchema,
  GatewayAuthFilePatchRequestSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFileSchema,
  GatewayClearLoginStorageResponseSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayGeminiCliOAuthStartRequestSchema,
  GatewayManagementApiCallRequestSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayOAuthCallbackRequestSchema,
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayProviderOAuthStartRequestSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderKindSchema,
  GatewayProbeResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewayRuntimeHealthResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayUpdateOAuthModelAliasRulesRequestSchema,
  GatewayUsageAnalyticsQuerySchema,
  GatewayUsageAnalyticsResponseSchema,
  GatewayVertexCredentialImportRequestSchema,
  GatewayVertexCredentialImportResponseSchema,
  type GatewayAuthFile,
  type GatewayAuthFileBatchUploadResponse,
  type GatewayAuthFileDeleteResponse,
  type GatewayAuthFileListResponse,
  type GatewayAuthFileModelListResponse,
  type GatewayClearLoginStorageResponse,
  type GatewayDashboardSummaryResponse,
  type GatewayManagementApiCallResponse,
  type GatewayOAuthCallbackResponse,
  type GatewayOAuthModelAliasListResponse,
  type GatewayProviderOAuthStartResponse,
  type GatewayOAuthStatusResponse,
  type GatewayProbeResponse,
  type GatewayProviderSpecificConfigListResponse,
  type GatewayProviderSpecificConfigRecord,
  type GatewayQuotaDetailListResponse,
  type GatewayRequestLogSettingResponse,
  type GatewaySystemModelsResponse,
  type GatewaySystemVersionResponse,
  type GatewayUsageAnalyticsResponse,
  type GatewayVertexCredentialImportResponse
} from '@agent/core';
import { AgentGatewayAuthFileManagementService } from '../../domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import { AgentGatewayDashboardService } from '../../domains/agent-gateway/dashboard/agent-gateway-dashboard.service';
import { AgentGatewayOAuthPolicyService } from '../../domains/agent-gateway/oauth/agent-gateway-oauth-policy.service';
import { AgentGatewayProviderConfigService } from '../../domains/agent-gateway/providers/agent-gateway-provider-config.service';
import { AgentGatewayApiCallService } from '../../domains/agent-gateway/quotas/agent-gateway-api-call.service';
import { AgentGatewayLogService } from '../../domains/agent-gateway/logs/agent-gateway-log.service';
import { RuntimeEngineFacade } from '../../domains/agent-gateway/runtime-engine/runtime-engine.facade';
import type { RuntimeEngineHealth } from '../../domains/agent-gateway/runtime-engine/types/runtime-engine.types';
import { AgentGatewaySystemService } from '../../domains/agent-gateway/system/agent-gateway-system.service';
import { AgentGatewayUsageAnalyticsService } from '../../domains/agent-gateway/usage/agent-gateway-usage-analytics.service';

@Controller('agent-gateway')
@UseGuards(AgentGatewayAuthGuard)
export class AgentGatewayManagementController {
  constructor(
    private readonly dashboardService: AgentGatewayDashboardService,
    private readonly providerConfigService: AgentGatewayProviderConfigService,
    private readonly authFileService: AgentGatewayAuthFileManagementService,
    private readonly oauthPolicyService: AgentGatewayOAuthPolicyService,
    private readonly apiCallService: AgentGatewayApiCallService,
    private readonly logService: AgentGatewayLogService,
    private readonly systemService: AgentGatewaySystemService,
    private readonly runtimeEngine: RuntimeEngineFacade,
    private readonly usageAnalyticsService: AgentGatewayUsageAnalyticsService
  ) {}

  @Get('dashboard') dashboard(): Promise<GatewayDashboardSummaryResponse> {
    return this.dashboardService.summary().then(response => GatewayDashboardSummaryResponseSchema.parse(response));
  }

  @Get('runtime/health')
  runtimeHealth(): Promise<RuntimeEngineHealth> {
    return this.runtimeEngine.health().then(response => GatewayRuntimeHealthResponseSchema.parse(response));
  }

  @Get('usage/analytics')
  usageAnalytics(@Query() query: Record<string, unknown>): Promise<GatewayUsageAnalyticsResponse> {
    return this.usageAnalyticsService
      .summary(parseBody(GatewayUsageAnalyticsQuerySchema, query))
      .then(response => GatewayUsageAnalyticsResponseSchema.parse(response));
  }

  @Get('provider-configs') providerConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return this.providerConfigService
      .list()
      .then(response => GatewayProviderSpecificConfigListResponseSchema.parse(response));
  }

  @Put('provider-configs/:providerId') saveProviderConfig(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProviderSpecificConfigRecord> {
    const request = parseBody(GatewayProviderSpecificConfigRecordSchema, { ...(body as object), id: providerId });
    return this.providerConfigService
      .saveProviderConfig(providerId, request)
      .then(response => GatewayProviderSpecificConfigRecordSchema.parse(response));
  }

  @Delete('provider-configs/:providerId') deleteProviderConfig(@Param('providerId') providerId: string): Promise<void> {
    return this.providerConfigService.deleteProviderConfig(providerId);
  }

  @Get('provider-configs/:providerId/models') providerModels(
    @Param('providerId') providerId: string
  ): Promise<GatewaySystemModelsResponse> {
    return this.providerConfigService
      .discoverModels(providerId)
      .then(response => GatewaySystemModelsResponseSchema.parse(response));
  }

  @Post('provider-configs/:providerId/test-model') testProviderModel(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProbeResponse> {
    const record = asRecord(body);
    if (typeof record.model !== 'string') throw invalidRequest();
    return this.providerConfigService
      .testModel(providerId, record.model)
      .then(response => GatewayProbeResponseSchema.parse(response));
  }

  @Get('auth-files') authFiles(@Query() query: Record<string, unknown>): Promise<GatewayAuthFileListResponse> {
    return this.authFileService
      .list({
        query: stringValue(query.query),
        providerKind: stringValue(query.providerKind),
        cursor: stringValue(query.cursor),
        limit: numberValue(query.limit)
      })
      .then(response => GatewayAuthFileListResponseSchema.parse(response));
  }

  @Post('auth-files') uploadAuthFiles(@Body() body: unknown): Promise<GatewayAuthFileBatchUploadResponse> {
    return this.authFileService
      .uploadAuthFiles(parseBody(GatewayAuthFileBatchUploadRequestSchema, body))
      .then(response => GatewayAuthFileBatchUploadResponseSchema.parse(response));
  }

  @Patch('auth-files/fields') patchAuthFile(@Body() body: unknown): Promise<GatewayAuthFile> {
    return this.authFileService
      .patchFields(parseBody(GatewayAuthFilePatchRequestSchema, body))
      .then(response => GatewayAuthFileSchema.parse(response));
  }

  @Get('auth-files/:authFileId/models') authFileModels(
    @Param('authFileId') authFileId: string
  ): Promise<GatewayAuthFileModelListResponse> {
    return this.authFileService
      .models(authFileId)
      .then(response => GatewayAuthFileModelListResponseSchema.parse(response));
  }

  @Get('auth-files/:authFileId/download') downloadAuthFile(@Param('authFileId') authFileId: string): Promise<string> {
    return this.authFileService.download(authFileId);
  }

  @Delete('auth-files') deleteAuthFiles(@Body() body: unknown): Promise<GatewayAuthFileDeleteResponse> {
    return this.authFileService.delete(parseBody(GatewayAuthFileDeleteRequestSchema, body));
  }

  @Get('oauth/model-aliases/:providerId') oauthAliases(
    @Param('providerId') providerId: string
  ): Promise<GatewayOAuthModelAliasListResponse> {
    return this.oauthPolicyService
      .listAliases(providerId)
      .then(response => GatewayOAuthModelAliasListResponseSchema.parse(response));
  }

  @Patch('oauth/model-aliases/:providerId') saveOauthAliases(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayOAuthModelAliasListResponse> {
    return this.oauthPolicyService
      .saveAliases(parseBody(GatewayUpdateOAuthModelAliasRulesRequestSchema, { ...(body as object), providerId }))
      .then(response => GatewayOAuthModelAliasListResponseSchema.parse(response));
  }

  @Get('oauth/status/:state') oauthStatus(@Param('state') state: string): Promise<GatewayOAuthStatusResponse> {
    return this.oauthPolicyService.status(state).then(response => GatewayOAuthStatusResponseSchema.parse(response));
  }

  @Post('oauth/callback') oauthCallback(@Body() body: unknown): Promise<GatewayOAuthCallbackResponse> {
    return this.oauthPolicyService
      .submitCallback(parseBody(GatewayOAuthCallbackRequestSchema, body))
      .then(response => GatewayOAuthCallbackResponseSchema.parse(response));
  }

  @Post('oauth/gemini-cli/start') startGeminiCli(@Body() body: unknown): Promise<GatewayProviderOAuthStartResponse> {
    return this.oauthPolicyService
      .startGeminiCli(parseBody(GatewayGeminiCliOAuthStartRequestSchema, body))
      .then(response => GatewayProviderOAuthStartResponseSchema.parse(response));
  }

  @Post('oauth/:providerId/start') startProviderOAuth(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProviderOAuthStartResponse> {
    const request = parseBody(GatewayProviderOAuthStartRequestSchema, { ...(body as object), provider: providerId });
    return this.oauthPolicyService
      .startProviderOAuth(providerId, request)
      .then(response => GatewayProviderOAuthStartResponseSchema.parse(response));
  }

  @Post('oauth/vertex/import') importVertexCredential(
    @Body() body: unknown
  ): Promise<GatewayVertexCredentialImportResponse> {
    return this.oauthPolicyService
      .importVertexCredential(parseBody(GatewayVertexCredentialImportRequestSchema, body))
      .then(response => GatewayVertexCredentialImportResponseSchema.parse(response));
  }

  @Post('api-call') apiCall(@Body() body: unknown): Promise<GatewayManagementApiCallResponse> {
    return this.apiCallService
      .call(parseBody(GatewayManagementApiCallRequestSchema, body))
      .then(response => GatewayManagementApiCallResponseSchema.parse(response));
  }

  @Post('quotas/details/:providerKind/refresh') refreshQuota(
    @Param('providerKind') providerKind: string
  ): Promise<GatewayQuotaDetailListResponse> {
    return this.apiCallService
      .refreshProviderQuota(parseBody(GatewayProviderKindSchema, providerKind))
      .then(response => GatewayQuotaDetailListResponseSchema.parse(response));
  }

  @Get('logs/request/:id/download') downloadRequestLog(@Param('id') id: string): Promise<string> {
    return this.logService.downloadRequestLog(id);
  }

  @Get('logs/request-error-files/:fileName/download') downloadRequestErrorFile(
    @Param('fileName') fileName: string
  ): Promise<string> {
    return this.logService.downloadRequestErrorFile(fileName);
  }

  @Get('system/latest-version') latestVersion(): Promise<GatewaySystemVersionResponse> {
    return this.systemService.latestVersion().then(response => GatewaySystemVersionResponseSchema.parse(response));
  }

  @Put('system/request-log') setRequestLog(@Body() body: unknown): Promise<GatewayRequestLogSettingResponse> {
    const record = asRecord(body);
    return this.systemService
      .setRequestLogEnabled(record.enabled === true || record.requestLog === true)
      .then(response => GatewayRequestLogSettingResponseSchema.parse(response));
  }

  @Post('system/clear-login-storage') clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return this.systemService
      .clearLoginStorage()
      .then(response => GatewayClearLoginStorageResponseSchema.parse(response));
  }
}

function parseBody<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
  body: unknown
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw invalidRequest();
  return parsed.data;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidRequest();
  return input as Record<string, unknown>;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function invalidRequest(): BadRequestException {
  return new BadRequestException({ code: 'INVALID_REQUEST', message: 'Agent Gateway management 参数无效' });
}
