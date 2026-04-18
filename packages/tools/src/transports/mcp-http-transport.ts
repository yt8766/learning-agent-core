import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/core';

import type { McpCapabilityDefinition } from '../mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../mcp/mcp-server-registry';
import type { McpTransportDiscovery, McpTransportHandler, McpTransportHealth } from '../mcp/mcp-transport-types';

export class HttpTransportHandler implements McpTransportHandler {
  readonly transport = 'http' as const;

  async invoke(
    server: McpServerDefinition,
    capability: McpCapabilityDefinition,
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    if (!server.endpoint) {
      return {
        ok: false,
        outputSummary: `MCP server ${server.id} is missing an HTTP endpoint`,
        errorMessage: 'missing_endpoint',
        durationMs: 0,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'http',
        fallbackUsed: false
      };
    }

    const startedAt = Date.now();

    try {
      const response = await fetch(server.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(server.headers ?? {})
        },
        body: JSON.stringify({
          capabilityId: capability.id,
          toolName: capability.toolName,
          request
        })
      });

      if (!response.ok) {
        return {
          ok: false,
          outputSummary: `HTTP MCP server ${server.id} returned ${response.status}`,
          errorMessage: `http_${response.status}`,
          durationMs: Date.now() - startedAt,
          exitCode: 1,
          serverId: server.id,
          capabilityId: capability.id,
          transportUsed: 'http',
          fallbackUsed: false
        };
      }

      const payload = (await response.json()) as Partial<ToolExecutionResult>;
      return {
        ok: payload.ok ?? false,
        outputSummary: payload.outputSummary ?? `HTTP MCP server ${server.id} completed`,
        rawOutput: payload.rawOutput,
        exitCode: payload.exitCode ?? (payload.ok ? 0 : 1),
        errorMessage: payload.errorMessage,
        durationMs: payload.durationMs ?? Date.now() - startedAt,
        serverId: payload.serverId ?? server.id,
        capabilityId: payload.capabilityId ?? capability.id,
        transportUsed: 'http',
        fallbackUsed: false
      };
    } catch (error) {
      return {
        ok: false,
        outputSummary: `HTTP MCP server ${server.id} request failed`,
        errorMessage: error instanceof Error ? error.message : 'http_request_failed',
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        serverId: server.id,
        capabilityId: capability.id,
        transportUsed: 'http',
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

    if (!server.endpoint) {
      return {
        healthState: 'degraded',
        healthReason: 'missing_http_endpoint',
        implementedCapabilityCount: 0
      };
    }

    return {
      healthState: 'healthy',
      healthReason: 'http_transport_ready',
      implementedCapabilityCount: capabilities.length
    };
  }

  async discover(server: McpServerDefinition, capabilities: McpCapabilityDefinition[]): Promise<McpTransportDiscovery> {
    const endpoint = server.discoveryEndpoint ?? server.endpoint;
    if (!endpoint) {
      return {
        sessionState: 'error',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        errorMessage: 'missing_http_discovery_endpoint'
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(server.headers ?? {})
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });

      if (!response.ok) {
        return {
          sessionState: 'error',
          discoveredCapabilities: capabilities.map(capability => capability.toolName),
          discoveryMode: 'registered',
          errorMessage: `http_discovery_${response.status}`
        };
      }

      const payload = (await response.json()) as {
        tools?: Array<{ name?: string }>;
        result?: { tools?: Array<{ name?: string }> };
      };
      const tools = payload.tools ?? payload.result?.tools ?? [];
      const discoveredCapabilities = Array.isArray(tools)
        ? tools.map(tool => tool?.name).filter((name): name is string => typeof name === 'string' && name.length > 0)
        : [];

      return {
        sessionState: 'connected',
        discoveredCapabilities: discoveredCapabilities.length
          ? discoveredCapabilities
          : capabilities.map(capability => capability.toolName),
        discoveryMode: discoveredCapabilities.length ? 'remote' : 'registered'
      };
    } catch (error) {
      return {
        sessionState: 'error',
        discoveredCapabilities: capabilities.map(capability => capability.toolName),
        discoveryMode: 'registered',
        errorMessage: error instanceof Error ? error.message : 'http_discovery_failed'
      };
    }
  }
}
