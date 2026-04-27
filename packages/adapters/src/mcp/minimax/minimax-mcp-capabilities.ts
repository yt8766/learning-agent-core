import type { AdapterMcpCapabilityDefinition } from '../mcp-skill-provider-adapter';

const MINIMAX_SERVER_ID = 'minimax-mcp';
const MINIMAX_TOKEN_PLAN_SERVER_ID = 'minimax-token-plan-mcp';

export function buildMiniMaxMcpCapabilities(
  serverId = MINIMAX_SERVER_ID,
  tokenPlanServerId = MINIMAX_TOKEN_PLAN_SERVER_ID
): AdapterMcpCapabilityDefinition[] {
  return [
    {
      id: 'minimax:text_to_audio',
      toolName: 'text_to_audio',
      serverId,
      displayName: 'MiniMax text to audio',
      riskLevel: 'medium',
      requiresApproval: true,
      category: 'action',
      dataScope: 'prompt-and-audio-generation',
      writeScope: 'external-billing-and-content-generation'
    },
    {
      id: 'minimax:list_voices',
      toolName: 'list_voices',
      serverId,
      displayName: 'MiniMax list voices',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'voice-catalog',
      writeScope: 'none'
    },
    {
      id: 'minimax:voice_clone',
      toolName: 'voice_clone',
      serverId,
      displayName: 'MiniMax voice clone',
      riskLevel: 'critical',
      requiresApproval: true,
      category: 'action',
      dataScope: 'voice-biometric-sample',
      writeScope: 'external-billing-and-content-generation'
    },
    {
      id: 'minimax:generate_video',
      toolName: 'generate_video',
      serverId,
      displayName: 'MiniMax generate video',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action',
      dataScope: 'prompt-and-media-generation',
      writeScope: 'external-billing-and-content-generation'
    },
    {
      id: 'minimax:text_to_image',
      toolName: 'text_to_image',
      serverId,
      displayName: 'MiniMax text to image',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action',
      dataScope: 'prompt-and-media-generation',
      writeScope: 'external-billing-and-content-generation'
    },
    {
      id: 'minimax:query_video_generation',
      toolName: 'query_video_generation',
      serverId,
      displayName: 'MiniMax query video generation',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'generation-task-status',
      writeScope: 'none'
    },
    {
      id: 'minimax:music_generation',
      toolName: 'music_generation',
      serverId,
      displayName: 'MiniMax music generation',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action',
      dataScope: 'prompt-and-music-generation',
      writeScope: 'external-billing-and-content-generation'
    },
    {
      id: 'minimax:voice_design',
      toolName: 'voice_design',
      serverId,
      displayName: 'MiniMax voice design',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action',
      dataScope: 'prompt-and-audio-generation',
      writeScope: 'external-billing-and-content-generation'
    },
    {
      id: 'minimax:web_search',
      toolName: 'web_search',
      serverId: tokenPlanServerId,
      displayName: 'MiniMax Token Plan web search',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      dataScope: 'web-search-query-and-results',
      writeScope: 'none'
    },
    {
      id: 'minimax:understand_image',
      toolName: 'understand_image',
      serverId: tokenPlanServerId,
      displayName: 'MiniMax Token Plan image understanding',
      riskLevel: 'medium',
      requiresApproval: true,
      category: 'knowledge',
      dataScope: 'image-url-or-local-image-content',
      writeScope: 'none'
    }
  ];
}
