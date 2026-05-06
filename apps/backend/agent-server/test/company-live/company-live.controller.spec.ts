import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { CompanyExpertConsultationSchema } from '@agent/core';

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

const stubConsultationResult = CompanyExpertConsultationSchema.parse({
  consultationId: 'consultation-test-1',
  briefId: 'brief-test-1',
  userQuestion: '公司专家会诊一下',
  selectedExperts: ['productAgent'],
  expertFindings: [
    {
      expertId: 'productAgent',
      role: 'product',
      summary: '产品定位需要更清楚。',
      diagnosis: ['目标用户和购买理由仍偏泛。'],
      recommendations: ['补充核心用户画像。'],
      questionsToUser: ['主推 SKU 是哪一个？'],
      risks: ['卖点分散会降低转化。'],
      confidence: 0.66,
      source: 'fallback'
    }
  ],
  missingInputs: [],
  conflicts: [],
  nextActions: [],
  businessPlanPatch: {
    briefId: 'brief-test-1',
    updates: [
      {
        path: 'product.positioning',
        value: ['补充核心用户画像'],
        reason: '产品专家建议收敛定位。'
      }
    ]
  },
  createdAt: '2026-05-02T00:00:00.000Z'
});

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

  it('calls service.consultExperts with parsed brief and trimmed question then returns result', async () => {
    const service = {
      consultExperts: vi.fn().mockResolvedValue(stubConsultationResult)
    } as unknown as CompanyLiveService;
    const controller = new CompanyLiveController(service);

    const result = await controller.consultExperts({
      brief: stubFormBody,
      question: '  公司专家会诊一下  '
    });

    expect(service.consultExperts).toHaveBeenCalledWith(
      expect.objectContaining({
        briefId: 'brief-test-1',
        targetPlatform: 'TikTok',
        targetRegion: 'US',
        language: 'en-US',
        riskLevel: 'medium',
        createdAt: expect.any(String)
      }),
      '公司专家会诊一下'
    );
    expect(result).toEqual(stubConsultationResult);
  });

  it('rejects blank expert consultation questions with a bad request error', async () => {
    const service = {
      consultExperts: vi.fn().mockResolvedValue(stubConsultationResult)
    } as unknown as CompanyLiveService;
    const controller = new CompanyLiveController(service);

    await expect(
      controller.consultExperts({
        brief: stubFormBody,
        question: '   '
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.consultExperts).not.toHaveBeenCalled();
  });
});
