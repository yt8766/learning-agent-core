import { describe, expect, it, vi } from 'vitest';

import { AgentGatewayApiCallService } from '../../src/domains/agent-gateway/quotas/agent-gateway-api-call.service';

describe('AgentGatewayApiCallService extended coverage', () => {
  describe('call', () => {
    it('delegates to managementApiCall when available on client', async () => {
      const mockCall = vi.fn().mockResolvedValue({
        statusCode: 200,
        header: {},
        bodyText: '{"ok":true}',
        body: { ok: true },
        durationMs: 5
      });
      const service = new AgentGatewayApiCallService({
        listQuotaDetails: vi.fn(),
        managementApiCall: mockCall
      } as any);

      const result = await service.call({
        method: 'POST',
        url: 'https://api.example.com',
        header: {},
        data: undefined
      });

      expect(mockCall).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
    });

    it('falls back to synthetic response when managementApiCall is not defined', async () => {
      const service = new AgentGatewayApiCallService({
        listQuotaDetails: vi.fn()
      } as any);

      const result = await service.call({
        method: 'GET',
        url: 'https://api.anthropic.com/v1/models',
        header: {},
        data: undefined
      });

      expect(result.statusCode).toBe(200);
      expect(result.bodyText).toContain('claude');
    });

    it('infers gemini provider from googleapis URL', async () => {
      const service = new AgentGatewayApiCallService({
        listQuotaDetails: vi.fn()
      } as any);

      const result = await service.call({
        method: 'GET',
        url: 'https://generativelanguage.googleapis.com/v1/models',
        header: {},
        data: undefined
      });

      expect(result.bodyText).toContain('gemini');
    });

    it('infers custom provider for unknown URLs', async () => {
      const service = new AgentGatewayApiCallService({
        listQuotaDetails: vi.fn()
      } as any);

      const result = await service.call({
        method: 'GET',
        url: 'https://api.openai.com/v1/models',
        header: {},
        data: undefined
      });

      expect(result.bodyText).toContain('custom');
    });
  });

  describe('refreshQuotaDetails', () => {
    it('delegates to refreshQuotaDetails when available on client', async () => {
      const mockRefresh = vi.fn().mockResolvedValue({ items: [quotaDetail('claude')] });
      const service = new AgentGatewayApiCallService({
        listQuotaDetails: vi.fn(),
        refreshQuotaDetails: mockRefresh
      } as any);

      const result = await service.refreshQuotaDetails('claude');

      expect(mockRefresh).toHaveBeenCalledWith('claude');
      expect(result.items).toHaveLength(1);
    });

    it('falls back to filtering listQuotaDetails by providerKind', async () => {
      const mockList = vi.fn().mockResolvedValue({
        items: [quotaDetail('claude'), quotaDetail('gemini')]
      });
      const service = new AgentGatewayApiCallService({
        listQuotaDetails: mockList
      } as any);

      const result = await service.refreshQuotaDetails('claude');

      expect(mockList).toHaveBeenCalled();
      expect(result.items).toEqual([quotaDetail('claude')]);
    });
  });
});

function quotaDetail(providerId: string) {
  return {
    id: `${providerId}-daily`,
    providerId,
    model: `${providerId}-model`,
    scope: 'provider',
    window: 'daily',
    limit: 100,
    used: 1,
    remaining: 99,
    resetAt: null,
    refreshedAt: '2026-05-11T00:00:00.000Z',
    status: 'normal'
  };
}
