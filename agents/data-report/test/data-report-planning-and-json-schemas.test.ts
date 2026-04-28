import { describe, expect, it } from 'vitest';

import { DataReportJsonBundleSchema } from '../src/types';
import {
  DataReportAnalysisSchema,
  DataReportComponentPlanSchema,
  DataReportIntentSchema
} from '../src/flows/data-report/schemas';
import { extractEmbeddedSchema } from '../src/flows/data-report-json/nodes/structured-input';
import { createDataReportJsonPatchPartUserPrompt } from '../src/flows/data-report-json/prompts/generate-report-page-part-prompt';
import { resolveStrictFragmentTimeoutMs } from '../src/flows/data-report-json/runtime-helpers';
import { dataReportJsonPatchSchema, parseDataReportJsonSchema } from '../src/flows/data-report-json/schemas';

describe('@agent/agents-data-report planning and json contracts', () => {
  it('does not apply a local timeout to strict llm json fragment generation', () => {
    expect(resolveStrictFragmentTimeoutMs()).toBeUndefined();
  });

  it('accepts planning contracts for generated report pages', () => {
    expect(
      DataReportAnalysisSchema.parse({
        reportType: 'data-dashboard',
        requiresSandpack: true,
        requiresMultiFileOutput: true,
        title: 'Bonus Center Overview',
        routeName: 'bonusCenterOverview',
        templateId: 'bonus-center',
        referenceMode: 'single',
        keywords: ['bonus', 'dashboard']
      })
    ).toMatchObject({
      routeName: 'bonusCenterOverview',
      referenceMode: 'single'
    });

    expect(
      DataReportIntentSchema.parse({
        action: 'generate-report-page',
        routeName: 'bonusCenterOverview',
        moduleBasePath: '/pages/dataDashboard/BonusCenterOverview',
        serviceBaseName: 'bonusCenterOverview'
      })
    ).toMatchObject({
      moduleBasePath: '/pages/dataDashboard/BonusCenterOverview'
    });

    expect(
      DataReportComponentPlanSchema.parse({
        singleReportMode: 'component-files',
        planned: [
          {
            name: 'BonusCenterOverview',
            path: '/pages/dataDashboard/BonusCenterOverview',
            purpose: '页面主入口'
          },
          {
            name: 'OverviewFilters',
            path: '/pages/dataDashboard/BonusCenterOverview/components/OverviewFilters/index.tsx',
            purpose: '筛选区'
          }
        ]
      })
    ).toMatchObject({
      singleReportMode: 'component-files'
    });
  });

  it('rejects invalid route naming for planning contracts', () => {
    expect(() =>
      DataReportAnalysisSchema.parse({
        reportType: 'data-dashboard',
        requiresSandpack: true,
        requiresMultiFileOutput: true,
        title: 'Broken Route',
        routeName: 'broken-route',
        templateId: 'bonus-center',
        referenceMode: 'single',
        keywords: ['broken']
      })
    ).toThrow(/Invalid string/i);
  });

  it('parses a minimal patchable report json document', () => {
    const parsed = parseDataReportJsonSchema({
      version: '1.0',
      kind: 'data-report-json',
      meta: {
        reportId: 'bonus-center-overview',
        title: 'Bonus Center Overview',
        description: 'Bonus center dashboard',
        route: '/bonus-center-overview',
        templateRef: 'bonus-center',
        scope: 'single',
        layout: 'dashboard',
        owner: 'data-report-json-agent'
      },
      pageDefaults: {
        filters: {
          orgId: 'north'
        },
        queryPolicy: {
          autoQueryOnInit: true,
          autoQueryOnFilterChange: false,
          cacheKey: 'bonus-center-overview'
        }
      },
      filterSchema: {
        formKey: 'bonus-center-filters',
        layout: 'inline',
        fields: [
          {
            name: 'orgId',
            label: '组织',
            component: {
              type: 'custom',
              componentKey: 'OrgSelect',
              props: {}
            },
            valueType: 'string',
            required: true,
            requestMapping: {
              orgId: 'orgId'
            }
          }
        ]
      },
      dataSources: {
        main: {
          serviceKey: 'bonusCenterService',
          requestAdapter: {
            orgId: 'orgId'
          },
          responseAdapter: {
            listPath: 'data.list',
            totalPath: 'data.total'
          }
        }
      },
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          description: '核心概览',
          dataSourceKey: 'main',
          sectionDefaults: {
            filters: {
              orgId: 'north'
            },
            table: {
              pageSize: 20,
              defaultSort: {
                field: 'date',
                order: 'desc'
              }
            },
            chart: {
              granularity: 'day'
            }
          },
          blocks: [
            {
              type: 'metrics',
              title: 'KPI',
              items: [
                {
                  key: 'revenue',
                  label: '营收',
                  field: 'revenue',
                  format: 'number',
                  aggregate: 'sum'
                }
              ]
            },
            {
              type: 'chart',
              title: '趋势',
              chartType: 'line',
              xField: 'date',
              series: [
                {
                  key: 'revenue',
                  label: '营收',
                  field: 'revenue',
                  seriesType: 'line'
                }
              ]
            },
            {
              type: 'table',
              title: '明细',
              exportable: true,
              columns: [
                {
                  title: '日期',
                  dataIndex: 'date',
                  width: 160
                }
              ]
            }
          ]
        }
      ],
      registries: {
        filterComponents: ['OrgSelect'],
        blockTypes: ['metrics', 'chart', 'table'],
        serviceKeys: ['bonusCenterService']
      },
      modification: {
        strategy: 'patchable-json',
        supportedOperations: ['update-filter-defaults', 'replace-section']
      },
      warnings: []
    });

    expect(parsed.meta.reportId).toBe('bonus-center-overview');
    expect(parsed.sections).toHaveLength(1);
  });

  it('defaults patch operations to an empty array for patch payloads', () => {
    expect(
      dataReportJsonPatchSchema.parse({
        meta: {
          reportId: 'bonus-center-overview',
          title: 'Bonus Center Overview',
          description: 'Bonus center dashboard',
          route: '/bonus-center-overview',
          templateRef: 'bonus-center',
          scope: 'single',
          layout: 'dashboard'
        },
        pageDefaults: {
          filters: {},
          queryPolicy: {
            autoQueryOnInit: true,
            autoQueryOnFilterChange: false,
            cacheKey: 'bonus-center-overview'
          }
        }
      })
    ).toEqual({
      meta: {
        reportId: 'bonus-center-overview',
        title: 'Bonus Center Overview',
        description: 'Bonus center dashboard',
        route: '/bonus-center-overview',
        templateRef: 'bonus-center',
        scope: 'single',
        layout: 'dashboard'
      },
      pageDefaults: {
        filters: {},
        queryPolicy: {
          autoQueryOnInit: true,
          autoQueryOnFilterChange: false,
          cacheKey: 'bonus-center-overview'
        }
      },
      patchOperations: []
    });
  });

  it('does not parse legacy CHANGE_REQUEST plus CURRENT_SCHEMA markers from raw goals anymore', () => {
    expect(
      extractEmbeddedSchema(
        'CHANGE_REQUEST: 把标题改成运营总览\nCURRENT_SCHEMA:\n{"version":"1.0","kind":"data-report-json"}'
      )
    ).toEqual({
      currentSchema: undefined,
      modificationRequest: undefined
    });
  });

  it('formats patch prompts with explicit modification labels instead of legacy markers', () => {
    const prompt = createDataReportJsonPatchPartUserPrompt({
      changeRequest: '把页面标题改成运营总览',
      currentFragment: { meta: { title: '旧标题' } },
      currentSchema: { meta: { title: '旧标题' } },
      partName: 'schemaPatch'
    });

    expect(prompt).toContain('MODIFICATION_REQUEST:');
    expect(prompt).toContain('CURRENT_DOCUMENT:');
    expect(prompt).not.toContain('CHANGE_REQUEST:');
    expect(prompt).not.toContain('CURRENT_SCHEMA:');
  });

  it('accepts a gosh_admin_fe multi-report bundle json contract', () => {
    const parsed = DataReportJsonBundleSchema.parse({
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
            name: 'formatPercent',
            input: 'number',
            output: 'percent'
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
            listPath: 'data.list',
            totalPath: 'data.total'
          },
          dataModel: [
            {
              name: 'dt',
              label: 'Date',
              valueType: 'date',
              required: true
            },
            {
              name: 'login_dau',
              label: 'Login DAU',
              valueType: 'number',
              required: false,
              formatter: 'formatNumber'
            }
          ],
          metrics: [
            {
              key: 'loginDau',
              label: 'Login DAU',
              field: 'login_dau',
              format: 'number',
              aggregate: 'sum'
            }
          ],
          charts: [
            {
              key: 'trend',
              title: 'Trend',
              chartType: 'line',
              xField: 'dt',
              series: [
                {
                  key: 'loginDau',
                  label: 'Login DAU',
                  field: 'login_dau',
                  seriesType: 'line'
                }
              ]
            }
          ],
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
              dependsOn: ['TaskPagePenetrationChart.tsx', 'TaskPagePenetrationTable.tsx']
            }
          ]
        }
      ],
      files: [
        {
          path: 'src/pages/dataDashboard/bonusCenterGenerated/index.tsx',
          kind: 'page',
          source: 'bundle-assembly'
        }
      ],
      checks: ['pnpm exec tsc -p tsconfig.json --noEmit']
    });

    expect(parsed.reports).toHaveLength(1);
    expect(parsed.page.mode).toBe('tabs');
  });
});
