import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type {
  GatewayClientQuota,
  GatewayClientRequestLogListResponse,
  GatewayClientUsageSummary,
  GatewayUpdateClientQuotaRequest
} from '@agent/core';
import type { AgentGatewayClientRepository } from './agent-gateway-client.repository';
import { AGENT_GATEWAY_CLIENT_CLOCK, AGENT_GATEWAY_CLIENT_REPOSITORY } from './agent-gateway-client.repository';

type DateFactory = () => Date;

@Injectable()
export class AgentGatewayClientQuotaService {
  constructor(
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY)
    private readonly repository: AgentGatewayClientRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_CLOCK)
    private readonly now: DateFactory = () => new Date()
  ) {}

  async getQuota(clientId: string): Promise<GatewayClientQuota> {
    await this.requireClient(clientId);
    const usage = await this.usage(clientId);
    const quota = (await this.repository.getQuota(clientId)) ?? this.defaultQuota(clientId, usage);
    return {
      ...quota,
      usedTokens: usage.totalTokens,
      usedRequests: usage.requestCount,
      status: quotaStatus(usage.totalTokens, usage.requestCount, quota.tokenLimit, quota.requestLimit)
    };
  }

  async updateQuota(clientId: string, request: GatewayUpdateClientQuotaRequest): Promise<GatewayClientQuota> {
    await this.requireClient(clientId);
    const usage = await this.usage(clientId);
    return this.repository.upsertQuota({
      clientId,
      period: 'monthly',
      tokenLimit: request.tokenLimit,
      requestLimit: request.requestLimit,
      usedTokens: usage.totalTokens,
      usedRequests: usage.requestCount,
      resetAt: request.resetAt,
      status: quotaStatus(usage.totalTokens, usage.requestCount, request.tokenLimit, request.requestLimit)
    });
  }

  async usage(clientId: string): Promise<GatewayClientUsageSummary> {
    await this.requireClient(clientId);
    return (await this.repository.getUsage(clientId)) ?? emptyUsage(clientId);
  }

  async logs(clientId: string, limit?: number): Promise<GatewayClientRequestLogListResponse> {
    await this.requireClient(clientId);
    return { items: await this.repository.listRequestLogs(clientId, limit) };
  }

  private defaultQuota(clientId: string, usage: GatewayClientUsageSummary): GatewayClientQuota {
    return {
      clientId,
      period: 'monthly',
      tokenLimit: 1_000_000,
      requestLimit: 10_000,
      usedTokens: usage.totalTokens,
      usedRequests: usage.requestCount,
      resetAt: nextMonthlyResetAt(this.now()),
      status: quotaStatus(usage.totalTokens, usage.requestCount, 1_000_000, 10_000)
    };
  }

  private async requireClient(clientId: string): Promise<void> {
    const client = await this.repository.findClient(clientId);
    if (!client) throw new NotFoundException({ code: 'CLIENT_NOT_FOUND', message: 'Gateway client not found' });
  }
}

function quotaStatus(
  usedTokens: number,
  usedRequests: number,
  tokenLimit: number,
  requestLimit: number
): GatewayClientQuota['status'] {
  if (usedTokens >= tokenLimit || usedRequests >= requestLimit) return 'exceeded';
  if (usedTokens / tokenLimit >= 0.8 || usedRequests / requestLimit >= 0.8) return 'warning';
  return 'normal';
}

function nextMonthlyResetAt(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

function emptyUsage(clientId: string): GatewayClientUsageSummary {
  return {
    clientId,
    window: 'current-period',
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    lastRequestAt: null
  };
}
