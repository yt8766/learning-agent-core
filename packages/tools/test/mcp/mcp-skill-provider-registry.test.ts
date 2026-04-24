import { describe, expect, it } from 'vitest';

import {
  installMcpSkillProvider,
  McpCapabilityRegistry,
  McpServerRegistry,
  McpSkillProviderRegistry,
  type McpSkillProviderAdapter
} from '../../src';

describe('McpSkillProviderRegistry', () => {
  it('lets developers register an MCP skill provider and install its servers and capabilities', () => {
    const provider: McpSkillProviderAdapter = {
      descriptor: {
        id: 'figma',
        displayName: 'Figma MCP',
        description: 'Design context MCP skills for Figma files.',
        builtIn: false,
        trustClass: 'community',
        supportedTransports: ['stdio'],
        skillIds: ['figma:get_file']
      },
      secretRequirements: [{ key: 'FIGMA_TOKEN', label: 'Figma token', required: true, sensitive: true }],
      validate(input) {
        return input.secrets.FIGMA_TOKEN ? { ok: true } : { ok: false, errors: ['missing_FIGMA_TOKEN'] };
      },
      buildInstallPlan(input) {
        return {
          servers: [
            {
              id: input.serverId ?? 'figma-mcp',
              displayName: 'Figma MCP',
              transport: 'stdio',
              command: 'npx',
              args: ['-y', 'figma-mcp'],
              env: { FIGMA_TOKEN: input.secrets.FIGMA_TOKEN },
              enabled: input.enabled ?? true,
              source: 'figma',
              trustClass: 'community'
            }
          ],
          capabilities: [
            {
              id: 'figma:get_file',
              toolName: 'get_file',
              serverId: input.serverId ?? 'figma-mcp',
              displayName: 'Read a Figma file',
              riskLevel: 'medium',
              requiresApproval: true,
              category: 'knowledge'
            }
          ],
          warnings: []
        };
      }
    };

    const providerRegistry = new McpSkillProviderRegistry();
    providerRegistry.register(provider);

    const serverRegistry = new McpServerRegistry();
    const capabilityRegistry = new McpCapabilityRegistry();
    const result = installMcpSkillProvider({
      providerRegistry,
      serverRegistry,
      capabilityRegistry,
      input: {
        providerId: 'figma',
        profile: 'personal',
        secrets: { FIGMA_TOKEN: 'figma-token' }
      }
    });

    expect(providerRegistry.list().map(item => item.descriptor.id)).toEqual(['figma']);
    expect(result.ok).toBe(true);
    expect(result.registeredServerIds).toEqual(['figma-mcp']);
    expect(result.registeredCapabilityIds).toEqual(['figma:get_file']);
    expect(serverRegistry.get('figma-mcp')).toEqual(expect.objectContaining({ source: 'figma' }));
    expect(capabilityRegistry.get('figma:get_file')).toEqual(expect.objectContaining({ toolName: 'get_file' }));
  });

  it('returns validation errors without mutating registries', () => {
    const providerRegistry = new McpSkillProviderRegistry();
    providerRegistry.register({
      descriptor: {
        id: 'custom',
        displayName: 'Custom MCP',
        builtIn: false,
        trustClass: 'community',
        supportedTransports: ['stdio'],
        skillIds: ['custom:run']
      },
      secretRequirements: [{ key: 'CUSTOM_TOKEN', label: 'Token', required: true, sensitive: true }],
      validate: () => ({ ok: false, errors: ['missing_CUSTOM_TOKEN'] }),
      buildInstallPlan: () => ({ servers: [], capabilities: [], warnings: [] })
    });

    const serverRegistry = new McpServerRegistry();
    const capabilityRegistry = new McpCapabilityRegistry();
    const result = installMcpSkillProvider({
      providerRegistry,
      serverRegistry,
      capabilityRegistry,
      input: {
        providerId: 'custom',
        profile: 'company',
        secrets: {}
      }
    });

    expect(result).toEqual({
      ok: false,
      errors: ['missing_CUSTOM_TOKEN'],
      registeredServerIds: [],
      registeredCapabilityIds: [],
      warnings: []
    });
    expect(serverRegistry.list()).toEqual([]);
    expect(capabilityRegistry.list()).toEqual([]);
  });
});
