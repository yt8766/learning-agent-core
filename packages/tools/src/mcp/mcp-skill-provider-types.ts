import type { McpCapabilityDefinition } from './mcp-capability-registry';
import type { McpServerDefinition } from './mcp-server-registry';

export type McpSkillProviderTransport = McpServerDefinition['transport'] | 'sse' | 'streamable-http';

export interface McpSkillProviderSecretRequirement {
  key: string;
  label: string;
  required: boolean;
  sensitive: boolean;
}

export interface McpSkillProviderDescriptor {
  id: string;
  displayName: string;
  builtIn: boolean;
  trustClass: NonNullable<McpServerDefinition['trustClass']>;
  supportedTransports: McpSkillProviderTransport[];
  skillIds: string[];
  description?: string;
  homepageUrl?: string;
  documentationUrl?: string;
}

export interface McpSkillProviderInstallInput {
  providerId: string;
  profile: NonNullable<McpServerDefinition['allowedProfiles']>[number];
  secrets: Record<string, string | undefined>;
  serverId?: string;
  enabled?: boolean;
  transportPreference?: McpSkillProviderTransport;
  options?: Record<string, unknown>;
}

export interface McpSkillProviderInstallPlan {
  servers: McpServerDefinition[];
  capabilities: McpCapabilityDefinition[];
  warnings: string[];
}

export type McpSkillProviderValidationResult = { ok: true } | { ok: false; errors: string[] };

export interface McpSkillProviderAdapter {
  readonly descriptor: McpSkillProviderDescriptor;
  readonly secretRequirements: McpSkillProviderSecretRequirement[];
  validate(input: McpSkillProviderInstallInput): McpSkillProviderValidationResult;
  buildInstallPlan(input: McpSkillProviderInstallInput): McpSkillProviderInstallPlan;
}
