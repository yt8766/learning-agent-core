import { describe, expect, it } from 'vitest';

import { ReportBundleSchema, type ReportBundle } from '@agent/core';

import { executeReportBundleEditFlow } from '../src/flows/report-bundle/edit/report-bundle-edit-flow';

function createCurrentBundle(): ReportBundle {
  return ReportBundleSchema.parse({
    version: 'report-bundle.v1',
    kind: 'report-bundle',
    meta: {
      bundleId: 'bundle-bonus-center',
      title: 'Bonus Center',
      mode: 'single-document'
    },
    documents: [
      {
        version: '1.0',
        kind: 'data-report-json',
        meta: {
          reportId: 'bonus-center-overview',
          title: 'Bonus Center',
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
      }
    ]
  });
}

describe('@agent/agents-data-report report bundle edit flow', () => {
  it('patches the current bundle primary document from chat messages', async () => {
    const result = await executeReportBundleEditFlow({
      currentBundle: createCurrentBundle(),
      messages: [{ role: 'user', content: '请把明细表标题改为兑换明细' }]
    });

    expect(result.status).toBe('success');
    expect(result.bundle).toBeDefined();
    expect(result.bundle?.documents[0]?.sections[0]?.blocks[2]).toMatchObject({
      type: 'table',
      title: '兑换明细'
    });
    expect(result.patchOperations?.[0]?.summary).toContain('明细表标题更新为');
  });

  it('prefers requested operations over messages when both are provided', async () => {
    const result = await executeReportBundleEditFlow({
      currentBundle: createCurrentBundle(),
      messages: [{ role: 'user', content: '请把页面标题改为消息标题' }],
      requestedOperations: [
        {
          op: 'replace-meta-title',
          path: '/meta/title',
          summary: '页面标题改为运营总览'
        }
      ]
    });

    expect(result.status).toBe('success');
    expect(result.bundle?.meta.title).toBe('运营总览');
    expect(result.bundle?.documents[0]?.meta.title).toBe('运营总览');
    expect(result.patchOperations?.[0]).toMatchObject({
      op: 'replace-meta-title'
    });
  });
});
