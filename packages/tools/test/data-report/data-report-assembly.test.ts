import { describe, expect, it } from 'vitest';

import {
  assembleDataReportBundle,
  assembleDataReportBundleWithPostProcess,
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportRoutes,
  buildDataReportScaffold,
  postProcessDataReportSandpackFiles
} from '@agent/report-kit';

describe('assembleDataReportBundle', () => {
  it('assembles blueprint, module results, and shared files into a delivery manifest', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });
    const moduleResult = buildDataReportModuleScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template',
      moduleId: 'TaskPagePenetration'
    });
    const scaffold = buildDataReportScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });
    const routes = buildDataReportRoutes(blueprint);

    const bundle = assembleDataReportBundle({
      blueprint,
      moduleResults: [moduleResult],
      sharedFiles: scaffold.files,
      routeFiles: routes.files
    });

    expect(bundle.blueprint).toEqual(expect.objectContaining({ templateId: 'bonus-center-data' }));
    expect(bundle.moduleResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: expect.objectContaining({ id: 'TaskPagePenetration' }) })
      ])
    );
    expect(bundle.sharedFiles.some(file => file.path === 'src/routes.ts')).toBe(false);
    expect(bundle.routeFiles).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'App.tsx' })]));
    expect(bundle.assemblyPlan.totalFiles).toBeGreaterThan(0);
    expect(bundle.assemblyPlan.moduleArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: 'TaskPagePenetration',
          filePaths: expect.arrayContaining([
            'src/pages/dataDashboard/bonusCenterData/components/TaskPagePenetration/index.tsx'
          ])
        })
      ])
    );
    expect(bundle.assemblyPlan.sharedArtifacts.some(path => path === 'src/routes.ts')).toBe(false);
    expect(bundle.assemblyPlan.routeArtifacts).toEqual(expect.arrayContaining(['App.tsx']));
    expect(bundle.assemblyPlan.postProcessSummary).toEqual(
      expect.objectContaining({
        pending: false,
        hook: 'data-report-ast-postprocess',
        processedFiles: expect.any(Number),
        modifiedFiles: expect.any(Number),
        appliedFixes: expect.any(Number),
        fallbackUsed: false
      })
    );
    expect(bundle.sandpackFiles['/App.tsx']?.code).toContain(
      "import ReportPage from './src/pages/dataDashboard/bonusCenterData';"
    );
    expect(bundle.sandpackFiles).not.toHaveProperty('/src/index.tsx');
    expect(bundle.sandpackFiles).not.toHaveProperty('/src/routes.ts');
  });

  it('applies AST post-processing fixes to assembled sandpack files', () => {
    const result = postProcessDataReportSandpackFiles({
      '/App.tsx': {
        code: [
          'type Props = { users?: string[] };',
          'export default function App({ users }: Props) {',
          '  return <div>{users.map(user => user.toUpperCase()).join(", ")}</div>;',
          '}'
        ].join('\n')
      }
    });

    expect(result.files['/App.tsx']?.code).toContain('(users ?? []).map(');
    expect(result.summary).toEqual(
      expect.objectContaining({
        hook: 'data-report-ast-postprocess',
        processedFiles: 1,
        modifiedFiles: 1,
        appliedFixes: expect.any(Number),
        fallbackUsed: false
      })
    );
    expect(result.summary.appliedFixes).toBeGreaterThanOrEqual(2);
  });

  it('keeps deep relative type imports unchanged', () => {
    const result = postProcessDataReportSandpackFiles({
      '/src/pages/dataDashboard/silverCoinExchangeRecord/components/ExchangeMall/index.tsx': {
        code: [
          "import type { ExchangeMallRecord } from '../../../../../types/data/silverCoinExchangeRecord';",
          'export function ExchangeMall() {',
          '  return <div />;',
          '}'
        ].join('\n')
      }
    });

    expect(
      result.files['/src/pages/dataDashboard/silverCoinExchangeRecord/components/ExchangeMall/index.tsx']?.code
    ).toContain("from '../../../../../types/data/silverCoinExchangeRecord';");
    expect(result.summary.appliedFixes).toBe(0);
  });

  it('moves root-level report files into the src directory', () => {
    const result = postProcessDataReportSandpackFiles({
      '/pages/dataDashboard/silverCoinExchangeRecord/index.tsx': {
        code: "import { getSilverCoinExchangeRecordList } from '@/services/data/silverCoinExchangeRecord';\nexport default function Page() { return <div />; }"
      },
      '/services/data/silverCoinExchangeRecord.ts': {
        code: 'export async function getSilverCoinExchangeRecordList() { return []; }'
      },
      '/types/data/silverCoinExchangeRecord.ts': {
        code: 'export interface SilverCoinExchangeRecordListItem { id: string; }'
      }
    });

    expect(result.files).toHaveProperty('/src/pages/dataDashboard/silverCoinExchangeRecord/index.tsx');
    expect(result.files).toHaveProperty('/src/services/data/silverCoinExchangeRecord.ts');
    expect(result.files).toHaveProperty('/src/types/data/silverCoinExchangeRecord.ts');
    expect(result.files['/src/pages/dataDashboard/silverCoinExchangeRecord/index.tsx']?.code).toContain(
      "from '../../../services/data/silverCoinExchangeRecord'"
    );
  });

  it('falls back to the original assembled files when AST post-processing throws', () => {
    const blueprint = buildDataReportBlueprint({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });
    const moduleResult = buildDataReportModuleScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template',
      moduleId: 'TaskPagePenetration'
    });
    const scaffold = buildDataReportScaffold({
      goal: '参考 bonusCenterData 生成多个数据报表页面',
      taskContext: 'bonusCenterData template'
    });
    const routes = buildDataReportRoutes(blueprint);

    const bundle = assembleDataReportBundleWithPostProcess(
      {
        blueprint,
        moduleResults: [moduleResult],
        sharedFiles: scaffold.files,
        routeFiles: routes.files
      },
      () => {
        throw new Error('ast exploded');
      }
    );

    expect(bundle.sandpackFiles['/App.tsx']?.code).toContain(
      "import ReportPage from './src/pages/dataDashboard/bonusCenterData';"
    );
    expect(bundle.assemblyPlan.postProcessSummary).toEqual(
      expect.objectContaining({
        hook: 'data-report-ast-postprocess',
        fallbackUsed: true,
        errorMessage: 'ast exploded'
      })
    );
  });
});
