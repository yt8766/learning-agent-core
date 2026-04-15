import { describe, expect, it } from 'vitest';

import {
  createStructuredInputStarter,
  applySingleReportFormValues,
  deriveSingleReportFormValues,
  formatWorkbenchJson,
  getSchemaPreviewWarnings,
  getSingleReportPreviewModel,
  getSchemaChartSummary,
  getSchemaDataSourceMappings,
  getSchemaFilterFields,
  getSchemaMetricsItems,
  getSchemaRuntimeSummary,
  getSchemaSections,
  getSchemaTableColumns,
  parseWorkbenchJsonDraft
} from '@/features/report-schema/report-schema-workbench-support';

describe('report-schema-workbench support helpers', () => {
  it('parses optional json drafts and surfaces readable errors', () => {
    expect(parseWorkbenchJsonDraft<{ ok: boolean }>('', '结构化输入')).toBeUndefined();
    expect(parseWorkbenchJsonDraft<{ ok: boolean }>('{"ok":true}', '结构化输入')).toEqual({ ok: true });
    expect(() => parseWorkbenchJsonDraft('{oops}', '结构化输入')).toThrow('结构化输入 JSON 解析失败');
  });

  it('formats raw schema json and extracts table columns from the first section', () => {
    const schema = {
      filterSchema: {
        fields: [
          {
            name: 'dateRange',
            label: '日期',
            component: {
              componentKey: 'gosh-date-range'
            },
            required: true
          }
        ]
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
    };

    expect(formatWorkbenchJson(schema)).toContain('"title": "直播间分类"');
    expect(getSchemaTableColumns(schema)).toEqual([
      {
        title: '直播间分类',
        dataIndex: 'category_name',
        width: 180
      }
    ]);
    expect(getSchemaSections(schema)).toHaveLength(1);
    expect(getSchemaFilterFields(schema)).toEqual([
      expect.objectContaining({
        name: 'dateRange'
      })
    ]);
    expect(getSchemaMetricsItems(schema)).toEqual([
      expect.objectContaining({
        key: 'roomCount'
      })
    ]);
    expect(getSchemaChartSummary(schema)).toEqual(
      expect.objectContaining({
        chartType: 'bar',
        xField: 'category_name'
      })
    );
  });

  it('builds compact runtime summaries from stream stage events', () => {
    expect(
      getSchemaRuntimeSummary([
        {
          stage: 'chartBlockNode',
          status: 'success',
          details: {
            elapsedMs: 123,
            cacheHit: true,
            modelId: 'glm-fast',
            degraded: false
          }
        }
      ])
    ).toEqual([
      {
        stage: 'chartBlockNode',
        status: 'success',
        elapsedMs: 123,
        cacheHit: true,
        modelId: 'glm-fast',
        degraded: false
      }
    ]);
  });

  it('creates starter structured inputs and extracts explicit data source mappings', () => {
    const starter = createStructuredInputStarter('single-report');

    expect(starter.meta.reportId).toBe('roomCategoryDashboard');
    expect(starter.sections[0]?.tableSpec.columns[0]?.title).toBe('直播间分类');
    expect(
      getSchemaDataSourceMappings({
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
        }
      })
    ).toEqual([
      {
        key: 'roomCategory',
        serviceKey: 'getRoomCategoryData',
        requestAdapter: {
          'dateRange.start': 'start_dt'
        },
        responseAdapter: {
          listPath: 'data.list',
          totalPath: 'data.total'
        }
      }
    ]);
  });

  it('derives and reapplies single-report form values from structured input', () => {
    const starter = createStructuredInputStarter('single-report') as Record<string, unknown>;
    const form = deriveSingleReportFormValues(starter);

    expect(form.serviceKey).toBe('getRoomCategoryData');
    expect(form.firstColumnTitle).toBe('直播间分类');

    const next = applySingleReportFormValues(starter, {
      ...form,
      title: '直播间分类新报表',
      serviceKey: 'getRoomCategoryRealtime',
      firstColumnTitle: '直播间一级分类'
    });

    expect((next.meta as Record<string, unknown>).title).toBe('直播间分类新报表');
    expect(((next.dataSources as Array<Record<string, unknown>>)[0] as Record<string, unknown>).serviceKey).toBe(
      'getRoomCategoryRealtime'
    );
    expect(
      (
        (
          ((next.sections as Array<Record<string, unknown>>)[0] as Record<string, unknown>).tableSpec as Record<
            string,
            unknown
          >
        ).columns as Array<Record<string, unknown>>
      )[0]?.title
    ).toBe('直播间一级分类');
  });

  it('builds a single-report preview model and warning list from schema and runtime events', () => {
    const schema = {
      filterSchema: {
        fields: [
          {
            name: 'dateRange',
            label: '日期',
            component: {
              componentKey: 'gosh-date-range'
            },
            required: true
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
    };
    const runtime = getSchemaRuntimeSummary([
      {
        stage: 'chartBlockNode',
        status: 'error',
        details: {
          degraded: true,
          fallbackReason: 'timeout'
        }
      }
    ]);

    expect(getSchemaPreviewWarnings(schema, runtime)).toEqual(
      expect.arrayContaining(['chartBlockNode 降级：timeout', 'chartBlockNode 已降级：timeout'])
    );
    expect(getSingleReportPreviewModel(schema)).toEqual(
      expect.objectContaining({
        sectionTitle: '直播间分类',
        filters: expect.arrayContaining([expect.objectContaining({ name: 'dateRange' })]),
        metricItems: expect.arrayContaining([expect.objectContaining({ key: 'roomCount' })]),
        chartBlock: undefined,
        tableBlock: expect.objectContaining({ title: '明细表' })
      })
    );
  });
});
