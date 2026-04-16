import { describe, expect, it } from 'vitest';

import { buildDataReportBlueprint, inferSingleReportStructure } from '../src';

describe('@agent/report-kit data report blueprint', () => {
  it('keeps table-only goals in page-only mode', () => {
    expect(inferSingleReportStructure({ goal: '生成一个只有查询和表格的日报页面', routeName: 'dailyReport' })).toEqual({
      mode: 'page-only',
      componentBaseName: 'DailyReport'
    });
  });

  it('switches visual goals to component-files mode', () => {
    expect(inferSingleReportStructure({ goal: '生成一个带趋势图和指标卡的报表', routeName: 'trendReport' })).toEqual({
      mode: 'component-files',
      componentBaseName: 'TrendReport'
    });
  });

  it('builds a generic react-ts blueprint with planned scaffold files', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '生成一个通用数据报表页面',
      templateId: 'react-ts'
    });

    expect(blueprint.templateId).toBe('react-ts');
    expect(blueprint.pageDir).toContain('data/generated/data-report/template');
    expect(blueprint.plannedFiles).toEqual(
      expect.arrayContaining([
        'data/generated/data-report/template/App.tsx',
        'data/generated/data-report/template/index.tsx',
        'data/generated/data-report/template/package.json',
        'data/generated/data-report/template/styles.css'
      ])
    );
  });
});
