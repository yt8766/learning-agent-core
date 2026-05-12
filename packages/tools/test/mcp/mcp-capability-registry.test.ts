import { describe, expect, it } from 'vitest';

import { McpCapabilityRegistry, type McpCapabilityDefinition } from '../../src/mcp/mcp-capability-registry';

function makeCapability(overrides: Partial<McpCapabilityDefinition> = {}): McpCapabilityDefinition {
  return {
    id: 'srv1:tool-a',
    toolName: 'tool-a',
    serverId: 'srv1',
    displayName: 'Tool A',
    riskLevel: 'low',
    requiresApproval: false,
    category: 'system',
    ...overrides
  };
}

describe('McpCapabilityRegistry', () => {
  describe('register and get', () => {
    it('registers and retrieves a capability by id', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability());

      const result = registry.get('srv1:tool-a');
      expect(result?.toolName).toBe('tool-a');
      expect(result?.serverId).toBe('srv1');
    });

    it('returns undefined for unknown capability id', () => {
      const registry = new McpCapabilityRegistry();
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('registerFromTools', () => {
    it('registers capabilities from tool definitions with derived ids', () => {
      const registry = new McpCapabilityRegistry();
      registry.registerFromTools('server-1', [
        {
          name: 'read-file',
          description: 'Read a file',
          family: 'filesystem',
          category: 'system',
          riskLevel: 'low',
          requiresApproval: false,
          timeoutMs: 5000,
          sandboxProfile: 'strict',
          capabilityType: 'tool',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: false,
          permissionScope: 'workspace',
          inputSchema: {}
        }
      ]);

      const cap = registry.get('server-1:read-file');
      expect(cap).toBeDefined();
      expect(cap?.toolName).toBe('read-file');
      expect(cap?.serverId).toBe('server-1');
      expect(cap?.dataScope).toBe('workspace');
      expect(cap?.writeScope).toBe('workspace-read');
    });

    it('sets dataScope to workspace-and-knowledge for memory/knowledge categories', () => {
      const registry = new McpCapabilityRegistry();
      registry.registerFromTools('srv', [
        {
          name: 'search-memory',
          description: 'Search memory',
          family: 'memory',
          category: 'memory',
          riskLevel: 'low',
          requiresApproval: false,
          timeoutMs: 5000,
          sandboxProfile: 'strict',
          capabilityType: 'tool',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: false,
          permissionScope: 'workspace',
          inputSchema: {}
        },
        {
          name: 'search-knowledge',
          description: 'Search knowledge',
          family: 'knowledge',
          category: 'knowledge',
          riskLevel: 'low',
          requiresApproval: false,
          timeoutMs: 5000,
          sandboxProfile: 'strict',
          capabilityType: 'tool',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: false,
          permissionScope: 'workspace',
          inputSchema: {}
        }
      ]);

      expect(registry.get('srv:search-memory')?.dataScope).toBe('workspace-and-knowledge');
      expect(registry.get('srv:search-knowledge')?.dataScope).toBe('workspace-and-knowledge');
    });

    it('sets writeScope to writes-or-external-actions for action tools with approval', () => {
      const registry = new McpCapabilityRegistry();
      registry.registerFromTools('srv', [
        {
          name: 'send-email',
          description: 'Send email',
          family: 'action',
          category: 'action',
          riskLevel: 'high',
          requiresApproval: true,
          timeoutMs: 10000,
          sandboxProfile: 'strict',
          capabilityType: 'tool',
          isReadOnly: false,
          isConcurrencySafe: false,
          isDestructive: true,
          supportsStreamingDispatch: false,
          permissionScope: 'external',
          inputSchema: {}
        }
      ]);

      expect(registry.get('srv:send-email')?.writeScope).toBe('writes-or-external-actions');
    });

    it('sets writeScope to workspace-read for system category', () => {
      const registry = new McpCapabilityRegistry();
      registry.registerFromTools('srv', [
        {
          name: 'sys-tool',
          description: 'System tool',
          family: 'system',
          category: 'system',
          riskLevel: 'low',
          requiresApproval: false,
          timeoutMs: 5000,
          sandboxProfile: 'strict',
          capabilityType: 'tool',
          isReadOnly: true,
          isConcurrencySafe: true,
          isDestructive: false,
          supportsStreamingDispatch: false,
          permissionScope: 'workspace',
          inputSchema: {}
        }
      ]);

      expect(registry.get('srv:sys-tool')?.writeScope).toBe('workspace-read');
    });
  });

  describe('list and listByServer', () => {
    it('lists all capabilities', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ id: 'c1', serverId: 's1' }));
      registry.register(makeCapability({ id: 'c2', serverId: 's2' }));

      expect(registry.list()).toHaveLength(2);
    });

    it('lists capabilities filtered by server id', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ id: 'c1', serverId: 's1' }));
      registry.register(makeCapability({ id: 'c2', serverId: 's2' }));
      registry.register(makeCapability({ id: 'c3', serverId: 's1' }));

      const s1Caps = registry.listByServer('s1');
      expect(s1Caps).toHaveLength(2);
      expect(s1Caps.every(c => c.serverId === 's1')).toBe(true);
    });
  });

  describe('server approval overrides', () => {
    it('sets and gets a server approval override', () => {
      const registry = new McpCapabilityRegistry();
      registry.setServerApprovalOverride('srv1', 'deny');
      expect(registry.getServerApprovalOverride('srv1')).toBe('deny');
    });

    it('clears server override when effect is observe or undefined', () => {
      const registry = new McpCapabilityRegistry();
      registry.setServerApprovalOverride('srv1', 'allow');
      registry.setServerApprovalOverride('srv1', 'observe');
      expect(registry.getServerApprovalOverride('srv1')).toBeUndefined();

      registry.setServerApprovalOverride('srv1', 'allow');
      registry.setServerApprovalOverride('srv1', undefined);
      expect(registry.getServerApprovalOverride('srv1')).toBeUndefined();
    });

    it('reports server as denied when override is deny', () => {
      const registry = new McpCapabilityRegistry();
      expect(registry.isServerDenied('srv1')).toBe(false);
      registry.setServerApprovalOverride('srv1', 'deny');
      expect(registry.isServerDenied('srv1')).toBe(true);
    });
  });

  describe('capability approval overrides', () => {
    it('sets and gets a capability approval override', () => {
      const registry = new McpCapabilityRegistry();
      registry.setCapabilityApprovalOverride('cap1', 'require-approval');
      expect(registry.getCapabilityApprovalOverride('cap1')).toBe('require-approval');
    });

    it('clears capability override when effect is observe or undefined', () => {
      const registry = new McpCapabilityRegistry();
      registry.setCapabilityApprovalOverride('cap1', 'allow');
      registry.setCapabilityApprovalOverride('cap1', 'observe');
      expect(registry.getCapabilityApprovalOverride('cap1')).toBeUndefined();
    });

    it('reports capability as denied when override is deny', () => {
      const registry = new McpCapabilityRegistry();
      expect(registry.isCapabilityDenied('cap1')).toBe(false);
      registry.setCapabilityApprovalOverride('cap1', 'deny');
      expect(registry.isCapabilityDenied('cap1')).toBe(true);
    });
  });

  describe('applyOverrides', () => {
    it('allow override sets requiresApproval to false', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ requiresApproval: true }));
      registry.setServerApprovalOverride('srv1', 'allow');

      const result = registry.get('srv1:tool-a');
      expect(result?.requiresApproval).toBe(false);
    });

    it('require-approval override sets requiresApproval to true', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ requiresApproval: false }));
      registry.setServerApprovalOverride('srv1', 'require-approval');

      const result = registry.get('srv1:tool-a');
      expect(result?.requiresApproval).toBe(true);
    });

    it('capability-level override takes precedence over server-level override', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ requiresApproval: false }));
      registry.setServerApprovalOverride('srv1', 'require-approval');
      registry.setCapabilityApprovalOverride('srv1:tool-a', 'allow');

      const result = registry.get('srv1:tool-a');
      expect(result?.requiresApproval).toBe(false);
    });

    it('observe override does not change the capability', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ requiresApproval: true }));
      registry.setServerApprovalOverride('srv1', 'observe');

      const result = registry.get('srv1:tool-a');
      expect(result?.requiresApproval).toBe(true);
    });

    it('list applies overrides to all capabilities', () => {
      const registry = new McpCapabilityRegistry();
      registry.register(makeCapability({ id: 'c1', serverId: 's1', requiresApproval: false }));
      registry.register(makeCapability({ id: 'c2', serverId: 's1', requiresApproval: false }));
      registry.setServerApprovalOverride('s1', 'require-approval');

      const list = registry.list();
      expect(list.every(c => c.requiresApproval === true)).toBe(true);
    });
  });
});
