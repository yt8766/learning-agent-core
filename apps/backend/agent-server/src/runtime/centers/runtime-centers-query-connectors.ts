import { readKnowledgeOverview } from '../knowledge/runtime-knowledge-store';
import { buildConnectorsCenter } from './runtime-connectors-center';
import type { RuntimeCentersContext } from './runtime-centers.types';

export async function loadConnectorsCenter(ctx: RuntimeCentersContext) {
  await ctx.mcpClientManager.sweepIdleSessions(ctx.settings.mcp.stdioSessionIdleTtlMs);
  const [snapshot, knowledgeOverview] = await Promise.all([
    ctx.runtimeStateRepository.load(),
    readKnowledgeOverview(ctx.settings)
  ]);
  const tasks = ctx.orchestrator.listTasks();
  return buildConnectorsCenter({
    profile: ctx.settings.profile,
    snapshot,
    tasks,
    connectors: ctx.mcpClientManager.describeServers(),
    knowledgeOverview
  });
}
