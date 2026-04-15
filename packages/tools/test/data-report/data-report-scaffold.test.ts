import { describe, expect, it } from 'vitest';

import { buildDataReportScaffold } from '@agent/report-kit';

describe('buildDataReportScaffold', () => {
  it('keeps single-report bonus-center scaffold minimal without shared search/config template files', () => {
    const result = buildDataReportScaffold({
      goal: '生成 Bonus Center 银币兑换记录报表',
      taskContext: 'single report module'
    });

    expect(result.blueprint).toEqual(
      expect.objectContaining({
        scope: 'single',
        routeName: 'silverCoinExchangeRecord'
      })
    );
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'src/pages/dataDashboard/silverCoinExchangeRecord/index.tsx' }),
        expect.objectContaining({ path: 'src/services/data/silverCoinExchangeRecord.ts' }),
        expect.objectContaining({ path: 'src/types/data/silverCoinExchangeRecord.ts' })
      ])
    );
    expect(result.files.some(file => file.path === 'src/routes.ts')).toBe(false);
    expect(result.files.some(file => file.path.includes('/components/Search/'))).toBe(false);
    expect(result.files.some(file => file.path.endsWith('/config.tsx'))).toBe(false);
    expect(result.files.some(file => file.path.includes('/components/'))).toBe(false);
    expect(
      result.files.find(file => file.path === 'src/pages/dataDashboard/silverCoinExchangeRecord/index.tsx')?.content
    ).toContain(
      "import { fetchSilverCoinExchangeRecordReport } from '../../../services/data/silverCoinExchangeRecord';"
    );
    expect(
      result.files.find(file => file.path === 'src/pages/dataDashboard/silverCoinExchangeRecord/index.tsx')?.content
    ).toContain("import type { SilverCoinExchangeRecordRow } from '../../../types/data/silverCoinExchangeRecord';");
  });

  it('adds direct component files for single-report dashboard requirements that need charts and metrics', () => {
    const result = buildDataReportScaffold({
      goal: '生成 Bonus Center 银币兑换记录驾驶舱，需要指标卡、趋势图和表格',
      taskContext: 'single report module'
    });

    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/pages/dataDashboard/silverCoinExchangeRecord/components/SilverCoinExchangeRecordChart.tsx'
        }),
        expect.objectContaining({
          path: 'src/pages/dataDashboard/silverCoinExchangeRecord/components/SilverCoinExchangeRecordMetrics.tsx'
        }),
        expect.objectContaining({
          path: 'src/pages/dataDashboard/silverCoinExchangeRecord/components/SilverCoinExchangeRecordTable.tsx'
        })
      ])
    );
  });

  it('reuses the planned blueprint when generating bonus-center-data scaffold files', () => {
    const result = buildDataReportScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });

    expect(result.blueprint).toEqual(
      expect.objectContaining({
        templateId: 'bonus-center-data',
        pageDir: 'src/pages/dataDashboard/bonusCenterData'
      })
    );
    expect(result.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'src/pages/dataDashboard/bonusCenterData/index.tsx' })])
    );
    expect(result.files.some(file => file.path === 'src/routes.ts')).toBe(false);
  });
});
