import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, type ToolDefinition, type ToolExecutionResult } from '@agent/shared';

import { GongbuCodeMinistry } from '../../../src/flows/ministries/gongbu-code-ministry';

// Legacy executionMode aliases remain valid inputs here; runtime behavior is still canonical executionPlan.mode = plan.
const READ_TOOL: ToolDefinition = {
  name: 'read_local_file',
  description: 'Read a local file.',
  family: 'filesystem',
  category: 'system',
  riskLevel: 'low',
  requiresApproval: false,
  timeoutMs: 1000,
  sandboxProfile: 'workspace-readonly',
  capabilityType: 'local-tool',
  inputSchema: {}
};

const WRITE_TOOL: ToolDefinition = {
  ...READ_TOOL,
  name: 'write_local_file',
  description: 'Write a local file.',
  category: 'action',
  riskLevel: 'high',
  requiresApproval: true,
  sandboxProfile: 'workspace-write'
};

describe('GongbuCodeMinistry planning readonly guard', () => {
  it('falls back to readonly tools when planning mode forbids writes', async () => {
    const execute = vi.fn(
      async (): Promise<ToolExecutionResult> => ({
        ok: true,
        outputSummary: 'read package.json',
        durationMs: 10
      })
    );
    const ministry = new GongbuCodeMinistry({
      taskId: 'task-1',
      goal: 'write file for the new plan',
      flow: 'chat',
      executionMode: 'planning-readonly',
      memoryRepository: {} as never,
      skillRegistry: {} as never,
      approvalService: {
        evaluate: vi.fn(() => ({ requiresApproval: false, reason: '', reasonCode: 'approved_by_policy' }))
      } as never,
      toolRegistry: {
        list: () => [READ_TOOL, WRITE_TOOL],
        get: (toolName: string) => [READ_TOOL, WRITE_TOOL].find(tool => tool.name === toolName),
        getForIntent: (intent: ActionIntent) => (intent === ActionIntent.WRITE_FILE ? WRITE_TOOL : READ_TOOL)
      } as never,
      sandbox: {
        execute
      } as never,
      llm: {
        isConfigured: () => false
      } as never,
      thinking: {
        manager: false,
        research: false,
        executor: false,
        reviewer: false
      }
    } as never);

    const result = await ministry.execute('write a file', 'need to inspect current project');

    expect(result.toolName).toBe('read_local_file');
    expect(result.requiresApproval).toBe(false);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'read_local_file'
      })
    );
  });
});
