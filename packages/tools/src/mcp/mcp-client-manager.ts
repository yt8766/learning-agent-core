import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/runtime';

import type { SandboxExecutor } from '@agent/runtime';
import type { ExecutionWatchdog } from '@agent/runtime';
import { McpCapabilityRegistry } from './mcp-capability-registry';
import { McpServerRegistry } from './mcp-server-registry';
import {
  CliTransportHandler,
  HttpTransportHandler,
  LocalAdapterTransportHandler,
  McpTransportDiscovery,
  McpTransportHandler,
  StdioTransportHandler,
  type CliCapabilityBinding
} from '../transports/mcp-transport-handlers';

interface McpServerDiscoveryRecord {
  sessionState: 'stateless' | 'disconnected' | 'connected' | 'error';
  discoveredCapabilities: string[];
  discoveredAt?: string;
  discoveryMode: 'registered' | 'remote';
  lastError?: string;
}

interface PreferredToolRoute {
  capabilityId: string;
  serverId: string;
  transport: 'http' | 'stdio' | 'local-adapter' | 'cli';
  requiresApproval: boolean;
}

function isStatelessTransport(transport: 'http' | 'stdio' | 'local-adapter' | 'cli'): boolean {
  return transport === 'local-adapter' || transport === 'http' || transport === 'cli';
}

export class McpClientManager {
  private readonly handlers = new Map<string, McpTransportHandler>();
  private readonly discoveryCache = new Map<string, McpServerDiscoveryRecord>();
  private readonly transportPriority: Record<'http' | 'stdio' | 'local-adapter' | 'cli', number> = {
    http: 3,
    stdio: 2,
    cli: 2,
    'local-adapter': 1
  };

  constructor(
    private readonly serverRegistry: McpServerRegistry,
    private readonly capabilityRegistry: McpCapabilityRegistry,
    private readonly fallbackExecutor: SandboxExecutor,
    options?: {
      stdioMaxSessions?: number;
      watchdog?: ExecutionWatchdog;
      cliBindings?: Map<string, CliCapabilityBinding>;
    }
  ) {
    this.registerHandler(new LocalAdapterTransportHandler(this.fallbackExecutor));
    this.registerHandler(new HttpTransportHandler());
    this.registerHandler(new StdioTransportHandler({ maxSessions: options?.stdioMaxSessions }));
    if (options?.cliBindings && options.cliBindings.size > 0) {
      this.registerHandler(new CliTransportHandler(options.cliBindings));
    }
    this.watchdog = options?.watchdog;
  }
  private readonly watchdog?: ExecutionWatchdog;

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
        sessionState: isStatelessTransport(server.transport) ? 'stateless' : 'disconnected',
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

    if (this.capabilityRegistry.isServerDenied(capability.serverId)) {
      return {
        ok: false,
        outputSummary: `MCP server ${capability.serverId} is blocked by policy override`,
        errorMessage: 'server_blocked_by_policy',
        durationMs: 0,
        exitCode: 1
      };
    }

    if (this.capabilityRegistry.isCapabilityDenied(capability.id)) {
      return {
        ok: false,
        outputSummary: `MCP capability ${capability.id} is blocked by policy override`,
        errorMessage: 'capability_blocked_by_policy',
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

    return this.watchdog
      ? this.watchdog.guard(
          {
            taskId: request.taskId,
            toolName: capability.toolName,
            serverId: capability.serverId,
            capabilityId: capability.id,
            timeoutMs: capability.timeoutMs,
            request
          },
          () => handler.invoke(server, capability, request)
        )
      : handler.invoke(server, capability, request);
  }

  async invokeTool(toolName: string, request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const capability = this.resolvePreferredCapabilityForTool(toolName);
    if (!capability) {
      return {
        ok: false,
        outputSummary: `MCP tool ${toolName} has no registered capability`,
        errorMessage: 'missing_tool_capability',
        durationMs: 0,
        exitCode: 1
      };
    }

    return this.invokeCapability(capability.id, request);
  }

  describeToolRoute(toolName: string): PreferredToolRoute | undefined {
    const capability = this.resolvePreferredCapabilityForTool(toolName);
    if (!capability) {
      return undefined;
    }
    const server = this.serverRegistry.get(capability.serverId);
    if (!server) {
      return undefined;
    }
    return {
      capabilityId: capability.id,
      serverId: capability.serverId,
      transport: server.transport,
      requiresApproval: capability.requiresApproval
    };
  }

  private resolvePreferredCapabilityForTool(toolName: string) {
    const candidates = this.capabilityRegistry
      .list()
      .filter(capability => capability.toolName === toolName)
      .filter(capability => !this.capabilityRegistry.isServerDenied(capability.serverId))
      .filter(capability => this.serverRegistry.get(capability.serverId)?.enabled);

    if (!candidates.length) {
      return undefined;
    }

    return candidates.slice().sort((left, right) => {
      const leftServer = this.serverRegistry.get(left.serverId);
      const rightServer = this.serverRegistry.get(right.serverId);
      const leftPriority = leftServer ? this.transportPriority[leftServer.transport] : 0;
      const rightPriority = rightServer ? this.transportPriority[rightServer.transport] : 0;
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      if (left.requiresApproval !== right.requiresApproval) {
        return Number(left.requiresApproval) - Number(right.requiresApproval);
      }
      return left.id.localeCompare(right.id);
    })[0];
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

      const enrichedCapabilities = capabilities.map(capability => {
        const preferred = this.resolvePreferredCapabilityForTool(capability.toolName);
        return {
          ...capability,
          isPrimaryForTool: preferred?.id === capability.id,
          fallbackAvailable: this.capabilityRegistry
            .list()
            .some(item => item.toolName === capability.toolName && item.id !== capability.id)
        };
      });

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
          discovery?.sessionState ?? (isStatelessTransport(server.transport) ? 'stateless' : 'disconnected'),
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
        capabilities: enrichedCapabilities
      };
    });
  }
}
