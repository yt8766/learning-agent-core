import { describe, expect, it, vi } from 'vitest';

import { RuntimeWorkflowExecutionFacade } from '../../src/runtime/core/runtime-workflow-execution-facade';
import { WorkflowDispatcher } from '../../src/workflow-runs/workflow-dispatcher';

describe('WorkflowDispatcher company-live workflow', () => {
  it('dispatches company-live through the backend workflow execution facade', async () => {
    const facade = {
      executeWorkflow: vi.fn().mockResolvedValue({
        bundle: { sourceBriefId: 'wf-facade-test' },
        trace: [{ nodeId: 'media-bundle', status: 'succeeded', durationMs: 3 }]
      })
    } as unknown as RuntimeWorkflowExecutionFacade;
    const dispatcher = new WorkflowDispatcher(facade);
    const onNodeComplete = vi.fn();

    const result = await dispatcher.dispatch(
      'company-live',
      {
        briefId: 'wf-facade-test',
        targetPlatform: 'douyin'
      },
      onNodeComplete
    );

    expect(facade.executeWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'company-live',
        input: {
          briefId: 'wf-facade-test',
          targetPlatform: 'douyin'
        },
        onStage: expect.any(Function)
      })
    );
    expect(result).toMatchObject({
      bundle: { sourceBriefId: 'wf-facade-test' }
    });
  });
});
