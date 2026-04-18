import { describe, expect, it, vi } from 'vitest';
import { ActionIntent } from '@agent/core';

import { McpCapabilityRegistry } from '../../src/mcp/mcp-capability-registry';
import { McpClientManager } from '../../src/mcp/mcp-client-manager';
import { McpServerRegistry } from '../../src/mcp/mcp-server-registry';
import { expectDefined } from './mcp-client-manager.test.utils';

describe('McpClientManager local and http transports', () => {
  it('鏈湴閫傞厤鍣ㄥ彲鍥為€€鍒?sandbox executor', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();
    const sandboxExecutor = {
      execute: vi.fn(async () => ({
        ok: true,
        outputSummary: 'sandbox fallback executed',
        durationMs: 1,
        exitCode: 0
      }))
    };

    servers.register({
      id: 'local-workspace',
      displayName: 'local',
      transport: 'local-adapter',
      enabled: true
    });
    capabilities.register({
      id: 'read_local_file',
      toolName: 'read_local_file',
      serverId: 'local-workspace',
      displayName: 'Read file',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'system'
    });

    const manager = new McpClientManager(servers, capabilities, sandboxExecutor as never);
    const result = await manager.invokeCapability('read_local_file', {
      taskId: 'task-1',
      toolName: 'ignored',
      intent: 'read_file' as never,
      input: { path: 'package.json' },
      requestedBy: 'agent'
    });

    expect(result.ok).toBe(true);
    expect(sandboxExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'read_local_file' }));
  });

  it('HTTP transport can invoke a remote MCP endpoint when configured', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'remote-browser',
      displayName: 'browser',
      transport: 'http',
      endpoint: 'http://mcp.local/invoke',
      headers: { Authorization: 'Bearer secret-token' },
      enabled: true
    });
    capabilities.register({
      id: 'browse_page',
      toolName: 'browse_page',
      serverId: 'remote-browser',
      displayName: 'Browse',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action'
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        outputSummary: 'remote mcp executed',
        durationMs: 12,
        exitCode: 0
      })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    const result = await manager.invokeCapability('browse_page', {
      taskId: 'task-2',
      toolName: 'ignored',
      intent: 'call_external_api' as never,
      input: { url: 'https://example.com' },
      requestedBy: 'agent'
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://mcp.local/invoke',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' })
      })
    );
    expect(result.transportUsed).toBe('http');
    expect(result.fallbackUsed).toBe(false);
  });

  it('invokeTool prefers a remote transport over local-adapter for the same toolName', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();
    const sandboxExecutor = {
      execute: vi.fn(async () => ({
        ok: true,
        outputSummary: 'local fallback executed',
        durationMs: 1,
        exitCode: 0
      }))
    };

    servers.register({ id: 'local-workspace', displayName: 'local', transport: 'local-adapter', enabled: true });
    servers.register({
      id: 'remote-browser',
      displayName: 'browser',
      transport: 'http',
      endpoint: 'http://mcp.local/invoke',
      enabled: true
    });
    capabilities.register({
      id: 'browse_page_local',
      toolName: 'browse_page',
      serverId: 'local-workspace',
      displayName: 'Browse local',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action'
    });
    capabilities.register({
      id: 'browse_page_remote',
      toolName: 'browse_page',
      serverId: 'remote-browser',
      displayName: 'Browse remote',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action'
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        outputSummary: 'remote browser executed',
        durationMs: 8,
        exitCode: 0
      })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const manager = new McpClientManager(servers, capabilities, sandboxExecutor as never);
    const result = await manager.invokeTool('browse_page', {
      taskId: 'task-pref-1',
      toolName: 'ignored',
      intent: 'call_external_api' as never,
      input: { url: 'https://example.com' },
      requestedBy: 'agent'
    });

    expect(result.ok).toBe(true);
    expect(result.transportUsed).toBe('http');
    expect(result.serverId).toBe('remote-browser');
    expect(result.capabilityId).toBe('browse_page_remote');
    expect(sandboxExecutor.execute).not.toHaveBeenCalled();
  });

  it('registerFromTools does not override a remote capability with the same toolName', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();
    const sandboxExecutor = {
      execute: vi.fn(async () => ({
        ok: true,
        outputSummary: 'local fallback executed',
        durationMs: 1,
        exitCode: 0
      }))
    };

    servers.register({ id: 'local-workspace', displayName: 'local', transport: 'local-adapter', enabled: true });
    servers.register({
      id: 'bigmodel-web-search',
      displayName: 'BigModel Web Search MCP',
      transport: 'http',
      endpoint: 'http://mcp.local/invoke',
      enabled: true
    });

    capabilities.register({
      id: 'webSearchPrime',
      toolName: 'webSearchPrime',
      serverId: 'bigmodel-web-search',
      displayName: 'Web Search Prime',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge'
    });
    capabilities.registerFromTools('local-workspace', [
      {
        name: 'webSearchPrime',
        description: 'Search the open web for recent, citation-friendly sources.',
        family: 'knowledge',
        category: 'knowledge',
        riskLevel: 'low',
        requiresApproval: false,
        timeoutMs: 10000,
        sandboxProfile: 'research-readonly',
        capabilityType: 'local-tool',
        isReadOnly: true,
        isConcurrencySafe: true,
        isDestructive: false,
        supportsStreamingDispatch: true,
        permissionScope: 'readonly',
        inputSchema: { type: 'object', properties: {} }
      }
    ]);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        outputSummary: 'remote search executed',
        durationMs: 8,
        exitCode: 0
      })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const manager = new McpClientManager(servers, capabilities, sandboxExecutor as never);
    const result = await manager.invokeTool('webSearchPrime', {
      taskId: 'task-pref-2',
      toolName: 'ignored',
      intent: ActionIntent.CALL_EXTERNAL_API,
      input: { query: 'latest runtime news' },
      requestedBy: 'agent'
    });

    expect(result.ok).toBe(true);
    expect(result.serverId).toBe('bigmodel-web-search');
    expect(result.capabilityId).toBe('webSearchPrime');
    expect(sandboxExecutor.execute).not.toHaveBeenCalled();
  });

  it('HTTP transport can discover remote capabilities when tools/list is supported', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'remote-browser',
      displayName: 'browser',
      transport: 'http',
      endpoint: 'http://mcp.local/invoke',
      discoveryEndpoint: 'http://mcp.local/discover',
      enabled: true
    });
    capabilities.register({
      id: 'browse_page',
      toolName: 'browse_page',
      serverId: 'remote-browser',
      displayName: 'Browse',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action'
    });

    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      if (body.method === 'tools/list') {
        return {
          ok: true,
          json: async () => ({
            result: { tools: [{ name: 'browse_page' }, { name: 'page_snapshot' }] }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          outputSummary: 'remote mcp executed',
          durationMs: 12,
          exitCode: 0
        })
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    await manager.refreshAllServerDiscovery();

    const server = expectDefined(manager.describeServers()[0], 'remote-browser server');
    expect(server.sessionState).toBe('connected');
    expect(server.discoveryMode).toBe('remote');
    expect(server.discoveredCapabilities).toEqual(['browse_page', 'page_snapshot']);
  });

  it('describeServers reports transport health and implemented capabilities', () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'remote-browser',
      displayName: 'browser',
      transport: 'http',
      endpoint: 'http://mcp.local/invoke',
      enabled: true
    });
    servers.register({
      id: 'stdio-runner',
      displayName: 'stdio',
      transport: 'stdio',
      enabled: true
    });
    capabilities.register({
      id: 'browse_page',
      toolName: 'browse_page',
      serverId: 'remote-browser',
      displayName: 'Browse',
      riskLevel: 'high',
      requiresApproval: true,
      category: 'action'
    });

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    const remote = expectDefined(manager.describeServers()[0], 'remote-browser server');
    const stdio = expectDefined(manager.describeServers()[1], 'stdio-runner server');

    expect(remote.healthState).toBe('healthy');
    expect(remote.implementedCapabilityCount).toBe(1);
    expect(stdio.healthState).toBe('degraded');
    expect(stdio.healthReason).toBe('missing_stdio_command');
  });
});
