import type { RuntimeStateSnapshot } from '@agent/memory';
import type { TaskRecord } from '@agent/core';

import { buildConnectorsCenter } from '../../centers/runtime-connectors-center';
import type { PlatformConsoleConnectorsRecord } from '../../centers/runtime-platform-console.records';
import type { RuntimeToolsContext } from '../../services/runtime-tools.service';

export async function loadConnectorsCenterForTools(
  context: RuntimeToolsContext
): Promise<PlatformConsoleConnectorsRecord> {
  await context.mcpClientManager.sweepIdleSessions(context.settings.mcp.stdioSessionIdleTtlMs);
  const snapshot: RuntimeStateSnapshot = await context.runtimeStateRepository.load();
  const tasks: TaskRecord[] = context.orchestrator.listTasks();
  return buildConnectorsCenter({
    profile: context.settings.profile,
    snapshot,
    tasks,
    connectors: context.mcpClientManager.describeServers()
  });
}
