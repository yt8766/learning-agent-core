import { describe, expect, it, vi } from 'vitest';

import { CompanyLiveController } from '../../src/company-live/company-live.controller';
import { CompanyLiveService } from '../../src/company-live/company-live.service';

/** 前端表单实际发送的简化字段 */
const stubFormBody = {
  briefId: 'brief-test-1',
  targetPlatform: 'TikTok',
  targetRegion: 'US',
  language: 'en-US',
  audienceProfile: 'US shoppers',
  productRefs: ['sku-1'],
  sellingPoints: ['Fast glow'],
  riskLevel: 'medium' as const
};

const stubResult = {
  bundle: {
    bundleId: 'bundle-test-1',
    requestId: 'req-test-1',
    assets: [],
    createdAt: '2026-04-29T00:00:00.000Z'
  },
  trace: []
};

describe('CompanyLiveController', () => {
  it('calls service.generate with parsed brief (including defaults) and returns result', async () => {
    const service = { generate: vi.fn().mockResolvedValue(stubResult) } as unknown as CompanyLiveService;
    const controller = new CompanyLiveController(service);

    const result = await controller.generate(stubFormBody);

    expect(service.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        briefId: 'brief-test-1',
        targetPlatform: 'TikTok',
        targetRegion: 'US',
        language: 'en-US',
        riskLevel: 'medium',
        createdAt: expect.any(String)
      })
    );
    expect(result).toEqual(stubResult);
  });

  it('propagates service errors to caller', async () => {
    const service = {
      generate: vi.fn().mockRejectedValue(new Error('graph failed'))
    } as unknown as CompanyLiveService;
    const controller = new CompanyLiveController(service);

    await expect(controller.generate(stubFormBody)).rejects.toThrow('graph failed');
  });
});
