import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';

import {
  AGENT_GATEWAY_MANAGEMENT_CLIENT,
  type AgentGatewayManagementClient
} from '../../domains/agent-gateway/management/agent-gateway-management-client';
import {
  endpointFromRequestPath,
  isGatewayProviderRecord,
  isRecord,
  normalizeStringArray,
  normalizeValueBody,
  parseSimpleYamlConfig,
  projectOpenAICompatibility,
  projectProviderConfig,
  PROVIDER_ENDPOINT_TO_TYPE,
  type CliProxyProviderEndpoint
} from './cli-proxy-management-compat.helpers';
import { CliProxyManagementNoStoreInterceptor } from './cli-proxy-management-cache.interceptor';
import { CliProxyManagementCompatGuard } from './cli-proxy-management-compat.guard';

type RequestLike = { path?: string; url?: string; route?: { path?: string } };

const PROVIDER_ENDPOINTS: CliProxyProviderEndpoint[] = [
  'gemini-api-key',
  'codex-api-key',
  'claude-api-key',
  'vertex-api-key'
];

@Controller('v0/management')
@UseGuards(CliProxyManagementCompatGuard)
@UseInterceptors(CliProxyManagementNoStoreInterceptor)
export class CliProxyManagementCompatController {
  private readonly configOverrides = new Map<string, unknown>();

  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  @Get('config')
  async getConfig(): Promise<Record<string, unknown>> {
    const rawConfig = await this.managementClient.readRawConfig();
    const parsedConfig = parseSimpleYamlConfig(rawConfig.content);
    const apiKeys = await this.listApiKeys();
    const providerConfig = await this.managementClient.listProviderConfigs();
    const providerEntries = Object.fromEntries(
      PROVIDER_ENDPOINTS.map(endpoint => [
        endpoint,
        providerConfig.items
          .filter(isGatewayProviderRecord)
          .filter(item => item.providerType === PROVIDER_ENDPOINT_TO_TYPE[endpoint])
          .map(item => projectProviderConfig(item))
      ])
    );

    return {
      debug: parsedConfig.debug ?? true,
      'request-retry': parsedConfig['request-retry'] ?? 2,
      'api-keys': apiKeys['api-keys'],
      'request-log': this.configOverrides.get('request-log') ?? true,
      'logging-to-file': this.configOverrides.get('logging-to-file') ?? false,
      'logs-max-total-size-mb': this.configOverrides.get('logs-max-total-size-mb') ?? 0,
      'ws-auth': this.configOverrides.get('ws-auth') ?? false,
      'force-model-prefix': this.configOverrides.get('force-model-prefix') ?? false,
      'routing-strategy': this.configOverrides.get('routing/strategy') ?? 'round-robin',
      'proxy-url': this.configOverrides.get('proxy-url') ?? '',
      'quota-exceeded': {
        'switch-project': this.configOverrides.get('quota-exceeded/switch-project') ?? false,
        'switch-preview-model': this.configOverrides.get('quota-exceeded/switch-preview-model') ?? false
      },
      ...providerEntries,
      'openai-compatibility': providerConfig.items
        .filter(isGatewayProviderRecord)
        .filter(item => item.providerType === 'openaiCompatible')
        .map(item => projectOpenAICompatibility(item)),
      ampcode: {
        upstream_url: '',
        upstream_api_key: '',
        upstream_api_keys: {},
        model_mappings: {},
        force_model_mappings: false
      }
    };
  }

  @Get('config.yaml')
  async getConfigYaml(): Promise<string> {
    return (await this.managementClient.readRawConfig()).content;
  }

  @Put('config.yaml')
  async saveConfigYaml(@Body() body: string | Record<string, unknown>): Promise<string> {
    const content = typeof body === 'string' ? body : String(body.content ?? body.value ?? '');
    return (await this.managementClient.saveRawConfig({ content })).content;
  }

  @Put([
    'debug',
    'proxy-url',
    'request-retry',
    'request-log',
    'logging-to-file',
    'logs-max-total-size-mb',
    'ws-auth',
    'force-model-prefix'
  ])
  updateConfigValue(@Req() request: RequestLike, @Body() body: unknown): Record<string, unknown> {
    const key = endpointFromRequestPath(request);
    const value = normalizeValueBody(body);
    this.configOverrides.set(key, value);
    return { [key]: value };
  }

  @Get(['logs-max-total-size-mb', 'force-model-prefix'])
  getConfigValue(@Req() request: RequestLike): Record<string, unknown> {
    const key = endpointFromRequestPath(request);
    return { [key]: this.configOverrides.get(key) ?? (key === 'logs-max-total-size-mb' ? 0 : false) };
  }

  @Delete('proxy-url')
  clearProxyUrl(): Record<string, unknown> {
    this.configOverrides.delete('proxy-url');
    return { 'proxy-url': '' };
  }

  @Put(['quota-exceeded/switch-project', 'quota-exceeded/switch-preview-model', 'routing/strategy'])
  updateNestedConfigValue(@Req() request: RequestLike, @Body() body: unknown): Record<string, unknown> {
    const pathTail = endpointFromRequestPath(request);
    const key = pathTail === 'strategy' ? 'routing/strategy' : `quota-exceeded/${pathTail}`;
    const value = normalizeValueBody(body);
    this.configOverrides.set(key, value);
    return key === 'routing/strategy' ? { strategy: value, 'routing-strategy': value } : { [key]: value };
  }

  @Get('routing/strategy')
  getRoutingStrategy(): Record<string, unknown> {
    const strategy = this.configOverrides.get('routing/strategy') ?? 'round-robin';
    return { strategy, 'routing-strategy': strategy };
  }

  @Get('api-keys')
  async listApiKeys(): Promise<Record<'api-keys', string[]>> {
    const response = await this.managementClient.listApiKeys();
    return { 'api-keys': response.items.map(item => item.prefix) };
  }

  @Put('api-keys')
  async replaceApiKeys(@Body() keys: unknown): Promise<Record<'api-keys', string[]>> {
    await this.managementClient.replaceApiKeys({ keys: normalizeStringArray(keys) });
    return this.listApiKeys();
  }

  @Patch('api-keys')
  async updateApiKey(@Body() body: unknown): Promise<Record<'api-keys', string[]>> {
    const source = isRecord(body) ? body : {};
    await this.managementClient.updateApiKey({
      keyId: String(source.index ?? ''),
      name: String(source.value ?? '')
    });
    return this.listApiKeys();
  }

  @Delete('api-keys')
  async deleteApiKey(@Query('index') index: string): Promise<Record<'api-keys', string[]>> {
    await this.managementClient.deleteApiKey({ index: Number(index) });
    return this.listApiKeys();
  }
}
