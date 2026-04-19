import { buildConnectorsCenter } from './runtime-connectors-center';
import { RuntimeCentersContext } from './runtime-centers.types';

export async function loadConnectorView(ctx: RuntimeCentersContext, connectorId: string) {
  await ctx.mcpClientManager.sweepIdleSessions(ctx.settings.mcp.stdioSessionIdleTtlMs);
  await ctx.mcpClientManager.refreshAllServerDiscovery({ includeStdio: false }).catch(() => undefined);
  const snapshot = await ctx.runtimeStateRepository.load();
  const tasks = ctx.orchestrator.listTasks();
  return buildConnectorsCenter({
    profile: ctx.settings.profile,
    snapshot,
    tasks,
    connectors: ctx.mcpClientManager.describeServers()
  }).find((item: ReturnType<typeof buildConnectorsCenter>[number]) => item.id === connectorId)!;
}
