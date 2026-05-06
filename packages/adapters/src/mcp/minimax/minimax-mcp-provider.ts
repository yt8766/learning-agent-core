import type {
  AdapterMcpServerDefinition,
  AdapterMcpSkillProviderAdapter,
  AdapterMcpSkillProviderInstallInput
} from '../mcp-skill-provider-adapter';
import { buildMiniMaxMcpCapabilities } from './minimax-mcp-capabilities';

const DEFAULT_MINIMAX_SERVER_ID = 'minimax-mcp';
const DEFAULT_MINIMAX_CLI_SERVER_ID = 'minimax-cli';

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
        'Built-in MiniMax MCP skills for audio, image, video, music, voice, plus MiniMax CLI for web search and image understanding.',
      builtIn: true,
      trustClass: 'official',
      supportedTransports: ['stdio', 'sse', 'cli'],
      skillIds: buildMiniMaxMcpCapabilities().map(capability => capability.id),
      documentationUrl: 'https://platform.minimaxi.com/docs/token-plan/minimax-cli'
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
      const resolvedCliServerId = input.serverId
        ? `${serverId === DEFAULT_MINIMAX_SERVER_ID ? 'minimax' : serverId}-cli`
        : DEFAULT_MINIMAX_CLI_SERVER_ID;
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
      const cliServer: AdapterMcpServerDefinition = {
        id: resolvedCliServerId,
        displayName: 'MiniMax CLI',
        transport: 'cli',
        enabled: input.enabled ?? true,
        source: 'minimax',
        trustClass: 'official',
        dataScope: 'web-search-and-image-understanding',
        writeScope: 'none',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli'],
        command: 'mmx',
        env: sharedEnv
      };

      return {
        servers: [server, cliServer],
        capabilities: buildMiniMaxMcpCapabilities(serverId, resolvedCliServerId),
        warnings:
          resourceMode === 'local' && !basePath
            ? ['MINIMAX_MCP_BASE_PATH is recommended when MINIMAX_API_RESOURCE_MODE=local']
            : []
      };
    }
  };
}
