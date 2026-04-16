import { describe, expect, it } from 'vitest';

import { resolveSpecialistRoute } from '../src';

describe('shared specialist routing', () => {
  it('为数据报表目标路由到 technical-architecture 并附带结构化输出指令', () => {
    const specialistRoute = resolveSpecialistRoute({
      goal: '生成一个带趋势图和指标卡的 bonus center 数据报表页面',
      context: '当前任务要按 bonus center data 模板生成数据报表页面。'
    });

    expect(specialistRoute.specialistLead.domain).toBe('technical-architecture');
    expect(specialistRoute.contextSlicesBySpecialist[0]).toEqual(
      expect.objectContaining({
        specialistId: specialistRoute.specialistLead.id,
        summary: expect.stringContaining('bonus center data'),
        outputInstruction: expect.stringContaining('结构化 JSON')
      })
    );
  });

  it('优先遵循显式指定的 specialist', () => {
    const specialistRoute = resolveSpecialistRoute({
      goal: '评估支付通道成功率下降',
      requestedHints: {
        requestedSpecialist: 'risk-compliance'
      }
    });

    expect(specialistRoute.specialistLead.domain).toBe('risk-compliance');
    expect(specialistRoute.specialistLead.reason).toContain('已优先遵循你的指定');
    expect(specialistRoute.routeConfidence).toBeGreaterThanOrEqual(0.72);
  });
});
