import { ActionIntent, ToolDefinition } from '@agent/shared';

const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: 'search_memory',
    description: 'Search shared long-term memory for relevant records.',
    category: 'memory',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'memory-readonly',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } }
  },
  {
    name: 'read_local_file',
    description: 'Read a local file inside the workspace.',
    category: 'system',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
  },
  {
    name: 'list_directory',
    description: 'List files and folders inside the workspace.',
    category: 'system',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
  },
  {
    name: 'write_local_file',
    description: 'Write a file inside the workspace after human approval.',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-write',
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }
  },
  {
    name: 'http_request',
    description: 'Perform an external request after human approval.',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 10000,
    sandboxProfile: 'network-restricted',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, method: { type: 'string' } } }
  },
  {
    name: 'local-analysis',
    description: 'Run a safe local analysis summary for the current goal.',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 5000,
    sandboxProfile: 'workspace-readonly',
    inputSchema: { type: 'object', properties: { goal: { type: 'string' }, researchSummary: { type: 'string' } } }
  },
  {
    name: 'find-skills',
    description: 'Discover installed, local, and cached remote skills that match the current goal.',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'workspace-readonly',
    inputSchema: { type: 'object', properties: { goal: { type: 'string' }, limit: { type: 'number' } } }
  },
  {
    name: 'collect_research_source',
    description: 'Collect a structured summary from an approved research source.',
    category: 'knowledge',
    riskLevel: 'low',
    requiresApproval: false,
    timeoutMs: 8000,
    sandboxProfile: 'research-readonly',
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
    name: 'browse_page',
    description: 'Open and inspect a target page through a browser automation MCP capability.',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 15000,
    sandboxProfile: 'browser-automation',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, goal: { type: 'string' } } }
  },
  {
    name: 'run_terminal',
    description: 'Execute a controlled terminal command inside the sandboxed environment.',
    category: 'action',
    riskLevel: 'high',
    requiresApproval: true,
    timeoutMs: 15000,
    sandboxProfile: 'workspace-write',
    inputSchema: { type: 'object', properties: { command: { type: 'string' }, goal: { type: 'string' } } }
  },
  {
    name: 'ship_release',
    description: 'Prepare or simulate a release workflow through the release MCP capability.',
    category: 'action',
    riskLevel: 'critical',
    requiresApproval: true,
    timeoutMs: 20000,
    sandboxProfile: 'release-ops',
    inputSchema: { type: 'object', properties: { target: { type: 'string' }, goal: { type: 'string' } } }
  }
];

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(seedTools: ToolDefinition[] = DEFAULT_TOOLS) {
    for (const tool of seedTools) {
      this.register(tool);
    }
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  getForIntent(intent: ActionIntent): ToolDefinition | undefined {
    switch (intent) {
      case ActionIntent.WRITE_FILE:
        return this.get('write_local_file');
      case ActionIntent.CALL_EXTERNAL_API:
        return this.get('http_request');
      default:
        return this.get('read_local_file');
    }
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry(DEFAULT_TOOLS);
}
