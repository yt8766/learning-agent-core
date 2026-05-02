import { describe, expect, it, vi } from 'vitest';

import { CompanyExpertConsultationSchema } from '@agent/core';

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

  it('delegates expert consultation to the backend company-live runtime facade', async () => {
    const dto = parseCompanyLiveGenerateDto({
      briefId: 'svc-consult-test',
      targetPlatform: 'douyin',
      riskLevel: 'medium'
    });
    const consultation = CompanyExpertConsultationSchema.parse({
      consultationId: 'consultation-svc-test',
      briefId: 'svc-consult-test',
      userQuestion: '专家会诊这个直播方案',
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
        briefId: 'svc-consult-test',
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
    const facade = {
      consultExperts: vi.fn().mockResolvedValue(consultation)
    } as unknown as RuntimeCompanyLiveFacade;
    const service = new CompanyLiveService(facade);

    await expect(service.consultExperts(dto, '专家会诊这个直播方案')).resolves.toEqual(consultation);
    expect(facade.consultExperts).toHaveBeenCalledWith({
      brief: dto,
      question: '专家会诊这个直播方案'
    });
  });
});
