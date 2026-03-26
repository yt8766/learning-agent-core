import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { McpCapabilityRegistry } from './mcp-capability-registry';
import { McpClientManager } from './mcp-client-manager';
import { McpServerRegistry } from './mcp-server-registry';

function expectDefined<T>(value: T | undefined, label: string): T {
  expect(value, `${label} should be defined`).toBeDefined();
  return value as T;
}

describe('McpClientManager', () => {
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
    expect(sandboxExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'read_local_file'
      })
    );
  });

  it('HTTP transport can invoke a remote MCP endpoint when configured', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();
    const sandboxExecutor = {
      execute: vi.fn()
    };

    servers.register({
      id: 'remote-browser',
      displayName: 'browser',
      transport: 'http',
      endpoint: 'http://mcp.local/invoke',
      headers: {
        Authorization: 'Bearer secret-token'
      },
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

    const manager = new McpClientManager(servers, capabilities, sandboxExecutor as never);
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
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token'
        })
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

    servers.register({
      id: 'local-workspace',
      displayName: 'local',
      transport: 'local-adapter',
      enabled: true
    });
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
            result: {
              tools: [{ name: 'browse_page' }, { name: 'page_snapshot' }]
            }
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

  it('stdio transport can initialize and call a tool over MCP json-rpc', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'vision-stdio',
      displayName: 'vision',
      transport: 'stdio',
      command: 'node',
      args: [
        '-e',
        `
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index = buffer.indexOf('\\n');
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mock-vision', version: '1.0.0' } } }) + '\\n');
      } else if (message.method === 'tools/call') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'vision tool executed' }] } }) + '\\n');
      }
    }
    index = buffer.indexOf('\\n');
  }
});
`
      ],
      enabled: true
    });
    capabilities.register({
      id: 'image_analysis',
      toolName: 'image_analysis',
      serverId: 'vision-stdio',
      displayName: 'Vision Analyze',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge'
    });

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    const result = await manager.invokeCapability('image_analysis', {
      taskId: 'task-stdio',
      toolName: 'ignored',
      intent: 'call_external_api' as never,
      input: { imagePath: '/tmp/demo.png' },
      requestedBy: 'agent'
    });

    expect(result.ok).toBe(true);
    expect(result.outputSummary).toContain('vision tool executed');

    const server = expectDefined(manager.describeServers()[0], 'vision-stdio server');
    expect(server.healthState).toBe('healthy');
    expect(server.healthReason).toBe('stdio_transport_ready');
  });

  it('stdio transport can discover tools over MCP json-rpc', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'vision-stdio',
      displayName: 'vision',
      transport: 'stdio',
      command: 'node',
      args: [
        '-e',
        `
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index = buffer.indexOf('\\n');
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mock-vision', version: '1.0.0' } } }) + '\\n');
      } else if (message.method === 'tools/list') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'image_analysis' }, { name: 'ui_diff_check' }] } }) + '\\n');
      }
    }
    index = buffer.indexOf('\\n');
  }
});
`
      ],
      enabled: true
    });
    capabilities.register({
      id: 'image_analysis',
      toolName: 'image_analysis',
      serverId: 'vision-stdio',
      displayName: 'Vision Analyze',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge'
    });

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    await manager.refreshAllServerDiscovery({ includeStdio: true });

    const server = expectDefined(manager.describeServers()[0], 'remote-browser server');
    expect(server.sessionState).toBe('connected');
    expect(server.discoveryMode).toBe('remote');
    expect(server.discoveredCapabilities).toEqual(['image_analysis', 'ui_diff_check']);
    expect(server.discoveredCapabilityCount).toBe(2);
  });

  it('stdio transport reuses one initialized session across discovery and invoke', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'mcp-session-'));
    const markerPath = join(tempDir, 'initialize-count.txt');
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'vision-stdio-session',
      displayName: 'vision-session',
      transport: 'stdio',
      command: 'node',
      args: [
        '-e',
        `
const fs = require('node:fs');
const marker = process.argv[1];
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index = buffer.indexOf('\\n');
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        fs.appendFileSync(marker, '1\\n');
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mock-vision', version: '1.0.0' } } }) + '\\n');
      } else if (message.method === 'tools/list') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'image_analysis' }] } }) + '\\n');
      } else if (message.method === 'tools/call') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'vision tool executed' }] } }) + '\\n');
      }
    }
    index = buffer.indexOf('\\n');
  }
});
`,
        markerPath
      ],
      enabled: true
    });
    capabilities.register({
      id: 'image_analysis',
      toolName: 'image_analysis',
      serverId: 'vision-stdio-session',
      displayName: 'Vision Analyze',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge'
    });

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    await manager.refreshServerDiscovery('vision-stdio-session');
    const result = await manager.invokeCapability('image_analysis', {
      taskId: 'task-stdio-session',
      toolName: 'ignored',
      intent: 'call_external_api' as never,
      input: { imagePath: '/tmp/demo.png' },
      requestedBy: 'agent'
    });

    expect(result.ok).toBe(true);
    const markerContents = await readFile(markerPath, 'utf8');
    expect(markerContents.trim().split('\n')).toHaveLength(1);
  });

  it('stdio transport can sweep idle sessions', async () => {
    const servers = new McpServerRegistry();
    const capabilities = new McpCapabilityRegistry();

    servers.register({
      id: 'vision-stdio-sweep',
      displayName: 'vision-sweep',
      transport: 'stdio',
      command: 'node',
      args: [
        '-e',
        `
process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index = buffer.indexOf('\\n');
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mock-vision', version: '1.0.0' } } }) + '\\n');
      } else if (message.method === 'tools/list') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'image_analysis' }] } }) + '\\n');
      }
    }
    index = buffer.indexOf('\\n');
  }
});
`
      ],
      enabled: true
    });
    capabilities.register({
      id: 'image_analysis',
      toolName: 'image_analysis',
      serverId: 'vision-stdio-sweep',
      displayName: 'Vision Analyze',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge'
    });

    const manager = new McpClientManager(servers, capabilities, { execute: vi.fn() } as never);
    await manager.refreshServerDiscovery('vision-stdio-sweep');
    const before = expectDefined(manager.describeServers()[0], 'vision-stdio-sweep server');
    expect(before.sessionState).toBe('connected');

    const closed = await manager.sweepIdleSessions(0);
    expect(closed).toContain('vision-stdio-sweep');
  });
});
