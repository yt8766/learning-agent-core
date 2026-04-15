import { describe, expect, it } from 'vitest';

import { buildDataReportBlueprint, buildDataReportRoutes } from '@agent/report-kit';

describe('buildDataReportRoutes', () => {
  it('generates App.tsx without routes for single-report output', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '生成银币兑换记录数据报表页面',
      taskContext: '参考 bonusCenterData 模板'
    });

    const result = buildDataReportRoutes(blueprint);
    expect(result.files).toEqual([
      expect.objectContaining({
        path: 'App.tsx',
        content: expect.stringContaining("import ReportPage from './src/pages/dataDashboard/silverCoinExchangeRecord';")
      })
    ]);
  });

  it('generates App.tsx without routes for bonus-center output', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });

    const result = buildDataReportRoutes(blueprint);
    expect(result.files).toEqual([
      expect.objectContaining({
        path: 'App.tsx',
        content: expect.stringContaining("import ReportPage from './src/pages/dataDashboard/bonusCenterData';")
      })
    ]);
  });
});
