import type { ToolDefinition } from '@agent/shared';

const filesystemSchemaPath = { type: 'string' };

export const FILESYSTEM_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_local_file',
    description: 'Read a local file inside the workspace.',
    family: 'filesystem',
    category: 'system',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['gongbu-code', 'hubu-search'],
    capabilityType: 'local-tool',
    inputSchema: { type: 'object', properties: { path: filesystemSchemaPath } }
  },
  {
    name: 'list_directory',
    description: 'List files and folders inside the workspace.',
    family: 'filesystem',
    category: 'system',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['gongbu-code', 'hubu-search'],
    capabilityType: 'local-tool',
    inputSchema: { type: 'object', properties: { path: filesystemSchemaPath } }
  },
  {
    name: 'write_local_file',
    description: 'Write a file inside the workspace after human approval.',
    family: 'filesystem',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: { path: filesystemSchemaPath, content: { type: 'string' } }
    }
  },
  {
    name: 'delete_local_file',
    description: 'Delete a file or folder inside the workspace after human approval.',
    family: 'filesystem',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['gongbu-code', 'bingbu-ops'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: { path: filesystemSchemaPath, recursive: { type: 'boolean' } }
    }
  },
  {
    name: 'move_local_file',
    description: 'Move or rename a file inside the workspace.',
    family: 'filesystem',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: { fromPath: filesystemSchemaPath, toPath: filesystemSchemaPath }
    }
  },
  {
    name: 'copy_local_file',
    description: 'Copy a file inside the workspace.',
    family: 'filesystem',
    category: 'action',
    riskLevel: 'medium',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: { fromPath: filesystemSchemaPath, toPath: filesystemSchemaPath }
    }
  },
  {
    name: 'patch_local_file',
    description: 'Apply a targeted text patch to a workspace file.',
    family: 'filesystem',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: {
        path: filesystemSchemaPath,
        search: { type: 'string' },
        replace: { type: 'string' },
        all: { type: 'boolean' }
      }
    }
  },
  {
    name: 'glob_workspace',
    description: 'List workspace files matching a glob-like pattern.',
    family: 'filesystem',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search', 'gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: { pattern: { type: 'string' }, basePath: filesystemSchemaPath, limit: { type: 'number' } }
    }
  },
  {
    name: 'search_in_files',
    description: 'Search for text inside workspace files.',
    family: 'filesystem',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search', 'gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        basePath: filesystemSchemaPath,
        filePattern: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'read_json',
    description: 'Read and parse a JSON file inside the workspace.',
    family: 'filesystem',
    category: 'system',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'hubu-search'],
    capabilityType: 'local-tool',
    inputSchema: { type: 'object', properties: { path: filesystemSchemaPath } }
  },
  {
    name: 'write_json',
    description: 'Write a JSON file inside the workspace after approval.',
    family: 'filesystem',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code'],
    capabilityType: 'local-tool',
    inputSchema: {
      type: 'object',
      properties: { path: filesystemSchemaPath, value: { type: 'object' }, spacing: { type: 'number' } }
    }
  }
];
