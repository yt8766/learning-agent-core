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
  GatewayAuthFileDeleteRequestSchema,
  GatewayAuthFilePatchRequestSchema,
  GatewayGeminiCliOAuthStartRequestSchema,
  GatewayManagementApiCallRequestSchema,
  GatewayOAuthCallbackRequestSchema,
  GatewayProviderOAuthStartRequestSchema,
  GatewayProviderKindSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayUpdateOAuthModelAliasRulesRequestSchema,
  GatewayVertexCredentialImportRequestSchema,
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
  type GatewayVertexCredentialImportResponse
} from '@agent/core';
import { AgentGatewayAuthFileManagementService } from '../../domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import { AgentGatewayDashboardService } from '../../domains/agent-gateway/dashboard/agent-gateway-dashboard.service';
import { AgentGatewayOAuthPolicyService } from '../../domains/agent-gateway/oauth/agent-gateway-oauth-policy.service';
import { AgentGatewayProviderConfigService } from '../../domains/agent-gateway/providers/agent-gateway-provider-config.service';
import { AgentGatewayApiCallService } from '../../domains/agent-gateway/quotas/agent-gateway-api-call.service';
import { AgentGatewayLogService } from '../../domains/agent-gateway/logs/agent-gateway-log.service';
import { AgentGatewaySystemService } from '../../domains/agent-gateway/system/agent-gateway-system.service';

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
    private readonly systemService: AgentGatewaySystemService
  ) {}

  @Get('dashboard') dashboard(): Promise<GatewayDashboardSummaryResponse> {
    return this.dashboardService.summary();
  }

  @Get('provider-configs') providerConfigs(): Promise<GatewayProviderSpecificConfigListResponse> {
    return this.providerConfigService.list();
  }

  @Put('provider-configs/:providerId') saveProviderConfig(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProviderSpecificConfigRecord> {
    return this.providerConfigService.save(
      parseBody(GatewayProviderSpecificConfigRecordSchema, { ...(body as object), id: providerId })
    );
  }

  @Get('provider-configs/:providerId/models') providerModels(
    @Param('providerId') providerId: string
  ): Promise<GatewaySystemModelsResponse> {
    return this.providerConfigService.discoverModels(providerId);
  }

  @Post('provider-configs/:providerId/test-model') testProviderModel(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProbeResponse> {
    const record = asRecord(body);
    if (typeof record.model !== 'string') throw invalidRequest();
    return this.providerConfigService.testModel(providerId, record.model);
  }

  @Get('auth-files') authFiles(@Query() query: Record<string, unknown>): Promise<GatewayAuthFileListResponse> {
    return this.authFileService.list({
      query: stringValue(query.query),
      providerKind: stringValue(query.providerKind),
      cursor: stringValue(query.cursor),
      limit: numberValue(query.limit)
    });
  }

  @Post('auth-files') uploadAuthFiles(@Body() body: unknown): Promise<GatewayAuthFileBatchUploadResponse> {
    return this.authFileService.batchUpload(parseBody(GatewayAuthFileBatchUploadRequestSchema, body));
  }

  @Patch('auth-files/fields') patchAuthFile(@Body() body: unknown): Promise<GatewayAuthFile> {
    return this.authFileService.patchFields(parseBody(GatewayAuthFilePatchRequestSchema, body));
  }

  @Get('auth-files/:authFileId/models') authFileModels(
    @Param('authFileId') authFileId: string
  ): Promise<GatewayAuthFileModelListResponse> {
    return this.authFileService.models(authFileId);
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
    return this.oauthPolicyService.listAliases(providerId);
  }

  @Patch('oauth/model-aliases/:providerId') saveOauthAliases(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayOAuthModelAliasListResponse> {
    return this.oauthPolicyService.saveAliases(
      parseBody(GatewayUpdateOAuthModelAliasRulesRequestSchema, { ...(body as object), providerId })
    );
  }

  @Get('oauth/status/:state') oauthStatus(@Param('state') state: string): Promise<GatewayOAuthStatusResponse> {
    return this.oauthPolicyService.status(state);
  }

  @Post('oauth/callback') oauthCallback(@Body() body: unknown): Promise<GatewayOAuthCallbackResponse> {
    return this.oauthPolicyService.submitCallback(parseBody(GatewayOAuthCallbackRequestSchema, body));
  }

  @Post('oauth/gemini-cli/start') startGeminiCli(@Body() body: unknown) {
    return this.oauthPolicyService.startGeminiCli(parseBody(GatewayGeminiCliOAuthStartRequestSchema, body));
  }

  @Post('oauth/:providerId/start') startProviderOAuth(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProviderOAuthStartResponse> {
    return this.oauthPolicyService.startProviderAuth(
      parseBody(GatewayProviderOAuthStartRequestSchema, { ...(body as object), provider: providerId })
    );
  }

  @Post('oauth/vertex/import') importVertexCredential(
    @Body() body: unknown
  ): Promise<GatewayVertexCredentialImportResponse> {
    return this.oauthPolicyService.importVertexCredential(parseBody(GatewayVertexCredentialImportRequestSchema, body));
  }

  @Post('api-call') apiCall(@Body() body: unknown): Promise<GatewayManagementApiCallResponse> {
    return this.apiCallService.call(parseBody(GatewayManagementApiCallRequestSchema, body));
  }

  @Post('quotas/details/:providerKind/refresh') refreshQuota(
    @Param('providerKind') providerKind: string
  ): Promise<GatewayQuotaDetailListResponse> {
    return this.apiCallService.refreshQuotaDetails(parseBody(GatewayProviderKindSchema, providerKind));
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
    return this.systemService.latestVersion();
  }

  @Put('system/request-log') setRequestLog(@Body() body: unknown): Promise<GatewayRequestLogSettingResponse> {
    const record = asRecord(body);
    return this.systemService.setRequestLogEnabled(record.enabled === true || record.requestLog === true);
  }

  @Post('system/clear-login-storage') clearLoginStorage(): Promise<GatewayClearLoginStorageResponse> {
    return this.systemService.clearLoginStorage();
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
