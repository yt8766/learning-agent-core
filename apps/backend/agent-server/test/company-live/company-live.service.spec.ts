import { describe, expect, it } from 'vitest';

import { parseCompanyLiveGenerateDto } from '../../src/company-live/company-live.dto';
import { CompanyLiveService } from '../../src/company-live/company-live.service';

describe('CompanyLiveService', () => {
  it('generates a company live bundle with node trace via stub registry', async () => {
    const service = new CompanyLiveService();
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
