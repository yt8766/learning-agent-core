import { describe, expect, it, vi } from 'vitest';

import type { ILLMProvider as LlmProvider } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import {
  createCapabilityIntentService,
  createReportSchemaPart,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService', () => {
  it('streams structured report schema output for llm and structured-fast-lane requests', async () => {
    const runtimeHost = createRuntimeHost();
    const generateObject = vi.fn(async (messages: Array<{ content: string }>) =>
      createReportSchemaPart(messages[0]?.content ?? '')
    );
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      supportedModels: vi.fn(() => []),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);
    const llmPush = vi.fn();

    const llmResult = await service.streamReportSchema(
      { message: '参考 bonusCenterData 生成多个报表 JSON schema', responseFormat: 'report-schema' },
      llmPush
    );

    expect(llmResult.status).toBe('success');
    expect(llmResult.schema).toBeUndefined();
    expect(llmResult.bundle).toEqual(
      expect.objectContaining({
        kind: 'report-bundle',
        documents: [expect.objectContaining({ kind: 'data-report-json' })]
      })
    );
    expect(llmResult.runtime).toEqual(expect.objectContaining({ executionPath: 'llm', llmAttempted: true }));
    expect(llmPush).toHaveBeenCalledWith(expect.objectContaining({ type: 'schema_ready' }));
    expect(llmPush).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bundle: expect.objectContaining({ kind: 'report-bundle' })
        })
      })
    );
    expect(llmPush.mock.calls.find(([event]) => event?.type === 'schema_ready')?.[0]?.data).not.toHaveProperty(
      'schema'
    );

    const structuredResult = await service.streamReportSchema(
      {
        message: '生成直播间分类报表',
        responseFormat: 'report-schema',
        reportSchemaInput: {
          meta: {
            reportId: 'roomCategoryDashboard',
            title: '直播间分类报表',
            description: '直播间分类经营分析',
            route: '/dataDashboard/roomCategoryDashboard',
            templateRef: 'generic-report',
            scope: 'single',
            layout: 'dashboard'
          },
          filters: [
            {
              name: 'dateRange',
              label: '日期',
              componentKey: 'gosh-date-range',
              valueType: 'date-range',
              required: true,
              defaultValue: { preset: 'last7Days' },
              requestMapping: { start: 'start_dt', end: 'end_dt' }
            }
          ],
          dataSources: [
            {
              key: 'roomCategory',
              serviceKey: 'getRoomCategoryData',
              requestAdapter: { 'dateRange.start': 'start_dt', 'dateRange.end': 'end_dt' },
              responseAdapter: { listPath: 'data.list', totalPath: 'data.total' }
            }
          ],
          sections: [
            {
              id: 'roomCategory',
              title: '直播间分类',
              description: '直播间分类核心数据',
              dataSourceKey: 'roomCategory',
              metricsSpec: [
                { key: 'roomCount', label: '直播间数', field: 'room_cnt', format: 'number', aggregate: 'latest' }
              ],
              chartSpec: {
                title: '直播间分类趋势',
                chartType: 'bar',
                xField: 'category_name',
                series: [{ key: 'roomCount', label: '直播间数', field: 'room_cnt' }]
              },
              tableSpec: {
                title: '直播间分类明细',
                exportable: true,
                columns: [{ title: '直播间分类', dataIndex: 'category_name', width: 180 }]
              }
            }
          ],
          generationHints: { cacheKey: 'roomCategoryDashboard' }
        }
      },
      vi.fn()
    );

    expect(generateObject).toHaveBeenCalled();
    expect(structuredResult.status).toBe('success');
    expect(structuredResult.bundle?.kind).toBe('report-bundle');
    expect(structuredResult.schema).toBeUndefined();
    expect(structuredResult.runtime).toEqual(
      expect.objectContaining({ executionPath: 'structured-fast-lane', cacheHit: false })
    );
    expect(structuredResult.bundle?.documents[0]?.sections[0]?.blocks.map(block => block.type)).toEqual([
      'metrics',
      'chart',
      'table'
    ]);
  });

  it('fails invalid structured requests and returns partial when llm is unavailable for brand-new multi-report requests', async () => {
    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => false),
      supportedModels: vi.fn(() => []),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject: vi.fn()
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const invalidStructured = await service.streamReportSchema(
      {
        message: '生成直播间分类报表',
        responseFormat: 'report-schema',
        reportSchemaInput: {
          meta: {
            reportId: 'roomCategoryDashboard',
            title: '直播间分类报表',
            description: '直播间分类经营分析',
            route: '/dataDashboard/roomCategoryDashboard',
            templateRef: 'generic-report',
            scope: 'single',
            layout: 'dashboard'
          },
          filters: [],
          dataSources: [],
          sections: [
            {
              id: 'roomCategory',
              title: '直播间分类',
              description: '直播间分类核心数据',
              dataSourceKey: 'roomCategory',
              metricsSpec: [
                { key: 'roomCount', label: '直播间数', field: 'room_cnt', format: 'number', aggregate: 'latest' }
              ],
              chartSpec: {
                title: '直播间分类趋势',
                chartType: 'bar',
                xField: 'category_name',
                series: [{ key: 'roomCount', label: '直播间数', field: 'room_cnt' }]
              },
              tableSpec: {
                title: '直播间分类明细',
                exportable: true,
                columns: [{ title: '直播间分类', dataIndex: 'category_name', width: 180 }]
              }
            }
          ]
        }
      },
      vi.fn()
    );

    expect(invalidStructured.status).toBe('failed');
    expect(invalidStructured.error?.errorMessage).toContain('dataSources');

    const partial = await service.streamReportSchema(
      { message: '参考 bonusCenterData 生成多个报表 JSON schema', responseFormat: 'report-schema' },
      vi.fn()
    );

    expect(partial.status).toBe('partial');
    expect(partial.partialSchema).toEqual(expect.objectContaining({ dataSources: expect.any(Object) }));
    expect(partial.bundle).toBeUndefined();
    expect(partial.schema).toBeUndefined();
  });

  it('rejects legacy CHANGE_REQUEST plus CURRENT_SCHEMA payloads and still switches cache keys for preferLlm', async () => {
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
        message:
          'CHANGE_REQUEST: 把页面标题改成 Bonus Center 驾驶舱\nCURRENT_SCHEMA:\n{"version":"1.0","kind":"data-report-json","meta":{"reportId":"bonusCenterData","title":"Bonus Center 数据报表","description":"Bonus Center 多报表运营分析页","route":"/dataDashboard/bonusCenterData","templateRef":"bonus-center-data","scope":"multiple","layout":"dashboard","owner":"data-report-json-agent"},"pageDefaults":{"filters":{"dateRange":{"preset":"last7Days"},"app":[],"userType":"all"},"queryPolicy":{"autoQueryOnInit":true,"autoQueryOnFilterChange":false,"cacheKey":"bonusCenterData"}},"filterSchema":{"formKey":"bonusCenterSearchForm","layout":"inline","fields":[{"name":"dateRange","label":"日期","component":{"type":"custom","componentKey":"gosh-date-range","props":{"allowClear":false}},"valueType":"date-range","required":true,"defaultValue":{"preset":"last7Days"}}]},"dataSources":{"exchangeMall":{"serviceKey":"getExchangeMallData","requestAdapter":{"dateRange.start":"start_dt","dateRange.end":"end_dt"},"responseAdapter":{"listPath":"data.list","totalPath":"data.total"}}},"sections":[{"id":"exchangeMall","title":"银币兑换记录","description":"兑换商城各类商品兑换情况","dataSourceKey":"exchangeMall","sectionDefaults":{"filters":{},"table":{"pageSize":100,"defaultSort":{"field":"dt","order":"desc"}},"chart":{"granularity":"day"}},"blocks":[{"type":"table","title":"明细表","exportable":true,"columns":[{"title":"日期","dataIndex":"dt_label","width":120,"fixed":"left"}]}]}],"registries":{"filterComponents":["gosh-date-range"],"blockTypes":["metrics","chart","table"],"serviceKeys":["getExchangeMallData"]},"modification":{"strategy":"patchable-json","supportedOperations":["update-filter-defaults"]},"warnings":[]}',
        responseFormat: 'report-schema'
      },
      vi.fn()
    );

    expect(result.status).toBe('failed');
    expect(result.error).toEqual(
      expect.objectContaining({
        errorCode: 'report_schema_generation_failed',
        errorMessage: expect.stringContaining('currentBundle')
      })
    );
    expect(result.bundle).toBeUndefined();
    expect(result.schema).toBeUndefined();

    const standardKey = service['resolveReportSchemaArtifactCacheKey']({
      message: '标题：Bonus Center数据\n报表名称：银币兑换记录\n大数据接口：get_bc_amount_record_data',
      responseFormat: 'report-schema'
    });
    const preferLlmKey = service['resolveReportSchemaArtifactCacheKey']({
      message: '标题：Bonus Center数据\n报表名称：银币兑换记录\n大数据接口：get_bc_amount_record_data',
      responseFormat: 'report-schema',
      preferLlm: true
    });

    expect(preferLlmKey).toBeDefined();
    expect(preferLlmKey).not.toBe(standardKey);
  });
});
