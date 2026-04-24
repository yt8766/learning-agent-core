import type {
  AdapterMcpServerDefinition,
  AdapterMcpSkillProviderAdapter,
  AdapterMcpSkillProviderInstallInput
} from '../mcp-skill-provider-adapter';
import { buildMiniMaxMcpCapabilities } from './minimax-mcp-capabilities';

const DEFAULT_MINIMAX_SERVER_ID = 'minimax-mcp';

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
      description: 'Built-in MiniMax MCP skills for audio, image, video, music, and voice workflows.',
      builtIn: true,
      trustClass: 'official',
      supportedTransports: ['stdio', 'sse'],
      skillIds: buildMiniMaxMcpCapabilities().map(capability => capability.id),
      documentationUrl: 'https://platform.minimax.io/docs/guides/mcp-guide'
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
      const resourceMode = readOption(input, 'resourceMode') ?? 'url';
      const basePath = readOption(input, 'basePath') ?? '';
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
        env: {
          MINIMAX_API_KEY: input.secrets.MINIMAX_API_KEY ?? '',
          MINIMAX_API_HOST: resolveMiniMaxApiHost(input),
          MINIMAX_MCP_BASE_PATH: basePath,
          MINIMAX_API_RESOURCE_MODE: resourceMode
        }
      };

      return {
        servers: [server],
        capabilities: buildMiniMaxMcpCapabilities(serverId),
        warnings:
          resourceMode === 'local' && !basePath
            ? ['MINIMAX_MCP_BASE_PATH is recommended when MINIMAX_API_RESOURCE_MODE=local']
            : []
      };
    }
  };
}
