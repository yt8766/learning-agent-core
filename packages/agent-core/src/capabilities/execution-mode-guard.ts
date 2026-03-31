import type { ExecutionMode, ToolDefinition } from '@agent/shared';
import { normalizeExecutionMode } from '@agent/shared';

// Legacy execution mode aliases are normalized into canonical executionPlan.mode values before guarding tools.
const PLANNING_READONLY_TOOL_NAMES = new Set([
  'search_memory',
  'local-analysis',
  'find-skills',
  'collect_research_source',
  'webSearchPrime',
  'webReader',
  'search_doc',
  'read_local_file',
  'list_directory',
  'glob_workspace',
  'search_in_files',
  'read_json'
]);

export function isToolAllowedInExecutionMode(tool: ToolDefinition, mode: ExecutionMode | undefined) {
  if (normalizeExecutionMode(mode) !== 'plan') {
    return true;
  }

  if (PLANNING_READONLY_TOOL_NAMES.has(tool.name)) {
    return true;
  }

  return !tool.requiresApproval && /readonly/i.test(tool.sandboxProfile);
}

export function filterToolsForExecutionMode<T extends ToolDefinition>(tools: T[], mode: ExecutionMode | undefined) {
  return tools.filter(tool => isToolAllowedInExecutionMode(tool, mode));
}
