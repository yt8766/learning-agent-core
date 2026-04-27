import type {
  AdapterMcpServerDefinition,
  AdapterMcpSkillProviderAdapter,
  AdapterMcpSkillProviderInstallInput
} from '../mcp-skill-provider-adapter';
import { buildMiniMaxMcpCapabilities } from './minimax-mcp-capabilities';

const DEFAULT_MINIMAX_SERVER_ID = 'minimax-mcp';
const DEFAULT_MINIMAX_TOKEN_PLAN_SERVER_ID = 'minimax-token-plan-mcp';

function readOption(input: AdapterMcpSkillProviderInstallInput, key: string): string | undefined {
  const value = input.options?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveMiniMaxApiHost(input: AdapterMcpSkillProviderInstallInput): string {
  const configuredHost = readOption(input, 'apiHost');
  if (configuredHost) {
    return configuredHost.replace(/\/$/, '');
  }
  return readOption(input, 'region') === 'global' ? 'https://api.minimax.io' : 'https://api.minimaxi.com';
}

export function createMiniMaxMcpSkillProvider(): AdapterMcpSkillProviderAdapter {
  return {
    descriptor: {
      id: 'minimax',
      displayName: 'MiniMax MCP',
      description:
        'Built-in MiniMax MCP skills for audio, image, video, music, voice, web search, and image understanding workflows.',
      builtIn: true,
      trustClass: 'official',
      supportedTransports: ['stdio', 'sse'],
      skillIds: buildMiniMaxMcpCapabilities().map(capability => capability.id),
      documentationUrl: 'https://platform.minimaxi.com/docs/guides/token-plan-mcp-guide'
    },
    secretRequirements: [
      {
        key: 'MINIMAX_API_KEY',
        label: 'MiniMax API key',
        required: true,
        sensitive: true
      }
    ],
    validate(input) {
      return input.secrets.MINIMAX_API_KEY ? { ok: true } : { ok: false, errors: ['missing_MINIMAX_API_KEY'] };
    },
    buildInstallPlan(input) {
      const serverId = input.serverId ?? DEFAULT_MINIMAX_SERVER_ID;
      const tokenPlanServerId = `${serverId === DEFAULT_MINIMAX_SERVER_ID ? 'minimax' : serverId}-token-plan-mcp`;
      const resourceMode = readOption(input, 'resourceMode') ?? 'url';
      const basePath = readOption(input, 'basePath') ?? '';
      const sharedEnv = {
        MINIMAX_API_KEY: input.secrets.MINIMAX_API_KEY ?? '',
        MINIMAX_API_HOST: resolveMiniMaxApiHost(input),
        MINIMAX_MCP_BASE_PATH: basePath,
        MINIMAX_API_RESOURCE_MODE: resourceMode
      };
      const server: AdapterMcpServerDefinition = {
        id: serverId,
        displayName: 'MiniMax MCP',
        transport: 'stdio',
        enabled: input.enabled ?? true,
        source: 'minimax',
        trustClass: 'official',
        dataScope: 'external-media-generation',
        writeScope: 'external-billing-and-content-generation',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli'],
        command: 'uvx',
        args: ['minimax-mcp', '-y'],
        env: sharedEnv
      };
      const tokenPlanServer: AdapterMcpServerDefinition = {
        id: input.serverId ? tokenPlanServerId : DEFAULT_MINIMAX_TOKEN_PLAN_SERVER_ID,
        displayName: 'MiniMax Token Plan MCP',
        transport: 'stdio',
        enabled: input.enabled ?? true,
        source: 'minimax',
        trustClass: 'official',
        dataScope: 'web-search-and-image-understanding',
        writeScope: 'none',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli'],
        command: 'uvx',
        args: ['minimax-coding-plan-mcp', '-y'],
        env: sharedEnv
      };
      const resolvedTokenPlanServerId = tokenPlanServer.id;

      return {
        servers: [server, tokenPlanServer],
        capabilities: buildMiniMaxMcpCapabilities(serverId, resolvedTokenPlanServerId),
        warnings:
          resourceMode === 'local' && !basePath
            ? ['MINIMAX_MCP_BASE_PATH is recommended when MINIMAX_API_RESOURCE_MODE=local']
            : []
      };
    }
  };
}
