import { ToolExecutionRequest, ToolExecutionResult } from '@agent/shared';

import { SandboxExecutor } from './sandbox-executor';
import { McpCapabilityRegistry } from './mcp-capability-registry';
import { McpServerRegistry } from './mcp-server-registry';

export class McpClientManager {
  constructor(
    private readonly serverRegistry: McpServerRegistry,
    private readonly capabilityRegistry: McpCapabilityRegistry,
    private readonly fallbackExecutor: SandboxExecutor
  ) {}

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

    if (server.transport === 'local-adapter') {
      return this.fallbackExecutor.execute({
        ...request,
        toolName: capability.toolName
      });
    }

    return {
      ok: false,
      outputSummary: `MCP server ${server.id} is registered but transport ${server.transport} is not implemented yet`,
      errorMessage: 'transport_not_implemented',
      durationMs: 0,
      exitCode: 1
    };
  }
}
