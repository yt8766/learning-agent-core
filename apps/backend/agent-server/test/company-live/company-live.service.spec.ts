import { describe, expect, it, vi } from 'vitest';

import { parseCompanyLiveGenerateDto } from '../../src/company-live/company-live.dto';
import { CompanyLiveService } from '../../src/company-live/company-live.service';
import { RuntimeCompanyLiveFacade } from '../../src/runtime/core/runtime-company-live-facade';

describe('CompanyLiveService', () => {
  it('delegates generation to the backend company-live runtime facade', async () => {
    const dto = parseCompanyLiveGenerateDto({
      briefId: 'svc-facade-test',
      targetPlatform: 'douyin'
    });
    const facade = {
      generate: vi.fn().mockResolvedValue({
        bundle: { sourceBriefId: 'svc-facade-test' },
        trace: [{ nodeId: 'business-agent', status: 'succeeded', durationMs: 1 }]
      })
    } as unknown as RuntimeCompanyLiveFacade;
    const service = new CompanyLiveService(facade);

    await expect(service.generate(dto)).resolves.toMatchObject({
      bundle: { sourceBriefId: 'svc-facade-test' }
    });
    expect(facade.generate).toHaveBeenCalledWith(dto);
  });

  it('generates a company live bundle with node trace via stub registry', async () => {
    const service = new CompanyLiveService(new RuntimeCompanyLiveFacade());
    const dto = parseCompanyLiveGenerateDto({
      briefId: 'svc-test-1',
      targetPlatform: 'douyin',
      script: 'Test script for service spec',
      riskLevel: 'low'
    });
    const result = await service.generate(dto);

    expect(result.bundle).toBeDefined();
    expect(result.bundle.sourceBriefId).toBe('svc-test-1');
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace[0]).toMatchObject({ nodeId: expect.any(String), status: expect.any(String) });
  });
});
