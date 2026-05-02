import { describe, expect, it } from 'vitest';

import { routeCompanyLiveExperts } from '../src';

describe('routeCompanyLiveExperts', () => {
  it('routes script and compliance questions to content and risk experts', () => {
    const selected = routeCompanyLiveExperts('脚本里有哪些合规风险，话术怎么改？');
    expect(selected).toEqual(['contentAgent', 'riskAgent']);
  });

  it('routes ROI and discount questions to finance and growth experts', () => {
    const selected = routeCompanyLiveExperts('这个折扣会不会影响 ROI，怎么提升 GMV？');
    expect(selected).toEqual(['financeAgent', 'growthAgent']);
  });

  it('routes broad consultation requests to the 6 core experts', () => {
    const selected = routeCompanyLiveExperts('让公司专家们整体会诊一下这个项目缺什么');
    expect(selected).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'riskAgent',
      'financeAgent'
    ]);
  });

  it('keeps the same expert only once when multiple keywords match', () => {
    const selected = routeCompanyLiveExperts('脚本、话术、短视频素材都需要本地化');
    expect(selected).toEqual(['contentAgent']);
  });

  it('limits ordinary keyword routing to the first 4 priority experts', () => {
    const selected = routeCompanyLiveExperts('这个产品卖点、运营排期、脚本话术、GMV 增长、合规风险、预算 ROI 都看看');
    expect(selected).toEqual(['contentAgent', 'riskAgent', 'financeAgent', 'growthAgent']);
  });

  it('uses product, operations, and content when the question has no clear keyword', () => {
    const selected = routeCompanyLiveExperts('帮我看看这个项目');
    expect(selected).toEqual(['productAgent', 'operationsAgent', 'contentAgent']);
  });
});
