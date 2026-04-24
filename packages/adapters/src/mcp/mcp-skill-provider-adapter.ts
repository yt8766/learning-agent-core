export type AdapterMcpTransport = 'local-adapter' | 'stdio' | 'http' | 'sse' | 'streamable-http';

export interface AdapterMcpServerDefinition {
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

export interface AdapterMcpCapabilityDefinition {
  id: string;
  toolName: string;
  serverId: string;
  displayName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  category: 'system' | 'knowledge' | 'memory' | 'action';
  timeoutMs?: number;
  dataScope?: string;
  writeScope?: string;
}

export interface AdapterMcpSkillProviderInstallInput {
  providerId: string;
  profile: 'platform' | 'company' | 'personal' | 'cli';
  secrets: Record<string, string | undefined>;
  serverId?: string;
  enabled?: boolean;
  transportPreference?: AdapterMcpTransport;
  options?: Record<string, unknown>;
}

export interface AdapterMcpSkillProviderAdapter {
  readonly descriptor: {
    id: string;
    displayName: string;
    builtIn: boolean;
    trustClass: NonNullable<AdapterMcpServerDefinition['trustClass']>;
    supportedTransports: AdapterMcpTransport[];
    skillIds: string[];
    description?: string;
    homepageUrl?: string;
    documentationUrl?: string;
  };
  readonly secretRequirements: Array<{ key: string; label: string; required: boolean; sensitive: boolean }>;
  validate(input: AdapterMcpSkillProviderInstallInput): { ok: true } | { ok: false; errors: string[] };
  buildInstallPlan(input: AdapterMcpSkillProviderInstallInput): {
    servers: AdapterMcpServerDefinition[];
    capabilities: AdapterMcpCapabilityDefinition[];
    warnings: string[];
  };
}

export interface AdapterMcpSkillProviderRegistryLike {
  register(provider: AdapterMcpSkillProviderAdapter): void;
}
