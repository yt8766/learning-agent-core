import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@agent/config', () => ({
  resolveActiveRoleModels: vi.fn(() => ({
    manager: 'manager-model',
    executor: 'executor-model',
    research: 'research-model',
    reviewer: 'reviewer-model'
  }))
}));

vi.mock('../../src/runtime/core/runtime-data-report-facade', () => ({
  DATA_REPORT_JSON_DEFAULT_MODEL_POLICY: {
    analysisNode: { primary: 'analysis-default' },
    schemaSpecNode: { primary: 'schema-default' }
  },
  executeDataReportJsonGraph: vi.fn(),
  executeReportBundleEditFlow: vi.fn(),
  executeReportBundleGenerateFlow: vi.fn()
}));

import { streamReportSchema } from '../../src/chat/chat-report-schema.helpers';
import { createRuntimeHost } from './chat.service.test-helpers';
import * as runtimeDataReportFacade from '../../src/runtime/core/runtime-data-report-facade';

const baseRuntimeMeta = {
  cacheHit: false,
  executionPath: 'llm' as const,
  llmAttempted: true,
  llmSucceeded: true,
  nodeDurations: {}
};

const primaryDocument = {
  version: '1.0',
  kind: 'data-report-json',
  meta: {
    reportId: 'bonusCenterData',
    title: 'Bonus Center',
    description: 'Bonus Center dashboard',
    route: '/bonus-center',
    templateRef: 'bonus-center',
    scope: 'single',
    layout: 'dashboard',
    owner: 'data-report-json-agent'
  },
  pageDefaults: {
    filters: {},
    queryPolicy: {
      autoQueryOnInit: true,
      autoQueryOnFilterChange: false,
      cacheKey: 'bonusCenterData'
    }
  },
  filterSchema: {
    formKey: 'bonusCenterFilters',
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
    supportedOperations: []
  },
  warnings: []
} as const;

describe('chat report schema helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not backfill bundle from a primary document when generate flow only returns upstream schema data', async () => {
    vi.mocked(runtimeDataReportFacade.executeReportBundleGenerateFlow).mockResolvedValueOnce({
      status: 'success',
      bundle: undefined,
      primaryDocument,
      error: undefined,
      reportSummaries: [{ reportKey: 'bonusCenterData', status: 'success' }],
      runtime: {
        executionPath: 'single-agent-generate',
        jsonRuntime: baseRuntimeMeta
      },
      content: 'generated',
      elapsedMs: 12
    } as never);

    const runtimeHost = createRuntimeHost();
    const events: Array<{ type: string; data?: Record<string, unknown> }> = [];

    const result = await streamReportSchema(
      runtimeHost,
      { message: '生成 Bonus Center 报表 JSON', responseFormat: 'report-schema' },
      event => events.push(event)
    );

    const readyEvent = events.find(event => event.type === 'schema_ready');

    expect(runtimeDataReportFacade.executeReportBundleGenerateFlow).toHaveBeenCalledTimes(1);
    expect(result.bundle).toBeUndefined();
    expect(result.schema).toBeUndefined();
    expect(readyEvent?.data).toEqual(
      expect.objectContaining({
        reportSummaries: [{ reportKey: 'bonusCenterData', status: 'success' }],
        runtime: baseRuntimeMeta
      })
    );
    expect(readyEvent?.data).not.toHaveProperty('bundle');
    expect(readyEvent?.data).not.toHaveProperty('schema');
  });

  it('does not fabricate a bundle for partial generate results', async () => {
    vi.mocked(runtimeDataReportFacade.executeReportBundleGenerateFlow).mockResolvedValueOnce({
      status: 'partial',
      bundle: undefined,
      primaryDocument: undefined,
      partialSchema: {
        meta: {
          reportId: 'bonusCenterData',
          title: 'Bonus Center'
        }
      },
      error: {
        errorCode: 'report_schema_generation_failed',
        errorMessage: 'provider exploded',
        retryable: true
      },
      reportSummaries: [{ reportKey: 'bonusCenterData', status: 'partial' }],
      runtime: {
        executionPath: 'single-agent-generate',
        jsonRuntime: baseRuntimeMeta
      },
      content: 'partial',
      elapsedMs: 18
    } as never);

    const runtimeHost = createRuntimeHost();
    const events: Array<{ type: string; data?: Record<string, unknown> }> = [];

    const result = await streamReportSchema(
      runtimeHost,
      { message: '生成 Bonus Center 报表 JSON', responseFormat: 'report-schema' },
      event => events.push(event)
    );

    const partialEvent = events.find(event => event.type === 'schema_partial');

    expect(runtimeDataReportFacade.executeReportBundleGenerateFlow).toHaveBeenCalledTimes(1);
    expect(result.bundle).toBeUndefined();
    expect(partialEvent?.data).toEqual(
      expect.objectContaining({
        schema: expect.objectContaining({
          meta: expect.objectContaining({
            reportId: 'bonusCenterData',
            title: 'Bonus Center'
          })
        }),
        error: {
          errorCode: 'report_schema_generation_failed',
          errorMessage: 'provider exploded',
          retryable: true
        },
        reportSummaries: [{ reportKey: 'bonusCenterData', status: 'partial' }],
        runtime: baseRuntimeMeta
      })
    );
    expect(partialEvent?.data).not.toHaveProperty('bundle');
  });
});
