import { describe, expect, it, vi } from 'vitest';

import { createPlatformWorkflowRegistry } from '../src';

describe('createPlatformWorkflowRegistry', () => {
  it('lists descriptors and dispatches workflow execution through registered executors', async () => {
    const executor = vi.fn().mockResolvedValue({
      workflowId: 'company-live',
      status: 'succeeded',
      output: { ok: true },
      trace: []
    });
    const registry = createPlatformWorkflowRegistry([
      {
        descriptor: {
          id: 'company-live',
          displayName: 'Company Live',
          agentIds: ['official.company-live']
        },
        execute: executor
      }
    ]);

    expect(registry.listWorkflows()).toEqual([
      {
        id: 'company-live',
        displayName: 'Company Live',
        agentIds: ['official.company-live']
      }
    ]);

    const onStage = vi.fn();
    await expect(
      registry.executeWorkflow({
        workflowId: 'company-live',
        input: { briefId: 'brief-1' },
        onStage
      })
    ).resolves.toMatchObject({
      workflowId: 'company-live',
      status: 'succeeded',
      output: { ok: true }
    });
    expect(executor).toHaveBeenCalledWith({
      workflowId: 'company-live',
      input: { briefId: 'brief-1' },
      onStage
    });
  });

  it('rejects unknown workflow ids with a stable error message', async () => {
    const registry = createPlatformWorkflowRegistry();

    await expect(
      registry.executeWorkflow({
        workflowId: 'missing-workflow',
        input: {}
      })
    ).rejects.toThrow('Unknown workflowId: missing-workflow');
  });
});
