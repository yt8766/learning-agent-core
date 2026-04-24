import { describe, expect, it } from 'vitest';

import type {
  DataReportJsonGenerateResult,
  DataReportJsonGraphState,
  DataReportJsonStructuredInput,
  LlmProviderMessage,
  ReportDocument
} from '@agent/core';

import {
  executeReportBundleGenerateFlow,
  type ReportBundleGenerateInput
} from '../src/flows/report-bundle/generate/runtime';

function buildStructuredSeed(): DataReportJsonStructuredInput {
  return {
    meta: {
      reportId: 'bonus-center-overview',
      title: 'Bonus Center Overview',
      description: 'Bonus center dashboard',
      route: '/bonus-center-overview',
      templateRef: 'bonus-center',
      scope: 'single',
      layout: 'dashboard'
    },
    filters: [],
    dataSources: [
      {
        key: 'main',
        serviceKey: 'bonusCenterService',
        requestAdapter: {
          orgId: 'orgId'
        },
        responseAdapter: {
          listPath: 'data.list',
          totalPath: 'data.total'
        }
      }
    ],
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        description: '核心概览',
        dataSourceKey: 'main',
        metricsSpec: [
          {
            key: 'revenue',
            label: '营收',
            field: 'revenue',
            format: 'number',
            aggregate: 'sum'
          }
        ],
        chartSpec: {
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
        tableSpec: {
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
      }
    ]
  };
}

function buildGeneratedSchema(): ReportDocument {
  return {
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
      formKey: 'bonus-center-overview-search',
      layout: 'inline',
      fields: []
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
      filterComponents: [],
      blockTypes: ['metrics', 'chart', 'table'],
      serviceKeys: ['bonusCenterService']
    },
    modification: {
      strategy: 'patchable-json',
      supportedOperations: ['update-filter-defaults', 'replace-section']
    },
    warnings: ['used-seed']
  };
}

describe('@agent/agents-data-report report bundle generate flow', () => {
  it('wraps a generated single-document schema into a report bundle and exposes the primary document projection', async () => {
    const calls: DataReportJsonGraphState[] = [];
    const input: ReportBundleGenerateInput = {
      messages: [
        {
          role: 'user',
          content: '请生成一个奖金中心总览报表。'
        }
      ],
      structuredSeed: buildStructuredSeed(),
      context: {
        projectId: 'project-1',
        currentProjectPath: '/workspace/gosh_admin_fe'
      }
    };

    const result = await executeReportBundleGenerateFlow(input, {
      executeJsonGraph: async state => {
        calls.push(state);

        return {
          status: 'success',
          schema: buildGeneratedSchema(),
          content: '{"status":"success"}',
          elapsedMs: 12,
          runtime: {
            cacheHit: false,
            executionPath: 'structured-fast-lane',
            llmAttempted: false,
            llmSucceeded: false,
            nodeDurations: {}
          }
        } satisfies DataReportJsonGenerateResult;
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.goal).toContain('USER: 请生成一个奖金中心总览报表。');
    expect(calls[0]?.goal).toContain('PROJECT_ID: project-1');
    expect(calls[0]?.goal).toContain('CURRENT_PROJECT_PATH: /workspace/gosh_admin_fe');
    expect(calls[0]?.reportSchemaInput).toEqual(buildStructuredSeed());

    expect(result.status).toBe('success');
    expect(result.bundle).toMatchObject({
      version: 'report-bundle.v1',
      kind: 'report-bundle',
      meta: {
        bundleId: 'bonus-center-overview',
        title: 'Bonus Center Overview',
        mode: 'single-document'
      }
    });
    expect(result.bundle?.documents).toHaveLength(1);
    expect(result.bundle?.warnings).toEqual(['used-seed']);
    expect(result.primaryDocument?.meta.reportId).toBe('bonus-center-overview');
    expect(result.runtime.executionPath).toBe('single-agent-generate');
    expect(result.runtime.jsonRuntime?.executionPath).toBe('structured-fast-lane');
  });

  it('passes through failed json generation results without inventing a bundle', async () => {
    const input: ReportBundleGenerateInput = {
      messages: [
        {
          role: 'user',
          content: '请生成一个失败用例。'
        }
      ]
    };

    const result = await executeReportBundleGenerateFlow(input, {
      executeJsonGraph: async () =>
        ({
          status: 'failed',
          content: '{"status":"failed"}',
          elapsedMs: 7,
          error: {
            errorCode: 'report_schema_generation_failed',
            errorMessage: 'llm failed',
            retryable: true
          }
        }) satisfies DataReportJsonGenerateResult
    });

    expect(result.status).toBe('failed');
    expect(result.bundle).toBeUndefined();
    expect(result.primaryDocument).toBeUndefined();
    expect(result.content).toBe('{"status":"failed"}');
    expect(result.error?.errorMessage).toBe('llm failed');
  });

  it('rejects empty message input before calling the wrapped json runtime', async () => {
    await expect(
      executeReportBundleGenerateFlow(
        {
          messages: [] as LlmProviderMessage[]
        },
        {
          executeJsonGraph: async () => {
            throw new Error('should not be reached');
          }
        }
      )
    ).rejects.toThrow(/at least one message/i);
  });
});
