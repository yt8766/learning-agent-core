import { describeConnectorProfilePolicy, type ProviderAuditSyncResult } from '@agent/runtime';
import type { AppLoggerService } from '../../logger/app-logger.service';
import type { RuntimeTechBriefingService } from '../briefings/runtime-tech-briefing.service';
import type { RuntimeHost } from '../core/runtime.host';
import type { RuntimePlatformConsoleContext } from './runtime-platform-console.records';
import type { RuntimeSkillInstallContext } from '../skills/runtime-skill-install.service';
import type { RuntimeSkillSourcesContext } from '../skills/runtime-skill-sources.service';
import type { RuntimeWenyuanFacade } from '../wenyuan/runtime-wenyuan-facade';

export interface RuntimeConnectorRegistryContext {
  settings: RuntimeHost['settings'];
  mcpServerRegistry: RuntimeHost['mcpServerRegistry'];
  mcpCapabilityRegistry: RuntimeHost['mcpCapabilityRegistry'];
  mcpClientManager: RuntimeHost['mcpClientManager'];
  orchestrator: RuntimeHost['orchestrator'];
}

export interface RuntimeCentersContext {
  settings: RuntimeHost['settings'];
  appLogger?: AppLoggerService;
  techBriefingService?: RuntimeTechBriefingService;
  runtimeHost: RuntimeHost;
  wenyuanFacade: RuntimeWenyuanFacade;
  sessionCoordinator: RuntimeHost['sessionCoordinator'];
  orchestrator: RuntimeHost['orchestrator'];
  runtimeStateRepository: RuntimeHost['runtimeStateRepository'];
  memoryRepository: RuntimeHost['memoryRepository'];
  ruleRepository: RuntimeHost['ruleRepository'];
  skillRegistry: RuntimeHost['skillRegistry'];
  toolRegistry: RuntimeHost['toolRegistry'];
  mcpClientManager: RuntimeHost['mcpClientManager'];
  mcpServerRegistry: RuntimeHost['mcpServerRegistry'];
  mcpCapabilityRegistry: RuntimeHost['mcpCapabilityRegistry'];
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

export const RUNTIME_CENTER_QUERY_METHOD_NAMES = [
  'getRuntimeCenter',
  'getRuntimeCenterSummary',
  'getRunObservatory',
  'getRunObservatoryDetail',
  'getApprovalsCenter',
  'exportApprovalsCenter',
  'getLearningCenter',
  'getLearningCenterSummary',
  'getEvidenceCenter',
  'getConnectorsCenter',
  'getToolsCenter',
  'getBrowserReplay',
  'getSkillSourcesCenter',
  'getCompanyAgentsCenter',
  'getEvalsCenter',
  'getEvalsCenterSummary',
  'getPlatformConsoleLogAnalysis',
  'getPlatformConsoleShell',
  'getPlatformConsole',
  'getBriefingRuns',
  'forceBriefingRun',
  'recordBriefingFeedback',
  'exportRuntimeCenter',
  'exportEvalsCenter'
] as const;

export const RUNTIME_CENTER_GOVERNANCE_METHOD_NAMES = [
  'listApprovalScopePolicies',
  'revokeApprovalScopePolicy',
  'getCounselorSelectorConfigs',
  'upsertCounselorSelectorConfig',
  'setCounselorSelectorEnabled',
  'setLearningConflictStatus',
  'syncSkillSource',
  'installSkill',
  'installRemoteSkill',
  'checkInstalledSkills',
  'updateInstalledSkills',
  'getSkillInstallReceipt',
  'approveSkillInstall',
  'rejectSkillInstall',
  'setSkillSourceEnabled',
  'setCompanyAgentEnabled',
  'setConnectorEnabled',
  'setConnectorApprovalPolicy',
  'clearConnectorApprovalPolicy',
  'setCapabilityApprovalPolicy',
  'clearCapabilityApprovalPolicy',
  'closeConnectorSession',
  'refreshConnectorDiscovery',
  'refreshMetricsSnapshots',
  'configureConnector'
] as const;

export function bindServiceMethods<TTarget extends object, TSource extends object>(
  target: TTarget,
  source: TSource,
  methodNames: readonly (keyof TSource & string)[]
) {
  for (const methodName of methodNames) {
    const method = source[methodName];
    if (typeof method !== 'function') {
      continue;
    }
    Object.defineProperty(target, methodName, {
      value: method.bind(source),
      configurable: true,
      writable: true
    });
  }
}
