import {
  approveSkillInstall,
  clearCapabilityPolicy,
  clearConnectorPolicy,
  closeConnectorSession,
  configureConnector,
  createOrUpdateCounselorSelector,
  disableCompanyAgent,
  disableCounselorSelector,
  disableConnector,
  disableSkillSource,
  enableCompanyAgent,
  enableCounselorSelector,
  enableConnector,
  enableSkillSource,
  installSkill,
  refreshConnectorDiscovery,
  rejectSkillInstall,
  setCapabilityPolicy,
  setConnectorPolicy,
  syncSkillSource
} from '@/api/admin-api';
import {
  promptCreateCounselorSelector,
  promptEditCounselorSelector
} from './admin-dashboard-counselor-selector-prompts';

interface MutationDeps {
  runMutation: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  refreshPageCenter: (targetPage: any, options?: { runtimeDays?: number; evalsDays?: number }) => Promise<void>;
}

export function createConnectorSkillCounselorMutations({ runMutation, refreshPageCenter }: MutationDeps) {
  return {
    handleCloseConnectorSession: async (connectorId: string) =>
      runMutation(async () => {
        await closeConnectorSession(connectorId);
        await refreshPageCenter('connectors');
      }, '关闭 connector session 失败'),
    handleRefreshConnectorDiscovery: async (connectorId: string) =>
      runMutation(async () => {
        await refreshConnectorDiscovery(connectorId);
        await refreshPageCenter('connectors');
      }, '刷新 connector discovery 失败'),
    handleEnableConnector: async (connectorId: string) =>
      runMutation(async () => {
        await enableConnector(connectorId);
        await refreshPageCenter('connectors');
      }, '启用 connector 失败'),
    handleDisableConnector: async (connectorId: string) =>
      runMutation(async () => {
        await disableConnector(connectorId);
        await refreshPageCenter('connectors');
      }, '停用 connector 失败'),
    handleSetConnectorPolicy: async (connectorId: string, effect: 'allow' | 'deny' | 'require-approval' | 'observe') =>
      runMutation(async () => {
        await setConnectorPolicy(connectorId, effect);
        await refreshPageCenter('connectors');
      }, '更新 connector policy 失败'),
    handleClearConnectorPolicy: async (connectorId: string) =>
      runMutation(async () => {
        await clearConnectorPolicy(connectorId);
        await refreshPageCenter('connectors');
      }, '清除 connector policy 失败'),
    handleSetCapabilityPolicy: async (
      connectorId: string,
      capabilityId: string,
      effect: 'allow' | 'deny' | 'require-approval' | 'observe'
    ) =>
      runMutation(async () => {
        await setCapabilityPolicy(connectorId, capabilityId, effect);
        await refreshPageCenter('connectors');
      }, '更新 capability policy 失败'),
    handleClearCapabilityPolicy: async (connectorId: string, capabilityId: string) =>
      runMutation(async () => {
        await clearCapabilityPolicy(connectorId, capabilityId);
        await refreshPageCenter('connectors');
      }, '清除 capability policy 失败'),
    handleConfigureConnector: async (params: {
      templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
      transport: 'stdio' | 'http';
      displayName?: string;
      endpoint?: string;
      command?: string;
      args?: string[];
      apiKey?: string;
    }) =>
      runMutation(async () => {
        await configureConnector(params);
        await refreshPageCenter('connectors');
      }, '配置 connector 失败'),
    handleInstallSkill: async (manifestId: string, sourceId?: string) =>
      runMutation(async () => {
        await installSkill(manifestId, sourceId);
        await refreshPageCenter('skillSources');
        await refreshPageCenter('skills');
      }, '安装 skill 失败'),
    handleApproveSkillInstall: async (receiptId: string) =>
      runMutation(async () => {
        await approveSkillInstall(receiptId);
        await refreshPageCenter('skillSources');
        await refreshPageCenter('skills');
      }, '批准 skill 安装失败'),
    handleRejectSkillInstall: async (receiptId: string) => {
      const reason = window.prompt('输入拒绝安装的原因');
      await runMutation(async () => {
        await rejectSkillInstall(receiptId, reason ?? undefined);
        await refreshPageCenter('skillSources');
      }, '拒绝 skill 安装失败');
    },
    handleEnableSkillSource: async (sourceId: string) =>
      runMutation(async () => {
        await enableSkillSource(sourceId);
        await refreshPageCenter('skillSources');
      }, '启用 skill source 失败'),
    handleDisableSkillSource: async (sourceId: string) =>
      runMutation(async () => {
        await disableSkillSource(sourceId);
        await refreshPageCenter('skillSources');
      }, '停用 skill source 失败'),
    handleSyncSkillSource: async (sourceId: string) =>
      runMutation(async () => {
        await syncSkillSource(sourceId);
        await refreshPageCenter('skillSources');
      }, '同步 skill source 失败'),
    handleEnableCompanyAgent: async (workerId: string) =>
      runMutation(async () => {
        await enableCompanyAgent(workerId);
        await refreshPageCenter('companyAgents');
      }, '启用 company agent 失败'),
    handleDisableCompanyAgent: async (workerId: string) =>
      runMutation(async () => {
        await disableCompanyAgent(workerId);
        await refreshPageCenter('companyAgents');
      }, '停用 company agent 失败'),
    handleCreateCounselorSelector: async () => {
      const params = promptCreateCounselorSelector(window);
      if (!params) {
        return;
      }
      await runMutation(async () => {
        await createOrUpdateCounselorSelector(params);
        await refreshPageCenter('learning');
      }, '创建群辅 selector 失败');
    },
    handleEditCounselorSelector: async (selector: {
      selectorId: string;
      domain: string;
      strategy: string;
      candidateIds: string[];
      defaultCounselorId: string;
      featureFlag?: string;
      weights?: number[];
      createdAt?: string;
      updatedAt?: string;
      enabled: boolean;
    }) => {
      const params = promptEditCounselorSelector(window, selector);
      if (!params) {
        return;
      }
      await runMutation(async () => {
        await createOrUpdateCounselorSelector(params);
        await refreshPageCenter('learning');
      }, '更新群辅 selector 失败');
    },
    handleEnableCounselorSelector: async (selectorId: string) =>
      runMutation(async () => {
        await enableCounselorSelector(selectorId);
        await refreshPageCenter('learning');
      }, '启用群辅 selector 失败'),
    handleDisableCounselorSelector: async (selectorId: string) =>
      runMutation(async () => {
        await disableCounselorSelector(selectorId);
        await refreshPageCenter('learning');
      }, '停用群辅 selector 失败')
  };
}
