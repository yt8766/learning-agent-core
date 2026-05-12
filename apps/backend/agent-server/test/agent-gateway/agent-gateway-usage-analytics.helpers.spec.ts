import { describe, expect, it } from 'vitest';

// We need to test the pure helper functions. Since they are not exported,
// we test them indirectly through the service's public summary() method
// and by exercising the module's internal logic paths.
// Instead, we'll import and test the internal functions by re-implementing
// the key logic in a testable way.

// The service file has these internal pure functions:
// - resolveRange, matchesQuery, summarize, buildTrend, buildProviderStats,
//   buildModelStats, buildFilters, providerDisplayName, isSuccess, contains,
//   safeRatio, average, emptySummary, groupBy, projectLog
//
// Since they are not exported, we test them through the AgentGatewayUsageAnalyticsService.summary()
// by constructing a mock repository.

import { AgentGatewayUsageAnalyticsService } from '../../src/domains/agent-gateway/usage/agent-gateway-usage-analytics.service';

function createMockRepository(clients: any[] = [], logs: any[] = []) {
  return {
    listClients: async () => clients,
    listRequestLogs: async (_clientId: string, _limit: number) => logs,
    getClient: async () => null,
    createClient: async () => ({}),
    updateClient: async () => ({}),
    deleteClient: async () => {},
    listClientApiKeys: async () => [],
    getClientApiKey: async () => null,
    createClientApiKey: async () => ({}),
    updateClientApiKey: async () => ({}),
    deleteClientApiKey: async () => {},
    getClientQuota: async () => null,
    upsertClientQuota: async () => ({}),
    listRequestLogsByClient: async () => [],
    appendRequestLog: async () => ({}),
    listSecretRefs: async () => [],
    getSecret: async () => null,
    setSecret: async () => ({}),
    deleteSecret: async () => {}
  };
}

function makeClient(overrides: Record<string, any> = {}) {
  return {
    id: 'client-1',
    name: 'Test Client',
    status: 'active',
    ...overrides
  };
}

function makeLog(overrides: Record<string, any> = {}) {
  return {
    id: 'log-1',
    clientId: 'client-1',
    occurredAt: new Date().toISOString(),
    providerId: 'openai',
    model: 'gpt-4',
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 200,
    statusCode: 200,
    ...overrides
  };
}

describe('AgentGatewayUsageAnalyticsService', () => {
  describe('summary', () => {
    it('returns empty response when no clients', async () => {
      const service = new AgentGatewayUsageAnalyticsService(
        createMockRepository([]),
        () => new Date('2026-05-11T12:00:00Z')
      );
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.summary.requestCount).toBe(0);
      expect(result.requestLogs.items).toEqual([]);
      expect(result.requestLogs.total).toBe(0);
    });

    it('returns response with logs when clients have data', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const log = makeLog({ occurredAt: recentTime });
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], [log]), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.summary.requestCount).toBe(1);
      expect(result.requestLogs.items).toHaveLength(1);
    });

    it('filters by providerId', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-1', providerId: 'openai', occurredAt: recentTime }),
        makeLog({ id: 'log-2', providerId: 'anthropic', occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50, providerId: 'openai' });
      expect(result.requestLogs.items).toHaveLength(1);
      expect(result.requestLogs.items[0].providerId).toBe('openai');
    });

    it('filters by applicationId', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const clients = [makeClient({ id: 'c1' }), makeClient({ id: 'c2' })];
      const repo = {
        listClients: async () => clients,
        listRequestLogs: async (clientId: string) => {
          if (clientId === 'c1') return [makeLog({ id: 'log-1', occurredAt: recentTime })];
          return [makeLog({ id: 'log-2', occurredAt: recentTime })];
        },
        getClient: async () => null,
        createClient: async () => ({}),
        updateClient: async () => ({}),
        deleteClient: async () => {},
        listClientApiKeys: async () => [],
        getClientApiKey: async () => null,
        createClientApiKey: async () => ({}),
        updateClientApiKey: async () => ({}),
        deleteClientApiKey: async () => {},
        getClientQuota: async () => null,
        upsertClientQuota: async () => ({}),
        listRequestLogsByClient: async () => [],
        appendRequestLog: async () => ({}),
        listSecretRefs: async () => [],
        getSecret: async () => null,
        setSecret: async () => ({}),
        deleteSecret: async () => {}
      };
      const service = new AgentGatewayUsageAnalyticsService(repo as any, () => now);
      const result = await service.summary({ range: '24h', limit: 50, applicationId: 'c1' });
      expect(result.requestLogs.items).toHaveLength(1);
    });

    it('filters by status success', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-1', statusCode: 200, occurredAt: recentTime }),
        makeLog({ id: 'log-2', statusCode: 500, occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50, status: 'success' });
      expect(result.requestLogs.items).toHaveLength(1);
      expect(result.requestLogs.items[0].statusCode).toBe(200);
    });

    it('filters by status error', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-1', statusCode: 200, occurredAt: recentTime }),
        makeLog({ id: 'log-2', statusCode: 500, occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50, status: 'error' });
      expect(result.requestLogs.items).toHaveLength(1);
      expect(result.requestLogs.items[0].statusCode).toBe(500);
    });

    it('filters by providerSearch', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-1', providerId: 'openai', occurredAt: recentTime }),
        makeLog({ id: 'log-2', providerId: 'anthropic', occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50, providerSearch: 'open' });
      expect(result.requestLogs.items).toHaveLength(1);
    });

    it('filters by modelSearch', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-1', model: 'gpt-4', occurredAt: recentTime }),
        makeLog({ id: 'log-2', model: 'claude-3', occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50, modelSearch: 'gpt' });
      expect(result.requestLogs.items).toHaveLength(1);
    });

    it('handles 7d range', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-10T12:00:00Z').toISOString();
      const service = new AgentGatewayUsageAnalyticsService(
        createMockRepository([makeClient()], [makeLog({ occurredAt: recentTime })]),
        () => now
      );
      const result = await service.summary({ range: '7d', limit: 50 });
      expect(result.range.bucketMinutes).toBe(24 * 60);
      expect(result.summary.requestCount).toBe(1);
    });

    it('handles 30d range', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-01T12:00:00Z').toISOString();
      const service = new AgentGatewayUsageAnalyticsService(
        createMockRepository([makeClient()], [makeLog({ occurredAt: recentTime })]),
        () => now
      );
      const result = await service.summary({ range: '30d', limit: 50 });
      expect(result.range.bucketMinutes).toBe(24 * 60);
    });

    it('handles today range (default)', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T06:00:00Z').toISOString();
      const service = new AgentGatewayUsageAnalyticsService(
        createMockRepository([makeClient()], [makeLog({ occurredAt: recentTime })]),
        () => now
      );
      const result = await service.summary({ range: 'today', limit: 50 });
      expect(result.range.bucketMinutes).toBe(60);
    });

    it('builds provider stats', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-1', providerId: 'openai', statusCode: 200, occurredAt: recentTime }),
        makeLog({ id: 'log-2', providerId: 'openai', statusCode: 500, occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.providerStats.length).toBeGreaterThan(0);
      expect(result.providerStats[0].providerId).toBe('openai');
    });

    it('builds model stats', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', model: 'gpt-4', occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.modelStats.length).toBeGreaterThan(0);
    });

    it('builds filters', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', providerId: 'openai', model: 'gpt-4', occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.filters.providers).toBeDefined();
      expect(result.filters.models).toBeDefined();
      expect(result.filters.applications).toBeDefined();
    });

    it('handles null providerId in log', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', providerId: null, occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items[0].providerName).toBe('Unknown');
    });

    it('handles null model in log', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', model: null, occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items[0].model).toBeNull();
    });

    it('respects limit', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = Array.from({ length: 10 }, (_, i) => makeLog({ id: `log-${i}`, occurredAt: recentTime }));
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 3 });
      expect(result.requestLogs.items).toHaveLength(3);
    });

    it('handles codex_session provider display name', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', providerId: 'codex_session', occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items[0].providerName).toBe('Codex (Session)');
    });

    it('handles claude_session provider display name', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', providerId: 'claude_session', occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items[0].providerName).toBe('Claude (Session)');
    });

    it('handles gemini_cli provider display name', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', providerId: 'gemini_cli', occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items[0].providerName).toBe('Gemini CLI');
    });

    it('capitalizes hyphenated provider names', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', providerId: 'my-custom-provider', occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items[0].providerName).toBe('My Custom Provider');
    });

    it('filters out logs outside time range', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const oldTime = new Date('2026-05-01T12:00:00Z').toISOString();
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [
        makeLog({ id: 'log-old', occurredAt: oldTime }),
        makeLog({ id: 'log-recent', occurredAt: recentTime })
      ];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items).toHaveLength(1);
    });

    it('handles invalid date in log gracefully', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', occurredAt: 'invalid-date' })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50 });
      expect(result.requestLogs.items).toHaveLength(0);
    });

    it('uses empty model in search when model is null', async () => {
      const now = new Date('2026-05-11T12:00:00Z');
      const recentTime = new Date('2026-05-11T11:00:00Z').toISOString();
      const client = makeClient();
      const logs = [makeLog({ id: 'log-1', model: null, occurredAt: recentTime })];
      const service = new AgentGatewayUsageAnalyticsService(createMockRepository([client], logs), () => now);
      const result = await service.summary({ range: '24h', limit: 50, modelSearch: 'anything' });
      expect(result.requestLogs.items).toHaveLength(0);
    });
  });
});
