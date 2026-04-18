import type { ToolDefinition } from '@agent/core';

export const SCHEDULING_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'schedule_task',
    description: 'Create or update a local runtime schedule definition after human approval.',
    family: 'scheduling',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'ministry-owned',
    ownerId: 'bingbu-ops',
    preferredMinistries: ['bingbu-ops'],
    capabilityType: 'governance-tool',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: false,
    supportsStreamingDispatch: false,
    permissionScope: 'governance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        prompt: { type: 'string' },
        schedule: { type: 'string' },
        status: { type: 'string' },
        cwd: { type: 'string' }
      }
    }
  },
  {
    name: 'list_scheduled_tasks',
    description: 'List local runtime schedules.',
    family: 'scheduling',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'ministry-owned',
    ownerId: 'bingbu-ops',
    preferredMinistries: ['bingbu-ops'],
    capabilityType: 'governance-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'cancel_scheduled_task',
    description: 'Disable a local runtime schedule after approval.',
    family: 'scheduling',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'ministry-owned',
    ownerId: 'bingbu-ops',
    preferredMinistries: ['bingbu-ops'],
    capabilityType: 'governance-tool',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: true,
    supportsStreamingDispatch: false,
    permissionScope: 'governance',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } }
  }
];
