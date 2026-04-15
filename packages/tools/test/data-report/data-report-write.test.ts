import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  assembleDataReportBundle,
  buildDataReportBlueprint,
  buildDataReportModuleScaffold,
  buildDataReportScaffold,
  writeDataReportBundle
} from '@agent/report-kit';

describe('writeDataReportBundle', () => {
  it('materializes assembled data-report files into a target root', async () => {
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
    const bundle = assembleDataReportBundle({
      blueprint,
      moduleResults: [moduleResult],
      sharedFiles: scaffold.files
    });
    const root = await mkdtemp(join(tmpdir(), 'data-report-write-'));

    const result = await writeDataReportBundle({
      bundle,
      targetRoot: root
    });

    expect(result).toEqual(
      expect.objectContaining({
        targetRoot: root,
        totalWritten: bundle.assemblyPlan.totalFiles,
        writtenFiles: expect.arrayContaining([
          expect.stringContaining('src/pages/dataDashboard/bonusCenterData/index.tsx'),
          expect.stringContaining('src/pages/dataDashboard/bonusCenterData/components/TaskPagePenetration/index.tsx'),
          expect.stringContaining('src/services/data/bonusCenter.ts'),
          expect.stringContaining('src/types/data/bonusCenter.ts')
        ])
      })
    );

    const pageContent = await readFile(join(root, 'src/pages/dataDashboard/bonusCenterData/index.tsx'), 'utf8');
    expect(pageContent).toContain('PageContainer');
  });
});
