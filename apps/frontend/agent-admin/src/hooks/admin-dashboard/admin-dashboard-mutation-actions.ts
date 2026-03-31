import {
  approveSkillInstall,
  approveTask,
  clearCapabilityPolicy,
  clearConnectorPolicy,
  closeConnectorSession,
  configureConnector,
  createOrUpdateCounselorSelector,
  createAgentDiagnosisTask,
  createTask,
  disableCompanyAgent,
  disableCounselorSelector,
  disableConnector,
  disableSkill,
  disableSkillSource,
  enableCompanyAgent,
  enableCounselorSelector,
  enableConnector,
  enableSkillSource,
  exportEvalsCenter,
  exportApprovalsCenter,
  exportRuntimeCenter,
  installSkill,
  invalidateMemory,
  invalidateRule,
  promoteSkill,
  refreshConnectorDiscovery,
  rejectSkillInstall,
  rejectTask,
  restoreMemory,
  restoreRule,
  restoreSkill,
  retireMemory,
  retireRule,
  retireSkill,
  retryTask,
  setLearningConflictStatus,
  setCapabilityPolicy,
  setConnectorPolicy,
  supersedeMemory,
  supersedeRule,
  syncSkillSource
} from '@/api/admin-api';
import { downloadText } from './admin-dashboard-constants';
import type { AdminDashboardActionContext } from './admin-dashboard-actions.types';

interface RefreshActions {
  refreshAll: () => Promise<void>;
  refreshPageCenter: (targetPage: any, options?: { runtimeDays?: number; evalsDays?: number }) => Promise<void>;
  refreshTask: (taskId: string, withLoading?: boolean) => Promise<void>;
}

export function createAdminDashboardMutationActions(
  context: AdminDashboardActionContext,
  refreshActions: RefreshActions
) {
  const runMutation = async (action: () => Promise<void>, fallbackMessage: string) => {
    try {
      context.setLoading(true);
      context.setError('');
      await action();
    } catch (nextError) {
      context.setError(nextError instanceof Error ? nextError.message : fallbackMessage);
    } finally {
      context.setLoading(false);
    }
  };

  const refreshLearningIfNeeded = async () => {
    if (context.getPage() === 'learning') {
      await refreshActions.refreshPageCenter('learning');
    }
  };

  const refreshCenterAfter = (page: 'runtime' | 'approvals' | 'connectors' | 'skillSources' | 'companyAgents') =>
    context.getPage() === page ? refreshActions.refreshPageCenter(page) : Promise.resolve();

  return {
    selectTask: async (taskId: string) => {
      await refreshActions.refreshTask(taskId);
      window.location.hash = '/runtime';
      context.setPage('runtime');
    },
    updateApproval: async (decision: 'approve' | 'reject', taskId: string, intent: string) =>
      runMutation(async () => {
        if (decision === 'approve') {
          await approveTask(taskId, intent);
        } else {
          await rejectTask(taskId, intent);
        }
        await refreshActions.refreshAll();
        await refreshCenterAfter('approvals');
      }, '更新审批状态失败'),
    handleRetryTask: async (taskId: string) =>
      runMutation(async () => {
        await retryTask(taskId);
        await refreshActions.refreshTask(taskId, false);
        await refreshCenterAfter('runtime');
      }, '重试任务失败'),
    handlePromoteSkill: async (skillId: string) =>
      runMutation(async () => {
        await promoteSkill(skillId);
        await refreshActions.refreshAll();
      }, '晋升技能失败'),
    handleDisableSkill: async (skillId: string) =>
      runMutation(async () => {
        await disableSkill(skillId);
        await refreshActions.refreshAll();
      }, '禁用技能失败'),
    handleRestoreSkill: async (skillId: string) =>
      runMutation(async () => {
        await restoreSkill(skillId);
        await refreshActions.refreshAll();
      }, '恢复技能失败'),
    handleRetireSkill: async (skillId: string) =>
      runMutation(async () => {
        await retireSkill(skillId);
        await refreshActions.refreshAll();
      }, '归档技能失败'),
    handleInvalidateMemory: async (memoryId: string) =>
      runMutation(async () => {
        await invalidateMemory(memoryId, 'invalidated_from_admin');
        await refreshActions.refreshAll();
        await refreshLearningIfNeeded();
      }, '失效记忆失败'),
    handleSupersedeMemory: async (memoryId: string) => {
      const replacementId = window.prompt('输入替代 memory 的 id');
      if (!replacementId) {
        return;
      }
      await runMutation(async () => {
        await supersedeMemory(memoryId, replacementId, 'superseded_from_admin');
        await refreshActions.refreshAll();
        await refreshLearningIfNeeded();
      }, '替代记忆失败');
    },
    handleRestoreMemory: async (memoryId: string) =>
      runMutation(async () => {
        await restoreMemory(memoryId);
        await refreshActions.refreshAll();
        await refreshLearningIfNeeded();
      }, '恢复记忆失败'),
    handleRetireMemory: async (memoryId: string) =>
      runMutation(async () => {
        await retireMemory(memoryId, 'retired_from_admin');
        await refreshActions.refreshAll();
        await refreshLearningIfNeeded();
      }, '归档记忆失败'),
    handleInvalidateRule: async (ruleId: string) =>
      runMutation(async () => {
        await invalidateRule(ruleId, 'invalidated_from_admin');
        await refreshActions.refreshAll();
      }, '失效规则失败'),
    handleSupersedeRule: async (ruleId: string) => {
      const replacementId = window.prompt('输入替代 rule 的 id');
      if (!replacementId) {
        return;
      }
      await runMutation(async () => {
        await supersedeRule(ruleId, replacementId, 'superseded_from_admin');
        await refreshActions.refreshAll();
      }, '替代规则失败');
    },
    handleRestoreRule: async (ruleId: string) =>
      runMutation(async () => {
        await restoreRule(ruleId);
        await refreshActions.refreshAll();
      }, '恢复规则失败'),
    handleRetireRule: async (ruleId: string) =>
      runMutation(async () => {
        await retireRule(ruleId, 'retired_from_admin');
        await refreshActions.refreshAll();
      }, '归档规则失败'),
    handleQuickCreate: async () =>
      runMutation(async () => {
        const task = await createTask('审计当前平台控制台、运行态和学习沉淀状态，并给出下一步建议');
        await refreshActions.refreshTask(task.id, false);
        window.location.hash = '/runtime';
        context.setPage('runtime');
      }, '快速创建任务失败'),
    handleCreateDiagnosisTask: async (params: {
      taskId: string;
      goal: string;
      errorCode: string;
      ministry?: string;
      message: string;
      diagnosisHint?: string;
      recommendedAction?: string;
      stack?: string;
      recoveryPlaybook?: string[];
    }) =>
      runMutation(async () => {
        const task = await createAgentDiagnosisTask(params);
        await refreshActions.refreshTask(task.id, false);
        window.location.hash = '/runtime';
        context.setPage('runtime');
      }, '创建诊断任务失败'),
    downloadRuntimeExport: async () =>
      runMutation(async () => {
        const runtimeFilters = context.getRuntimeFilters();
        const exported = await exportRuntimeCenter({
          days: context.getRuntimeHistoryDays(),
          status: runtimeFilters.status || undefined,
          model: runtimeFilters.model || undefined,
          pricingSource: runtimeFilters.pricingSource || undefined,
          executionMode: runtimeFilters.executionMode === 'all' ? undefined : runtimeFilters.executionMode,
          interactionKind: runtimeFilters.interactionKind === 'all' ? undefined : runtimeFilters.interactionKind
        });
        downloadText(exported.filename, exported.mimeType, exported.content);
      }, '导出 runtime 数据失败'),
    downloadApprovalsExport: async () =>
      runMutation(async () => {
        const approvalFilters = context.getApprovalFilters();
        const exported = await exportApprovalsCenter({
          executionMode: approvalFilters.executionMode === 'all' ? undefined : approvalFilters.executionMode,
          interactionKind: approvalFilters.interactionKind === 'all' ? undefined : approvalFilters.interactionKind
        });
        downloadText(exported.filename, exported.mimeType, exported.content);
      }, '导出 approvals 数据失败'),
    downloadEvalsExport: async () =>
      runMutation(async () => {
        const evalFilters = context.getEvalFilters();
        const exported = await exportEvalsCenter({
          days: context.getEvalsHistoryDays(),
          scenarioId: evalFilters.scenario || undefined,
          outcome: evalFilters.outcome || undefined
        });
        downloadText(exported.filename, exported.mimeType, exported.content);
      }, '导出 evals 数据失败'),
    handleCloseConnectorSession: async (connectorId: string) =>
      runMutation(async () => {
        await closeConnectorSession(connectorId);
        await refreshActions.refreshPageCenter('connectors');
      }, '关闭 connector session 失败'),
    handleRefreshConnectorDiscovery: async (connectorId: string) =>
      runMutation(async () => {
        await refreshConnectorDiscovery(connectorId);
        await refreshActions.refreshPageCenter('connectors');
      }, '刷新 connector discovery 失败'),
    handleEnableConnector: async (connectorId: string) =>
      runMutation(async () => {
        await enableConnector(connectorId);
        await refreshActions.refreshPageCenter('connectors');
      }, '启用 connector 失败'),
    handleDisableConnector: async (connectorId: string) =>
      runMutation(async () => {
        await disableConnector(connectorId);
        await refreshActions.refreshPageCenter('connectors');
      }, '停用 connector 失败'),
    handleSetConnectorPolicy: async (connectorId: string, effect: 'allow' | 'deny' | 'require-approval' | 'observe') =>
      runMutation(async () => {
        await setConnectorPolicy(connectorId, effect);
        await refreshActions.refreshPageCenter('connectors');
      }, '更新 connector policy 失败'),
    handleClearConnectorPolicy: async (connectorId: string) =>
      runMutation(async () => {
        await clearConnectorPolicy(connectorId);
        await refreshActions.refreshPageCenter('connectors');
      }, '清除 connector policy 失败'),
    handleSetCapabilityPolicy: async (
      connectorId: string,
      capabilityId: string,
      effect: 'allow' | 'deny' | 'require-approval' | 'observe'
    ) =>
      runMutation(async () => {
        await setCapabilityPolicy(connectorId, capabilityId, effect);
        await refreshActions.refreshPageCenter('connectors');
      }, '更新 capability policy 失败'),
    handleClearCapabilityPolicy: async (connectorId: string, capabilityId: string) =>
      runMutation(async () => {
        await clearCapabilityPolicy(connectorId, capabilityId);
        await refreshActions.refreshPageCenter('connectors');
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
        await refreshActions.refreshPageCenter('connectors');
      }, '配置 connector 失败'),
    handleInstallSkill: async (manifestId: string, sourceId?: string) =>
      runMutation(async () => {
        await installSkill(manifestId, sourceId);
        await refreshActions.refreshPageCenter('skillSources');
        await refreshActions.refreshPageCenter('skills');
      }, '安装 skill 失败'),
    handleApproveSkillInstall: async (receiptId: string) =>
      runMutation(async () => {
        await approveSkillInstall(receiptId);
        await refreshActions.refreshPageCenter('skillSources');
        await refreshActions.refreshPageCenter('skills');
      }, '批准 skill 安装失败'),
    handleRejectSkillInstall: async (receiptId: string) => {
      const reason = window.prompt('输入拒绝安装的原因');
      await runMutation(async () => {
        await rejectSkillInstall(receiptId, reason ?? undefined);
        await refreshActions.refreshPageCenter('skillSources');
      }, '拒绝 skill 安装失败');
    },
    handleEnableSkillSource: async (sourceId: string) =>
      runMutation(async () => {
        await enableSkillSource(sourceId);
        await refreshActions.refreshPageCenter('skillSources');
      }, '启用 skill source 失败'),
    handleDisableSkillSource: async (sourceId: string) =>
      runMutation(async () => {
        await disableSkillSource(sourceId);
        await refreshActions.refreshPageCenter('skillSources');
      }, '停用 skill source 失败'),
    handleSyncSkillSource: async (sourceId: string) =>
      runMutation(async () => {
        await syncSkillSource(sourceId);
        await refreshActions.refreshPageCenter('skillSources');
      }, '同步 skill source 失败'),
    handleEnableCompanyAgent: async (workerId: string) =>
      runMutation(async () => {
        await enableCompanyAgent(workerId);
        await refreshActions.refreshPageCenter('companyAgents');
      }, '启用 company agent 失败'),
    handleDisableCompanyAgent: async (workerId: string) =>
      runMutation(async () => {
        await disableCompanyAgent(workerId);
        await refreshActions.refreshPageCenter('companyAgents');
      }, '停用 company agent 失败'),
    handleCreateCounselorSelector: async () => {
      const selectorId = window.prompt('输入 selectorId，例如 payment-selector-v2');
      if (!selectorId) {
        return;
      }
      const domain = window.prompt('输入 domain，例如 payment', 'general') ?? 'general';
      const strategy =
        (window.prompt('输入策略：manual / user-id / session-ratio / task-type / feature-flag', 'task-type') as
          | 'manual'
          | 'user-id'
          | 'session-ratio'
          | 'task-type'
          | 'feature-flag'
          | null) ?? 'task-type';
      const candidateIds = (window.prompt('输入 candidateIds，逗号分隔', `${domain}-counselor-v1`) ?? '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (!candidateIds.length) {
        return;
      }
      const defaultCounselorId =
        window.prompt('输入 defaultCounselorId', candidateIds[0] ?? `${domain}-counselor-v1`) ?? candidateIds[0]!;
      const featureFlag =
        strategy === 'feature-flag'
          ? (window.prompt('输入 feature flag 名称', `${domain}_selector`) ?? undefined)
          : undefined;
      await runMutation(async () => {
        await createOrUpdateCounselorSelector({
          selectorId,
          domain,
          strategy,
          candidateIds,
          defaultCounselorId,
          featureFlag
        });
        await refreshActions.refreshPageCenter('learning');
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
      const strategy =
        (window.prompt('更新策略：manual / user-id / session-ratio / task-type / feature-flag', selector.strategy) as
          | 'manual'
          | 'user-id'
          | 'session-ratio'
          | 'task-type'
          | 'feature-flag'
          | null) ??
        ((selector.strategy as 'manual' | 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag') || 'task-type');
      const candidateIds = (window.prompt('更新 candidateIds，逗号分隔', selector.candidateIds.join(',')) ?? '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (!candidateIds.length) {
        return;
      }
      const defaultCounselorId =
        window.prompt('更新 defaultCounselorId', selector.defaultCounselorId) ?? selector.defaultCounselorId;
      const featureFlag =
        strategy === 'feature-flag'
          ? (window.prompt('更新 feature flag', selector.featureFlag ?? `${selector.domain}_selector`) ??
            selector.featureFlag)
          : undefined;
      const weightsInput =
        strategy === 'session-ratio'
          ? window.prompt(
              '更新 weights，逗号分隔',
              selector.weights?.join(',') ?? candidateIds.map(() => '1').join(',')
            )
          : undefined;
      const weights =
        strategy === 'session-ratio'
          ? weightsInput
              ?.split(',')
              .map(item => Number(item.trim()))
              .filter(item => Number.isFinite(item) && item > 0)
          : undefined;
      await runMutation(async () => {
        await createOrUpdateCounselorSelector({
          selectorId: selector.selectorId,
          domain: selector.domain,
          strategy,
          candidateIds,
          defaultCounselorId,
          featureFlag,
          weights,
          enabled: selector.enabled
        });
        await refreshActions.refreshPageCenter('learning');
      }, '更新群辅 selector 失败');
    },
    handleEnableCounselorSelector: async (selectorId: string) =>
      runMutation(async () => {
        await enableCounselorSelector(selectorId);
        await refreshActions.refreshPageCenter('learning');
      }, '启用群辅 selector 失败'),
    handleDisableCounselorSelector: async (selectorId: string) =>
      runMutation(async () => {
        await disableCounselorSelector(selectorId);
        await refreshActions.refreshPageCenter('learning');
      }, '停用群辅 selector 失败'),
    handleSetLearningConflictStatus: async (
      conflictId: string,
      status: 'open' | 'merged' | 'dismissed' | 'escalated',
      preferredMemoryId?: string
    ) =>
      runMutation(async () => {
        await setLearningConflictStatus(conflictId, status, preferredMemoryId);
        await refreshActions.refreshPageCenter('learning');
      }, '更新 learning conflict 状态失败')
  };
}
