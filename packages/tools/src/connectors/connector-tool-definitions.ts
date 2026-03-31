import type { ToolDefinition } from '@agent/shared';

export const CONNECTOR_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'create_connector_draft',
    description: 'Create a connector draft configuration for the current workspace.',
    family: 'connector-governance',
    category: 'action',
    riskLevel: 'medium',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'ministry-owned',
    ownerId: 'libu-governance',
    preferredMinistries: ['libu-governance', 'bingbu-ops'],
    capabilityType: 'governance-tool',
    inputSchema: { type: 'object', properties: { templateId: { type: 'string' }, displayName: { type: 'string' } } }
  },
  {
    name: 'update_connector_secret',
    description: 'Update a connector secret after approval.',
    family: 'connector-governance',
    category: 'action',
    riskLevel: 'critical',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'ministry-owned',
    ownerId: 'libu-governance',
    preferredMinistries: ['libu-governance', 'xingbu-review'],
    capabilityType: 'governance-tool',
    inputSchema: { type: 'object', properties: { connectorId: { type: 'string' }, secretRef: { type: 'string' } } }
  },
  {
    name: 'enable_connector',
    description: 'Enable a configured connector.',
    family: 'connector-governance',
    category: 'action',
    riskLevel: 'medium',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'ministry-owned',
    ownerId: 'libu-governance',
    preferredMinistries: ['libu-governance', 'bingbu-ops'],
    capabilityType: 'governance-tool',
    inputSchema: { type: 'object', properties: { connectorId: { type: 'string' } } }
  },
  {
    name: 'disable_connector',
    description: 'Disable a configured connector.',
    family: 'connector-governance',
    category: 'action',
    riskLevel: 'medium',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'ministry-owned',
    ownerId: 'libu-governance',
    preferredMinistries: ['libu-governance', 'bingbu-ops'],
    capabilityType: 'governance-tool',
    inputSchema: { type: 'object', properties: { connectorId: { type: 'string' } } }
  },
  {
    name: 'list_connectors',
    description: 'List configured and draft connectors.',
    family: 'connector-governance',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'ministry-owned',
    ownerId: 'libu-governance',
    preferredMinistries: ['libu-governance', 'bingbu-ops'],
    capabilityType: 'governance-tool',
    inputSchema: { type: 'object', properties: {} }
  }
];
