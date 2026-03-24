import { ToolExecutionRequest, ToolExecutionResult } from '@agent/shared';

import { SandboxExecutor } from './sandbox-executor';
import { McpCapabilityRegistry } from './mcp-capability-registry';
import { McpServerRegistry } from './mcp-server-registry';
import {
  HttpTransportHandler,
  LocalAdapterTransportHandler,
  McpTransportDiscovery,
  McpTransportHandler,
  StdioTransportHandler
} from './mcp-transport-handlers';

interface McpServerDiscoveryRecord {
  sessionState: 'stateless' | 'disconnected' | 'connected' | 'error';
  discoveredCapabilities: string[];
  discoveredAt?: string;
  discoveryMode: 'registered' | 'remote';
  lastError?: string;
}

export class McpClientManager {
  private readonly handlers = new Map<string, McpTransportHandler>();
  private readonly discoveryCache = new Map<string, McpServerDiscoveryRecord>();

  constructor(
    private readonly serverRegistry: McpServerRegistry,
    private readonly capabilityRegistry: McpCapabilityRegistry,
    private readonly fallbackExecutor: SandboxExecutor,
    options?: {
      stdioMaxSessions?: number;
    }
  ) {
    this.registerHandler(new LocalAdapterTransportHandler(this.fallbackExecutor));
    this.registerHandler(new HttpTransportHandler());
    this.registerHandler(new StdioTransportHandler({ maxSessions: options?.stdioMaxSessions }));
  }

  registerHandler(handler: McpTransportHandler): void {
    this.handlers.set(handler.transport, handler);
  }

  hasCapability(capabilityId: string): boolean {
    return Boolean(this.capabilityRegistry.get(capabilityId));
  }

  async refreshServerDiscovery(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      return;
    }
    const capabilities = this.capabilityRegistry.listByServer(server.id);
    const handler = this.handlers.get(server.transport);
    const discoveredAt = new Date().toISOString();

    if (!handler?.discover) {
      this.discoveryCache.set(server.id, {
        sessionState:
          server.transport === 'local-adapter' || server.transport === 'http' ? 'stateless' : 'disconnected',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        discoveredAt
      });
      return;
    }

    const discovery = await handler.discover(server, capabilities);
    this.discoveryCache.set(server.id, this.toDiscoveryRecord(discovery, capabilities, discoveredAt));
  }

  async refreshAllServerDiscovery(options?: { includeStdio?: boolean }): Promise<void> {
    for (const server of this.serverRegistry.list()) {
      if (server.transport === 'stdio' && !options?.includeStdio) {
        continue;
      }
      await this.refreshServerDiscovery(server.id);
    }
  }

  async closeServerSession(serverId: string): Promise<boolean> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      return false;
    }
    const handler = this.handlers.get(server.transport);
    if (!handler?.closeSession) {
      return false;
    }
    const closed = await handler.closeSession(server);
    if (closed) {
      this.discoveryCache.delete(serverId);
    }
    return closed;
  }

  async sweepIdleSessions(idleTtlMs: number): Promise<string[]> {
    const closedServerIds: string[] = [];
    for (const server of this.serverRegistry.list()) {
      const handler = this.handlers.get(server.transport);
      if (!handler?.sweepIdleSessions) {
        continue;
      }
      const closed = await handler.sweepIdleSessions(idleTtlMs);
      for (const serverId of closed) {
        this.discoveryCache.delete(serverId);
        closedServerIds.push(serverId);
      }
    }
    return closedServerIds;
  }

  private toDiscoveryRecord(
    discovery: McpTransportDiscovery,
    capabilities: ReturnType<McpCapabilityRegistry['listByServer']>,
    discoveredAt: string
  ): McpServerDiscoveryRecord {
    return {
      sessionState: discovery.sessionState,
      discoveredCapabilities: discovery.discoveredCapabilities ?? capabilities.map(capability => capability.toolName),
      discoveryMode: discovery.discoveryMode,
      discoveredAt,
      lastError: discovery.errorMessage
    };
  }

  async invokeCapability(capabilityId: string, request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const capability = this.capabilityRegistry.get(capabilityId);
    if (!capability) {
      return {
        ok: false,
        outputSummary: `MCP capability ${capabilityId} is not registered`,
        errorMessage: 'missing_capability',
        durationMs: 0,
        exitCode: 1
      };
    }

    const server = this.serverRegistry.get(capability.serverId);
    if (!server?.enabled) {
      return {
        ok: false,
        outputSummary: `MCP server ${capability.serverId} is unavailable`,
        errorMessage: 'server_unavailable',
        durationMs: 0,
        exitCode: 1
      };
    }

    const handler = this.handlers.get(server.transport);
    if (!handler) {
      return {
        ok: false,
        outputSummary: `MCP transport ${server.transport} has no registered handler`,
        errorMessage: 'missing_transport_handler',
        durationMs: 0,
        exitCode: 1
      };
    }

    return handler.invoke(server, capability, request);
  }

  describeServers() {
    return this.serverRegistry.list().map(server => {
      const capabilities = this.capabilityRegistry.listByServer(server.id);
      const handler = this.handlers.get(server.transport);
      const discovery = this.discoveryCache.get(server.id);
      const sessionMetadata = handler?.getSessionMetadata?.(server);
      const health = handler
        ? handler.getHealth(server, capabilities)
        : {
            healthState: 'degraded' as const,
            healthReason: 'missing_transport_handler',
            implementedCapabilityCount: 0
          };

      return {
        ...server,
        healthState: health.healthState,
        healthReason: health.healthReason,
        capabilityCount: capabilities.length,
        implementedCapabilityCount: health.implementedCapabilityCount,
        discoveredCapabilityCount: discovery?.discoveredCapabilities.length ?? capabilities.length,
        discoveredCapabilities:
          discovery?.discoveredCapabilities ?? capabilities.map(capability => capability.toolName),
        discoveryMode: discovery?.discoveryMode ?? 'registered',
        sessionState:
          discovery?.sessionState ??
          (server.transport === 'local-adapter' || server.transport === 'http' ? 'stateless' : 'disconnected'),
        sessionCreatedAt: sessionMetadata?.createdAt,
        sessionLastActivityAt: sessionMetadata?.lastActivityAt,
        sessionRequestCount: sessionMetadata?.requestCount,
        sessionIdleMs: sessionMetadata?.idleMs,
        lastDiscoveredAt: discovery?.discoveredAt,
        lastDiscoveryError: discovery?.lastError,
        approvalRequiredCount: capabilities.filter(capability => capability.requiresApproval).length,
        highRiskCount: capabilities.filter(
          capability => capability.riskLevel === 'high' || capability.riskLevel === 'critical'
        ).length,
        capabilities
      };
    });
  }
}
