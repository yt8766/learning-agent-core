import { Body, Controller, Delete, Get, Inject, Patch, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { GatewayProviderType } from '@agent/core';

import {
  AGENT_GATEWAY_MANAGEMENT_CLIENT,
  type AgentGatewayManagementClient
} from '../../domains/agent-gateway/management/agent-gateway-management-client';
import {
  endpointFromRequestPath,
  isGatewayProviderRecord,
  isRecord,
  normalizeProviderEndpoint,
  projectOpenAICompatibility,
  projectProviderConfig,
  PROVIDER_ENDPOINT_TO_TYPE,
  toOpenAIProviderConfig,
  toProviderConfig
} from './cli-proxy-management-compat.helpers';
import { CliProxyManagementNoStoreInterceptor } from './cli-proxy-management-cache.interceptor';
import { CliProxyManagementCompatGuard } from './cli-proxy-management-compat.guard';

type RequestLike = { path?: string; url?: string; route?: { path?: string } };

@Controller('v0/management')
@UseGuards(CliProxyManagementCompatGuard)
@UseInterceptors(CliProxyManagementNoStoreInterceptor)
export class CliProxyManagementProviderCompatController {
  constructor(
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  @Get(['gemini-api-key', 'codex-api-key', 'claude-api-key', 'vertex-api-key'])
  async listProviderKeysFromRequest(@Req() request: RequestLike): Promise<Record<string, unknown[]>> {
    return this.listProviderKeys(endpointFromRequestPath(request));
  }

  async listProviderKeys(endpoint: string): Promise<Record<string, unknown[]>> {
    const normalizedEndpoint = normalizeProviderEndpoint(endpoint);
    const providerType = PROVIDER_ENDPOINT_TO_TYPE[normalizedEndpoint];
    const response = await this.managementClient.listProviderConfigs();
    return {
      [normalizedEndpoint]: response.items
        .filter(isGatewayProviderRecord)
        .filter(item => item.providerType === providerType)
        .map(item => projectProviderConfig(item))
    };
  }

  @Put(['gemini-api-key', 'codex-api-key', 'claude-api-key', 'vertex-api-key'])
  async replaceProviderKeysFromRequest(
    @Req() request: RequestLike,
    @Body() body: unknown
  ): Promise<Record<string, unknown[]>> {
    return this.replaceProviderKeys(endpointFromRequestPath(request), body);
  }

  async replaceProviderKeys(endpoint: string, body: unknown): Promise<Record<string, unknown[]>> {
    const normalizedEndpoint = normalizeProviderEndpoint(endpoint);
    const nextValues = Array.isArray(body) ? body : [];
    const providerType = PROVIDER_ENDPOINT_TO_TYPE[normalizedEndpoint];
    await this.deleteProviderConfigsByType(providerType);
    await Promise.all(
      nextValues.map((value, index) =>
        this.managementClient.saveProviderConfig(toProviderConfig(normalizedEndpoint, value, index))
      )
    );
    return this.listProviderKeys(normalizedEndpoint);
  }

  @Patch(['gemini-api-key', 'codex-api-key', 'claude-api-key', 'vertex-api-key'])
  async patchProviderKey(@Req() request: RequestLike, @Body() body: unknown): Promise<Record<string, unknown[]>> {
    const endpoint = normalizeProviderEndpoint(endpointFromRequestPath(request));
    const source = isRecord(body) ? body : {};
    const current = (await this.listProviderKeys(endpoint))[endpoint] ?? [];
    const index = Number(source.index);
    const next = [...current];
    if (Number.isInteger(index) && source.value !== undefined) next[index] = source.value;
    return this.replaceProviderKeys(endpoint, next);
  }

  @Delete(['gemini-api-key', 'codex-api-key', 'claude-api-key', 'vertex-api-key'])
  async deleteProviderKey(@Req() request: RequestLike): Promise<Record<string, unknown[]>> {
    const endpoint = normalizeProviderEndpoint(endpointFromRequestPath(request));
    await this.deleteProviderConfigsByType(PROVIDER_ENDPOINT_TO_TYPE[endpoint]);
    return this.listProviderKeys(endpoint);
  }

  @Get('openai-compatibility')
  async listOpenAICompatibility(): Promise<Record<'openai-compatibility', unknown[]>> {
    const response = await this.managementClient.listProviderConfigs();
    return {
      'openai-compatibility': response.items
        .filter(isGatewayProviderRecord)
        .filter(item => item.providerType === 'openaiCompatible')
        .map(item => projectOpenAICompatibility(item))
    };
  }

  @Put('openai-compatibility')
  async replaceOpenAICompatibility(@Body() body: unknown): Promise<Record<'openai-compatibility', unknown[]>> {
    const values = Array.isArray(body) ? body : [];
    await this.deleteProviderConfigsByType('openaiCompatible');
    await Promise.all(
      values.map((value, index) => this.managementClient.saveProviderConfig(toOpenAIProviderConfig(value, index)))
    );
    return this.listOpenAICompatibility();
  }

  @Patch('openai-compatibility')
  async patchOpenAICompatibility(@Body() body: unknown): Promise<Record<'openai-compatibility', unknown[]>> {
    const source = isRecord(body) ? body : {};
    const current = (await this.listOpenAICompatibility())['openai-compatibility'];
    const index = Number(source.index);
    const next = [...current];
    if (Number.isInteger(index) && isRecord(source.value)) {
      next[index] = { ...(isRecord(next[index]) ? next[index] : {}), ...source.value };
    }
    return this.replaceOpenAICompatibility(next);
  }

  @Delete('openai-compatibility')
  async deleteOpenAICompatibility(): Promise<Record<'openai-compatibility', unknown[]>> {
    await this.deleteProviderConfigsByType('openaiCompatible');
    return this.listOpenAICompatibility();
  }

  private async deleteProviderConfigsByType(providerType: GatewayProviderType): Promise<void> {
    const current = await this.managementClient.listProviderConfigs();
    await Promise.all(
      current.items
        .filter(isGatewayProviderRecord)
        .filter(item => item.providerType === providerType)
        .map(item => this.managementClient.deleteProviderConfig(item.id))
    );
  }
}
