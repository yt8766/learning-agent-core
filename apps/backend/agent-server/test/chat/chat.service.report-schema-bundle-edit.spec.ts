import { describe, expect, it, vi } from 'vitest';

import type { ILLMProvider as LlmProvider } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import {
  createCapabilityIntentService,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService report schema bundle edits', () => {
  it('preserves multi-document bundles on bundle-first edit requests over the existing /api/chat report-schema path', async () => {
    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => false),
      supportedModels: vi.fn(() => []),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject: vi.fn()
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const result = await service.streamReportSchema(
      {
        responseFormat: 'report-schema',
        currentBundle: {
          version: 'report-bundle.v1',
          kind: 'report-bundle',
          meta: {
            bundleId: 'bonusCenterData',
            title: 'Bonus Center 数据报表',
            mode: 'multi-document'
          },
          documents: [
            {
              version: '1.0',
              kind: 'data-report-json',
              meta: {
                reportId: 'bonusCenterData',
                title: 'Bonus Center 数据报表',
                description: 'Bonus Center 多报表运营分析页',
                route: '/dataDashboard/bonusCenterData',
                templateRef: 'bonus-center-data',
                scope: 'multiple',
                layout: 'dashboard',
                owner: 'data-report-json-agent'
              },
              pageDefaults: {
                filters: {
                  dateRange: { preset: 'last7Days' },
                  app: [],
                  userType: 'all'
                },
                queryPolicy: {
                  autoQueryOnInit: true,
                  autoQueryOnFilterChange: false,
                  cacheKey: 'bonusCenterData'
                }
              },
              filterSchema: {
                formKey: 'bonusCenterSearchForm',
                layout: 'inline',
                fields: [
                  {
                    name: 'dateRange',
                    label: '日期',
                    component: {
                      type: 'custom',
                      componentKey: 'gosh-date-range',
                      props: { allowClear: false }
                    },
                    valueType: 'date-range',
                    required: true,
                    defaultValue: { preset: 'last7Days' }
                  }
                ]
              },
              dataSources: {
                exchangeMall: {
                  serviceKey: 'getExchangeMallData',
                  requestAdapter: {
                    'dateRange.start': 'start_dt',
                    'dateRange.end': 'end_dt'
                  },
                  responseAdapter: {
                    listPath: 'data.list',
                    totalPath: 'data.total'
                  }
                }
              },
              sections: [
                {
                  id: 'exchangeMall',
                  title: '银币兑换记录',
                  description: '兑换商城各类商品兑换情况',
                  dataSourceKey: 'exchangeMall',
                  sectionDefaults: {
                    filters: {},
                    table: {
                      pageSize: 100,
                      defaultSort: { field: 'dt', order: 'desc' }
                    },
                    chart: { granularity: 'day' }
                  },
                  blocks: [
                    {
                      type: 'table',
                      title: '明细表',
                      exportable: true,
                      columns: [{ title: '日期', dataIndex: 'dt_label', width: 120, fixed: 'left' }]
                    }
                  ]
                }
              ],
              registries: {
                filterComponents: ['gosh-date-range'],
                blockTypes: ['metrics', 'chart', 'table'],
                serviceKeys: ['getExchangeMallData']
              },
              modification: {
                strategy: 'patchable-json',
                supportedOperations: ['update-filter-defaults']
              },
              warnings: []
            },
            {
              version: '1.0',
              kind: 'data-report-json',
              meta: {
                reportId: 'bonusCenterTrend',
                title: 'Bonus Center 趋势分析',
                description: 'Bonus Center 趋势页',
                route: '/dataDashboard/bonusCenterTrend',
                templateRef: 'bonus-center-trend',
                scope: 'single',
                layout: 'dashboard',
                owner: 'data-report-json-agent'
              },
              pageDefaults: {
                filters: {
                  dateRange: { preset: 'last30Days' }
                },
                queryPolicy: {
                  autoQueryOnInit: true,
                  autoQueryOnFilterChange: true,
                  cacheKey: 'bonusCenterTrend'
                }
              },
              filterSchema: {
                formKey: 'bonusCenterTrendSearchForm',
                layout: 'inline',
                fields: []
              },
              dataSources: {},
              sections: [],
              registries: {
                filterComponents: [],
                blockTypes: ['metrics', 'chart', 'table'],
                serviceKeys: []
              },
              modification: {
                strategy: 'patchable-json',
                supportedOperations: ['update-filter-defaults']
              },
              warnings: []
            }
          ]
        },
        requestedOperations: [
          {
            op: 'replace-meta-title',
            path: '/meta/title',
            summary: '页面标题改为运营总览'
          }
        ]
      },
      vi.fn()
    );

    expect(result.status).toBe('success');
    expect(result.bundle?.kind).toBe('report-bundle');
    expect(result.bundle?.meta.mode).toBe('multi-document');
    expect(result.bundle?.meta.title).toBe('Bonus Center 数据报表');
    expect(result.bundle?.documents).toHaveLength(2);
    expect(result.bundle?.documents[1]?.meta.reportId).toBe('bonusCenterTrend');
    expect(result.bundle?.documents[1]?.meta.title).toBe('Bonus Center 趋势分析');
    expect(result.schema).toBeUndefined();
    expect(result.patchOperations).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace-meta-title' })])
    );
  });
});
