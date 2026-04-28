import type { ToolDefinition } from '@agent/runtime';

const SCAFFOLD_PREFERRED_MINISTRIES = ['libu-governance', 'gongbu-code', 'libu-delivery'] as const;

export const SCAFFOLD_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_scaffold_templates',
    description: 'List available package and agent scaffold templates from the stable scaffold host.',
    family: 'scaffold',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: [...SCAFFOLD_PREFERRED_MINISTRIES],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        hostKind: { type: 'string' }
      }
    }
  },
  {
    name: 'preview_scaffold',
    description: 'Generate a structured scaffold preview bundle for a package or agent target.',
    family: 'scaffold',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: [...SCAFFOLD_PREFERRED_MINISTRIES],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        hostKind: { type: 'string' },
        name: { type: 'string' },
        templateId: { type: 'string' },
        targetRoot: { type: 'string' }
      }
    }
  },
  {
    name: 'write_scaffold',
    description: 'Write a scaffold bundle into the workspace after target inspection and approval.',
    family: 'scaffold',
    category: 'system',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 10000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: [...SCAFFOLD_PREFERRED_MINISTRIES],
    capabilityType: 'local-tool',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: false,
    supportsStreamingDispatch: false,
    permissionScope: 'workspace-write',
    inputSchema: {
      type: 'object',
      properties: {
        hostKind: { type: 'string' },
        name: { type: 'string' },
        templateId: { type: 'string' },
        targetRoot: { type: 'string' },
        force: { type: 'boolean' }
      }
    }
  }
];
