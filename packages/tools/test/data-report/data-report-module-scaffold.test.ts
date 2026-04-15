import { describe, expect, it } from 'vitest';

import { buildDataReportModuleScaffold } from '@agent/report-kit';

describe('buildDataReportModuleScaffold', () => {
  it('keeps page-only single reports free of generated component directories', () => {
    const result = buildDataReportModuleScaffold({
      goal: '生成 Bonus Center 银币兑换记录报表',
      taskContext: 'single report module',
      moduleId: 'ExchangeMall'
    });

    expect(result).toEqual(
      expect.objectContaining({
        templateId: 'bonus-center-data',
        module: expect.objectContaining({
          id: 'ExchangeMall'
        }),
        files: []
      })
    );
  });

  it('builds direct single-report component files when the requirement explicitly needs metrics and charts', () => {
    const result = buildDataReportModuleScaffold({
      goal: '生成 Bonus Center 银币兑换记录驾驶舱，需要指标卡、趋势图和表格',
      taskContext: 'single report module',
      moduleId: 'ExchangeMall'
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
    expect(result.files.find(file => file.path.endsWith('Table.tsx'))?.content).toContain('GoshExportButton');
    expect(result.files.find(file => file.path.endsWith('Table.tsx'))?.content).toContain(
      "import { GoshExportButton } from '../../../../components/GoshExportButton';"
    );
    expect(result.files.find(file => file.path.endsWith('Table.tsx'))?.content).toContain(
      "title={intl.formatMessage({ id: 'SilverCoinExchangeRecord' })}"
    );
    expect(result.files.find(file => file.path.endsWith('Table.tsx'))?.content).toContain(
      'getQueryParams={() => ({ ...searchParams })}'
    );
  });
  it('generates a single bonus-center-data module payload for component-level execution', () => {
    const result = buildDataReportModuleScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template',
      moduleId: 'TaskPagePenetration'
    });

    expect(result).toEqual(
      expect.objectContaining({
        templateId: 'bonus-center-data',
        module: expect.objectContaining({
          id: 'TaskPagePenetration',
          entryFile: 'src/pages/dataDashboard/bonusCenterData/components/TaskPagePenetration/index.tsx'
        }),
        files: expect.arrayContaining([
          expect.objectContaining({
            path: 'src/pages/dataDashboard/bonusCenterData/components/TaskPagePenetration/index.tsx'
          }),
          expect.objectContaining({
            path: 'src/pages/dataDashboard/bonusCenterData/components/TaskPagePenetration/TaskPagePenetrationChart.tsx'
          })
        ])
      })
    );
    expect(result.files.some(file => file.path.includes('/components/Search/'))).toBe(false);
  });
});
