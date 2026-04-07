export interface McpServerDefinition {
  id: string;
  displayName: string;
  transport: 'local-adapter' | 'stdio' | 'http';
  enabled: boolean;
  source?: string;
  trustClass?: 'official' | 'curated' | 'community' | 'unverified' | 'internal';
  dataScope?: string;
  writeScope?: string;
  installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
  allowedProfiles?: Array<'platform' | 'company' | 'personal' | 'cli'>;
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

  setEnabled(serverId: string, enabled: boolean): McpServerDefinition | undefined {
    const server = this.servers.get(serverId);
    if (!server) {
      return undefined;
    }
    const updated = {
      ...server,
      enabled
    };
    this.servers.set(serverId, updated);
    return updated;
  }

  list(): McpServerDefinition[] {
    return Array.from(this.servers.values());
  }
}
