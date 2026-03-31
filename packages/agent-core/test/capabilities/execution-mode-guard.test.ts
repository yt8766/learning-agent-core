import { describe, expect, it } from 'vitest';

import type { ToolDefinition } from '@agent/shared';

import { filterToolsForExecutionMode, isToolAllowedInExecutionMode } from '../../src/capabilities/execution-mode-guard';

// Legacy aliases remain valid test inputs, but canonical assertions are expressed through executionPlan.mode semantics.
const READ_TOOL: ToolDefinition = {
  name: 'read_local_file',
  description: 'read',
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
  category: 'action',
  riskLevel: 'high',
  requiresApproval: true,
  sandboxProfile: 'workspace-write'
};

describe('execution-mode-guard', () => {
  it('blocks write tools in planning-readonly mode', () => {
    expect(isToolAllowedInExecutionMode(READ_TOOL, 'plan')).toBe(true);
    expect(isToolAllowedInExecutionMode(WRITE_TOOL, 'plan')).toBe(false);
    expect(isToolAllowedInExecutionMode(READ_TOOL, 'planning-readonly')).toBe(true);
    expect(isToolAllowedInExecutionMode(WRITE_TOOL, 'planning-readonly')).toBe(false);
  });

  it('filters candidates down to readonly planning tools', () => {
    expect(filterToolsForExecutionMode([READ_TOOL, WRITE_TOOL], 'planning-readonly').map(item => item.name)).toEqual([
      'read_local_file'
    ]);
  });
});
