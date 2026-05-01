import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeReportBundleGenerateFlow } from '../../src/runtime/core/runtime-data-report-facade';
import { RuntimeCompanyLiveFacade } from '../../src/runtime/core/runtime-company-live-facade';
import { RuntimeWorkflowExecutionFacade } from '../../src/runtime/core/runtime-workflow-execution-facade';
import { WorkflowDispatcher } from '../../src/workflow-runs/workflow-dispatcher';

vi.mock('../../src/runtime/core/runtime-data-report-facade', () => ({
  executeReportBundleGenerateFlow: vi.fn()
}));

const executeReportBundleGenerateFlowMock = vi.mocked(executeReportBundleGenerateFlow);

describe('WorkflowDispatcher data-report-json workflow', () => {
  beforeEach(() => {
    executeReportBundleGenerateFlowMock.mockReset();
  });

  it('dispatches admin workflow lab report JSON runs through the report bundle generate flow', async () => {
    executeReportBundleGenerateFlowMock.mockResolvedValue({
      status: 'success',
      content: '{"version":"report-bundle.v1"}',
      elapsedMs: 18,
      runtime: {
        executionPath: 'single-agent-generate',
        jsonRuntime: {
          cacheHit: false,
          executionPath: 'structured-fast-lane',
          llmAttempted: false,
          llmSucceeded: false,
          nodeDurations: {
            analysisNode: 4,
            validateNode: 2
          }
        }
      },
      bundle: {
        version: 'report-bundle.v1',
        kind: 'report-bundle',
        meta: {
          bundleId: 'bonus-center-overview',
          title: '奖金中心总览',
          mode: 'single-document'
        },
        documents: []
      }
    });

    const onNodeComplete = vi.fn();
    const dispatcher = new WorkflowDispatcher(new RuntimeWorkflowExecutionFacade({} as RuntimeCompanyLiveFacade));

    const result = await dispatcher.dispatch(
      'data-report-json',
      {
        message: '生成奖金中心总览报表',
        projectId: 'agent-admin-workflow-lab',
        currentProjectPath: '/admin/workflow-lab',
        structuredSeed: {
          meta: {
            reportId: 'bonus-center-overview',
            title: '奖金中心总览',
            route: '/bonus-center-overview',
            scope: 'single',
            layout: 'dashboard'
          },
          filters: [],
          dataSources: [],
          sections: []
        }
      },
      onNodeComplete
    );

    expect(executeReportBundleGenerateFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: '生成奖金中心总览报表'
          }
        ],
        structuredSeed: expect.objectContaining({
          meta: expect.objectContaining({
            reportId: 'bonus-center-overview'
          })
        }),
        context: {
          projectId: 'agent-admin-workflow-lab',
          currentProjectPath: '/admin/workflow-lab'
        },
        disableCache: true
      }),
      expect.any(Object)
    );
    expect(onNodeComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'analysisNode',
        status: 'succeeded',
        durationMs: expect.any(Number),
        inputSnapshot: expect.objectContaining({
          workflowId: 'data-report-json'
        }),
        outputSnapshot: expect.objectContaining({
          status: 'success'
        })
      })
    );
    expect(result.trace.map(trace => trace.nodeId)).toEqual(['analysisNode', 'validateNode']);
  });

  it('lists data-report-json as an admin workflow lab workflow', () => {
    expect(
      new WorkflowDispatcher(new RuntimeWorkflowExecutionFacade({} as RuntimeCompanyLiveFacade)).listWorkflowIds()
    ).toContain('data-report-json');
  });
});
