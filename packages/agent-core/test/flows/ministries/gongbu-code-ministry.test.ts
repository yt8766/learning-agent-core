import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, type ToolDefinition, type ToolExecutionResult } from '@agent/shared';

import { GongbuCodeMinistry } from '../../../src/flows/ministries/gongbu-code-ministry';
import { BingbuOpsMinistry } from '../../../src/flows/ministries/bingbu-ops-ministry';

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
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  supportsStreamingDispatch: true,
  permissionScope: 'readonly',
  inputSchema: {}
};

const WRITE_TOOL: ToolDefinition = {
  ...READ_TOOL,
  name: 'write_local_file',
  description: 'Write a local file.',
  category: 'action',
  riskLevel: 'high',
  requiresApproval: true,
  sandboxProfile: 'workspace-write',
  isReadOnly: false,
  isConcurrencySafe: false,
  supportsStreamingDispatch: false,
  permissionScope: 'workspace-write'
};

describe('GongbuCodeMinistry planning readonly guard', () => {
  it('keeps the currently selected tool path in planning mode', async () => {
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
      executionMode: 'plan',
      memoryRepository: {} as never,
      skillRegistry: {} as never,
      approvalService: {
        evaluate: vi.fn(() => ({ requiresApproval: false, reason: '', reasonCode: 'approved_by_policy' })),
        evaluateWithClassifier: vi.fn(async () => ({
          requiresApproval: false,
          reason: '',
          reasonCode: 'approved_by_policy'
        }))
      } as never,
      toolRegistry: {
        list: () => [READ_TOOL, WRITE_TOOL],
        get: (toolName: string) => [READ_TOOL, WRITE_TOOL].find(tool => tool.name === toolName),
        getForIntent: () => WRITE_TOOL
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

  it('turns watchdog-triggered execution into approval wait state', async () => {
    const execute = vi.fn(
      async (): Promise<ToolExecutionResult> => ({
        ok: false,
        outputSummary: 'Execution watchdog detected a stall while waiting for run_terminal.',
        errorMessage: 'watchdog_timeout',
        durationMs: 100,
        exitCode: 124
      })
    );
    const terminalTool: ToolDefinition = {
      ...WRITE_TOOL,
      name: 'run_terminal',
      family: 'mcp',
      capabilityType: 'mcp-capability'
    };
    const ministry = new GongbuCodeMinistry({
      taskId: 'task-2',
      goal: 'run a long terminal command',
      flow: 'chat',
      executionMode: 'execute',
      memoryRepository: {} as never,
      skillRegistry: {} as never,
      approvalService: {
        evaluateWithClassifier: vi.fn(async () => ({
          requiresApproval: false,
          reason: '',
          reasonCode: 'approved_by_policy'
        }))
      } as never,
      toolRegistry: {
        list: () => [terminalTool],
        get: (toolName: string) => [terminalTool].find(tool => tool.name === toolName),
        getForIntent: () => terminalTool
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

    const result = await ministry.execute('run the command', 'need terminal execution');

    expect(result.requiresApproval).toBe(true);
    expect(result.approvalReasonCode).toBe('watchdog_timeout');
  });

  it('bingbu prefers ops tools and rewrites watchdog summaries with ops wording', async () => {
    const execute = vi.fn(
      async (): Promise<ToolExecutionResult> => ({
        ok: false,
        outputSummary: 'Execution watchdog detected a stall while waiting for run_terminal.',
        errorMessage: 'watchdog_timeout',
        durationMs: 100,
        exitCode: 124
      })
    );
    const terminalTool: ToolDefinition = {
      ...WRITE_TOOL,
      name: 'run_terminal',
      family: 'mcp',
      capabilityType: 'mcp-capability'
    };
    const browseTool: ToolDefinition = {
      ...READ_TOOL,
      name: 'browse_page',
      family: 'knowledge',
      capabilityType: 'mcp-capability'
    };
    const ministry = new BingbuOpsMinistry({
      taskId: 'task-3',
      goal: 'inspect the runtime issue',
      flow: 'chat',
      executionMode: 'execute',
      memoryRepository: {} as never,
      skillRegistry: {} as never,
      approvalService: {
        evaluateWithClassifier: vi.fn(async () => ({
          requiresApproval: false,
          reason: '',
          reasonCode: 'approved_by_policy'
        }))
      } as never,
      toolRegistry: {
        list: () => [browseTool, terminalTool],
        get: (toolName: string) => [browseTool, terminalTool].find(tool => tool.name === toolName),
        getForIntent: () => browseTool
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
      },
      externalSources: [
        {
          sourceUrl: 'https://example.com/runtime'
        }
      ]
    } as never);

    const result = await ministry.execute('inspect runtime issue', 'check terminal and browser state');

    expect(result.toolName).toBe('run_terminal');
    expect(result.requiresApproval).toBe(true);
    expect(result.summary).toContain('兵部已暂停 run_terminal');
  });
});
