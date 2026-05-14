import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { GatewayManagementApiCallRequest, GatewayProviderKind } from '@agent/core';

import {
  AGENT_GATEWAY_MANAGEMENT_CLIENT,
  type AgentGatewayManagementClient
} from '../../domains/agent-gateway/management/agent-gateway-management-client';
import {
  endpointFromRequestPath,
  isRecord,
  normalizeStringArray,
  normalizeValueBody,
  projectAuthFile,
  projectLogLines,
  projectRequestErrorFiles
} from './cli-proxy-management-compat.helpers';
import { CliProxyManagementNoStoreInterceptor } from './cli-proxy-management-cache.interceptor';
import { CliProxyManagementCompatGuard } from './cli-proxy-management-compat.guard';

type RequestLike = { path?: string; url?: string; route?: { path?: string } };
type UploadedFileLike = { originalname?: string; buffer?: Buffer };

@Controller('v0/management')
@UseGuards(CliProxyManagementCompatGuard)
@UseInterceptors(CliProxyManagementNoStoreInterceptor)
export class CliProxyManagementOperationsCompatController {
  private readonly configOverrides = new Map<string, unknown>();
  private readonly oauthExcludedModels = new Map<string, string[]>();
  private readonly oauthModelAliases = new Map<string, Array<Record<string, unknown>>>();

  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  @Get('auth-files')
  async listAuthFiles(): Promise<Record<string, unknown>> {
    const response = await this.managementClient.listAuthFiles({ limit: 500 });
    return { files: response.items.map(item => projectAuthFile(item)), total: response.items.length };
  }

  @Patch('auth-files/status')
  async patchAuthFileStatus(@Body() body: unknown): Promise<Record<string, unknown>> {
    const source = isRecord(body) ? body : {};
    const authFile = await this.managementClient.patchAuthFileFields({
      authFileId: String(source.name ?? ''),
      disabled: Boolean(source.disabled)
    });
    return { status: 'ok', disabled: authFile.disabled ?? false };
  }

  @Patch('auth-files/fields')
  async patchAuthFileFields(@Body() body: unknown): Promise<Record<string, unknown>> {
    const source = isRecord(body) ? body : {};
    const authFile = await this.managementClient.patchAuthFileFields({
      authFileId: String(source.name ?? ''),
      prefix: typeof source.prefix === 'string' ? source.prefix : undefined,
      proxyUrl: typeof source.proxy_url === 'string' ? source.proxy_url : undefined,
      headers: isRecord(source.headers)
        ? Object.fromEntries(Object.entries(source.headers).map(([key, value]) => [key, String(value ?? '')]))
        : undefined,
      priority: typeof source.priority === 'number' ? source.priority : undefined,
      note: typeof source.note === 'string' ? source.note : undefined
    });
    return projectAuthFile(authFile);
  }

  @Post('auth-files')
  @UseInterceptors(FilesInterceptor('file'))
  async uploadAuthFiles(@UploadedFiles() files: UploadedFileLike[] = []): Promise<Record<string, unknown>> {
    const response = await this.managementClient.batchUploadAuthFiles({
      files: files.map(file => ({
        fileName: file.originalname ?? 'auth-file.json',
        contentBase64: (file.buffer ?? Buffer.from('{}')).toString('base64')
      }))
    });
    return {
      status: response.rejected.length ? 'partial' : 'ok',
      uploaded: response.accepted.length,
      files: response.accepted.map(item => item.fileName),
      failed: response.rejected.map(item => ({ name: item.fileName, error: item.reason }))
    };
  }

  @Delete('auth-files')
  async deleteAuthFiles(
    @Query('all') all: string | undefined,
    @Body() body: unknown
  ): Promise<Record<string, unknown>> {
    const source = isRecord(body) ? body : {};
    const response = await this.managementClient.deleteAuthFiles({
      all: all === 'true',
      names: normalizeStringArray(source.names)
    });
    return {
      status: response.skipped.length ? 'partial' : 'ok',
      deleted: response.deleted.length,
      files: response.deleted,
      failed: response.skipped.map(item => ({ name: item.name, error: item.reason }))
    };
  }

  @Get('auth-files/download')
  downloadAuthFile(@Query('name') name: string): Promise<string> {
    return this.managementClient.downloadAuthFile(name);
  }

  @Get('auth-files/models')
  async getAuthFileModels(@Query('name') name: string): Promise<Record<string, unknown>> {
    const response = await this.managementClient.listAuthFileModels(name);
    return {
      models: response.models.map(item => ({ id: item.id, display_name: item.displayName, type: item.providerKind }))
    };
  }

  @Get('model-definitions/:channel')
  async getModelDefinitions(@Param('channel') channel: GatewayProviderKind): Promise<Record<string, unknown>> {
    const response = await this.managementClient.discoverProviderModels(channel);
    return {
      models: response.groups.flatMap(group =>
        group.models.map(item => ({ id: item.id, display_name: item.displayName, type: item.providerKind }))
      )
    };
  }

  @Get('logs')
  async getLogs(): Promise<Record<string, unknown>> {
    const response = await this.managementClient.tailLogs({ hideManagementTraffic: false, limit: 200 });
    const lines = projectLogLines(response.items);
    const latestTimestamp = lines.length ? Date.parse(response.items[response.items.length - 1].occurredAt) : 0;
    return {
      lines,
      'line-count': lines.length,
      latest_timestamp: latestTimestamp,
      'latest-timestamp': latestTimestamp
    };
  }

  @Delete('logs')
  clearLogs(): Promise<Record<string, unknown>> {
    return this.managementClient.clearLogs();
  }

  @Get('request-error-logs')
  async listRequestErrorLogs(): Promise<Record<string, unknown>> {
    return projectRequestErrorFiles(await this.managementClient.listRequestErrorFiles());
  }

  @Get('request-error-logs/:filename')
  downloadRequestErrorLog(@Param('filename') filename: string): Promise<string> {
    return this.managementClient.downloadRequestErrorFile(filename);
  }

  @Get('request-log-by-id/:id')
  downloadRequestLog(@Param('id') id: string): Promise<string> {
    return this.managementClient.downloadRequestLog(id);
  }

  @Get(['codex-auth-url', 'anthropic-auth-url', 'antigravity-auth-url', 'gemini-cli-auth-url', 'kimi-auth-url'])
  async startProviderOAuthFromRequest(
    @Req() request: RequestLike,
    @Query() query: Record<string, string>
  ): Promise<Record<string, unknown>> {
    return this.startProviderOAuth(endpointFromRequestPath(request), query);
  }

  async startProviderOAuth(providerAuthUrl: string, query: Record<string, string>): Promise<Record<string, unknown>> {
    const provider = providerAuthUrl.replace(/-auth-url$/, '');
    const response =
      provider === 'gemini-cli'
        ? await this.managementClient.startGeminiCliOAuth({ projectId: query.project_id })
        : await this.managementClient.startProviderOAuth({
            provider: provider as 'codex' | 'anthropic' | 'antigravity' | 'kimi',
            isWebui: query.is_webui === 'true',
            projectId: query.project_id
          });
    return {
      state: response.state,
      url: response.verificationUri,
      verification_uri: response.verificationUri,
      user_code: response.userCode,
      expires_at: response.expiresAt,
      project_id: response.projectId
    };
  }

  @Get('get-auth-status')
  async getAuthStatus(@Query('state') state: string): Promise<Record<string, unknown>> {
    const response = await this.managementClient.getOAuthStatus(state);
    if (response.status === 'completed') return { status: 'ok' };
    if (response.status === 'error') return { status: 'error', error: 'OAuth failed' };
    return { status: 'wait' };
  }

  @Post('oauth-callback')
  async submitOAuthCallback(@Body() body: unknown): Promise<Record<string, unknown>> {
    const source = isRecord(body) ? body : {};
    const response = await this.managementClient.submitOAuthCallback({
      provider: String(source.provider ?? 'unknown'),
      redirectUrl: String(source.redirect_url ?? source.redirectUrl ?? '')
    });
    return { status: response.accepted ? 'ok' : 'error', provider: response.provider };
  }

  @Get('oauth-excluded-models')
  getOAuthExcludedModels(): Record<string, unknown> {
    return { 'oauth-excluded-models': Object.fromEntries(this.oauthExcludedModels.entries()) };
  }

  @Put('oauth-excluded-models')
  replaceOAuthExcludedModels(@Body() body: unknown): Record<string, unknown> {
    this.oauthExcludedModels.clear();
    if (isRecord(body)) {
      Object.entries(body).forEach(([provider, models]) =>
        this.oauthExcludedModels.set(provider, normalizeStringArray(models))
      );
    }
    return this.getOAuthExcludedModels();
  }

  @Patch('oauth-excluded-models')
  patchOAuthExcludedModels(@Body() body: unknown): Record<string, unknown> {
    const source = isRecord(body) ? body : {};
    const provider = String(source.provider ?? '').trim();
    if (provider) this.oauthExcludedModels.set(provider, normalizeStringArray(source.models));
    return this.getOAuthExcludedModels();
  }

  @Delete('oauth-excluded-models')
  deleteOAuthExcludedModels(@Query('provider') provider: string): Record<string, unknown> {
    this.oauthExcludedModels.delete(provider);
    return this.getOAuthExcludedModels();
  }

  @Get('oauth-model-alias')
  getOAuthModelAlias(): Record<string, unknown> {
    return { 'oauth-model-alias': Object.fromEntries(this.oauthModelAliases.entries()) };
  }

  @Patch('oauth-model-alias')
  patchOAuthModelAlias(@Body() body: unknown): Record<string, unknown> {
    const source = isRecord(body) ? body : {};
    const channel = String(source.channel ?? '').trim();
    if (channel)
      this.oauthModelAliases.set(channel, Array.isArray(source.aliases) ? source.aliases.filter(isRecord) : []);
    return this.getOAuthModelAlias();
  }

  @Delete('oauth-model-alias')
  deleteOAuthModelAlias(@Query('channel') channel: string): Record<string, unknown> {
    this.oauthModelAliases.delete(channel);
    return this.getOAuthModelAlias();
  }

  @Get('api-key-usage')
  async getApiKeyUsage(): Promise<Record<string, unknown>> {
    const quota = await this.managementClient.listQuotaDetails();
    return { items: quota.items };
  }

  @Post('api-call')
  callManagementApi(@Body() body: GatewayManagementApiCallRequest): Promise<Record<string, unknown>> {
    return this.managementClient.managementApiCall(body);
  }

  @Get('latest-version')
  latestVersion(): Promise<Record<string, unknown>> {
    return this.managementClient.latestVersion();
  }

  @Get('ampcode')
  getAmpcodeConfig(): Record<string, unknown> {
    return {
      upstream_url: this.configOverrides.get('ampcode/upstream-url') ?? '',
      upstream_api_key: this.configOverrides.get('ampcode/upstream-api-key') ?? '',
      upstream_api_keys: this.configOverrides.get('ampcode/upstream-api-keys') ?? {},
      model_mappings: this.configOverrides.get('ampcode/model-mappings') ?? {},
      force_model_mappings: this.configOverrides.get('ampcode/force-model-mappings') ?? false
    };
  }

  @Put([
    'ampcode/upstream-url',
    'ampcode/upstream-api-key',
    'ampcode/upstream-api-keys',
    'ampcode/model-mappings',
    'ampcode/force-model-mappings'
  ])
  putAmpcodeValue(@Req() request: RequestLike, @Body() body: unknown): Record<string, unknown> {
    return this.updateAmpcodeValue(request, body);
  }

  @Patch(['ampcode/upstream-api-keys', 'ampcode/model-mappings'])
  patchAmpcodeValue(@Req() request: RequestLike, @Body() body: unknown): Record<string, unknown> {
    return this.updateAmpcodeValue(request, body);
  }

  updateAmpcodeValue(request: RequestLike, body: unknown): Record<string, unknown> {
    const path = `ampcode/${endpointFromRequestPath(request)}`;
    this.configOverrides.set(path, normalizeValueBody(body));
    return this.getAmpcodeConfig();
  }

  @Delete(['ampcode/upstream-url', 'ampcode/upstream-api-key', 'ampcode/upstream-api-keys', 'ampcode/model-mappings'])
  clearAmpcodeValue(@Req() request: RequestLike): Record<string, unknown> {
    this.configOverrides.delete(`ampcode/${endpointFromRequestPath(request)}`);
    return this.getAmpcodeConfig();
  }
}
