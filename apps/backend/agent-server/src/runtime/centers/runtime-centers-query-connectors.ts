import { readKnowledgeOverview } from '../knowledge/runtime-knowledge-store';
import { loadConnectorCenterProjection } from '../domain/connectors/runtime-connector-view-reader';
import type { RuntimeCentersContext } from './runtime-centers.types';

export async function loadConnectorsCenter(ctx: RuntimeCentersContext) {
  return loadConnectorCenterProjection({
    settings: ctx.settings,
    runtimeStateRepository: ctx.runtimeStateRepository,
    orchestrator: ctx.orchestrator,
    mcpClientManager: ctx.mcpClientManager,
    loadKnowledgeOverview: () => readKnowledgeOverview(ctx.settings)
  });
}
