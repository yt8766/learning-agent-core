import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { AgentGatewayClientsController } from '../../src/api/agent-gateway/agent-gateway-clients.controller';

function createMockClientService(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn().mockResolvedValue({ items: [] }),
    create: vi
      .fn()
      .mockResolvedValue({ id: 'c1', name: 'Client', status: 'active', tags: [], createdAt: '', updatedAt: '' }),
    get: vi
      .fn()
      .mockResolvedValue({ id: 'c1', name: 'Client', status: 'active', tags: [], createdAt: '', updatedAt: '' }),
    update: vi
      .fn()
      .mockResolvedValue({ id: 'c1', name: 'Updated', status: 'active', tags: [], createdAt: '', updatedAt: '' }),
    enable: vi
      .fn()
      .mockResolvedValue({ id: 'c1', name: 'Client', status: 'active', tags: [], createdAt: '', updatedAt: '' }),
    disable: vi
      .fn()
      .mockResolvedValue({ id: 'c1', name: 'Client', status: 'disabled', tags: [], createdAt: '', updatedAt: '' }),
    ...overrides
  } as any;
}

function createMockApiKeyService(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn().mockResolvedValue({ items: [] }),
    create: vi.fn().mockResolvedValue({ id: 'k1', secret: 'gw_live_abc' }),
    update: vi.fn().mockResolvedValue({ id: 'k1', name: 'Updated', status: 'active', scopes: [] }),
    rotate: vi.fn().mockResolvedValue({ id: 'k2', secret: 'gw_live_def' }),
    revoke: vi.fn().mockResolvedValue({ id: 'k1', status: 'revoked' }),
    ...overrides
  } as any;
}

function createMockQuotaService(overrides: Record<string, unknown> = {}) {
  return {
    getQuota: vi.fn().mockResolvedValue({ clientId: 'c1', period: 'monthly', tokenLimit: 1000 }),
    updateQuota: vi.fn().mockResolvedValue({ clientId: 'c1', period: 'monthly', tokenLimit: 2000 }),
    usage: vi.fn().mockResolvedValue({ clientId: 'c1', requestCount: 10 }),
    logs: vi.fn().mockResolvedValue({ items: [] }),
    ...overrides
  } as any;
}

function createController(
  clientOverrides?: Record<string, unknown>,
  apiKeyOverrides?: Record<string, unknown>,
  quotaOverrides?: Record<string, unknown>
) {
  return new AgentGatewayClientsController(
    createMockClientService(clientOverrides),
    createMockApiKeyService(apiKeyOverrides),
    createMockQuotaService(quotaOverrides)
  );
}

async function expectBadRequest(fn: () => Promise<unknown>) {
  try {
    await fn();
    expect.unreachable('Expected BadRequestException to be thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
  }
}

describe('AgentGatewayClientsController', () => {
  describe('listClients', () => {
    it('delegates to clientService.list()', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      await controller.listClients();
      expect(clientService.list).toHaveBeenCalled();
    });
  });

  describe('createClient', () => {
    it('parses body and delegates to clientService.create()', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      const result = await controller.createClient({ name: 'New Client', tags: ['prod'] });
      expect(clientService.create).toHaveBeenCalled();
      expect(result.id).toBe('c1');
    });

    it('throws BadRequestException for invalid body', async () => {
      const controller = createController();
      await expectBadRequest(() => controller.createClient({}));
    });
  });

  describe('getClient', () => {
    it('delegates to clientService.get()', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      await controller.getClient('c1');
      expect(clientService.get).toHaveBeenCalledWith('c1');
    });
  });

  describe('updateClient', () => {
    it('parses body and delegates to clientService.update()', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      const result = await controller.updateClient('c1', { name: 'Updated' });
      expect(clientService.update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Updated' }));
      expect(result.id).toBe('c1');
    });

    it('accepts empty body since all fields are optional', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      const result = await controller.updateClient('c1', {});
      expect(clientService.update).toHaveBeenCalled();
      expect(result.id).toBe('c1');
    });

    it('throws BadRequestException for invalid status', async () => {
      const controller = createController();
      await expectBadRequest(() => controller.updateClient('c1', { status: 'invalid' }));
    });
  });

  describe('enableClient', () => {
    it('delegates to clientService.enable()', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      await controller.enableClient('c1');
      expect(clientService.enable).toHaveBeenCalledWith('c1');
    });
  });

  describe('disableClient', () => {
    it('delegates to clientService.disable()', async () => {
      const clientService = createMockClientService();
      const controller = new AgentGatewayClientsController(
        clientService,
        createMockApiKeyService(),
        createMockQuotaService()
      );

      await controller.disableClient('c1');
      expect(clientService.disable).toHaveBeenCalledWith('c1');
    });
  });

  describe('listApiKeys', () => {
    it('delegates to apiKeyService.list()', async () => {
      const apiKeyService = createMockApiKeyService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        apiKeyService,
        createMockQuotaService()
      );

      await controller.listApiKeys('c1');
      expect(apiKeyService.list).toHaveBeenCalledWith('c1');
    });
  });

  describe('createApiKey', () => {
    it('parses body and delegates to apiKeyService.create()', async () => {
      const apiKeyService = createMockApiKeyService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        apiKeyService,
        createMockQuotaService()
      );

      const result = await controller.createApiKey('c1', { name: 'My Key', scopes: ['chat.completions'] });
      expect(apiKeyService.create).toHaveBeenCalled();
      expect(result.id).toBe('k1');
    });

    it('throws BadRequestException for invalid body', async () => {
      const controller = createController();
      await expectBadRequest(() => controller.createApiKey('c1', {}));
    });
  });

  describe('updateApiKey', () => {
    it('parses body and delegates to apiKeyService.update()', async () => {
      const apiKeyService = createMockApiKeyService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        apiKeyService,
        createMockQuotaService()
      );

      const result = await controller.updateApiKey('c1', 'k1', { name: 'Updated' });
      expect(apiKeyService.update).toHaveBeenCalledWith('c1', 'k1', expect.objectContaining({ name: 'Updated' }));
      expect(result.id).toBe('k1');
    });

    it('accepts empty body since all fields are optional', async () => {
      const apiKeyService = createMockApiKeyService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        apiKeyService,
        createMockQuotaService()
      );

      const result = await controller.updateApiKey('c1', 'k1', {});
      expect(apiKeyService.update).toHaveBeenCalledWith('c1', 'k1', {});
      expect(result.id).toBe('k1');
    });

    it('throws BadRequestException for invalid status', async () => {
      const controller = createController();
      await expectBadRequest(() => controller.updateApiKey('c1', 'k1', { status: 'invalid' }));
    });
  });

  describe('rotateApiKey', () => {
    it('delegates to apiKeyService.rotate()', async () => {
      const apiKeyService = createMockApiKeyService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        apiKeyService,
        createMockQuotaService()
      );

      const result = await controller.rotateApiKey('c1', 'k1');
      expect(apiKeyService.rotate).toHaveBeenCalledWith('c1', 'k1');
      expect(result.id).toBe('k2');
    });
  });

  describe('revokeApiKey', () => {
    it('delegates to apiKeyService.revoke()', async () => {
      const apiKeyService = createMockApiKeyService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        apiKeyService,
        createMockQuotaService()
      );

      const result = await controller.revokeApiKey('c1', 'k1');
      expect(apiKeyService.revoke).toHaveBeenCalledWith('c1', 'k1');
      expect(result.status).toBe('revoked');
    });
  });

  describe('quota', () => {
    it('delegates to quotaService.getQuota()', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      const result = await controller.quota('c1');
      expect(quotaService.getQuota).toHaveBeenCalledWith('c1');
      expect(result.clientId).toBe('c1');
    });
  });

  describe('updateQuota', () => {
    it('parses body and delegates to quotaService.updateQuota()', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      const result = await controller.updateQuota('c1', {
        tokenLimit: 2000,
        requestLimit: 100,
        resetAt: '2026-06-01T00:00:00.000Z'
      });
      expect(quotaService.updateQuota).toHaveBeenCalled();
      expect(result.tokenLimit).toBe(2000);
    });

    it('throws BadRequestException for invalid body', async () => {
      const controller = createController();
      await expectBadRequest(() => controller.updateQuota('c1', {}));
    });

    it('throws BadRequestException for invalid field type', async () => {
      const controller = createController();
      await expectBadRequest(() => controller.updateQuota('c1', { tokenLimit: 'not-a-number' }));
    });
  });

  describe('usage', () => {
    it('delegates to quotaService.usage()', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      const result = await controller.usage('c1');
      expect(quotaService.usage).toHaveBeenCalledWith('c1');
      expect(result.requestCount).toBe(10);
    });
  });

  describe('logs', () => {
    it('delegates to quotaService.logs() with parsed limit', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      await controller.logs('c1', '25');
      expect(quotaService.logs).toHaveBeenCalledWith('c1', 25);
    });

    it('passes undefined when limit is not provided', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      await controller.logs('c1');
      expect(quotaService.logs).toHaveBeenCalledWith('c1', undefined);
    });

    it('passes undefined for non-numeric limit', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      await controller.logs('c1', 'abc');
      expect(quotaService.logs).toHaveBeenCalledWith('c1', undefined);
    });

    it('passes undefined for infinite limit', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      await controller.logs('c1', 'Infinity');
      expect(quotaService.logs).toHaveBeenCalledWith('c1', undefined);
    });

    it('parses zero limit correctly', async () => {
      const quotaService = createMockQuotaService();
      const controller = new AgentGatewayClientsController(
        createMockClientService(),
        createMockApiKeyService(),
        quotaService
      );

      await controller.logs('c1', '0');
      expect(quotaService.logs).toHaveBeenCalledWith('c1', 0);
    });
  });
});
