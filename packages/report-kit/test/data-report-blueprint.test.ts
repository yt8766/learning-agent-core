import { describe, expect, it } from 'vitest';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildDataReportBlueprint, inferSingleReportStructure, resolveBonusCenterBlueprintDir } from '../src';
import {
  buildDataReportBlueprint as canonicalBuildDataReportBlueprint,
  inferSingleReportStructure as canonicalInferSingleReportStructure
} from '../src/blueprints/data-report-blueprint';

describe('@agent/report-kit data report blueprint', () => {
  it('keeps the root blueprint export wired to the canonical blueprints host', () => {
    expect(buildDataReportBlueprint).toBe(canonicalBuildDataReportBlueprint);
    expect(inferSingleReportStructure).toBe(canonicalInferSingleReportStructure);
  });

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

  it('builds a generic react-ts blueprint with planned artifact scaffold files outside root data', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '生成一个通用数据报表页面',
      templateId: 'react-ts'
    });

    expect(blueprint.templateId).toBe('react-ts');
    expect(blueprint.baseDir).toBe('artifacts/report-kit/data-report');
    expect(blueprint.pageDir).toBe('artifacts/report-kit/data-report/template');
    expect(blueprint.plannedFiles).toEqual(
      expect.arrayContaining([
        'artifacts/report-kit/data-report/template/App.tsx',
        'artifacts/report-kit/data-report/template/index.tsx',
        'artifacts/report-kit/data-report/template/package.json',
        'artifacts/report-kit/data-report/template/styles.css'
      ])
    );
    expect(JSON.stringify(blueprint)).not.toContain('data/generated');
  });

  it('uses artifact storage paths for generic modules when no template is available', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '生成多个通用数据报表页面',
      templateId: 'missing-template'
    });

    expect(blueprint.baseDir).toBe('artifacts/report-kit/data-report');
    expect(blueprint.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentDir: 'artifacts/report-kit/data-report/modules/Overview',
          entryFile: 'artifacts/report-kit/data-report/modules/Overview.tsx'
        })
      ])
    );
    expect(JSON.stringify(blueprint)).not.toContain('data/generated');
  });

  it('resolves bonus-center-data blueprint assets from report-kit', () => {
    const blueprintDir = resolveBonusCenterBlueprintDir();
    const blueprint = buildDataReportBlueprint({
      goal: '生成 bonus center data 成本分析报表',
      taskContext: '大数据接口: get_bc_cost_analysis_data',
      templateId: 'bonus-center-data'
    });

    expect(blueprintDir).toContain('packages/report-kit/src/blueprints/bonus-center-data');
    expect(existsSync(join(blueprintDir, 'routes.ts'))).toBe(true);
    expect(existsSync(join(blueprintDir, 'services/data/bonusCenter.ts'))).toBe(true);
    expect(blueprint.templateId).toBe('bonus-center-data');
    expect(blueprint.templateApiCount).toBeGreaterThan(0);
    expect(blueprint.plannedFiles).toEqual(
      expect.arrayContaining([
        'src/pages/dataDashboard/costAnalysis/index.tsx',
        'src/services/data/costAnalysis.ts',
        'src/types/data/costAnalysis.ts'
      ])
    );
  });
});
