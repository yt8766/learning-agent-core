import type { AdapterMcpCapabilityDefinition } from '../mcp-skill-provider-adapter';

export function buildZhipuMcpCapabilities(): AdapterMcpCapabilityDefinition[] {
  return [
    {
      id: 'zhipu:webSearchPrime',
      toolName: 'webSearchPrime',
      serverId: 'zhipu-web-search-prime',
      displayName: 'Zhipu web search prime',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'open-web-search',
      writeScope: 'none'
    },
    {
      id: 'zhipu:webReader',
      toolName: 'webReader',
      serverId: 'zhipu-web-reader',
      displayName: 'Zhipu web reader',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'open-web-page',
      writeScope: 'none'
    },
    {
      id: 'zhipu:search_doc',
      toolName: 'search_doc',
      serverId: 'zhipu-zread',
      displayName: 'Zhipu ZRead search docs',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'public-github-repository',
      writeScope: 'none'
    },
    {
      id: 'zhipu:get_repo_structure',
      toolName: 'get_repo_structure',
      serverId: 'zhipu-zread',
      displayName: 'Zhipu ZRead repository structure',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'public-github-repository',
      writeScope: 'none'
    },
    {
      id: 'zhipu:read_file',
      toolName: 'read_file',
      serverId: 'zhipu-zread',
      displayName: 'Zhipu ZRead read file',
      riskLevel: 'medium',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'public-github-repository',
      writeScope: 'none'
    },
    {
      id: 'zhipu:image_analysis',
      toolName: 'image_analysis',
      serverId: 'zhipu-vision',
      displayName: 'Zhipu image analysis',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'local-or-remote-image',
      writeScope: 'none'
    },
    {
      id: 'zhipu:ui_diff_check',
      toolName: 'ui_diff_check',
      serverId: 'zhipu-vision',
      displayName: 'Zhipu UI diff check',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'local-ui-screenshot',
      writeScope: 'none'
    },
    {
      id: 'zhipu:video_analysis',
      toolName: 'video_analysis',
      serverId: 'zhipu-vision',
      displayName: 'Zhipu video analysis',
      riskLevel: 'medium',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'local-or-remote-video',
      writeScope: 'none'
    }
  ];
}
