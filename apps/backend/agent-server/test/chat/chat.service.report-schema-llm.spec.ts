import { describe, expect, it, vi } from 'vitest';

import type { ILLMProvider as LlmProvider } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import { RuntimeHost } from '../../src/runtime/core/runtime.host';
import {
  createCapabilityIntentService,
  createReportSchemaPart,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService', () => {
  it('exposes stage timing, model routing, and schema artifacts for llm-backed report generation', async () => {
    const runtimeHost = createRuntimeHost();
    const generateObject = vi.fn(async (messages: Array<{ content: string }>) =>
      createReportSchemaPart(messages[0]?.content ?? '')
    );
    runtimeHost.settings = {
      zhipuModels: { manager: 'GLM-4.7-FlashX', research: 'glm-5.1' },
      policy: { budget: { fallbackModelId: 'glm-5.1' } }
    } as RuntimeHost['settings'];
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      supportedModels: vi.fn(() => []),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);
    const push = vi.fn();

    const result = await service.streamReportSchema(
      {
        message:
          '标题：Bonus Center数据\n报表名称：银币兑换记录 strict-model-routing\n大数据接口：get_bc_exchange_mall_data\n字段列表：dt, app, user_type, props_amount',
        responseFormat: 'report-schema',
        preferLlm: true
      },
      push
    );

    expect(result.runtime).toEqual(expect.objectContaining({ executionPath: 'llm', llmAttempted: true }));
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ type: 'schema_progress' }));
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'stage',
        data: expect.objectContaining({ stage: 'planningNode', status: 'pending' })
      })
    );
    expect(
      push.mock.calls.some(
        ([event]) =>
          event?.type === 'stage' &&
          event.data?.status === 'success' &&
          event.data?.details?.source === 'llm' &&
          typeof event.data?.details?.modelId === 'string'
      )
    ).toBe(true);
    expect(
      generateObject.mock.calls.some(
        ([messages, , options]) =>
          Array.isArray(messages) &&
          messages.some(
            message => typeof message?.content === 'string' && message.content.includes('当前片段：filterSchema')
          ) &&
          options?.modelId === 'GLM-4.7-FlashX'
      )
    ).toBe(true);
  });

  it('falls back cleanly when block-level or whole-schema llm generation fails for simple single reports', async () => {
    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      supportedModels: vi.fn(() => []),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject: vi.fn(async (messages: Array<{ content: string }>) => {
        const systemPrompt = messages[0]?.content ?? '';
        if (systemPrompt.includes('当前片段：chartBlock')) {
          throw new Error('No JSON object found in model response.');
        }
        if (systemPrompt.includes('fallback')) {
          throw new Error('simple single-report should not call llm');
        }
        if (systemPrompt.includes('provider exploded')) {
          throw new Error('provider exploded');
        }
        return createReportSchemaPart(systemPrompt);
      })
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const blockFailure = await service.streamReportSchema(
      {
        message: '标题：Bonus Center数据\n报表名称：银币兑换记录\n大数据接口：get_bc_exchange_mall_data',
        responseFormat: 'report-schema'
      },
      vi.fn()
    );
    expect(blockFailure.status).toBe('success');
    expect(blockFailure.schema?.registries?.blockTypes).toEqual(['metrics', 'chart', 'table']);

    runtimeHost.llmProvider.generateObject = vi.fn(async () => {
      throw new Error('provider exploded');
    });
    const providerFailure = await service.streamReportSchema(
      {
        message:
          '标题：Bonus Center数据\n报表名称：银币兑换记录\n大数据接口：get_bc_exchange_mall_data\n字段列表：provider exploded',
        responseFormat: 'report-schema'
      },
      vi.fn()
    );
    expect(providerFailure.status).toBe('success');
    expect(providerFailure.schema?.sections[0]?.blocks.map(block => block.type)).toEqual(['metrics', 'chart', 'table']);
  });

  it('keeps reportSchemaInput and simple single-report requests on the deterministic fast lane when llm is skipped', async () => {
    const runtimeHost = createRuntimeHost();
    const generateObject = vi.fn(async () => {
      throw new Error('structured fast lane should not call llm');
    });
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      supportedModels: vi.fn(() => []),
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateObject
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const structuredFastLane = await service.streamReportSchema(
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
          dataSources: [
            {
              key: 'roomCategory',
              serviceKey: 'getRoomCategoryData',
              requestAdapter: {},
              responseAdapter: { listPath: 'data.list' }
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
          ]
        }
      },
      vi.fn()
    );
    expect(generateObject).not.toHaveBeenCalled();
    expect(structuredFastLane.runtime).toEqual(
      expect.objectContaining({ executionPath: 'structured-fast-lane', llmAttempted: false })
    );

    const simpleFastLane = await service.streamReportSchema(
      {
        message:
          '标题：Bonus Center数据\n报表名称：银币兑换记录 fallback\n大数据接口：get_bc_exchange_mall_data\n字段列表：dt, app, user_type, props_amount',
        responseFormat: 'report-schema'
      },
      vi.fn()
    );
    expect(simpleFastLane.status).toBe('success');
    expect(simpleFastLane.schema?.sections[0]?.blocks.map(block => block.type)).toEqual(['metrics', 'chart', 'table']);
  });
});
