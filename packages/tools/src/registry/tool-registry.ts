import { ActionIntent, type ToolDefinition, type ToolFamilyRecord } from '@agent/shared';

import { CONNECTOR_TOOL_DEFINITIONS } from '../connectors/connector-tool-definitions';
import { FILESYSTEM_TOOL_DEFINITIONS } from '../filesystem/filesystem-tool-definitions';
import { DEFAULT_TOOL_FAMILIES } from './tool-families';
import { RUNTIME_GOVERNANCE_TOOL_DEFINITIONS } from '../runtime-governance/runtime-governance-tool-definitions';
import { SCHEDULING_TOOL_DEFINITIONS } from '../scheduling/scheduling-tool-definitions';

const KNOWLEDGE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_memory',
    description: 'Search shared long-term memory for relevant records.',
    family: 'knowledge',
    category: 'memory',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'memory-readonly',
    ownerType: 'shared',
    bootstrap: true,
    preferredMinistries: ['hubu-search'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } }
  },
  {
    name: 'http_request',
    description: 'Perform an external request after human approval.',
    family: 'knowledge',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 10000,
    sandboxProfile: 'network-restricted',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search', 'bingbu-ops'],
    capabilityType: 'local-tool',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: false,
    supportsStreamingDispatch: false,
    permissionScope: 'external-side-effect',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, method: { type: 'string' } } }
  },
  {
    name: 'local-analysis',
    description: 'Run a safe local analysis summary for the current goal.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['libu-delivery', 'hubu-search'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: { type: 'object', properties: { goal: { type: 'string' }, researchSummary: { type: 'string' } } }
  },
  {
    name: 'find-skills',
    description: 'Discover installed, local, and cached remote skills that match the current goal.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['libu-governance', 'hubu-search'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: { type: 'object', properties: { goal: { type: 'string' }, limit: { type: 'number' } } }
  },
  {
    name: 'plan_data_report_structure',
    description:
      'Plan a structured data-report blueprint including pages, modules, services, types, and route targets.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        taskContext: { type: 'string' },
        baseDir: { type: 'string' }
      }
    }
  },
  {
    name: 'generate_data_report_scaffold',
    description: 'Generate a reusable data-report page scaffold with shared search, metrics, chart, and table modules.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        taskContext: { type: 'string' },
        baseDir: { type: 'string' }
      }
    }
  },
  {
    name: 'generate_data_report_module',
    description: 'Generate a single data-report module payload for component-level execution.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        taskContext: { type: 'string' },
        baseDir: { type: 'string' },
        moduleId: { type: 'string' }
      }
    }
  },
  {
    name: 'assemble_data_report_bundle',
    description: 'Assemble blueprint, module outputs, and shared files into a final readonly delivery manifest.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        blueprint: { type: 'object' },
        moduleResults: { type: 'array' },
        sharedFiles: { type: 'array' }
      }
    }
  },
  {
    name: 'generate_data_report_routes',
    description: 'Generate preview routes and App.tsx for data-report sandpack rendering.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        blueprint: { type: 'object' }
      }
    }
  },
  {
    name: 'write_data_report_bundle',
    description: 'Materialize an assembled data-report bundle into a workspace target root after approval.',
    family: 'knowledge',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: ['gongbu-code', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: false,
    supportsStreamingDispatch: false,
    permissionScope: 'workspace-write',
    inputSchema: {
      type: 'object',
      properties: {
        bundle: { type: 'object' },
        targetRoot: { type: 'string' }
      }
    }
  },
  {
    name: 'collect_research_source',
    description: 'Collect a structured summary from an approved research source.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'research-readonly',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        goal: { type: 'string' },
        trustClass: { type: 'string' },
        sourceType: { type: 'string' }
      }
    }
  },
  {
    name: 'webSearchPrime',
    description: 'Search the open web for recent, citation-friendly sources.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 10000,
    sandboxProfile: 'research-readonly',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, goal: { type: 'string' }, freshnessHint: { type: 'string' } }
    }
  },
  {
    name: 'webReader',
    description: 'Read and summarize a specific web page as a citation-friendly source.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 10000,
    sandboxProfile: 'research-readonly',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, goal: { type: 'string' } } }
  },
  {
    name: 'search_doc',
    description: 'Read repository or document sources with structured retrieval.',
    family: 'knowledge',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 10000,
    sandboxProfile: 'research-readonly',
    ownerType: 'shared',
    preferredMinistries: ['hubu-search', 'libu-delivery'],
    capabilityType: 'local-tool',
    isReadOnly: true,
    isConcurrencySafe: true,
    isDestructive: false,
    supportsStreamingDispatch: true,
    permissionScope: 'readonly',
    inputSchema: { type: 'object', properties: { repoUrl: { type: 'string' }, query: { type: 'string' } } }
  },
  {
    name: 'browse_page',
    description: 'Open and inspect a target page through a browser automation MCP capability.',
    family: 'mcp',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 15000,
    sandboxProfile: 'browser-automation',
    ownerType: 'shared',
    preferredMinistries: ['bingbu-ops', 'hubu-search'],
    capabilityType: 'mcp-capability',
    isReadOnly: true,
    isConcurrencySafe: false,
    isDestructive: false,
    supportsStreamingDispatch: false,
    permissionScope: 'external-side-effect',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, goal: { type: 'string' } } }
  },
  {
    name: 'run_terminal',
    description: 'Execute a controlled terminal command inside the sandboxed environment.',
    family: 'mcp',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 15000,
    sandboxProfile: 'workspace-write',
    ownerType: 'shared',
    preferredMinistries: ['bingbu-ops', 'gongbu-code'],
    capabilityType: 'mcp-capability',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: true,
    supportsStreamingDispatch: false,
    permissionScope: 'workspace-write',
    inputSchema: { type: 'object', properties: { command: { type: 'string' }, goal: { type: 'string' } } }
  },
  {
    name: 'ship_release',
    description: 'Prepare or simulate a release workflow through the release MCP capability.',
    family: 'mcp',
    category: 'action',
    riskLevel: 'critical',
    requiresApproval: true,
    timeoutMs: 20000,
    sandboxProfile: 'release-ops',
    ownerType: 'shared',
    preferredMinistries: ['bingbu-ops', 'xingbu-review'],
    capabilityType: 'mcp-capability',
    isReadOnly: false,
    isConcurrencySafe: false,
    isDestructive: true,
    supportsStreamingDispatch: false,
    permissionScope: 'governance',
    inputSchema: { type: 'object', properties: { target: { type: 'string' }, goal: { type: 'string' } } }
  }
];

export const DEFAULT_TOOLS: ToolDefinition[] = [
  ...KNOWLEDGE_TOOL_DEFINITIONS,
  ...FILESYSTEM_TOOL_DEFINITIONS,
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

  getForIntent(intent: ActionIntent): ToolDefinition | undefined {
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
