import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/core';

import type { McpCapabilityDefinition } from '../mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../mcp/mcp-server-registry';
import {
  createStdioSession,
  createStdioSessionClient,
  extractStdioContentText,
  type StdioSessionClient,
  type StdioSessionRecord
} from '../mcp/mcp-stdio-session';
import type { McpTransportDiscovery, McpTransportHandler, McpTransportHealth } from '../mcp/mcp-transport-types';

export class StdioTransportHandler implements McpTransportHandler {
  readonly transport = 'stdio' as const;

  constructor(private readonly options: { maxSessions?: number } = {}) {}

  private readonly sessions = new Map<string, StdioSessionRecord>();

  private async getSession(server: McpServerDefinition): Promise<StdioSessionClient> {
    if (!server.command) {
      throw new Error('missing_stdio_command');
    }

    this.enforceSessionLimit();
    const { session } = createStdioSession(server, () => {
      this.sessions.delete(server.id);
    });
    const client = createStdioSessionClient(session);

    session.initialized = (async () => {
      const initializeId = client.nextId();
      client.send({
        jsonrpc: '2.0',
        id: initializeId,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'learning-agent-core',
            version: '0.1.0'
          }
        }
      });
      await client.awaitResponse(initializeId, 10000);
      client.send({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });
    })();

    this.sessions.set(server.id, session);
    await session.initialized;
    return client;
  }

  private enforceSessionLimit() {
    const maxSessions = Math.max(1, this.options.maxSessions ?? 4);
    if (this.sessions.size < maxSessions) {
      return;
    }

    const oldestIdleSession = Array.from(this.sessions.entries()).sort((left, right) => {
      return new Date(left[1].lastActivityAt).getTime() - new Date(right[1].lastActivityAt).getTime();
    })[0];

    oldestIdleSession?.[1].close();
  }

  private async withClient<T>(
    server: McpServerDefinition,
    run: (client: StdioSessionClient) => Promise<T>
  ): Promise<T> {
    const existing = this.sessions.get(server.id);
    const client = existing
      ? await existing.initialized.then(() => createStdioSessionClient(existing))
      : await this.getSession(server);

    return run({
      ...client,
      close: () => {
        client.close();
      }
    });
  }

  async invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    if (!server.command) {
      return {
        ok: false,
        outputSummary: `MCP server ${server.id} is missing a stdio command`,
        errorMessage: 'missing_stdio_command',
        durationMs: 0,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'stdio',
        fallbackUsed: false
      };
    }

    const startedAt = Date.now();

    try {
      const result = (await this.withClient(server, async client => {
        const callId = client.nextId();
        client.send({
          jsonrpc: '2.0',
          id: callId,
          method: 'tools/call',
          params: {
            name: capability.toolName,
            arguments: request.input
          }
        });
        return client.awaitResponse(callId, 20000) as Promise<{
          content?: Array<{ type?: string; text?: string }>;
          isError?: boolean;
          [key: string]: unknown;
        }>;
      })) as {
        content?: Array<{ type?: string; text?: string }>;
        isError?: boolean;
        [key: string]: unknown;
      };

      const contentText = extractStdioContentText(result);

      return {
        ok: !result?.isError,
        outputSummary: contentText || `STDIO MCP server ${server.id} completed ${capability.toolName}`,
        rawOutput: result,
        exitCode: result?.isError ? 1 : 0,
        durationMs: Date.now() - startedAt,
        errorMessage: result?.isError ? contentText || 'stdio_tool_error' : undefined,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'stdio',
        fallbackUsed: false
      };
    } catch (error) {
      return {
        ok: false,
        outputSummary: `STDIO MCP server ${server.id} request failed`,
        errorMessage: error instanceof Error ? error.message : 'stdio_request_failed',
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'stdio',
        fallbackUsed: false
      };
    }
  }

  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth {
    if (!server.enabled) {
      return {
        healthState: 'disabled',
        healthReason: 'connector_disabled',
        implementedCapabilityCount: 0
      };
    }

    if (!server.command) {
      return {
        healthState: 'degraded',
        healthReason: 'missing_stdio_command',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'healthy',
      healthReason: 'stdio_transport_ready',
      implementedCapabilityCount: capabilities.length
    };
  }

  async discover(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): Promise<McpTransportDiscovery> {
    if (!server.command) {
      return {
        sessionState: 'error',
        discoveredCapabilities: [],
        discoveryMode: 'remote',
        errorMessage: 'missing_stdio_command'
      };
    }

    try {
      const result = (await this.withClient(server, async client => {
        const listId = client.nextId();
        client.send({
          jsonrpc: '2.0',
          id: listId,
          method: 'tools/list',
          params: {}
        });
        return client.awaitResponse(listId, 10000) as Promise<{
          tools?: Array<{ name?: string }>;
        }>;
      })) as { tools?: Array<{ name?: string }> };

      const discoveredCapabilities = Array.isArray(result.tools)
        ? result.tools
            .map(tool => tool?.name)
            .filter((name): name is string => typeof name === 'string' && name.length > 0)
        : capabilities.map(capability => capability.toolName);

      return {
        sessionState: 'connected',
        discoveredCapabilities,
        discoveryMode: 'remote'
      };
    } catch (error) {
      return {
        sessionState: 'error',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        errorMessage: error instanceof Error ? error.message : 'stdio_discovery_failed'
      };
    }
  }

  async closeSession(server: McpServerDefinition): Promise<boolean> {
    const session = this.sessions.get(server.id);
    if (!session) {
      return false;
    }
    session.close();
    return true;
  }

  getSessionMetadata(server: McpServerDefinition) {
    const session = this.sessions.get(server.id);
    if (!session) {
      return undefined;
    }
    const idleMs = Math.max(0, Date.now() - new Date(session.lastActivityAt).getTime());
    return {
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      requestCount: session.requestCount,
      idleMs
    };
  }

  async sweepIdleSessions(idleTtlMs: number): Promise<string[]> {
    const closed: string[] = [];
    for (const [serverId, session] of this.sessions) {
      const idleMs = Math.max(0, Date.now() - new Date(session.lastActivityAt).getTime());
      if (idleMs >= idleTtlMs) {
        session.close();
        closed.push(serverId);
      }
    }
    return closed;
  }
}
