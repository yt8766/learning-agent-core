import { ActionIntent, type ToolDefinition, type ToolFamilyRecord } from '@agent/core';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

import { CONNECTOR_TOOL_DEFINITIONS } from '../definitions/connector-tool-definitions';
import { FILESYSTEM_TOOL_DEFINITIONS } from '../definitions/filesystem-tool-definitions';
import { KNOWLEDGE_TOOL_DEFINITIONS } from '../definitions/knowledge-tool-definitions';
import { RUNTIME_GOVERNANCE_TOOL_DEFINITIONS } from '../definitions/runtime-governance-tool-definitions';
import { SCAFFOLD_TOOL_DEFINITIONS } from '../scaffold/scaffold-tool-definitions';
import { SCHEDULING_TOOL_DEFINITIONS } from '../definitions/scheduling-tool-definitions';
import { DEFAULT_TOOL_FAMILIES } from './tool-families';

export const DEFAULT_TOOLS: ToolDefinition[] = [
  ...KNOWLEDGE_TOOL_DEFINITIONS,
  ...FILESYSTEM_TOOL_DEFINITIONS,
  ...SCAFFOLD_TOOL_DEFINITIONS,
  ...SCHEDULING_TOOL_DEFINITIONS,
  ...CONNECTOR_TOOL_DEFINITIONS,
  ...RUNTIME_GOVERNANCE_TOOL_DEFINITIONS
];

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly families = new Map<string, ToolFamilyRecord>();

  constructor(seedTools: ToolDefinition[] = DEFAULT_TOOLS, seedFamilies: ToolFamilyRecord[] = DEFAULT_TOOL_FAMILIES) {
    for (const family of seedFamilies) {
      this.registerFamily(family);
    }
    for (const tool of seedTools) {
      this.register(tool);
    }
  }

  register(tool: ToolDefinition): void {
    if (!this.families.has(tool.family)) {
      throw new Error(`Unknown tool family "${tool.family}" for tool "${tool.name}"`);
    }
    validateToolDefinition(tool);
    this.tools.set(tool.name, tool);
  }

  registerFamily(family: ToolFamilyRecord): void {
    this.families.set(family.id, family);
  }

  get(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  getFamily(familyId: string): ToolFamilyRecord | undefined {
    return this.families.get(familyId);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listFamilies(): ToolFamilyRecord[] {
    return Array.from(this.families.values());
  }

  listByFamily(familyId: string): ToolDefinition[] {
    return this.list().filter(tool => tool.family === familyId);
  }

  getForIntent(intent: ActionIntentValue): ToolDefinition | undefined {
    switch (intent) {
      case ActionIntent.WRITE_FILE:
        return this.get('write_local_file');
      case ActionIntent.DELETE_FILE:
        return this.get('delete_local_file');
      case ActionIntent.SCHEDULE_TASK:
        return this.get('schedule_task');
      case ActionIntent.CALL_EXTERNAL_API:
        return this.get('http_request');
      default:
        return this.get('read_local_file');
    }
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry(DEFAULT_TOOLS, DEFAULT_TOOL_FAMILIES);
}

function validateToolDefinition(tool: ToolDefinition): void {
  const requiredFlags: Array<
    keyof Pick<
      ToolDefinition,
      'isReadOnly' | 'isConcurrencySafe' | 'isDestructive' | 'supportsStreamingDispatch' | 'permissionScope'
    >
  > = ['isReadOnly', 'isConcurrencySafe', 'isDestructive', 'supportsStreamingDispatch', 'permissionScope'];
  for (const key of requiredFlags) {
    if (tool[key] === undefined) {
      throw new Error(`Tool "${tool.name}" is missing required semantic field "${key}"`);
    }
  }
}
