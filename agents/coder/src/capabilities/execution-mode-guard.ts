import type { ExecutionMode, ToolDefinition } from '@agent/core';

export function isToolAllowedInExecutionMode(tool: ToolDefinition, mode: ExecutionMode | undefined) {
  if (normalizeExecutionMode(mode) !== 'plan') {
    return true;
  }

  if (tool.isReadOnly && tool.permissionScope === 'readonly') {
    return true;
  }

  return !tool.requiresApproval && tool.isReadOnly;
}

export function filterToolsForExecutionMode<T extends ToolDefinition>(tools: T[], mode: ExecutionMode | undefined) {
  return tools.filter(tool => isToolAllowedInExecutionMode(tool, mode));
}

function normalizeExecutionMode(mode?: string): 'plan' | 'execute' | 'imperial_direct' | undefined {
  if (!mode) {
    return undefined;
  }
  if (mode === 'planning-readonly') {
    return 'plan';
  }
  if (mode === 'standard') {
    return 'execute';
  }
  if (mode === 'plan' || mode === 'execute' || mode === 'imperial_direct') {
    return mode;
  }
  return undefined;
}
