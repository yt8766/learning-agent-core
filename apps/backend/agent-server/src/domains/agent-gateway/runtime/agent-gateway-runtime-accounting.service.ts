import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import type { GatewayClientRequestLog, GatewayRelayUsage } from '@agent/core';
import type { AgentGatewayClientRepository } from '../clients/agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_CLOCK, AGENT_GATEWAY_CLIENT_REPOSITORY } from '../clients/agent-gateway-client.repository';
import { openAIError } from './agent-gateway-openai-error';
import type { GatewayRuntimePrincipal } from './agent-gateway-runtime-auth.service';

type DateFactory = () => Date;
const DEFAULT_TOKEN_LIMIT = 1_000_000;
const DEFAULT_REQUEST_LIMIT = 10_000;

@Injectable()
export class AgentGatewayRuntimeAccountingService {
  constructor(
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY)
    private readonly repository: AgentGatewayClientRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_CLOCK)
    private readonly now: DateFactory = () => new Date()
  ) {}

  async assertQuota(principal: GatewayRuntimePrincipal, estimatedInputTokens: number): Promise<void> {
    const quota = await this.repository.getQuota(principal.client.id);
    const usage = await this.repository.getUsage(principal.client.id);
    const requestLimit = quota?.requestLimit ?? DEFAULT_REQUEST_LIMIT;
    const tokenLimit = quota?.tokenLimit ?? DEFAULT_TOKEN_LIMIT;
    const usedRequests = usage?.requestCount ?? quota?.usedRequests ?? 0;
    const usedTokens = usage?.totalTokens ?? quota?.usedTokens ?? 0;
    if (usedRequests + 1 > requestLimit || usedTokens + estimatedInputTokens > tokenLimit) {
      throw new HttpException(
        openAIError('quota_exceeded', 'Gateway client quota exceeded', 'rate_limit_error'),
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  async recordSuccess(
    principal: GatewayRuntimePrincipal,
    usage: GatewayRelayUsage,
    log: Omit<GatewayClientRequestLog, 'clientId' | 'apiKeyId' | 'occurredAt'>
  ): Promise<void> {
    const occurredAt = this.now().toISOString();
    await this.repository.addUsage(principal.client.id, {
      requestCount: 1,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: 0,
      lastRequestAt: occurredAt
    });
    await this.repository.touchApiKey(principal.client.id, principal.apiKey.id, occurredAt);
    await this.repository.appendRequestLog({
      ...log,
      clientId: principal.client.id,
      apiKeyId: principal.apiKey.id,
      occurredAt
    });
  }
}
