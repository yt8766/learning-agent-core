import type { McpCapabilityRegistry } from './mcp-capability-registry';
import type { McpServerRegistry } from './mcp-server-registry';
import type { McpSkillProviderInstallInput } from './mcp-skill-provider-types';
import type { McpSkillProviderRegistry } from './mcp-skill-provider-registry';

export interface InstallMcpSkillProviderInput {
  providerRegistry: McpSkillProviderRegistry;
  serverRegistry: McpServerRegistry;
  capabilityRegistry: McpCapabilityRegistry;
  input: McpSkillProviderInstallInput;
}

export interface InstallMcpSkillProviderResult {
  ok: boolean;
  registeredServerIds: string[];
  registeredCapabilityIds: string[];
  warnings: string[];
  errors?: string[];
}

export function installMcpSkillProvider({
  providerRegistry,
  serverRegistry,
  capabilityRegistry,
  input
}: InstallMcpSkillProviderInput): InstallMcpSkillProviderResult {
  const provider = providerRegistry.get(input.providerId);
  if (!provider) {
    return {
      ok: false,
      registeredServerIds: [],
      registeredCapabilityIds: [],
      warnings: [],
      errors: [`missing_mcp_skill_provider:${input.providerId}`]
    };
  }

  const validation = provider.validate(input);
  if (validation.ok === false) {
    return {
      ok: false,
      registeredServerIds: [],
      registeredCapabilityIds: [],
      warnings: [],
      errors: validation.errors
    };
  }

  const plan = provider.buildInstallPlan(input);
  for (const server of plan.servers) {
    serverRegistry.register(server);
  }
  for (const capability of plan.capabilities) {
    capabilityRegistry.register(capability);
  }

  return {
    ok: true,
    registeredServerIds: plan.servers.map(server => server.id),
    registeredCapabilityIds: plan.capabilities.map(capability => capability.id),
    warnings: plan.warnings
  };
}
