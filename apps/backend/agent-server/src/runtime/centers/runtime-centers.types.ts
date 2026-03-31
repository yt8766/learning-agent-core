export interface RuntimeCentersContext {
  settings: any;
  wenyuanFacade: any;
  sessionCoordinator: any;
  orchestrator: any;
  runtimeStateRepository: any;
  memoryRepository: any;
  ruleRepository: any;
  skillRegistry: any;
  toolRegistry: any;
  mcpClientManager: any;
  mcpServerRegistry: any;
  mcpCapabilityRegistry: any;
  describeConnectorProfilePolicy: any;
  fetchProviderUsageAudit: (days: number) => Promise<any>;
  getBackgroundWorkerSlots: () => Map<string, { taskId: string; startedAt: string }>;
  getConnectorRegistryContext: () => any;
  getSkillInstallContext: () => any;
  getSkillSourcesContext: () => any;
  getPlatformConsoleContext: () => any;
}

export const RUNTIME_CENTER_QUERY_METHOD_NAMES = [
  'getRuntimeCenter',
  'getApprovalsCenter',
  'exportApprovalsCenter',
  'getLearningCenter',
  'getEvidenceCenter',
  'getConnectorsCenter',
  'getToolsCenter',
  'getBrowserReplay',
  'getSkillSourcesCenter',
  'getCompanyAgentsCenter',
  'getEvalsCenter',
  'getPlatformConsole',
  'exportRuntimeCenter',
  'exportEvalsCenter'
] as const;

export const RUNTIME_CENTER_GOVERNANCE_METHOD_NAMES = [
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
  'configureConnector'
] as const;

export function bindServiceMethods<TTarget extends object, TSource extends object>(
  target: TTarget,
  source: TSource,
  methodNames: readonly string[]
) {
  for (const methodName of methodNames) {
    Object.defineProperty(target, methodName, {
      value: (source as any)[methodName].bind(source),
      configurable: true,
      writable: true
    });
  }
}
