import { describe, expect, it } from 'vitest';

import { resolveSpecialistRoute } from '../../src/workflows/specialist-routing';

describe('resolveSpecialistRoute', () => {
  it('高置信支付问题会命中支付通道专家并补充支撑专家', () => {
    const route = resolveSpecialistRoute({
      goal: '越南和巴基斯坦支付通道上线后，入金成功率和提现客诉率怎么优化？'
    });

    expect(route.specialistLead.domain).toBe('payment-channel');
    expect(route.routeConfidence).toBeGreaterThan(0.4);
    expect(route.contextSlicesBySpecialist[0]).toEqual(
      expect.objectContaining({
        specialistId: 'payment-channel',
        domainInstruction: expect.stringContaining('支付链路'),
        outputInstruction: expect.stringContaining('结构化 JSON')
      })
    );
  });

  it('低置信通用问题会回退到通用助理', () => {
    const route = resolveSpecialistRoute({
      goal: '帮我想一个更自然的周报标题'
    });

    expect(route.specialistLead.domain).toBe('general-assistant');
    expect(route.routeConfidence).toBeLessThan(0.4);
    expect(route.supportingSpecialists).toHaveLength(0);
  });

  it('用户明确指定 specialist 时优先遵循指定结果', () => {
    const route = resolveSpecialistRoute({
      goal: '帮我看下这个发布方案',
      requestedHints: {
        requestedSpecialist: 'risk-compliance'
      }
    });

    expect(route.specialistLead.domain).toBe('risk-compliance');
    expect(route.specialistLead.reason).toContain('已优先遵循你的指定');
    expect(route.routeConfidence).toBeGreaterThan(0.7);
  });

  it('兼容 live-ops 旧域并默认收敛到增长营销，产品信号强时收敛到产品策略', () => {
    const growthRoute = resolveSpecialistRoute({
      goal: '帮我优化直播投放转化和拉新效率',
      requestedHints: {
        requestedSpecialist: 'live-ops'
      }
    });
    const productRoute = resolveSpecialistRoute({
      goal: '帮我规划直播互动产品路线图和版本优先级',
      requestedHints: {
        requestedSpecialist: 'live-ops'
      }
    });

    expect(growthRoute.specialistLead.domain).toBe('growth-marketing');
    expect(productRoute.specialistLead.domain).toBe('product-strategy');
  });

  it('会裁剪成摘要 + 最近两轮 + 强相关历史片段', () => {
    const route = resolveSpecialistRoute({
      goal: '帮我判断这个 VIP 和投放组合是否合理',
      conversationSummary: '我们在讨论 VIP 承接、投放 ROI 和代理转化。',
      recentTurns: [
        { role: 'user', content: '先看 VIP 承接问题' },
        { role: 'assistant', content: '需要结合 ROI 与高价值用户留存' },
        { role: 'user', content: '再一起评估代理和买量' }
      ],
      relatedHistory: ['历史上 Game Only ROI 更稳定', '代理渠道转化高但投诉偏多', '无关片段', '超出上限']
    });

    expect(route.contextSlicesBySpecialist[0]).toEqual(
      expect.objectContaining({
        summary: '我们在讨论 VIP 承接、投放 ROI 和代理转化。',
        recentTurns: [
          { role: 'assistant', content: '需要结合 ROI 与高价值用户留存' },
          { role: 'user', content: '再一起评估代理和买量' }
        ],
        relatedHistory: ['历史上 Game Only ROI 更稳定', '代理渠道转化高但投诉偏多', '无关片段']
      })
    );
  });
});
