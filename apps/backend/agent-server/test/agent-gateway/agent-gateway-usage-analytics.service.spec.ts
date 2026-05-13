import { describe, expect, it } from 'vitest';
import type { GatewayClient, GatewayClientRequestLog } from '@agent/core';
import { MemoryAgentGatewayClientRepository } from '../../src/domains/agent-gateway/clients/memory-agent-gateway-client.repository';
import { AgentGatewayUsageAnalyticsService } from '../../src/domains/agent-gateway/usage/agent-gateway-usage-analytics.service';

const NOW = new Date('2026-05-11T18:50:00.000Z');

describe('AgentGatewayUsageAnalyticsService', () => {
  it('aggregates runtime request logs into overview, trend, provider and model stats', async () => {
    const { service } = await createFixture();

    const response = await service.summary({ range: 'today', status: 'all', limit: 100 });

    expect(response.summary).toMatchObject({
      requestCount: 3,
      inputTokens: 360_891,
      outputTokens: 998,
      totalTokens: 361_889,
      estimatedCostUsd: 0
    });
    expect(response.requestLogs.items.map(item => item.id)).toEqual(['req-codex-2', 'req-claude-1', 'req-codex-1']);
    expect(response.providerStats).toEqual([
      expect.objectContaining({
        providerId: 'codex_session',
        providerName: 'Codex (Session)',
        requestCount: 2,
        totalTokens: 360_816,
        successRate: 1
      }),
      expect.objectContaining({
        providerId: 'claude_session',
        providerName: 'Claude (Session)',
        requestCount: 1,
        totalTokens: 1073,
        successRate: 1
      })
    ]);
    expect(response.modelStats).toContainEqual(
      expect.objectContaining({
        model: 'gpt-5.5',
        providerId: 'codex_session',
        requestCount: 2,
        totalTokens: 360_816
      })
    );
    expect(response.trend.some(point => point.requestCount > 0)).toBe(true);
    expect(response.filters.providers.map(option => option.id)).toEqual(['codex_session', 'claude_session']);
  });

  it('filters by provider, model search and error status', async () => {
    const { service, repository } = await createFixture();
    await repository.appendRequestLog(
      makeLog({
        id: 'req-codex-error',
        clientId: 'client-codex',
        occurredAt: '2026-05-11T18:49:30.000Z',
        providerId: 'codex_session',
        model: 'gpt-5.5',
        statusCode: 500,
        inputTokens: 99,
        outputTokens: 1
      })
    );

    const response = await service.summary({
      range: 'today',
      status: 'error',
      providerId: 'codex_session',
      modelSearch: 'gpt-5',
      limit: 10
    });

    expect(response.summary.requestCount).toBe(1);
    expect(response.requestLogs.items).toEqual([
      expect.objectContaining({
        id: 'req-codex-error',
        providerName: 'Codex (Session)',
        model: 'gpt-5.5',
        statusCode: 500
      })
    ]);
  });
});

async function createFixture() {
  const repository = new MemoryAgentGatewayClientRepository(() => NOW);
  await repository.createClient(makeClient({ id: 'client-codex', name: 'Codex Session' }));
  await repository.createClient(makeClient({ id: 'client-claude', name: 'Claude Session' }));
  await repository.appendRequestLog(
    makeLog({
      id: 'req-codex-1',
      clientId: 'client-codex',
      occurredAt: '2026-05-11T18:48:00.000Z',
      providerId: 'codex_session',
      model: 'gpt-5.5',
      inputTokens: 175_484,
      outputTokens: 316
    })
  );
  await repository.appendRequestLog(
    makeLog({
      id: 'req-claude-1',
      clientId: 'client-claude',
      occurredAt: '2026-05-11T18:48:30.000Z',
      providerId: 'claude_session',
      model: 'mimo-v2.5-pro',
      inputTokens: 1000,
      outputTokens: 73
    })
  );
  await repository.appendRequestLog(
    makeLog({
      id: 'req-codex-2',
      clientId: 'client-codex',
      occurredAt: '2026-05-11T18:49:00.000Z',
      providerId: 'codex_session',
      model: 'gpt-5.5',
      inputTokens: 184_407,
      outputTokens: 609
    })
  );
  return {
    repository,
    service: new AgentGatewayUsageAnalyticsService(repository, () => NOW)
  };
}

function makeClient(patch: Partial<GatewayClient>): GatewayClient {
  return {
    id: 'client-1',
    name: 'Client',
    status: 'active',
    tags: [],
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...patch
  };
}

function makeLog(patch: Partial<GatewayClientRequestLog>): GatewayClientRequestLog {
  return {
    id: 'req-1',
    clientId: 'client-1',
    apiKeyId: 'key-1',
    occurredAt: '2026-05-11T00:00:00.000Z',
    endpoint: '/v1/chat/completions',
    model: 'gpt-5.5',
    providerId: 'codex_session',
    statusCode: 200,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 0,
    ...patch
  };
}
