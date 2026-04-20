import { vi } from 'vitest';

import type { RuntimeSessionService } from '../../src/runtime/services/runtime-session.service';
import { ChatCapabilityIntentsService } from '../../src/chat/chat-capability-intents.service';
import { RuntimeHost } from '../../src/runtime/core/runtime.host';

const reportSchemaTableColumnsSpec = [
  { title: '日期', dataIndex: 'dt_label', width: 120, fixed: 'left' },
  { title: 'App', dataIndex: 'app_label', width: 100 },
  { title: '新老用户', dataIndex: 'user_type_label', width: 100 }
] as const;

const reportSchemaMetaSpec = {
  reportId: 'bcExchangeMall',
  title: 'Bonus Center数据',
  description: '银币兑换记录分析页',
  route: '/dataDashboard/bonusCenterData/bcExchangeMall',
  templateRef: 'bonus-center-exchange',
  scope: 'single',
  layout: 'dashboard'
} as const;

const reportSchemaPageDefaultsSpec = {
  filters: { dateRange: { preset: 'last7Days' }, app: [], userType: 'all' },
  queryPolicy: { autoQueryOnInit: true, autoQueryOnFilterChange: false, cacheKey: 'bcExchangeMall' }
} as const;

const reportSchemaFilterSpec = {
  formKey: 'bcExchangeMallSearchForm',
  layout: 'inline',
  fields: [
    {
      name: 'dateRange',
      label: '日期',
      component: { type: 'custom', componentKey: 'gosh-date-range', props: { allowClear: false } },
      valueType: 'date-range',
      required: true,
      defaultValue: { preset: 'last7Days' }
    }
  ]
} as const;

const reportSchemaDataSourcesSpec = {
  bcExchangeMall: {
    serviceKey: 'get_bc_exchange_mall_data',
    requestAdapter: { 'dateRange.start': 'start_dt', 'dateRange.end': 'end_dt' },
    responseAdapter: { listPath: 'data.records', totalPath: 'data.total' }
  }
} as const;

const reportSchemaSectionsSpec = [
  {
    id: 'bcExchangeMall',
    title: '银币兑换记录',
    description: '银币兑换记录核心分析',
    dataSourceKey: 'bcExchangeMall',
    sectionDefaults: {
      filters: { userType: 'all' },
      table: { pageSize: 100, defaultSort: { field: 'dt', order: 'desc' } },
      chart: { granularity: 'day' }
    },
    blocks: [
      {
        type: 'metrics',
        title: '核心指标',
        items: [
          { key: 'propsAmount', label: '道具消耗银币量', field: 'props_amount', format: 'number', aggregate: 'sum' }
        ]
      },
      {
        type: 'chart',
        title: '趋势图',
        chartType: 'line',
        xField: 'dt',
        series: [{ key: 'propsAmount', label: '道具消耗银币量', field: 'props_amount' }]
      },
      { type: 'table', title: '明细表', exportable: true, columns: reportSchemaTableColumnsSpec }
    ]
  }
] as const;

export const createReportSchemaPart = (systemPrompt: string) => {
  if (systemPrompt.includes('生成完整 data-report-json 页面 schema')) {
    return {
      version: '1.0',
      kind: 'data-report-json',
      meta: { ...reportSchemaMetaSpec, owner: 'data-report-json-agent' },
      pageDefaults: reportSchemaPageDefaultsSpec,
      filterSchema: reportSchemaFilterSpec,
      dataSources: reportSchemaDataSourcesSpec,
      sections: reportSchemaSectionsSpec,
      registries: {
        filterComponents: ['gosh-date-range'],
        blockTypes: ['metrics', 'chart', 'table'],
        serviceKeys: ['get_bc_exchange_mall_data']
      },
      modification: {
        strategy: 'patchable-json',
        supportedOperations: ['update-filter-defaults', 'replace-section', 'append-section', 'update-block-config']
      },
      patchOperations: [],
      warnings: []
    };
  }

  if (systemPrompt.includes('当前片段：meta')) return reportSchemaMetaSpec;
  if (systemPrompt.includes('当前片段：pageDefaults')) return reportSchemaPageDefaultsSpec;
  if (systemPrompt.includes('当前片段：filterSchema')) return reportSchemaFilterSpec;
  if (systemPrompt.includes('当前片段：dataSources')) return reportSchemaDataSourcesSpec;
  if (systemPrompt.includes('当前片段：sections')) return reportSchemaSectionsSpec;
  if (systemPrompt.includes('当前片段：metricsBlock')) return reportSchemaSectionsSpec[0].blocks[0];
  if (systemPrompt.includes('当前片段：chartBlock')) return reportSchemaSectionsSpec[0].blocks[1];
  if (systemPrompt.includes('当前片段：tableBlock')) return reportSchemaSectionsSpec[0].blocks[2];

  throw new Error(`unexpected report-schema prompt: ${systemPrompt}`);
};

export const createRuntimeSessionService = () =>
  ({
    listSessions: vi.fn(() => ['session-1']),
    createSession: vi.fn(dto => ({ id: 'session-1', ...dto })),
    deleteSession: vi.fn(sessionId => ({ id: sessionId, deleted: true })),
    updateSession: vi.fn((sessionId, dto) => ({ id: sessionId, ...dto })),
    getSession: vi.fn(sessionId => ({ id: sessionId })),
    listSessionMessages: vi.fn(sessionId => [{ sessionId, role: 'user', content: 'hello' }]),
    listSessionEvents: vi.fn(sessionId => [{ sessionId, type: 'user_message' }]),
    getSessionCheckpoint: vi.fn(sessionId => ({ sessionId, taskId: 'task-1' })),
    appendSessionMessage: vi.fn((sessionId, dto) => ({ sessionId, ...dto })),
    approveSessionAction: vi.fn((sessionId, dto) => ({ sessionId, action: 'approve', ...dto })),
    rejectSessionAction: vi.fn((sessionId, dto) => ({ sessionId, action: 'reject', ...dto })),
    confirmLearning: vi.fn((sessionId, dto) => ({ sessionId, ...dto })),
    recoverSession: vi.fn(sessionId => ({ sessionId, recovered: true })),
    recoverSessionToCheckpoint: vi.fn(dto => ({ id: dto.sessionId, recovered: true })),
    cancelSession: vi.fn((sessionId, dto) => ({ sessionId, cancelled: true, ...dto })),
    subscribeSession: vi.fn(() => vi.fn())
  }) as unknown as RuntimeSessionService;

export const createCapabilityIntentService = () =>
  ({ tryHandle: vi.fn(async () => undefined) }) as unknown as ChatCapabilityIntentsService;

export const createRuntimeHost = () =>
  ({
    settings: {
      zhipuModels: { research: 'glm-5.1' },
      policy: { budget: { fallbackModelId: 'glm-5.1' } }
    },
    llmProvider: {
      isConfigured: vi.fn(() => true),
      streamText: vi.fn(async (_messages, _options, onToken) => {
        onToken('你');
        onToken('好');
        return '你好';
      })
    },
    platformRuntime: {
      agentDependencies: {
        resolveWorkflowPreset: vi.fn((goal: string) => ({
          preset: { id: /报表|bonusCenterData|data.?report/i.test(goal) ? 'data-report' : 'general' }
        }))
      }
    }
  }) as unknown as RuntimeHost;
