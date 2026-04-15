import { describe, expect, it } from 'vitest';

import { buildDataReportBlueprint } from '@agent/report-kit';

describe('buildDataReportBlueprint', () => {
  it('uses the matched single reference module when only one report module is requested', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '生成 Bonus Center 银币兑换记录报表',
      taskContext: 'single report module'
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

  it('selects a single bonus-center module from the referenced data interface and route title', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '生成银币兑换记录数据报表页面',
      taskContext: '参考 bonusCenterData 模板'
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

  it('treats a prompt with exactly one declared big-data interface as a single report', () => {
    const blueprint = buildDataReportBlueprint({
      goal: ['标题：Bonus Center数据', '报表名称：银币兑换记录', '大数据接口：get_bc_exchange_mall_data'].join('\n')
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

  it('plans a bonus-center-data blueprint with report modules and target directories', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });

    expect(blueprint).toEqual(
      expect.objectContaining({
        scope: 'multiple',
        templateId: 'bonus-center-data',
        pageDir: 'src/pages/dataDashboard/bonusCenterData',
        routesFile: 'src/routes.ts',
        servicesDir: 'src/services/data',
        typesDir: 'src/types/data',
        modules: expect.arrayContaining([
          expect.objectContaining({ id: 'TaskPagePenetration' }),
          expect.objectContaining({ id: 'CostAnalysis' }),
          expect.objectContaining({ id: 'UserRemain' })
        ])
      })
    );
  });
});
