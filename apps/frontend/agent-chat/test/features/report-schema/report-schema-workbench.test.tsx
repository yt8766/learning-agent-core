import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReportSchemaWorkbench } from '@/features/report-schema/report-schema-workbench';

describe('report-schema-workbench', () => {
  it('renders schema preview, runtime summary, and raw json from an initial result', () => {
    const html = renderToStaticMarkup(
      <ReportSchemaWorkbench
        initialGoal="生成直播间分类报表"
        initialResult={{
          schema: {
            meta: {
              title: '直播间分类报表',
              route: '/dataDashboard/roomCategoryDashboard',
              templateRef: 'generic-report',
              layout: 'dashboard',
              scope: 'single'
            },
            filterSchema: {
              fields: [
                {
                  name: 'dateRange',
                  label: '日期',
                  required: true,
                  component: {
                    componentKey: 'gosh-date-range'
                  }
                }
              ]
            },
            dataSources: {
              roomCategory: {
                serviceKey: 'getRoomCategoryData',
                requestAdapter: {
                  'dateRange.start': 'start_dt'
                },
                responseAdapter: {
                  listPath: 'data.list',
                  totalPath: 'data.total'
                }
              }
            },
            sections: [
              {
                blocks: [
                  {
                    type: 'metrics',
                    items: [
                      {
                        key: 'roomCount',
                        label: '直播间数',
                        field: 'room_cnt',
                        aggregate: 'latest'
                      }
                    ]
                  },
                  {
                    type: 'chart',
                    title: '趋势图',
                    chartType: 'bar',
                    xField: 'category_name',
                    series: [
                      {
                        key: 'roomCount',
                        label: '直播间数',
                        field: 'room_cnt'
                      }
                    ]
                  },
                  {
                    type: 'table',
                    columns: [
                      {
                        title: '直播间分类',
                        dataIndex: 'category_name',
                        width: 180
                      }
                    ]
                  }
                ]
              }
            ]
          },
          elapsedMs: 3200,
          rawJson: '{"kind":"data-report-json"}'
        }}
      />
    );

    expect(html).toContain('报表 JSON 工作台');
    expect(html).toContain('单报表表单');
    expect(html).toContain('接口 serviceKey');
    expect(html).toContain('请求开始参数');
    expect(html).toContain('直播间分类报表');
    expect(html).toContain('/dataDashboard/roomCategoryDashboard');
    expect(html).toContain('dashboard');
    expect(html).toContain('single');
    expect(html).toContain('日期 · gosh-date-range · required=true');
    expect(html).toContain('getRoomCategoryData');
    expect(html).toContain('请求参数映射');
    expect(html).toContain('响应路径映射');
    expect(html).toContain('roomCategory · getRoomCategoryData');
    expect(html).toContain('&quot;dateRange.start&quot;: &quot;start_dt&quot;');
    expect(html).toContain('&quot;listPath&quot;: &quot;data.list&quot;');
    expect(html).toContain('直播间数 · room_cnt · latest');
    expect(html).toContain('趋势图');
    expect(html).toContain('bar · xField=category_name');
    expect(html).toContain('直播间分类 · category_name · width=180');
    expect(html).toContain('Section 数：1');
    expect(html).toContain('{&quot;kind&quot;:&quot;data-report-json&quot;}');
    expect(html).toContain('打开配置器');
  });

  it('renders a real single-report preview and visible warnings for degraded blocks', () => {
    const html = renderToStaticMarkup(
      <ReportSchemaWorkbench
        initialGoal="生成直播间分类报表"
        initialResult={{
          schema: {
            meta: {
              title: '直播间分类报表',
              route: '/dataDashboard/roomCategoryDashboard',
              templateRef: 'generic-report',
              layout: 'dashboard',
              scope: 'single'
            },
            filterSchema: {
              fields: [
                {
                  name: 'dateRange',
                  label: '日期',
                  required: true,
                  component: {
                    componentKey: 'gosh-date-range'
                  }
                }
              ]
            },
            sections: [
              {
                title: '直播间分类',
                blocks: [
                  {
                    type: 'metrics',
                    title: '核心指标',
                    items: [
                      {
                        key: 'roomCount',
                        label: '直播间数',
                        field: 'room_cnt',
                        aggregate: 'latest'
                      }
                    ]
                  },
                  {
                    type: 'table',
                    title: '明细表',
                    exportable: true,
                    columns: [
                      {
                        title: '直播间分类',
                        dataIndex: 'category_name',
                        width: 180
                      }
                    ]
                  }
                ]
              }
            ],
            warnings: ['chartBlockNode 降级：timeout']
          },
          rawJson: '{"kind":"data-report-json"}'
        }}
      />
    );

    expect(html).toContain('真实预览');
    expect(html).toContain('筛选区');
    expect(html).toContain('指标卡');
    expect(html).toContain('直播间数');
    expect(html).toContain('明细表');
    expect(html).toContain('Mock 数据预览');
    expect(html).toContain('降级告警');
    expect(html).toContain('chartBlockNode 降级：timeout');
  });

  it('disables the configurator button when no schema has been generated', () => {
    const html = renderToStaticMarkup(
      <ReportSchemaWorkbench
        initialGoal="生成直播间分类报表"
        initialResult={{
          rawJson: ''
        }}
      />
    );

    expect(html).toContain('<button type="button" disabled="">打开配置器</button>');
  });

  it('does not crash when schema fragments are malformed or incomplete', () => {
    const html = renderToStaticMarkup(
      <ReportSchemaWorkbench
        initialGoal="生成直播间分类报表"
        initialResult={{
          schema: {
            meta: {
              title: '异常 schema'
            },
            filterSchema: {
              fields: {
                bad: true
              }
            },
            dataSources: {
              broken: undefined
            },
            sections: {
              blocks: {
                broken: true
              }
            }
          } as unknown as Record<string, unknown>
        }}
      />
    );

    expect(html).toContain('报表 JSON 工作台');
    expect(html).toContain('<button type="button" disabled="">打开配置器</button>');
    expect(html).not.toContain('真实预览');
  });
});
