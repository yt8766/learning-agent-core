import { describe, expect, it } from 'vitest';

import { McpCapabilityRegistry, McpServerRegistry } from '@agent/tools';
import { registerBuiltinMcpServers } from '../src/runtime/agent-runtime-mcp-configuration';

describe('registerBuiltinMcpServers MCP skill providers', () => {
  it('registers MiniMax MCP when a MiniMax provider is configured', () => {
    const mcpServerRegistry = new McpServerRegistry();
    const mcpCapabilityRegistry = new McpCapabilityRegistry();

    const { miniMaxCliBindings } = registerBuiltinMcpServers({
      mcpServerRegistry,
      mcpCapabilityRegistry,
      settings: {
        mcp: {
          bigmodelApiKey: '',
          webSearchEndpoint: '',
          webReaderEndpoint: '',
          zreadEndpoint: '',
          researchHttpEndpoint: '',
          researchHttpApiKey: '',
          visionMode: 'ZHIPU',
          stdioSessionIdleTtlMs: 300000,
          stdioSessionMaxCount: 4
        },
        providers: [
          {
            id: 'minimax',
            type: 'minimax',
            displayName: 'MiniMax',
            apiKey: 'minimax-key',
            baseUrl: 'https://api.minimax.io/v1',
            models: ['MiniMax-M2.7'],
            roleModels: { manager: 'MiniMax-M2.7' }
          }
        ]
      } as never
    });

    expect(mcpServerRegistry.get('minimax-mcp')).toEqual(
      expect.objectContaining({
        source: 'minimax',
        transport: 'stdio',
        command: 'uvx',
        env: expect.objectContaining({ MINIMAX_API_KEY: 'minimax-key' })
      })
    );
    expect(mcpServerRegistry.get('minimax-cli')).toEqual(
      expect.objectContaining({
        source: 'minimax',
        transport: 'cli',
        command: 'mmx',
        env: expect.objectContaining({ MINIMAX_API_KEY: 'minimax-key' })
      })
    );
    expect(miniMaxCliBindings?.has('minimax:web_search')).toBe(true);
    expect(miniMaxCliBindings?.has('minimax:understand_image')).toBe(true);
    expect(mcpCapabilityRegistry.get('minimax:voice_clone')).toEqual(
      expect.objectContaining({ riskLevel: 'critical', requiresApproval: true })
    );
  });
});
