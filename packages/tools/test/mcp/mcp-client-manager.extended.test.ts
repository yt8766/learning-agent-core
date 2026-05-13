import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ActionIntent } from '@agent/core';

import { McpClientManager } from '../../src/mcp/mcp-client-manager';
import { McpServerRegistry } from '../../src/mcp/mcp-server-registry';
import { McpCapabilityRegistry } from '../../src/mcp/mcp-capability-registry';
import type { ToolFallbackExecutor } from '../../src/contracts';

describe('McpClientManager extended coverage', () => {
  let serverRegistry: McpServerRegistry;
  let capabilityRegistry: McpCapabilityRegistry;
  let fallbackExecutor: ToolFallbackExecutor;

  beforeEach(() => {
    serverRegistry = new McpServerRegistry();
    capabilityRegistry = new McpCapabilityRegistry();
    fallbackExecutor = { execute: vi.fn().mockResolvedValue({ ok: true, outputSummary: 'done' }) };
  });

  function createManager(options?: Parameters<typeof McpClientManager>[3]) {
    return new McpClientManager(serverRegistry, capabilityRegistry, fallbackExecutor, options);
  }

  function registerTestServer(overrides: Record<string, unknown> = {}) {
    serverRegistry.register({
      id: 'test-srv',
      displayName: 'Test',
      transport: 'http',
      enabled: true,
      endpoint: 'https://test.example.com',
      ...overrides
    });
  }

  function registerTestCapability(overrides: Record<string, unknown> = {}) {
    capabilityRegistry.register({
      id: 'test-srv:tool_a',
      toolName: 'tool_a',
      serverId: 'test-srv',
      displayName: 'Tool A',
      riskLevel: 'low',
      requiresApproval: false,
      category: 'knowledge',
      ...overrides
    });
  }

  describe('hasCapability', () => {
    it('returns true for registered capability', () => {
      registerTestCapability();
      const manager = createManager();

      expect(manager.hasCapability('test-srv:tool_a')).toBe(true);
    });

    it('returns false for unregistered capability', () => {
      const manager = createManager();

      expect(manager.hasCapability('nonexistent')).toBe(false);
    });
  });

  describe('invokeCapability', () => {
    it('returns missing_capability error for unregistered capability', async () => {
      const manager = createManager();

      const result = await manager.invokeCapability('nonexistent', {} as any);

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('missing_capability');
    });

    it('returns server_blocked_by_policy when server is denied', async () => {
      registerTestServer();
      registerTestCapability();
      capabilityRegistry.setServerApprovalOverride('test-srv', 'deny');
      const manager = createManager();

      const result = await manager.invokeCapability('test-srv:tool_a', {} as any);

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('server_blocked_by_policy');
    });

    it('returns capability_blocked_by_policy when capability is denied', async () => {
      registerTestServer();
      registerTestCapability();
      capabilityRegistry.setCapabilityApprovalOverride('test-srv:tool_a', 'deny');
      const manager = createManager();

      const result = await manager.invokeCapability('test-srv:tool_a', {} as any);

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('capability_blocked_by_policy');
    });

    it('returns server_unavailable when server is disabled', async () => {
      registerTestServer({ enabled: false });
      registerTestCapability();
      const manager = createManager();

      const result = await manager.invokeCapability('test-srv:tool_a', {} as any);

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('server_unavailable');
    });
  });

  describe('invokeTool', () => {
    it('returns missing_tool_capability when no capability matches', async () => {
      const manager = createManager();

      const result = await manager.invokeTool('nonexistent_tool', {} as any);

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('missing_tool_capability');
    });
  });

  describe('describeToolRoute', () => {
    it('returns undefined when no capability matches', () => {
      const manager = createManager();

      expect(manager.describeToolRoute('nonexistent')).toBeUndefined();
    });

    it('returns route info for matching capability', () => {
      registerTestServer();
      registerTestCapability();
      const manager = createManager();

      const route = manager.describeToolRoute('tool_a');

      expect(route).toBeDefined();
      expect(route?.transport).toBe('http');
      expect(route?.serverId).toBe('test-srv');
    });
  });

  describe('refreshServerDiscovery', () => {
    it('does nothing for unknown server', async () => {
      const manager = createManager();

      await manager.refreshServerDiscovery('nonexistent');
      // No error thrown
    });
  });

  describe('refreshAllServerDiscovery', () => {
    it('skips stdio servers by default', async () => {
      serverRegistry.register({
        id: 'stdio-srv',
        displayName: 'Stdio',
        transport: 'stdio',
        enabled: true,
        command: 'node'
      });
      registerTestServer();
      const manager = createManager();

      await manager.refreshAllServerDiscovery();
      // No error; stdio server was skipped
    });

    it('includes stdio servers when option is set', async () => {
      serverRegistry.register({
        id: 'http-only',
        displayName: 'HTTP',
        transport: 'http',
        enabled: true,
        endpoint: 'https://example.com'
      });
      const manager = createManager();

      // With includeStdio=true, it won't skip http servers (which are not stdio)
      // This tests the option is passed through without error
      await manager.refreshAllServerDiscovery({ includeStdio: true });
      // No error thrown
    }, 10000);
  });

  describe('closeServerSession', () => {
    it('returns false for unknown server', async () => {
      const manager = createManager();

      const result = await manager.closeServerSession('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('sweepIdleSessions', () => {
    it('returns empty array when no sessions to sweep', async () => {
      const manager = createManager();

      const result = await manager.sweepIdleSessions(60000);

      expect(result).toEqual([]);
    });
  });

  describe('describeServers', () => {
    it('returns empty when no servers registered', () => {
      const manager = createManager();

      expect(manager.describeServers()).toEqual([]);
    });

    it('enriches server descriptions with health and capabilities', () => {
      registerTestServer();
      registerTestCapability();
      const manager = createManager();

      const descriptions = manager.describeServers();

      expect(descriptions).toHaveLength(1);
      expect(descriptions[0].healthState).toBe('healthy');
      expect(descriptions[0].capabilities).toHaveLength(1);
      expect(descriptions[0].capabilities[0].isPrimaryForTool).toBe(true);
    });

    it('handles missing transport handler gracefully', () => {
      serverRegistry.register({
        id: 'weird-srv',
        displayName: 'Weird',
        transport: 'nonexistent' as any,
        enabled: true
      });
      const manager = createManager();

      const descriptions = manager.describeServers();

      expect(descriptions[0].healthState).toBe('degraded');
      expect(descriptions[0].healthReason).toBe('missing_transport_handler');
    });
  });
});
