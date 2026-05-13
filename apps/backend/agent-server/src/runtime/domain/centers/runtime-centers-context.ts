import { describeConnectorProfilePolicy } from '@agent/runtime';
import type { ProviderAuditSyncResult } from '../../core/runtime-centers-facade';

import type { RuntimeHost } from '../../core/runtime.host';
import type { IntelligenceRepository } from '../../intelligence/intelligence.repository';
import type { RuntimeCentersContext } from '../../centers/runtime-centers.types';
import type { RuntimeConnectorRegistryContext } from '../../centers/runtime-centers.types';
import type { AppLoggerService } from '../../../logger/app-logger.service';
import type { RuntimeWenyuanFacade } from '../knowledge/runtime-wenyuan-facade';
import type { RuntimePlatformConsoleContext } from '../../centers/runtime-platform-console.records';
import type { RuntimeSkillInstallContext } from '../../skills/runtime-skill-install.service';
import type { RuntimeSkillSourcesContext } from '../../skills/runtime-skill-sources.service';

export interface RuntimeCentersContextInput {
  settings: () => RuntimeHost['settings'];
  runtimeHost: () => RuntimeHost;
  appLogger?: () => AppLoggerService | undefined;
  intelligenceRepository?: () => IntelligenceRepository | undefined;
  intelligenceRunService?: () => RuntimeCentersContext['intelligenceRunService'];
  wenyuanFacade: () => RuntimeWenyuanFacade;
  sessionCoordinator: () => RuntimeHost['sessionCoordinator'];
  orchestrator: () => RuntimeHost['orchestrator'];
  runtimeStateRepository: () => RuntimeHost['runtimeStateRepository'];
  memoryRepository: () => RuntimeHost['memoryRepository'];
  ruleRepository: () => RuntimeHost['ruleRepository'];
  skillRegistry: () => RuntimeHost['skillRegistry'];
  toolRegistry: () => RuntimeHost['toolRegistry'];
  mcpClientManager: () => RuntimeHost['mcpClientManager'];
  mcpServerRegistry: () => RuntimeHost['mcpServerRegistry'];
  mcpCapabilityRegistry: () => RuntimeHost['mcpCapabilityRegistry'];
  describeConnectorProfilePolicy: typeof describeConnectorProfilePolicy;
  fetchProviderUsageAudit: (days: number) => Promise<ProviderAuditSyncResult>;
  getBackgroundWorkerSlots: () => Map<string, { taskId: string; startedAt: string }>;
  getConnectorRegistryContext: () => RuntimeConnectorRegistryContext;
  getSkillInstallContext: () => RuntimeSkillInstallContext;
  getSkillSourcesContext: () => RuntimeSkillSourcesContext & {
    listSkillSources?: () => Promise<unknown[]>;
  };
  getPlatformConsoleContext: () => RuntimePlatformConsoleContext;
}

export function createCentersContext(input: RuntimeCentersContextInput): RuntimeCentersContext {
  return {
    settings: input.settings(),
    runtimeHost: input.runtimeHost(),
    appLogger: input.appLogger?.(),
    intelligenceRepository: input.intelligenceRepository?.(),
    intelligenceRunService: input.intelligenceRunService?.(),
    wenyuanFacade: input.wenyuanFacade(),
    sessionCoordinator: input.sessionCoordinator(),
    orchestrator: input.orchestrator(),
    runtimeStateRepository: input.runtimeStateRepository(),
    memoryRepository: input.memoryRepository(),
    ruleRepository: input.ruleRepository(),
    skillRegistry: input.skillRegistry(),
    toolRegistry: input.toolRegistry(),
    mcpClientManager: input.mcpClientManager(),
    mcpServerRegistry: input.mcpServerRegistry(),
    mcpCapabilityRegistry: input.mcpCapabilityRegistry(),
    describeConnectorProfilePolicy: input.describeConnectorProfilePolicy,
    fetchProviderUsageAudit: input.fetchProviderUsageAudit,
    getBackgroundWorkerSlots: input.getBackgroundWorkerSlots,
    getConnectorRegistryContext: input.getConnectorRegistryContext,
    getSkillInstallContext: input.getSkillInstallContext,
    getSkillSourcesContext: input.getSkillSourcesContext,
    getPlatformConsoleContext: input.getPlatformConsoleContext
  };
}
