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
  GatewayAccountingRequestSchema,
  GatewayCompleteOAuthRequestSchema,
  GatewayDeleteApiKeyRequestSchema,
  GatewayDeleteCredentialFileRequestSchema,
  GatewayDeleteProviderRequestSchema,
  GatewayListQuerySchema,
  GatewayLogSearchRequestSchema,
  GatewayPreprocessRequestSchema,
  GatewayProbeRequestSchema,
  GatewayRelayRequestSchema,
  GatewayReplaceApiKeysRequestSchema,
  GatewaySaveConnectionProfileRequestSchema,
  GatewaySaveRawConfigRequestSchema,
  GatewayStartOAuthRequestSchema,
  GatewayTokenCountRequestSchema,
  GatewayUpdateApiKeyRequestSchema,
  GatewayUpdateConfigRequestSchema,
  GatewayUpdateQuotaRequestSchema,
  GatewayUpsertCredentialFileRequestSchema,
  GatewayUpsertProviderRequestSchema
} from '@agent/core';
import type {
  GatewayAccountingResponse,
  GatewayCompleteOAuthResponse,
  GatewayConfig,
  GatewayCredentialFile,
  GatewayApiKeyListResponse,
  GatewayClearLogsResponse,
  GatewayConfigDiffResponse,
  GatewayConnectionProfile,
  GatewayConnectionStatusResponse,
  GatewayLogFileListResponse,
  GatewayLogListResponse,
  GatewayPreprocessResponse,
  GatewayProbeResponse,
  GatewayProviderCredentialSet,
  GatewayQuota,
  GatewayQuotaDetailListResponse,
  GatewayRawConfigResponse,
  GatewayRelayResponse,
  GatewayReloadConfigResponse,
  GatewayRequestLogListResponse,
  GatewaySnapshot,
  GatewayStartOAuthResponse,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse,
  GatewayTokenCountResponse,
  GatewayUsageListResponse
} from '@agent/core';
import { AgentGatewayApiKeyService } from '../../domains/agent-gateway/api-keys/agent-gateway-api-key.service';
import { AgentGatewayAuthGuard } from '../../domains/agent-gateway/auth/agent-gateway-auth.guard';
import { AgentGatewayConfigFileService } from '../../domains/agent-gateway/config/agent-gateway-config-file.service';
import { AgentGatewayConnectionService } from '../../domains/agent-gateway/management/agent-gateway-connection.service';
import { AgentGatewayOAuthService } from '../../domains/agent-gateway/oauth/agent-gateway-oauth.service';
import { AgentGatewayQuotaDetailService } from '../../domains/agent-gateway/quotas/agent-gateway-quota-detail.service';
import { AgentGatewayRelayService } from '../../domains/agent-gateway/runtime/agent-gateway-relay.service';
import { AgentGatewayService } from '../../domains/agent-gateway/services/agent-gateway.service';
import { AgentGatewayLogService } from '../../domains/agent-gateway/logs/agent-gateway-log.service';
import { AgentGatewaySystemService } from '../../domains/agent-gateway/system/agent-gateway-system.service';
@Controller('agent-gateway')
@UseGuards(AgentGatewayAuthGuard)
export class AgentGatewayController {
  constructor(
    private readonly service: AgentGatewayService,
    private readonly relayService?: AgentGatewayRelayService,
    private readonly oauthService?: AgentGatewayOAuthService,
    private readonly connectionService?: AgentGatewayConnectionService,
    private readonly configFileService?: AgentGatewayConfigFileService,
    private readonly apiKeyService?: AgentGatewayApiKeyService,
    private readonly logService?: AgentGatewayLogService,
    private readonly quotaDetailService?: AgentGatewayQuotaDetailService,
    private readonly systemService?: AgentGatewaySystemService
  ) {}

  @Get('snapshot') snapshot(): Promise<GatewaySnapshot> {
    return this.service.snapshot();
  }

  @Get('providers') providers(): Promise<GatewayProviderCredentialSet[]> {
    return this.service.listProviders();
  }

  @Get('credential-files') credentialFiles(): Promise<GatewayCredentialFile[]> {
    return this.service.listCredentialFiles();
  }

  @Get('quotas') quotas(): Promise<GatewayQuota[]> {
    return this.service.listQuotas();
  }

  @Get('logs') logs(@Query() query: unknown): Promise<GatewayLogListResponse> {
    const parsed = GatewayListQuerySchema.safeParse(query);
    return this.service.listLogs(parsed.success ? parsed.data.limit : undefined);
  }

  @Get('usage') usage(@Query() query: unknown): Promise<GatewayUsageListResponse> {
    const parsed = GatewayListQuerySchema.safeParse(query);
    return this.service.listUsage(parsed.success ? parsed.data.limit : undefined);
  }

  @Put('connection/profile') saveConnectionProfile(@Body() body: unknown): Promise<GatewayConnectionProfile> {
    const parsed = parseConnectionProfile(body);
    if (!this.connectionService)
      throw new BadRequestException({ code: 'MANAGEMENT_UNAVAILABLE', message: 'Management client 未配置' });
    return this.connectionService.saveProfile(parsed);
  }

  @Post('connection/check') checkConnection(): Promise<GatewayConnectionStatusResponse> {
    if (!this.connectionService)
      throw new BadRequestException({ code: 'MANAGEMENT_UNAVAILABLE', message: 'Management client 未配置' });
    return this.connectionService.checkConnection();
  }

  @Get('config/raw') rawConfig(): Promise<GatewayRawConfigResponse> {
    if (!this.configFileService)
      throw new BadRequestException({ code: 'CONFIG_UNAVAILABLE', message: '配置文件服务未配置' });
    return this.configFileService.readRawConfig();
  }

  @Post('config/raw/diff') diffRawConfig(@Body() body: unknown): Promise<GatewayConfigDiffResponse> {
    if (!this.configFileService)
      throw new BadRequestException({ code: 'CONFIG_UNAVAILABLE', message: '配置文件服务未配置' });
    return this.configFileService.diffRawConfig(parseRawConfigWrite(body));
  }

  @Put('config/raw') saveRawConfig(@Body() body: unknown): Promise<GatewayRawConfigResponse> {
    if (!this.configFileService)
      throw new BadRequestException({ code: 'CONFIG_UNAVAILABLE', message: '配置文件服务未配置' });
    return this.configFileService.saveRawConfig(parseRawConfigWrite(body));
  }

  @Post('config/reload') reloadConfig(): Promise<GatewayReloadConfigResponse> {
    if (!this.configFileService)
      throw new BadRequestException({ code: 'CONFIG_UNAVAILABLE', message: '配置文件服务未配置' });
    return this.configFileService.reloadConfig();
  }

  @Get('api-keys') apiKeys(): Promise<GatewayApiKeyListResponse> {
    if (!this.apiKeyService)
      throw new BadRequestException({ code: 'API_KEYS_UNAVAILABLE', message: 'API key 服务未配置' });
    return this.apiKeyService.list();
  }

  @Put('api-keys') replaceApiKeys(@Body() body: unknown): Promise<GatewayApiKeyListResponse> {
    if (!this.apiKeyService)
      throw new BadRequestException({ code: 'API_KEYS_UNAVAILABLE', message: 'API key 服务未配置' });
    return this.apiKeyService.replace(parseReplaceApiKeys(body));
  }

  @Patch('api-keys/:index') updateApiKey(
    @Param('index') index: string,
    @Body() body: unknown
  ): Promise<GatewayApiKeyListResponse> {
    if (!this.apiKeyService)
      throw new BadRequestException({ code: 'API_KEYS_UNAVAILABLE', message: 'API key 服务未配置' });
    return this.apiKeyService.update(parseUpdateApiKey(index, body));
  }

  @Delete('api-keys/:index') deleteApiKey(@Param('index') index: string): Promise<GatewayApiKeyListResponse> {
    if (!this.apiKeyService)
      throw new BadRequestException({ code: 'API_KEYS_UNAVAILABLE', message: 'API key 服务未配置' });
    return this.apiKeyService.delete({ index: parseIndex(index, 'API key 删除参数无效') });
  }

  @Get('quotas/details') quotaDetails(): Promise<GatewayQuotaDetailListResponse> {
    if (!this.quotaDetailService)
      throw new BadRequestException({ code: 'QUOTA_DETAILS_UNAVAILABLE', message: 'quota detail 服务未配置' });
    return this.quotaDetailService.list();
  }

  @Get('logs/tail') tailLogs(@Query() query: unknown): Promise<GatewayRequestLogListResponse> {
    if (!this.logService) throw new BadRequestException({ code: 'LOGS_UNAVAILABLE', message: '日志服务未配置' });
    return this.logService.tail(parseLogSearch(query));
  }

  @Post('logs/search') searchLogs(@Body() body: unknown): Promise<GatewayRequestLogListResponse> {
    if (!this.logService) throw new BadRequestException({ code: 'LOGS_UNAVAILABLE', message: '日志服务未配置' });
    return this.logService.search(parseLogSearch(body));
  }

  @Get('logs/request-error-files') requestErrorFiles(): Promise<GatewayLogFileListResponse> {
    if (!this.logService) throw new BadRequestException({ code: 'LOGS_UNAVAILABLE', message: '日志服务未配置' });
    return this.logService.listRequestErrorFiles();
  }

  @Delete('logs') clearLogs(): Promise<GatewayClearLogsResponse> {
    if (!this.logService) throw new BadRequestException({ code: 'LOGS_UNAVAILABLE', message: '日志服务未配置' });
    return this.logService.clear();
  }

  @Get('system/info') systemInfo(): Promise<GatewaySystemVersionResponse> {
    if (!this.systemService)
      throw new BadRequestException({ code: 'SYSTEM_UNAVAILABLE', message: '系统信息服务未配置' });
    return this.systemService.info();
  }

  @Get('system/models') systemModels(): Promise<GatewaySystemModelsResponse> {
    if (!this.systemService)
      throw new BadRequestException({ code: 'SYSTEM_UNAVAILABLE', message: '系统信息服务未配置' });
    return this.systemService.models();
  }

  @Patch('config') updateConfig(@Body() body: unknown): Promise<GatewayConfig> {
    const parsed = GatewayUpdateConfigRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '网关配置参数无效' });
    return this.service.updateConfig(parsed.data);
  }

  @Put('providers/:providerId') upsertProvider(
    @Param('providerId') providerId: string,
    @Body() body: unknown
  ): Promise<GatewayProviderCredentialSet> {
    const parsed = GatewayUpsertProviderRequestSchema.safeParse({ ...(body as object), id: providerId });
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'provider 参数无效' });
    return this.service.upsertProvider(parsed.data);
  }

  @Delete('providers/:providerId') deleteProvider(@Param('providerId') providerId: string): Promise<void> {
    const parsed = GatewayDeleteProviderRequestSchema.safeParse({ providerId });
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'provider 删除参数无效' });
    return this.service.deleteProvider(parsed.data);
  }

  @Put('credential-files/:credentialFileId') upsertCredentialFile(
    @Param('credentialFileId') credentialFileId: string,
    @Body() body: unknown
  ): Promise<GatewayCredentialFile> {
    const parsed = GatewayUpsertCredentialFileRequestSchema.safeParse({ ...(body as object), id: credentialFileId });
    if (!parsed.success)
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'credential file 参数无效' });
    return this.service.upsertCredentialFile(parsed.data);
  }

  @Delete('credential-files/:credentialFileId') deleteCredentialFile(
    @Param('credentialFileId') credentialFileId: string
  ): Promise<void> {
    const parsed = GatewayDeleteCredentialFileRequestSchema.safeParse({ credentialFileId });
    if (!parsed.success)
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'credential file 删除参数无效' });
    return this.service.deleteCredentialFile(parsed.data);
  }

  @Patch('quotas/:quotaId') updateQuota(
    @Param('quotaId') quotaId: string,
    @Body() body: unknown
  ): Promise<GatewayQuota> {
    const parsed = GatewayUpdateQuotaRequestSchema.safeParse({ ...(body as object), id: quotaId });
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'quota 参数无效' });
    return this.service.updateQuota(parsed.data);
  }

  @Post('probe') probe(@Body() body: unknown): GatewayProbeResponse {
    const parsed = GatewayProbeRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '探测参数无效' });
    return this.service.probe(parsed.data);
  }
  @Post('token-count') tokenCount(@Body() body: unknown): GatewayTokenCountResponse {
    const parsed = GatewayTokenCountRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'token 计算参数无效' });
    return this.service.countTokens(parsed.data.text);
  }
  @Post('preprocess') preprocess(@Body() body: unknown): GatewayPreprocessResponse {
    const parsed = GatewayPreprocessRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '前处理参数无效' });
    return this.service.preprocess(parsed.data);
  }
  @Post('accounting') accounting(@Body() body: unknown): GatewayAccountingResponse {
    const parsed = GatewayAccountingRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '后处理参数无效' });
    return this.service.accounting(parsed.data);
  }

  @Post('relay') relay(@Body() body: unknown): Promise<GatewayRelayResponse> {
    const parsed = GatewayRelayRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '中转请求参数无效' });
    if (!this.relayService) throw new BadRequestException({ code: 'RELAY_UNAVAILABLE', message: '中转服务未配置' });
    return this.relayService.relay(parsed.data);
  }

  @Post('oauth/start') startOAuth(@Body() body: unknown): Promise<GatewayStartOAuthResponse> {
    const parsed = GatewayStartOAuthRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'OAuth 启动参数无效' });
    if (!this.oauthService) throw new BadRequestException({ code: 'OAUTH_UNAVAILABLE', message: 'OAuth 服务未配置' });
    return this.oauthService.start(parsed.data);
  }

  @Post('oauth/complete') completeOAuth(@Body() body: unknown): Promise<GatewayCompleteOAuthResponse> {
    const parsed = GatewayCompleteOAuthRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'OAuth 完成参数无效' });
    if (!this.oauthService) throw new BadRequestException({ code: 'OAUTH_UNAVAILABLE', message: 'OAuth 服务未配置' });
    return this.oauthService.complete(parsed.data);
  }
}

function parseConnectionProfile(body: unknown) {
  const parsed = GatewaySaveConnectionProfileRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '连接参数无效' });
  return parsed.data;
}

function parseRawConfigWrite(body: unknown) {
  const parsed = GatewaySaveRawConfigRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'raw config 参数无效' });
  return parsed.data;
}

function parseReplaceApiKeys(body: unknown) {
  const parsed = GatewayReplaceApiKeysRequestSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'API key 参数无效' });
  return parsed.data;
}

function parseUpdateApiKey(index: string, body: unknown) {
  const record = asRecord(body, 'API key 参数无效');
  const parsed = GatewayUpdateApiKeyRequestSchema.safeParse({
    keyId: String(parseIndex(index, 'API key 参数无效')),
    name: record.value
  });
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'API key 参数无效' });
  return parsed.data;
}

function parseLogSearch(input: unknown) {
  const record = asRecord(input, '日志查询参数无效');
  const parsed = GatewayLogSearchRequestSchema.safeParse({
    ...record,
    hideManagementTraffic: record.hideManagementTraffic === true || record.hideManagementTraffic === 'true',
    limit: record.limit === undefined ? undefined : Number(record.limit)
  });
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: '日志查询参数无效' });
  return parsed.data;
}

function parseIndex(input: string, message: string): number {
  const index = Number(input);
  if (!Number.isInteger(index) || index < 0) throw new BadRequestException({ code: 'INVALID_REQUEST', message });
  return index;
}

function asRecord(input: unknown, message: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message });
  }
  return input as Record<string, unknown>;
}
