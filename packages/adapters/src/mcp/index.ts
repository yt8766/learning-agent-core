import { createMiniMaxMcpSkillProvider } from './minimax';
import type { AdapterMcpSkillProviderRegistryLike } from './mcp-skill-provider-adapter';
import { createZhipuMcpSkillProvider } from './zhipu';

export type {
  AdapterMcpCapabilityDefinition,
  AdapterMcpServerDefinition,
  AdapterMcpSkillProviderAdapter,
  AdapterMcpSkillProviderInstallInput,
  AdapterMcpSkillProviderRegistryLike,
  AdapterMcpTransport
} from './mcp-skill-provider-adapter';
export { buildMiniMaxMcpCapabilities, createMiniMaxMcpSkillProvider } from './minimax';
export { buildZhipuMcpCapabilities, createZhipuMcpSkillProvider } from './zhipu';

export function registerDefaultMcpSkillProviders<T extends AdapterMcpSkillProviderRegistryLike>(registry: T): T {
  registry.register(createMiniMaxMcpSkillProvider());
  registry.register(createZhipuMcpSkillProvider());
  return registry;
}
