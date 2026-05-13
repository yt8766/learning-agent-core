import { describe, expect, it } from 'vitest';

import { McpServerRegistry, type McpServerDefinition } from '../../src/mcp/mcp-server-registry';

function makeServer(overrides: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return {
    id: 'server-1',
    displayName: 'Test Server',
    transport: 'stdio',
    enabled: true,
    ...overrides
  };
}

describe('McpServerRegistry', () => {
  describe('register and get', () => {
    it('registers and retrieves a server by id', () => {
      const registry = new McpServerRegistry();
      const server = makeServer();
      registry.register(server);

      expect(registry.get('server-1')).toEqual(server);
    });

    it('returns undefined for unknown server id', () => {
      const registry = new McpServerRegistry();
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('overwrites a server with the same id', () => {
      const registry = new McpServerRegistry();
      registry.register(makeServer({ displayName: 'First' }));
      registry.register(makeServer({ displayName: 'Second' }));

      expect(registry.get('server-1')?.displayName).toBe('Second');
    });
  });

  describe('list', () => {
    it('returns empty list when no servers are registered', () => {
      const registry = new McpServerRegistry();
      expect(registry.list()).toEqual([]);
    });

    it('returns all registered servers', () => {
      const registry = new McpServerRegistry();
      registry.register(makeServer({ id: 's1' }));
      registry.register(makeServer({ id: 's2' }));

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.map(s => s.id)).toEqual(expect.arrayContaining(['s1', 's2']));
    });
  });

  describe('setEnabled', () => {
    it('enables a disabled server', () => {
      const registry = new McpServerRegistry();
      registry.register(makeServer({ enabled: false }));

      const updated = registry.setEnabled('server-1', true);
      expect(updated?.enabled).toBe(true);
      expect(registry.get('server-1')?.enabled).toBe(true);
    });

    it('disables an enabled server', () => {
      const registry = new McpServerRegistry();
      registry.register(makeServer({ enabled: true }));

      const updated = registry.setEnabled('server-1', false);
      expect(updated?.enabled).toBe(false);
    });

    it('returns undefined for unknown server id', () => {
      const registry = new McpServerRegistry();
      expect(registry.setEnabled('unknown', true)).toBeUndefined();
    });
  });

  describe('McpServerDefinition fields', () => {
    it('supports optional transport types', () => {
      const registry = new McpServerRegistry();
      registry.register(makeServer({ transport: 'http', endpoint: 'https://example.com' }));
      registry.register(makeServer({ id: 's2', transport: 'cli', command: 'mcp-server' }));
      registry.register(makeServer({ id: 's3', transport: 'local-adapter' }));

      expect(registry.get('server-1')?.transport).toBe('http');
      expect(registry.get('s2')?.transport).toBe('cli');
      expect(registry.get('s3')?.transport).toBe('local-adapter');
    });

    it('supports optional trustClass and installationMode', () => {
      const registry = new McpServerRegistry();
      registry.register(
        makeServer({
          trustClass: 'official',
          installationMode: 'builtin',
          dataScope: 'workspace',
          writeScope: 'none'
        })
      );

      const result = registry.get('server-1');
      expect(result?.trustClass).toBe('official');
      expect(result?.installationMode).toBe('builtin');
      expect(result?.dataScope).toBe('workspace');
      expect(result?.writeScope).toBe('none');
    });
  });
});
