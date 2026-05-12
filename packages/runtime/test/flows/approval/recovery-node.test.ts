import { describe, expect, it, vi } from 'vitest';

import { executeApprovedAction, syncApprovedExecutorState } from '../../../src/flows/approval/recovery-node';

describe('recovery-node', () => {
  describe('executeApprovedAction', () => {
    it('calls sandbox.execute with merged toolInput and approved flag', async () => {
      const execute = vi.fn().mockResolvedValue({
        ok: true,
        outputSummary: 'file written',
        exitCode: 0,
        durationMs: 10
      });
      const context = { taskId: 't1', goal: 'write a file', sandbox: { execute } } as any;
      const pending = {
        taskId: 't1',
        intent: 'write_file',
        toolName: 'write_scaffold',
        researchSummary: 'pre-check done',
        goal: 'write a file',
        toolInput: { path: '/tmp/test.txt', content: 'hello' }
      } as any;

      const result = await executeApprovedAction(context, pending);

      expect(execute).toHaveBeenCalledWith({
        taskId: 't1',
        toolName: 'write_scaffold',
        intent: 'write_file',
        input: {
          path: '/tmp/test.txt',
          content: 'hello',
          goal: 'write a file',
          researchSummary: 'pre-check done',
          approved: true
        },
        requestedBy: 'agent'
      });
      expect(result).toEqual({ ok: true, outputSummary: 'file written', exitCode: 0, durationMs: 10 });
    });

    it('uses context.goal when pending.goal is undefined', async () => {
      const execute = vi.fn().mockResolvedValue({ ok: true, outputSummary: 'done' });
      const context = { taskId: 't1', goal: 'fallback-goal', sandbox: { execute } } as any;
      const pending = {
        taskId: 't1',
        intent: 'delete_file',
        toolName: 'rm',
        researchSummary: 'cleanup',
        toolInput: {}
      } as any;

      await executeApprovedAction(context, pending);

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ goal: 'fallback-goal' })
        })
      );
    });
  });

  describe('syncApprovedExecutorState', () => {
    it('updates executor state with execution result', () => {
      const executorState = {
        status: 'pending',
        subTask: '',
        plan: [],
        toolCalls: [],
        observations: [],
        shortTermMemory: [],
        finalOutput: ''
      };
      const executor = { getState: () => executorState } as any;
      const executionResult = {
        outputSummary: 'file created successfully',
        exitCode: 0,
        durationMs: 100
      } as any;
      const pending = {
        intent: 'write_file',
        toolName: 'write_scaffold',
        researchSummary: 'research done'
      } as any;

      const result = syncApprovedExecutorState(executor, executionResult, pending);

      expect(result.status).toBe('completed');
      expect(result.subTask).toBe('Execute the approved action');
      expect(result.plan).toEqual(['Receive human approval', 'Execute approved high-risk action']);
      expect(result.toolCalls).toEqual(['intent:write_file', 'tool:write_scaffold']);
      expect(result.observations).toEqual(['file created successfully']);
      expect(result.shortTermMemory).toEqual(['research done', 'file created successfully']);
      expect(result.finalOutput).toBe('file created successfully');
    });
  });
});
