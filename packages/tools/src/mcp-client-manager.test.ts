import { describe, expect, it, vi } from 'vitest';

import { McpCapabilityRegistry } from './mcp-capability-registry';
import { McpClientManager } from './mcp-client-manager';
import { McpServerRegistry } from './mcp-server-registry';

describe('McpClientManager', () => {
  it('本地适配器可回退到 sandbox executor', async () => {
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
});
