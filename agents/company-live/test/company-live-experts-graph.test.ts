import { describe, expect, it, vi } from 'vitest';

import type { ExpertFinding, ILLMProvider } from '@agent/core';

import { consultCompanyLiveExperts } from '../src';

const stubBrief = {
  briefId: 'brief-experts-1',
  targetPlatform: 'TikTok',
  targetRegion: 'US',
  language: 'en-US',
  audienceProfile: 'US shoppers',
  productRefs: ['sku-1'],
  sellingPoints: ['Fast glow'],
  riskLevel: 'medium' as const,
  createdAt: '2026-04-29T00:00:00.000Z'
};

describe('consultCompanyLiveExperts', () => {
  it('returns a structured fallback consultation with all core experts when no llm is available', async () => {
    const consultation = await consultCompanyLiveExperts({
      brief: stubBrief,
      question: '让公司专家们整体会诊一下这个项目缺什么',
      now: () => new Date('2026-05-02T00:00:00.000Z')
    });

    expect(consultation.selectedExperts).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'riskAgent',
      'financeAgent'
    ]);
    expect(consultation.expertFindings).toHaveLength(6);
    expect(consultation.expertFindings.every(finding => finding.source === 'fallback')).toBe(true);
    expect(consultation.missingInputs).toContain('商品成本');
    expect(consultation.businessPlanPatch.briefId).toBe(stubBrief.briefId);
  });

  it('uses llm findings for routed experts when generateObject returns a valid finding', async () => {
    const llmFinding: ExpertFinding = {
      expertId: 'contentAgent',
      role: 'content',
      summary: '脚本需要更清晰地拆出开场钩子、卖点证明和转化口播。',
      diagnosis: ['当前问题集中在脚本与话术表达。'],
      recommendations: ['补一版 30 秒短视频脚本和直播间成交话术。'],
      questionsToUser: ['是否已有品牌禁用词清单？'],
      risks: ['未经验证的功效表达需要删除。'],
      confidence: 0.82,
      source: 'llm'
    };
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => llmFinding)
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;

    const consultation = await consultCompanyLiveExperts({
      brief: stubBrief,
      question: '脚本和话术应该怎么改？',
      llm,
      now: () => new Date('2026-05-02T00:00:00.000Z')
    });

    expect(consultation.selectedExperts).toContain('contentAgent');
    expect(consultation.expertFindings).toHaveLength(1);
    expect(consultation.expertFindings[0]).toMatchObject({
      expertId: 'contentAgent',
      source: 'llm'
    });
    expect(llm.generateObject).toHaveBeenCalled();
  });

  it('keeps next actions within selected experts for content-only script questions', async () => {
    const consultation = await consultCompanyLiveExperts({
      brief: stubBrief,
      question: '脚本和话术应该怎么改？',
      now: () => new Date('2026-05-02T00:00:00.000Z')
    });

    expect(consultation.selectedExperts).toEqual(['contentAgent']);
    for (const action of consultation.nextActions) {
      expect(consultation.selectedExperts).toContain(action.ownerExpertId);
      expect(action.label).not.toMatch(/风控|riskAgent|交给/);
    }
  });

  it('falls back for an expert when llm generation throws', async () => {
    const onExpertFallback = vi.fn();
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => {
        throw new Error('provider unavailable');
      })
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;

    const consultation = await consultCompanyLiveExperts({
      brief: stubBrief,
      question: '这个折扣会不会影响 ROI？',
      llm,
      onExpertFallback,
      now: () => new Date('2026-05-02T00:00:00.000Z')
    });

    expect(consultation.selectedExperts).toContain('financeAgent');
    expect(consultation.expertFindings).toHaveLength(1);
    expect(consultation.expertFindings[0]).toMatchObject({
      expertId: 'financeAgent',
      source: 'fallback'
    });
    expect(consultation.missingInputs).toContain('商品成本');
    expect(onExpertFallback).toHaveBeenCalledWith({
      expertId: 'financeAgent',
      reason: 'llm_error'
    });
  });

  it('rejects a blank question before routing or llm generation', async () => {
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => {
        throw new Error('should not call llm for blank question');
      })
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;

    await expect(
      consultCompanyLiveExperts({
        brief: stubBrief,
        question: '   \n\t  ',
        llm,
        now: () => new Date('2026-05-02T00:00:00.000Z')
      })
    ).rejects.toThrow('company-live expert consultation requires a non-empty question');

    expect(llm.generateObject).not.toHaveBeenCalled();
  });

  it('falls back when llm returns a schema-invalid finding object', async () => {
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => ({
        expertId: 'contentAgent',
        role: 'content',
        summary: 'missing required arrays',
        confidence: 'high',
        source: 'llm'
      }))
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;

    const consultation = await consultCompanyLiveExperts({
      brief: stubBrief,
      question: '脚本和话术应该怎么改？',
      llm,
      now: () => new Date('2026-05-02T00:00:00.000Z')
    });

    expect(consultation.selectedExperts).toEqual(['contentAgent']);
    expect(consultation.expertFindings).toHaveLength(1);
    expect(consultation.expertFindings[0]).toMatchObject({
      expertId: 'contentAgent',
      source: 'fallback'
    });
  });

  it('falls back to the routed content expert when llm returns a different expert finding', async () => {
    const llmFinding: ExpertFinding = {
      expertId: 'riskAgent',
      role: 'risk',
      summary: '风控建议不应替换当前内容专家路由。',
      diagnosis: ['模型返回了与路由不一致的专家。'],
      recommendations: ['应该回退到路由选中的内容专家。'],
      questionsToUser: ['是否需要额外风控复核？'],
      risks: ['专家错配会污染 selectedExperts 与 findings。'],
      confidence: 0.77,
      source: 'llm'
    };
    const llm = {
      isConfigured: vi.fn(() => true),
      generateObject: vi.fn(async () => llmFinding)
    } satisfies Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;

    const consultation = await consultCompanyLiveExperts({
      brief: stubBrief,
      question: '脚本和话术应该怎么改？',
      llm,
      now: () => new Date('2026-05-02T00:00:00.000Z')
    });

    expect(consultation.selectedExperts).toEqual(['contentAgent']);
    expect(consultation.expertFindings).toHaveLength(1);
    expect(consultation.expertFindings[0]).toMatchObject({
      expertId: 'contentAgent',
      source: 'fallback'
    });
  });
});
