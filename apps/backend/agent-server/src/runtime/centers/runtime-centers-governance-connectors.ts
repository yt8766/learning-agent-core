import { loadConnectorProjectionById } from '../domain/connectors/runtime-connector-view-reader';
import { RuntimeCentersContext } from './runtime-centers.types';

export async function loadConnectorView(ctx: RuntimeCentersContext, connectorId: string) {
  return (await loadConnectorProjectionById({
    settings: ctx.settings,
    runtimeStateRepository: ctx.runtimeStateRepository,
    orchestrator: ctx.orchestrator,
    mcpClientManager: ctx.mcpClientManager,
    refreshDiscovery: true,
    includeStdioInRefresh: false,
    connectorId
  }))!;
}
