export interface McpServerDefinition {
  id: string;
  displayName: string;
  transport: 'local-adapter' | 'stdio' | 'http';
  enabled: boolean;
  endpoint?: string;
  discoveryEndpoint?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export class McpServerRegistry {
  private readonly servers = new Map<string, McpServerDefinition>();

  register(server: McpServerDefinition): void {
    this.servers.set(server.id, server);
  }

  get(serverId: string): McpServerDefinition | undefined {
    return this.servers.get(serverId);
  }

  list(): McpServerDefinition[] {
    return Array.from(this.servers.values());
  }
}
