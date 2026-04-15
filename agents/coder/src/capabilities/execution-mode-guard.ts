import type { ExecutionMode, ToolDefinition } from '@agent/shared';
import { normalizeExecutionMode } from '@agent/shared';

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
