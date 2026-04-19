import type { RuntimeConnectorRegistryContext } from '../../centers/runtime-centers.types';
import type { RuntimeHost } from '../../core/runtime.host';

export interface RuntimeConnectorRegistryContextInput {
  settings: () => RuntimeHost['settings'];
  mcpServerRegistry: () => RuntimeHost['mcpServerRegistry'];
  mcpCapabilityRegistry: () => RuntimeHost['mcpCapabilityRegistry'];
  mcpClientManager: () => RuntimeHost['mcpClientManager'];
  orchestrator: () => RuntimeHost['orchestrator'];
}

export function createConnectorRegistryContext(
  input: RuntimeConnectorRegistryContextInput
): RuntimeConnectorRegistryContext {
  return {
    settings: input.settings(),
    mcpServerRegistry: input.mcpServerRegistry(),
    mcpCapabilityRegistry: input.mcpCapabilityRegistry(),
    mcpClientManager: input.mcpClientManager(),
    orchestrator: input.orchestrator()
  };
}
