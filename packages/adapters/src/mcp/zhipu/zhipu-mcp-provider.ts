import type {
  AdapterMcpServerDefinition,
  AdapterMcpSkillProviderAdapter,
  AdapterMcpSkillProviderInstallInput
} from '../mcp-skill-provider-adapter';
import { buildZhipuMcpCapabilities } from './zhipu-mcp-capabilities';

function readOption(input: AdapterMcpSkillProviderInstallInput, key: string): string | undefined {
  const value = input.options?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveZhipuBaseUrl(input: AdapterMcpSkillProviderInstallInput): string {
  return (readOption(input, 'apiBaseUrl') ?? 'https://open.bigmodel.cn/api/mcp').replace(/\/$/, '');
}

function zhipuHttpServer(
  id: string,
  displayName: string,
  endpoint: string,
  apiKey: string
): AdapterMcpServerDefinition {
  return {
    id,
    displayName,
    transport: 'http',
    enabled: true,
    endpoint,
    discoveryEndpoint: endpoint,
    headers: { Authorization: `Bearer ${apiKey}` },
    source: 'zhipu',
    trustClass: 'official',
    dataScope: 'remote-zhipu-mcp',
    writeScope: 'none',
    installationMode: 'configured',
    allowedProfiles: ['platform', 'company', 'personal', 'cli']
  };
}

export function createZhipuMcpSkillProvider(): AdapterMcpSkillProviderAdapter {
  return {
    descriptor: {
      id: 'zhipu',
      displayName: 'Zhipu MCP',
      description: 'Built-in Zhipu MCP skills for search, web reading, repository reading, and vision.',
      builtIn: true,
      trustClass: 'official',
      supportedTransports: ['http', 'stdio', 'streamable-http', 'sse'],
      skillIds: buildZhipuMcpCapabilities().map(capability => capability.id),
      documentationUrl: 'https://docs.bigmodel.cn/cn/coding-plan/mcp/search-mcp-server'
    },
    secretRequirements: [
      {
        key: 'Z_AI_API_KEY',
        label: 'Zhipu / Z.AI API key',
        required: true,
        sensitive: true
      }
    ],
    validate(input) {
      return input.secrets.Z_AI_API_KEY ? { ok: true } : { ok: false, errors: ['missing_Z_AI_API_KEY'] };
    },
    buildInstallPlan(input) {
      const apiKey = input.secrets.Z_AI_API_KEY ?? '';
      const baseUrl = resolveZhipuBaseUrl(input);
      const zAiMode = readOption(input, 'zAiMode') ?? 'ZHIPU';
      const enabled = input.enabled ?? true;
      const visionServer: AdapterMcpServerDefinition = {
        id: 'zhipu-vision',
        displayName: 'Zhipu Vision MCP',
        transport: 'stdio',
        enabled,
        command: 'npx',
        args: ['-y', '@z_ai/mcp-server'],
        env: { Z_AI_API_KEY: apiKey, Z_AI_MODE: zAiMode },
        source: 'zhipu',
        trustClass: 'official',
        dataScope: 'local-or-remote-vision',
        writeScope: 'none',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli']
      };
      const servers: AdapterMcpServerDefinition[] = [
        zhipuHttpServer(
          'zhipu-web-search-prime',
          'Zhipu Web Search Prime MCP',
          `${baseUrl}/web_search_prime/mcp`,
          apiKey
        ),
        zhipuHttpServer('zhipu-web-reader', 'Zhipu Web Reader MCP', `${baseUrl}/web_reader/mcp`, apiKey),
        zhipuHttpServer('zhipu-zread', 'Zhipu ZRead MCP', `${baseUrl}/zread/mcp`, apiKey),
        visionServer
      ].map(server => ({ ...server, enabled }));

      return {
        servers,
        capabilities: buildZhipuMcpCapabilities(),
        warnings:
          input.transportPreference === 'sse' || input.transportPreference === 'streamable-http'
            ? ['streamable-http and sse require dedicated runtime transport support before invocation']
            : []
      };
    }
  };
}
