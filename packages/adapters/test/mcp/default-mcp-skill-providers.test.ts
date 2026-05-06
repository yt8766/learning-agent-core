import { describe, expect, it } from 'vitest';
import { McpSkillProviderRegistry } from '@agent/tools';

import {
  createMiniMaxMcpSkillProvider,
  createZhipuMcpSkillProvider,
  registerDefaultMcpSkillProviders
} from '@agent/adapters';

describe('@agent/adapters default MCP skill providers', () => {
  it('exports MiniMax and Zhipu as built-in MCP skill providers', () => {
    const registry = registerDefaultMcpSkillProviders(new McpSkillProviderRegistry());

    expect(registry.list().map(provider => provider.descriptor.id)).toEqual(['minimax', 'zhipu']);
    expect(registry.get('minimax')?.descriptor.builtIn).toBe(true);
    expect(registry.get('zhipu')?.descriptor.builtIn).toBe(true);
  });

  it('builds a MiniMax stdio install plan with governed media plus CLI search capabilities', () => {
    const provider = createMiniMaxMcpSkillProvider();
    const plan = provider.buildInstallPlan({
      providerId: 'minimax',
      profile: 'company',
      secrets: { MINIMAX_API_KEY: 'minimax-key' },
      options: { region: 'global' }
    });

    expect(plan.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'minimax-mcp',
          transport: 'stdio',
          command: 'uvx',
          args: ['minimax-mcp', '-y'],
          env: expect.objectContaining({
            MINIMAX_API_KEY: 'minimax-key',
            MINIMAX_API_HOST: 'https://api.minimax.io'
          })
        }),
        expect.objectContaining({
          id: 'minimax-cli',
          transport: 'cli',
          command: 'mmx',
          env: expect.objectContaining({
            MINIMAX_API_KEY: 'minimax-key',
            MINIMAX_API_HOST: 'https://api.minimax.io'
          })
        })
      ])
    );
    expect(plan.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'minimax:voice_clone', riskLevel: 'critical', requiresApproval: true }),
        expect.objectContaining({ id: 'minimax:list_voices', riskLevel: 'low', requiresApproval: false }),
        expect.objectContaining({
          id: 'minimax:web_search',
          toolName: 'web_search',
          serverId: 'minimax-cli',
          riskLevel: 'low',
          requiresApproval: false
        }),
        expect.objectContaining({
          id: 'minimax:understand_image',
          toolName: 'understand_image',
          serverId: 'minimax-cli',
          riskLevel: 'medium',
          requiresApproval: true
        })
      ])
    );
  });

  it('lets MiniMax CLI web search resolve by MCP tool name', () => {
    const provider = createMiniMaxMcpSkillProvider();
    const plan = provider.buildInstallPlan({
      providerId: 'minimax',
      profile: 'company',
      secrets: { MINIMAX_API_KEY: 'minimax-key' }
    });

    expect(plan.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'minimax:web_search',
          toolName: 'web_search',
          serverId: 'minimax-cli'
        })
      ])
    );
  });

  it('builds Zhipu default MCP plans for remote and local MCP skills', () => {
    const provider = createZhipuMcpSkillProvider();
    const plan = provider.buildInstallPlan({
      providerId: 'zhipu',
      profile: 'company',
      secrets: { Z_AI_API_KEY: 'zhipu-key' }
    });

    expect(plan.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'zhipu-web-search-prime',
          transport: 'http',
          endpoint: 'https://open.bigmodel.cn/api/mcp/web_search_prime/mcp',
          headers: { Authorization: 'Bearer zhipu-key' }
        }),
        expect.objectContaining({
          id: 'zhipu-vision',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@z_ai/mcp-server'],
          env: { Z_AI_API_KEY: 'zhipu-key', Z_AI_MODE: 'ZHIPU' }
        })
      ])
    );
    expect(plan.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'zhipu:webSearchPrime', toolName: 'webSearchPrime' }),
        expect.objectContaining({ id: 'zhipu:image_analysis', toolName: 'image_analysis' }),
        expect.objectContaining({ id: 'zhipu:search_doc', toolName: 'search_doc' })
      ])
    );
  });
});
