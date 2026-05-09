import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/core';

import type { McpCapabilityDefinition } from '../mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../mcp/mcp-server-registry';
import type { McpTransportDiscovery, McpTransportHandler, McpTransportHealth } from '../mcp/mcp-transport-types';
import type { ToolFallbackExecutor } from '../contracts';

export class LocalAdapterTransportHandler implements McpTransportHandler {
  readonly transport = 'local-adapter' as const;

  constructor(private readonly fallbackExecutor: ToolFallbackExecutor) {}

  invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    return this.fallbackExecutor
      .execute({
        ...request,
        toolName: capability.toolName
      })
      .then(result => ({
        ...result,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'local-adapter' as const,
        fallbackUsed: true
      }));
  }

  getHealth(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): McpTransportHealth {
    if (!server.enabled) {
      return {
        healthState: 'disabled',
        healthReason: 'connector_disabled',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'degraded',
      healthReason: 'fallback_local_adapter',
      implementedCapabilityCount: capabilities.length
    };
  }

  async discover(
    _server: McpServerDefinition,
    capabilities: McpCapabilityDefinition[]
  ): Promise<McpTransportDiscovery> {
    return {
      sessionState: 'stateless',
      discoveredCapabilities: capabilities.map(capability => capability.toolName),
      discoveryMode: 'registered'
    };
  }
}
