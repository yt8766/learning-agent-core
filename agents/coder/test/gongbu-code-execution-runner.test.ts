import { ActionIntent } from '@agent/core';
import { describe, expect, it, vi } from 'vitest';

import { executeGongbuToolRequest } from '../src/flows/ministries/gongbu-code/gongbu-code-execution-runner';

describe('gongbu code execution runner', () => {
  it('executes local filesystem tools through sandbox when they are not MCP capabilities', async () => {
    const mcpClientManager = {
      hasCapability: vi.fn(() => false),
      invokeCapability: vi.fn()
    };
    const sandbox = {
      execute: vi.fn(async () => ({
        ok: true,
        outputSummary: 'read from sandbox'
      }))
    };

    const result = await executeGongbuToolRequest(
      {
        taskId: 'task-1',
        mcpClientManager,
        sandbox
      } as never,
      {
        name: 'read_local_file'
      } as never,
      ActionIntent.READ_FILE,
      {
        path: 'README.md'
      }
    );

    expect(result).toMatchObject({ ok: true, outputSummary: 'read from sandbox' });
    expect(mcpClientManager.invokeCapability).not.toHaveBeenCalled();
    expect(sandbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'read_local_file',
        input: { path: 'README.md' }
      })
    );
  });
});
