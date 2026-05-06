import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import type { ExpertFinding, ILLMProvider } from '@agent/core';
import { CompanyExpertConsultationSchema } from '@agent/core';

import { parseCompanyLiveGenerateDto } from '../../src/company-live/company-live.dto';
import { CompanyLiveService } from '../../src/company-live/company-live.service';
import { RuntimeCompanyLiveFacade } from '../../src/runtime/core/runtime-company-live-facade';
import { RuntimeHost } from '../../src/runtime/core/runtime.host';

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

  it('passes the runtime host llm provider into expert consultation', async () => {
    const llmFinding: ExpertFinding = {
      expertId: 'contentAgent',
      role: 'content',
      summary: '脚本需要先补开场钩子。',
      diagnosis: ['当前问题集中在脚本表达。'],
      recommendations: ['补一版直播开场和成交口播。'],
      questionsToUser: ['是否已有禁用词清单？'],
      risks: ['未经校验的话术可能影响转化。'],
      confidence: 0.82,
      source: 'llm'
    };
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => llmFinding)
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
    const service = new CompanyLiveService(new RuntimeCompanyLiveFacade({ llmProvider: llm } as RuntimeHost));
    const dto = parseCompanyLiveGenerateDto({
      briefId: 'svc-llm-consult-test',
      targetPlatform: 'TikTok',
      riskLevel: 'medium'
    });

    const result = await service.consultExperts(dto, '脚本和话术怎么改？');

    expect(llm.generateObject).toHaveBeenCalled();
    expect(result.expertFindings).toEqual([
      expect.objectContaining({
        expertId: 'contentAgent',
        source: 'llm'
      })
    ]);
  });

  it('resolves the runtime host llm provider through Nest dependency injection', async () => {
    const llmFinding: ExpertFinding = {
      expertId: 'contentAgent',
      role: 'content',
      summary: '脚本需要先补开场钩子。',
      diagnosis: ['当前问题集中在脚本表达。'],
      recommendations: ['补一版直播开场和成交口播。'],
      questionsToUser: ['是否已有禁用词清单？'],
      risks: ['未经校验的话术可能影响转化。'],
      confidence: 0.82,
      source: 'llm'
    };
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => llmFinding)
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
    const runtimeHost = { llmProvider: llm } as RuntimeHost;
    const moduleRef = await Test.createTestingModule({
      providers: [
        CompanyLiveService,
        RuntimeCompanyLiveFacade,
        {
          provide: RuntimeHost,
          useValue: runtimeHost
        }
      ]
    }).compile();
    const service = moduleRef.get(CompanyLiveService);
    const dto = parseCompanyLiveGenerateDto({
      briefId: 'svc-nest-di-consult-test',
      targetPlatform: 'TikTok',
      riskLevel: 'medium'
    });

    const result = await service.consultExperts(dto, '脚本和话术怎么改？');

    expect(llm.generateObject).toHaveBeenCalled();
    expect(result.expertFindings[0]).toMatchObject({
      expertId: 'contentAgent',
      source: 'llm'
    });
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
