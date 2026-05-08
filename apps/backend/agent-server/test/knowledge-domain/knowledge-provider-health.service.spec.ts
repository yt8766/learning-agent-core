import { describe, expect, it, vi } from 'vitest';

import { KnowledgeProviderHealthService } from '../../src/domains/knowledge/services/knowledge-provider-health.service';

describe('KnowledgeProviderHealthService', () => {
  it('projects unconfigured providers when no probes are registered', async () => {
    const service = new KnowledgeProviderHealthService();

    await expect(service.getProviderHealth()).resolves.toEqual({
      embedding: 'unconfigured',
      vector: 'unconfigured',
      keyword: 'unconfigured',
      generation: 'unconfigured'
    });
  });

  it('runs registered probes and degrades failed probes', async () => {
    const service = new KnowledgeProviderHealthService({
      embedding: vi.fn().mockResolvedValue({ status: 'ok' }),
      vector: vi.fn().mockRejectedValue(new Error('vector offline')),
      keyword: vi.fn().mockResolvedValue({ status: 'degraded' })
    });

    await expect(service.getProviderHealth()).resolves.toEqual({
      embedding: 'ok',
      vector: 'degraded',
      keyword: 'degraded',
      generation: 'unconfigured'
    });
  });
});
