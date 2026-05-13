import { describe, expect, it, vi } from 'vitest';

import { LocalAdapterTransportHandler } from '../../src/transports/mcp-local-adapter-transport';
import type { McpCapabilityDefinition } from '../../src/mcp/mcp-capability-registry';
import type { McpServerDefinition } from '../../src/mcp/mcp-server-registry';
import { ActionIntent } from '@agent/core';

const capability: McpCapabilityDefinition = {
  id: 'local-srv:tool_a',
  toolName: 'tool_a',
  serverId: 'local-srv',
  displayName: 'Tool A',
  riskLevel: 'low',
  requiresApproval: false,
  category: 'knowledge'
};

const server: McpServerDefinition = {
  id: 'local-srv',
  displayName: 'Local Server',
  transport: 'local-adapter',
  enabled: true
};

function makeRequest() {
  return {
    taskId: 'task-1',
    toolName: 'tool_a',
    intent: ActionIntent.READ_FILE,
    input: { key: 'value' },
    requestedBy: 'agent' as const
  };
}

describe('LocalAdapterTransportHandler', () => {
  describe('invoke', () => {
    it('delegates to fallbackExecutor.execute and enriches result', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        ok: true,
        outputSummary: 'done',
        rawOutput: { data: 42 }
      });
      const handler = new LocalAdapterTransportHandler({ execute: mockExecute });

      const result = await handler.invoke(server, capability, makeRequest());

      expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'tool_a' }));
      expect(result.ok).toBe(true);
      expect(result.serverId).toBe('local-srv');
      expect(result.capabilityId).toBe('local-srv:tool_a');
      expect(result.transportUsed).toBe('local-adapter');
      expect(result.fallbackUsed).toBe(true);
    });

    it('propagates fallbackExecutor errors', async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error('fallback failed'));
      const handler = new LocalAdapterTransportHandler({ execute: mockExecute });

      await expect(handler.invoke(server, capability, makeRequest())).rejects.toThrow('fallback failed');
    });
  });

  describe('getHealth', () => {
    it('returns disabled when server is disabled', () => {
      const handler = new LocalAdapterTransportHandler({ execute: vi.fn() });

      const health = handler.getHealth({ ...server, enabled: false }, [capability]);

      expect(health.healthState).toBe('disabled');
      expect(health.healthReason).toBe('connector_disabled');
      expect(health.implementedCapabilityCount).toBe(0);
    });

    it('returns degraded when server is enabled', () => {
      const handler = new LocalAdapterTransportHandler({ execute: vi.fn() });

      const health = handler.getHealth(server, [capability, capability]);

      expect(health.healthState).toBe('degraded');
      expect(health.healthReason).toBe('fallback_local_adapter');
      expect(health.implementedCapabilityCount).toBe(2);
    });
  });

  describe('discover', () => {
    it('returns stateless discovery with registered capability names', async () => {
      const handler = new LocalAdapterTransportHandler({ execute: vi.fn() });

      const discovery = await handler.discover(server, [capability]);

      expect(discovery.sessionState).toBe('stateless');
      expect(discovery.discoveredCapabilities).toEqual(['tool_a']);
      expect(discovery.discoveryMode).toBe('registered');
    });
  });
});
