import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { GatewayLogEntry, GatewayRelayRequest, GatewayRelayResponse, GatewayUsageRecord } from '@agent/core';
import type { AgentGatewayProvider } from '../providers/agent-gateway-provider';
import { AGENT_GATEWAY_PROVIDERS } from '../providers/agent-gateway-provider';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';
import { selectGatewayProvider } from './agent-gateway-router';

@Injectable()
export class AgentGatewayRelayService {
  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Inject(AGENT_GATEWAY_PROVIDERS) private readonly providers: AgentGatewayProvider[]
  ) {}

  async relay(request: GatewayRelayRequest): Promise<GatewayRelayResponse> {
    const selected = selectGatewayProvider(await this.repository.listProviders(), request.model, request.providerId);
    if (!selected) {
      throw new BadRequestException({ code: 'PROVIDER_NOT_FOUND', message: '没有可用的中转上游通道' });
    }

    const provider = this.providers.find(candidate => candidate.providerId === selected.id);
    if (!provider) {
      throw new BadRequestException({ code: 'PROVIDER_ADAPTER_NOT_FOUND', message: '未配置上游通道适配器' });
    }

    const providerResponse = await provider.complete(request);
    const relayId = `relay-${Date.now()}`;
    const logId = `log-${Date.now()}`;
    const occurredAt = new Date().toISOString();

    const logEntry: GatewayLogEntry = {
      id: logId,
      occurredAt,
      level: 'info',
      stage: 'proxy',
      provider: selected.provider,
      message: `完成 ${selected.id} 中转调用`,
      inputTokens: providerResponse.usage.inputTokens,
      outputTokens: providerResponse.usage.outputTokens
    };
    await this.repository.appendLog(logEntry);

    const usageRecord: GatewayUsageRecord = {
      id: `usage-${Date.now()}`,
      provider: selected.provider,
      date: occurredAt.slice(0, 10),
      requestCount: 1,
      inputTokens: providerResponse.usage.inputTokens,
      outputTokens: providerResponse.usage.outputTokens,
      estimatedCostUsd: 0
    };
    await this.repository.appendUsage(usageRecord);

    return {
      id: relayId,
      providerId: selected.id,
      model: providerResponse.model,
      content: providerResponse.content,
      usage: providerResponse.usage,
      logId
    };
  }
}
