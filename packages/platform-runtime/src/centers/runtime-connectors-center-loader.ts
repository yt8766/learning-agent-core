import { buildConnectorsCenter } from './runtime-connectors-center';

type ConnectorCenterProjection = ReturnType<typeof buildConnectorsCenter>;
type ConnectorProjection = ConnectorCenterProjection[number];
type KnowledgeOverview = Parameters<typeof buildConnectorsCenter>[0]['knowledgeOverview'];

export interface RuntimeConnectorCenterLoaderInput {
  settings: {
    profile: unknown;
    mcp: {
      stdioSessionIdleTtlMs: number;
    };
  };
  runtimeStateRepository: {
    load: () => Promise<unknown>;
  };
  orchestrator: {
    listTasks: () => unknown[];
  };
  mcpClientManager: {
    sweepIdleSessions: (ttlMs: number) => Promise<unknown>;
    describeServers: () => unknown[];
    refreshAllServerDiscovery?: (options: { includeStdio: boolean }) => Promise<unknown>;
  };
  refreshDiscovery?: boolean;
  includeStdioInRefresh?: boolean;
  loadKnowledgeOverview?: () => Promise<KnowledgeOverview>;
}

export async function loadConnectorCenterProjection(
  input: RuntimeConnectorCenterLoaderInput
): Promise<ConnectorCenterProjection> {
  await input.mcpClientManager.sweepIdleSessions(input.settings.mcp.stdioSessionIdleTtlMs);

  if (input.refreshDiscovery) {
    await input.mcpClientManager
      .refreshAllServerDiscovery?.({ includeStdio: input.includeStdioInRefresh ?? false })
      .catch(() => undefined);
  }

  const [snapshot, knowledgeOverview] = await Promise.all([
    input.runtimeStateRepository.load(),
    input.loadKnowledgeOverview?.()
  ]);

  return buildConnectorsCenter({
    profile: input.settings.profile as never,
    snapshot: snapshot as never,
    tasks: input.orchestrator.listTasks() as never,
    connectors: input.mcpClientManager.describeServers() as never,
    knowledgeOverview
  });
}

export async function loadConnectorProjectionById(
  input: RuntimeConnectorCenterLoaderInput & { connectorId: string }
): Promise<ConnectorProjection | undefined> {
  const projections = await loadConnectorCenterProjection(input);
  return projections.find(item => item.id === input.connectorId);
}
