import { describe, expect, it } from 'vitest';

import { renderDataReportJsonBundleFiles } from '../src';

describe('@agent/report-kit data report json renderer', () => {
  it('renders a gosh_admin_fe style multi-report bundle into deterministic files', () => {
    const result = renderDataReportJsonBundleFiles({
      version: 'data-report-json.v1',
      targetProject: '/Users/dev/Desktop/gosh_admin_fe',
      page: {
        routePath: '/dataDashboard/bonusCenterGenerated',
        pageDir: 'src/pages/dataDashboard/bonusCenterGenerated',
        titleI18nKey: 'data.bonusCenterGenerated.title',
        mode: 'tabs'
      },
      shared: {
        searchParams: [
          {
            name: 'start_dt',
            label: 'Start date',
            valueType: 'date',
            required: true,
            requestKey: 'start_dt'
          }
        ],
        defaultParams: {
          page: 1,
          page_size: 100
        },
        formatters: [
          {
            name: 'formatNumber',
            input: 'number',
            output: 'number'
          }
        ]
      },
      reports: [
        {
          id: 'taskPagePenetration',
          componentName: 'TaskPagePenetration',
          titleI18nKey: 'data.bonusCenterGenerated.taskPagePenetration',
          service: {
            serviceKey: 'getTaskPagePenetrationData',
            lambdaKey: 'get_bc_center_behavioral_event_data',
            requestTypeName: 'BonusCenterGeneratedSearchParams',
            responseTypeName: 'TaskPagePenetrationListRes',
            listPath: 'data.list'
          },
          dataModel: [
            {
              name: 'dt',
              label: 'Date',
              valueType: 'date',
              required: true
            }
          ],
          metrics: [],
          charts: [],
          tables: [
            {
              key: 'detail',
              title: 'Detail',
              exportable: true,
              columns: [
                {
                  title: 'Date',
                  dataIndex: 'dt',
                  width: 160
                }
              ]
            }
          ],
          components: [
            {
              fileName: 'index.tsx',
              role: 'report-entry',
              dependsOn: ['TaskPagePenetrationTable.tsx']
            }
          ]
        }
      ],
      files: [],
      checks: []
    });

    expect(result.files.map(file => file.path)).toEqual([
      'src/pages/dataDashboard/bonusCenterGenerated/config.tsx',
      'src/pages/dataDashboard/bonusCenterGenerated/index.tsx',
      'src/pages/dataDashboard/bonusCenterGenerated/components/TaskPagePenetration/index.tsx',
      'src/services/data/bonusCenterGenerated.ts',
      'src/types/data/bonusCenterGenerated.ts'
    ]);
    expect(result.files.find(file => file.path.endsWith('index.tsx'))?.content).toContain('PageContainer');
    expect(result.summary.reportCount).toBe(1);
  });
});
