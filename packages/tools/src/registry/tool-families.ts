import type { ToolFamilyRecord } from '@agent/runtime';

export const DEFAULT_TOOL_FAMILIES: ToolFamilyRecord[] = [
  {
    id: 'knowledge',
    displayName: 'Knowledge Tools',
    description: 'Memory, research, and source retrieval helpers.',
    capabilityType: 'local-tool',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['hubu-search', 'libu-delivery']
  },
  {
    id: 'filesystem',
    displayName: 'Filesystem Tools',
    description: 'Workspace file read, write, patch, search, and traversal tools.',
    capabilityType: 'local-tool',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['gongbu-code', 'bingbu-ops']
  },
  {
    id: 'scaffold',
    displayName: 'Scaffold Tools',
    description: 'Template-driven packages/* and agents/* scaffold generation helpers.',
    capabilityType: 'local-tool',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['libu-governance', 'gongbu-code', 'libu-delivery']
  },
  {
    id: 'scheduling',
    displayName: 'Scheduling Tools',
    description: 'Runtime task scheduling and lifecycle management tools.',
    capabilityType: 'governance-tool',
    ownerType: 'ministry-owned',
    ownerId: 'bingbu-ops',
    preferredMinistries: ['bingbu-ops']
  },
  {
    id: 'runtime-governance',
    displayName: 'Runtime Governance Tools',
    description: 'Approval, archive, recover, and runtime artifact governance tools.',
    capabilityType: 'governance-tool',
    ownerType: 'ministry-owned',
    ownerId: 'bingbu-ops',
    preferredMinistries: ['bingbu-ops', 'xingbu-review']
  },
  {
    id: 'connector-governance',
    displayName: 'Connector Governance Tools',
    description: 'Connector drafts, secrets, enablement, and health operations.',
    capabilityType: 'governance-tool',
    ownerType: 'ministry-owned',
    ownerId: 'libu-governance',
    preferredMinistries: ['libu-governance', 'bingbu-ops']
  },
  {
    id: 'mcp',
    displayName: 'MCP Capabilities',
    description: 'Transport-backed MCP capabilities exposed through runtime governance.',
    capabilityType: 'mcp-capability',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search', 'bingbu-ops', 'gongbu-code']
  }
];
