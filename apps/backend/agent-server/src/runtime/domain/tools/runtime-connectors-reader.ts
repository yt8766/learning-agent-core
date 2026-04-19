import type { RuntimeStateSnapshot } from '@agent/memory';
import type { TaskRecord } from '@agent/core';

import { loadConnectorCenterProjection } from '../connectors/runtime-connector-view-reader';
import type { PlatformConsoleConnectorsRecord } from '../../centers/runtime-platform-console.records';
import type { RuntimeToolsContext } from '../../services/runtime-tools.service';

export async function loadConnectorsCenterForTools(
  context: RuntimeToolsContext
): Promise<PlatformConsoleConnectorsRecord> {
  return loadConnectorCenterProjection({
    settings: context.settings,
    runtimeStateRepository: context.runtimeStateRepository as {
      load: () => Promise<RuntimeStateSnapshot>;
    },
    orchestrator: context.orchestrator as {
      listTasks: () => TaskRecord[];
    },
    mcpClientManager: context.mcpClientManager
  });
}
