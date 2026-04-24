import { describe, expect, it, vi } from 'vitest';

import type { ILLMProvider as LlmProvider } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import {
  createCapabilityIntentService,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

const bonusCenterAmountRecordRequest = `标题：Bonus Center数据

报表名称：银币兑换记录

大数据接口：get_bc_amount_record_data

筛选项：

start_dt (string) - 开始日期，UTC时区 yyyy-MM-dd
end_dt (string) - 结束日期，UTC时区 yyyy-MM-dd
app (string) - 商户ID列表：vizz、hotya
user_type (string) - 新老用户
展示及文案：

dt
string
日期，utc时区yyyy-MM-dd
2025-01-01
app
string
商户ID列表：vizz、hotya
all
user_type
string
新老用户
all
total_record_all_cnt
bigint
总发放次数
1
total_record_amount
bigint
总发放金额
1
total_record_user_cnt
bigint
总发放人数
1
total_record_amount_avg
double
总发放人均金额
1`;

describe('ChatService report-schema chat payload compatibility', () => {
  it('generates a ReportBundle from chat-style report-schema messages without requiring an LLM', async () => {
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
        message: bonusCenterAmountRecordRequest,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的报表生成助手，擅长根据用户需求生成数据报表配置。'
          },
          {
            role: 'user',
            content: `请交给 report-schema 链路生成符合 data-report-json 的结构化结果。\n\n用户需求：\n${bonusCenterAmountRecordRequest}`
          }
        ],
        responseFormat: 'report-schema',
        temperature: 0.2,
        maxTokens: 4000
      },
      vi.fn()
    );

    const document = result.bundle?.documents[0];
    const dataSource = document?.dataSources.bcExchangeMall;

    expect(result.status).toBe('success');
    expect(result.bundle?.kind).toBe('report-bundle');
    expect(document?.filterSchema.fields.map(field => field.name)).toEqual(['dateRange', 'app', 'user_type']);
    expect(dataSource?.serviceKey).toBe('get_bc_amount_record_data');
    expect(document?.sections[0]?.blocks.find(block => block.type === 'table')).toEqual(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ dataIndex: 'total_record_amount', title: '总发放金额' })
        ])
      })
    );
    expect(result.content).toContain('"kind": "report-bundle"');
  });
});
