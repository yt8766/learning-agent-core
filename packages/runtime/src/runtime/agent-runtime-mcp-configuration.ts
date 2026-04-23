import type { RuntimeSettings } from '@agent/config';
import type { McpCapabilityRegistry, McpServerRegistry } from '@agent/tools';

export interface McpConfigurationDeps {
  settings: RuntimeSettings;
  mcpServerRegistry: McpServerRegistry;
  mcpCapabilityRegistry: McpCapabilityRegistry;
}

export function registerBuiltinMcpServers(deps: McpConfigurationDeps): void {
  const { settings, mcpServerRegistry, mcpCapabilityRegistry } = deps;

  mcpServerRegistry.register({
    id: 'local-workspace',
    displayName: '本地工作区 MCP 兼容适配器',
    transport: 'local-adapter',
    enabled: true,
    source: 'workspace',
    trustClass: 'internal',
    dataScope: 'workspace files and local runtime data',
    writeScope: 'local workspace actions',
    installationMode: 'builtin',
    allowedProfiles: ['platform', 'company', 'personal', 'cli']
  });

  if (settings.mcp.bigmodelApiKey) {
    const authHeaders = {
      Authorization: `Bearer ${settings.mcp.bigmodelApiKey}`
    };
    mcpServerRegistry.register({
      id: 'bigmodel-web-search',
      displayName: 'BigModel Web Search MCP',
      transport: 'http',
      endpoint: settings.mcp.webSearchEndpoint,
      headers: authHeaders,
      enabled: true,
      source: 'bigmodel-official',
      trustClass: 'official',
      dataScope: 'open web search results',
      writeScope: 'none',
      installationMode: 'builtin',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
    mcpServerRegistry.register({
      id: 'bigmodel-web-reader',
      displayName: 'BigModel Web Reader MCP',
      transport: 'http',
      endpoint: settings.mcp.webReaderEndpoint,
      headers: authHeaders,
      enabled: true,
      source: 'bigmodel-official',
      trustClass: 'official',
      dataScope: 'open web document content',
      writeScope: 'none',
      installationMode: 'builtin',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
    mcpServerRegistry.register({
      id: 'bigmodel-zread',
      displayName: 'BigModel ZRead MCP',
      transport: 'http',
      endpoint: settings.mcp.zreadEndpoint,
      headers: authHeaders,
      enabled: true,
      source: 'bigmodel-official',
      trustClass: 'official',
      dataScope: 'repository and document retrieval',
      writeScope: 'none',
      installationMode: 'builtin',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
    mcpServerRegistry.register({
      id: 'bigmodel-vision',
      displayName: 'BigModel Vision MCP',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@z_ai/mcp-server@latest'],
      env: {
        Z_AI_API_KEY: settings.mcp.bigmodelApiKey,
        Z_AI_MODE: settings.mcp.visionMode
      },
      enabled: true,
      source: 'bigmodel-official',
      trustClass: 'official',
      dataScope: 'images and UI snapshots',
      writeScope: 'artifact generation only',
      installationMode: 'configured',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
    mcpCapabilityRegistry.register({
      id: 'webSearchPrime',
      toolName: 'webSearchPrime',
      serverId: 'bigmodel-web-search',
      displayName: 'Web Search Prime',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'open web search results',
      writeScope: 'none'
    });
    mcpCapabilityRegistry.register({
      id: 'webReader',
      toolName: 'webReader',
      serverId: 'bigmodel-web-reader',
      displayName: 'Web Reader',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'web page content',
      writeScope: 'none'
    });
    mcpCapabilityRegistry.register({
      id: 'search_doc',
      toolName: 'search_doc',
      serverId: 'bigmodel-zread',
      displayName: 'ZRead Search Doc',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'remote docs and repositories',
      writeScope: 'none'
    });
    mcpCapabilityRegistry.register({
      id: 'get_repo_structure',
      toolName: 'get_repo_structure',
      serverId: 'bigmodel-zread',
      displayName: 'ZRead Repo Structure',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'repository structure metadata',
      writeScope: 'none'
    });
    mcpCapabilityRegistry.register({
      id: 'read_file',
      toolName: 'read_file',
      serverId: 'bigmodel-zread',
      displayName: 'ZRead Read File',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'repository file content',
      writeScope: 'none'
    });
    mcpCapabilityRegistry.register({
      id: 'ui_to_artifact',
      toolName: 'ui_to_artifact',
      serverId: 'bigmodel-vision',
      displayName: 'Vision UI To Artifact',
      riskLevel: 'medium',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'uploaded UI screenshots',
      writeScope: 'artifact generation'
    });
    mcpCapabilityRegistry.register({
      id: 'image_analysis',
      toolName: 'image_analysis',
      serverId: 'bigmodel-vision',
      displayName: 'Vision Image Analysis',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'uploaded images',
      writeScope: 'none'
    });
    mcpCapabilityRegistry.register({
      id: 'ui_diff_check',
      toolName: 'ui_diff_check',
      serverId: 'bigmodel-vision',
      displayName: 'Vision UI Diff Check',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'UI snapshots and diffs',
      writeScope: 'none'
    });
  }

  if (settings.mcp.researchHttpEndpoint) {
    mcpServerRegistry.register({
      id: 'remote-research',
      displayName: 'Remote Research MCP',
      transport: 'http',
      endpoint: settings.mcp.researchHttpEndpoint,
      headers: settings.mcp.researchHttpApiKey
        ? { Authorization: `Bearer ${settings.mcp.researchHttpApiKey}` }
        : undefined,
      enabled: true,
      source: 'workspace-configured',
      trustClass: 'curated',
      dataScope: 'controlled research summaries',
      writeScope: 'none',
      installationMode: 'configured',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
    mcpCapabilityRegistry.register({
      id: 'collect_research_source',
      toolName: 'collect_research_source',
      serverId: 'remote-research',
      displayName: 'Collect research source',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'research source summaries',
      writeScope: 'none'
    });
  }

  mcpServerRegistry.register({
    id: 'github-mcp-template',
    displayName: 'GitHub MCP Template',
    transport: 'stdio',
    enabled: false,
    source: 'github-official-template',
    trustClass: 'official',
    dataScope: 'repos, issues, pull requests, workflows',
    writeScope: 'repository operations after approval',
    installationMode: 'configured',
    allowedProfiles: ['platform', 'company', 'personal', 'cli']
  });
  mcpServerRegistry.register({
    id: 'browser-mcp-template',
    displayName: 'Browser MCP Template',
    transport: 'http',
    enabled: false,
    source: 'browserbase-playwright-template',
    trustClass: 'official',
    dataScope: 'browser sessions, screenshots, extracted DOM data',
    writeScope: 'browser actions after approval',
    installationMode: 'configured',
    allowedProfiles: ['platform', 'company', 'personal', 'cli']
  });
}
