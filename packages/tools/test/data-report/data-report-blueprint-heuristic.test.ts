import { describe, expect, it } from 'vitest';

import { buildDataReportBlueprint } from '@agent/report-kit';

describe('buildDataReportBlueprint structured heuristic', () => {
  it('prefers labeled single-report intent over bonus center multi-template defaults', () => {
    const blueprint = buildDataReportBlueprint({
      goal: [
        '标题：Bonus Center数据',
        '报表名称：银币兑换记录',
        '大数据接口：get_bc_exchange_mall_data',
        '字段列表：dt, app, user_type, props_amount'
      ].join('\n'),
      taskContext: '参考 bonusCenterData 模板生成单报表'
    });

    expect(blueprint).toEqual(
      expect.objectContaining({
        scope: 'single',
        templateId: 'bonus-center-data',
        routeName: 'silverCoinExchangeRecord',
        routeTitle: '银币兑换记录',
        moduleIds: ['ExchangeMall']
      })
    );
  });
});
