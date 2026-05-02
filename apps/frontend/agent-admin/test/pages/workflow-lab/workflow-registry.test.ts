import { describe, expect, it } from 'vitest';

import { workflowRegistry } from '../../../src/pages/workflow-lab/registry/workflow.registry';

describe('workflowRegistry', () => {
  it('exposes a data-report-json workflow for admin-side report generation testing', () => {
    const workflow = workflowRegistry.find(item => item.id === 'data-report-json');

    expect(workflow).toBeDefined();
    expect(workflow?.name).toContain('报表');
    expect(workflow?.fields.map(field => field.name)).toEqual(
      expect.arrayContaining(['message', 'reportId', 'title', 'serviceKey'])
    );
    expect(workflow?.graph.nodes.map(node => node.id)).toEqual([
      'receive-request',
      'normalize-seed',
      'compile-report-bundle',
      'validate-contract',
      'persist-run'
    ]);
    expect(workflow?.graph.edges).toEqual([
      { from: 'receive-request', to: 'normalize-seed' },
      { from: 'normalize-seed', to: 'compile-report-bundle' },
      { from: 'compile-report-bundle', to: 'validate-contract' },
      { from: 'validate-contract', to: 'persist-run' }
    ]);
  });

  it('maps the data-report-json form values into the backend workflow payload contract', () => {
    const workflow = workflowRegistry.find(item => item.id === 'data-report-json');

    const payload = workflow?.mapFormToPayload({
      message: '生成奖金中心总览报表',
      reportId: 'bonus-center-overview',
      title: '奖金中心总览',
      serviceKey: 'bonusCenterService',
      route: '/bonus-center-overview'
    });

    expect(payload).toEqual({
      message: '生成奖金中心总览报表',
      projectId: 'agent-admin-workflow-lab',
      currentProjectPath: '/admin/workflow-lab',
      structuredSeed: {
        meta: {
          reportId: 'bonus-center-overview',
          title: '奖金中心总览',
          description: 'Workflow Lab generated report JSON test seed.',
          route: '/bonus-center-overview',
          templateRef: 'workflow-lab',
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
            title: '奖金中心总览',
            description: 'Workflow Lab report JSON smoke section.',
            dataSourceKey: 'main',
            metricsSpec: [
              {
                key: 'amount',
                label: '金额',
                field: 'amount',
                format: 'currency',
                aggregate: 'sum'
              }
            ],
            chartSpec: {
              title: '趋势',
              chartType: 'line',
              xField: 'date',
              series: [
                {
                  key: 'amount',
                  label: '金额',
                  field: 'amount',
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
                },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  width: 140
                }
              ]
            }
          }
        ]
      }
    });
  });
});
