import type { ToolDefinition } from '@agent/runtime';

export const KNOWLEDGE_TOOL_DEFINITIONS: ToolDefinition[] = [
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
  }
];
