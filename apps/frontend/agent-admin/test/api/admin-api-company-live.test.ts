import { describe, expect, it, vi, beforeEach } from 'vitest';

const requestMock = vi.fn();

vi.mock('@/api/admin-api-core', () => ({
  request: (...args: unknown[]) => requestMock(...args)
}));

import { consultCompanyLiveExperts, generateCompanyLive } from '@/api/company-live.api';
import { CompanyExpertConsultationSchema } from '@agent/core';

describe('admin-api-company-live', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('calls POST /company-live/generate with the brief body', async () => {
    const mockResult = {
      bundle: {
        requestId: 'req-test-1',
        assets: [
          {
            assetId: 'a1',
            type: 'audio',
            uri: 'stub://audio/a1.mp3',
            mimeType: 'audio/mpeg',
            sourceNodeId: 'generate-audio'
          }
        ],
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      trace: [
        {
          nodeId: 'generate-audio',
          status: 'succeeded',
          durationMs: 120,
          inputSnapshot: {},
          outputSnapshot: {}
        }
      ]
    };
    requestMock.mockResolvedValue(mockResult);

    const brief = {
      briefId: 'brief-1',
      targetPlatform: 'douyin',
      script: 'Hello world',
      durationSeconds: 60,
      speakerVoiceId: 'voice-default',
      backgroundMusicUri: undefined,
      brandKitRef: undefined,
      requestedBy: 'test-user'
    };

    const result = await generateCompanyLive(brief);

    expect(requestMock).toHaveBeenCalledWith('/company-live/generate', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockResult);
  });

  it('passes brief fields in the request body as JSON', async () => {
    requestMock.mockResolvedValue({ bundle: { requestId: 'r1', assets: [], createdAt: '' }, trace: [] });
    const brief = {
      briefId: 'b2',
      targetPlatform: 'bilibili',
      script: 'Test script',
      durationSeconds: 30,
      speakerVoiceId: 'v1',
      requestedBy: 'user-1'
    };
    await generateCompanyLive(brief);
    const [, init] = requestMock.mock.calls[0] as [string, { body: string }];
    const parsed = JSON.parse(init.body);
    expect(parsed.briefId).toBe('b2');
    expect(parsed.targetPlatform).toBe('bilibili');
  });

  it('calls POST /company-live/experts/consult with the question and brief body', async () => {
    const mockResult = {
      consultationId: 'consultation-test-1',
      briefId: 'brief-consult-1',
      userQuestion: '如何优化开场转化？',
      selectedExperts: ['productAgent'],
      expertFindings: [
        {
          expertId: 'productAgent',
          role: 'product',
          summary: '开场需要更快说明用户收益。',
          diagnosis: ['当前脚本前 15 秒缺少核心购买理由。'],
          recommendations: ['把核心卖点前置到第一句话。'],
          questionsToUser: ['主推 SKU 是哪一个？'],
          risks: ['卖点铺陈过慢会降低停留。'],
          confidence: 0.72,
          source: 'fallback'
        }
      ],
      missingInputs: [],
      conflicts: [],
      nextActions: [],
      businessPlanPatch: {
        briefId: 'brief-consult-1',
        updates: [
          {
            path: 'script.opening',
            value: '把核心卖点前置到第一句话。',
            reason: '产品专家建议先解释用户收益。'
          }
        ]
      },
      createdAt: '2026-05-02T00:00:00.000Z'
    };
    const parsedMockResult = CompanyExpertConsultationSchema.parse(mockResult);
    requestMock.mockResolvedValue(parsedMockResult);
    const brief = {
      briefId: 'brief-consult-1',
      targetPlatform: 'douyin',
      script: '欢迎来到直播间，今天给大家介绍新品。',
      durationSeconds: 60,
      speakerVoiceId: 'voice-default',
      requestedBy: 'test-user'
    };
    const question = '如何优化开场转化？';

    const result = await consultCompanyLiveExperts({ question, brief });

    expect(requestMock).toHaveBeenCalledWith('/company-live/experts/consult', {
      method: 'POST',
      body: JSON.stringify({ question, brief })
    });
    expect(result).toEqual(parsedMockResult);
  });
});
