import {
  approveTask,
  closeConnectorSession,
  configureConnector,
  clearConnectorPolicy,
  clearCapabilityPolicy,
  createTask,
  disableConnector,
  refreshConnectorDiscovery,
  disableSkill,
  exportEvalsCenter,
  exportRuntimeCenter,
  getApprovalsCenter,
  getCompanyAgentsCenter,
  getConnectorsCenter,
  getEvidenceCenter,
  getEvalsCenterFiltered,
  getLearningCenter,
  getPlatformConsole,
  getRuntimeCenterFiltered,
  getSkillSourcesCenter,
  getTaskBundle,
  installSkill,
  invalidateMemory,
  invalidateRule,
  promoteSkill,
  approveSkillInstall,
  rejectSkillInstall,
  enableSkillSource,
  setConnectorPolicy,
  setCapabilityPolicy,
  disableSkillSource,
  syncSkillSource,
  enableCompanyAgent,
  enableConnector,
  disableCompanyAgent,
  rejectTask,
  restoreMemory,
  restoreRule,
  restoreSkill,
  retireMemory,
  retireRule,
  retireSkill,
  supersedeMemory,
  supersedeRule
} from '../../api/admin-api';
import type { DashboardPageKey, PlatformConsoleRecord, TaskBundle } from '../../types/admin';
import { downloadText } from './admin-dashboard-constants';

interface AdminDashboardActionContext {
  getPage: () => DashboardPageKey;
  getRuntimeHistoryDays: () => number;
  getEvalsHistoryDays: () => number;
  getRuntimeFilters: () => { status: string; model: string; pricingSource: string };
  getEvalFilters: () => { scenario: string; outcome: string };
  getBundle: () => TaskBundle | null;
  getConsoleData: () => PlatformConsoleRecord | null;
  setPage: (page: DashboardPageKey) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setConsoleData: (
    value: PlatformConsoleRecord | ((current: PlatformConsoleRecord | null) => PlatformConsoleRecord | null) | null
  ) => void;
  setBundle: (value: TaskBundle | null) => void;
}

export function createAdminDashboardActions(context: AdminDashboardActionContext) {
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

  const refreshAll = async () => {
    try {
      context.setLoading(true);
      context.setError('');
      const nextConsole = await getPlatformConsole(
        Math.max(context.getRuntimeHistoryDays(), context.getEvalsHistoryDays())
      );
      context.setConsoleData(nextConsole);

      const nextTaskId =
        context.getBundle()?.task.id ?? nextConsole.runtime.recentRuns[0]?.id ?? nextConsole.tasks[0]?.id;
      if (nextTaskId) {
        context.setBundle(await getTaskBundle(nextTaskId));
      } else {
        context.setBundle(null);
      }
    } catch (nextError) {
      context.setError(nextError instanceof Error ? nextError.message : '刷新平台控制台失败');
    } finally {
      context.setLoading(false);
    }
  };

  const refreshPageCenter = async (
    targetPage: DashboardPageKey,
    options?: { runtimeDays?: number; evalsDays?: number }
  ) => {
    if (!context.getConsoleData()) {
      return;
    }

    try {
      switch (targetPage) {
        case 'runtime': {
          const runtimeFilters = context.getRuntimeFilters();
          const runtime = await getRuntimeCenterFiltered({
            days: options?.runtimeDays ?? context.getRuntimeHistoryDays(),
            status: runtimeFilters.status || undefined,
            model: runtimeFilters.model || undefined,
            pricingSource: runtimeFilters.pricingSource || undefined
          });
          context.setConsoleData(current => (current ? { ...current, runtime } : current));
          break;
        }
        case 'approvals': {
          const approvals = await getApprovalsCenter();
          context.setConsoleData(current => (current ? { ...current, approvals } : current));
          break;
        }
        case 'learning': {
          const learning = await getLearningCenter();
          context.setConsoleData(current => (current ? { ...current, learning } : current));
          break;
        }
        case 'evals': {
          const evalFilters = context.getEvalFilters();
          const evals = await getEvalsCenterFiltered({
            days: options?.evalsDays ?? context.getEvalsHistoryDays(),
            scenarioId: evalFilters.scenario || undefined,
            outcome: evalFilters.outcome || undefined
          });
          context.setConsoleData(current => (current ? { ...current, evals } : current));
          break;
        }
        case 'evidence': {
          const evidence = await getEvidenceCenter();
          context.setConsoleData(current => (current ? { ...current, evidence } : current));
          break;
        }
        case 'connectors': {
          const connectors = await getConnectorsCenter();
          context.setConsoleData(current => (current ? { ...current, connectors } : current));
          break;
        }
        case 'skillSources': {
          const skillSources = await getSkillSourcesCenter();
          context.setConsoleData(current => (current ? { ...current, skillSources } : current));
          break;
        }
        case 'companyAgents': {
          const companyAgents = await getCompanyAgentsCenter();
          context.setConsoleData(current => (current ? { ...current, companyAgents } : current));
          break;
        }
        default:
          break;
      }
    } catch (nextError) {
      context.setError(nextError instanceof Error ? nextError.message : '刷新中心数据失败');
    }
  };

  const refreshTask = async (taskId: string, withLoading = true) => {
    try {
      if (withLoading) {
        context.setLoading(true);
      }
      context.setError('');
      const [nextConsole, nextBundle] = await Promise.all([
        getPlatformConsole(Math.max(context.getRuntimeHistoryDays(), context.getEvalsHistoryDays())),
        getTaskBundle(taskId)
      ]);
      context.setConsoleData(nextConsole);
      context.setBundle(nextBundle);
    } catch (nextError) {
      context.setError(nextError instanceof Error ? nextError.message : '刷新任务详情失败');
    } finally {
      if (withLoading) {
        context.setLoading(false);
      }
    }
  };

  const selectTask = async (taskId: string) => {
    await refreshTask(taskId);
    window.location.hash = '/runtime';
    context.setPage('runtime');
  };

  const updateApproval = async (decision: 'approve' | 'reject', taskId: string, intent: string) => {
    await runMutation(async () => {
      if (decision === 'approve') {
        await approveTask(taskId, intent);
      } else {
        await rejectTask(taskId, intent);
      }
      await refreshAll();
      if (context.getPage() === 'approvals') {
        await refreshPageCenter('approvals');
      }
    }, '更新审批状态失败');
  };

  const refreshLearningIfNeeded = async () => {
    if (context.getPage() === 'learning') {
      await refreshPageCenter('learning');
    }
  };

  const handlePromoteSkill = async (skillId: string) =>
    runMutation(async () => {
      await promoteSkill(skillId);
      await refreshAll();
    }, '晋升技能失败');

  const handleDisableSkill = async (skillId: string) =>
    runMutation(async () => {
      await disableSkill(skillId);
      await refreshAll();
    }, '禁用技能失败');

  const handleRestoreSkill = async (skillId: string) =>
    runMutation(async () => {
      await restoreSkill(skillId);
      await refreshAll();
    }, '恢复技能失败');

  const handleRetireSkill = async (skillId: string) =>
    runMutation(async () => {
      await retireSkill(skillId);
      await refreshAll();
    }, '归档技能失败');

  const handleInvalidateMemory = async (memoryId: string) =>
    runMutation(async () => {
      await invalidateMemory(memoryId, 'invalidated_from_admin');
      await refreshAll();
      await refreshLearningIfNeeded();
    }, '失效记忆失败');

  const handleSupersedeMemory = async (memoryId: string) => {
    const replacementId = window.prompt('输入替代 memory 的 id');
    if (!replacementId) {
      return;
    }

    await runMutation(async () => {
      await supersedeMemory(memoryId, replacementId, 'superseded_from_admin');
      await refreshAll();
      await refreshLearningIfNeeded();
    }, '替代记忆失败');
  };

  const handleRestoreMemory = async (memoryId: string) =>
    runMutation(async () => {
      await restoreMemory(memoryId);
      await refreshAll();
      await refreshLearningIfNeeded();
    }, '恢复记忆失败');

  const handleRetireMemory = async (memoryId: string) =>
    runMutation(async () => {
      await retireMemory(memoryId, 'retired_from_admin');
      await refreshAll();
      await refreshLearningIfNeeded();
    }, '归档记忆失败');

  const handleInvalidateRule = async (ruleId: string) =>
    runMutation(async () => {
      await invalidateRule(ruleId, 'invalidated_from_admin');
      await refreshAll();
    }, '失效规则失败');

  const handleSupersedeRule = async (ruleId: string) => {
    const replacementId = window.prompt('输入替代 rule 的 id');
    if (!replacementId) {
      return;
    }

    await runMutation(async () => {
      await supersedeRule(ruleId, replacementId, 'superseded_from_admin');
      await refreshAll();
    }, '替代规则失败');
  };

  const handleRestoreRule = async (ruleId: string) =>
    runMutation(async () => {
      await restoreRule(ruleId);
      await refreshAll();
    }, '恢复规则失败');

  const handleRetireRule = async (ruleId: string) =>
    runMutation(async () => {
      await retireRule(ruleId, 'retired_from_admin');
      await refreshAll();
    }, '归档规则失败');

  const handleQuickCreate = async () =>
    runMutation(async () => {
      const task = await createTask('审计当前平台控制台、运行态和学习沉淀状态，并给出下一步建议');
      await refreshTask(task.id, false);
      window.location.hash = '/runtime';
      context.setPage('runtime');
    }, '快速创建任务失败');

  const downloadRuntimeExport = async () =>
    runMutation(async () => {
      const runtimeFilters = context.getRuntimeFilters();
      const exported = await exportRuntimeCenter({
        days: context.getRuntimeHistoryDays(),
        status: runtimeFilters.status || undefined,
        model: runtimeFilters.model || undefined,
        pricingSource: runtimeFilters.pricingSource || undefined
      });
      downloadText(exported.filename, exported.mimeType, exported.content);
    }, '导出 runtime 数据失败');

  const downloadEvalsExport = async () =>
    runMutation(async () => {
      const evalFilters = context.getEvalFilters();
      const exported = await exportEvalsCenter({
        days: context.getEvalsHistoryDays(),
        scenarioId: evalFilters.scenario || undefined,
        outcome: evalFilters.outcome || undefined
      });
      downloadText(exported.filename, exported.mimeType, exported.content);
    }, '导出 evals 数据失败');

  const handleCloseConnectorSession = async (connectorId: string) =>
    runMutation(async () => {
      await closeConnectorSession(connectorId);
      await refreshPageCenter('connectors');
    }, '关闭 connector session 失败');

  const handleRefreshConnectorDiscovery = async (connectorId: string) =>
    runMutation(async () => {
      await refreshConnectorDiscovery(connectorId);
      await refreshPageCenter('connectors');
    }, '刷新 connector discovery 失败');

  const handleEnableConnector = async (connectorId: string) =>
    runMutation(async () => {
      await enableConnector(connectorId);
      await refreshPageCenter('connectors');
    }, '启用 connector 失败');

  const handleDisableConnector = async (connectorId: string) =>
    runMutation(async () => {
      await disableConnector(connectorId);
      await refreshPageCenter('connectors');
    }, '停用 connector 失败');

  const handleSetConnectorPolicy = async (
    connectorId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) =>
    runMutation(async () => {
      await setConnectorPolicy(connectorId, effect);
      await refreshPageCenter('connectors');
    }, '更新 connector policy 失败');

  const handleClearConnectorPolicy = async (connectorId: string) =>
    runMutation(async () => {
      await clearConnectorPolicy(connectorId);
      await refreshPageCenter('connectors');
    }, '清除 connector policy 失败');

  const handleSetCapabilityPolicy = async (
    connectorId: string,
    capabilityId: string,
    effect: 'allow' | 'deny' | 'require-approval' | 'observe'
  ) =>
    runMutation(async () => {
      await setCapabilityPolicy(connectorId, capabilityId, effect);
      await refreshPageCenter('connectors');
    }, '更新 capability policy 失败');

  const handleClearCapabilityPolicy = async (connectorId: string, capabilityId: string) =>
    runMutation(async () => {
      await clearCapabilityPolicy(connectorId, capabilityId);
      await refreshPageCenter('connectors');
    }, '清除 capability policy 失败');

  const handleConfigureConnector = async (params: {
    templateId: 'github-mcp-template' | 'browser-mcp-template';
    transport: 'stdio' | 'http';
    displayName?: string;
    endpoint?: string;
    command?: string;
    args?: string[];
    apiKey?: string;
  }) => {
    await runMutation(async () => {
      await configureConnector(params);
      await refreshPageCenter('connectors');
    }, '配置 connector 失败');
  };

  const handleInstallSkill = async (manifestId: string, sourceId?: string) =>
    runMutation(async () => {
      await installSkill(manifestId, sourceId);
      await refreshPageCenter('skillSources');
      await refreshPageCenter('skills');
    }, '安装 skill 失败');

  const handleApproveSkillInstall = async (receiptId: string) =>
    runMutation(async () => {
      await approveSkillInstall(receiptId);
      await refreshPageCenter('skillSources');
      await refreshPageCenter('skills');
    }, '批准 skill 安装失败');

  const handleRejectSkillInstall = async (receiptId: string) => {
    const reason = window.prompt('输入拒绝安装的原因');
    await runMutation(async () => {
      await rejectSkillInstall(receiptId, reason ?? undefined);
      await refreshPageCenter('skillSources');
    }, '拒绝 skill 安装失败');
  };

  const handleEnableSkillSource = async (sourceId: string) =>
    runMutation(async () => {
      await enableSkillSource(sourceId);
      await refreshPageCenter('skillSources');
    }, '启用 skill source 失败');

  const handleDisableSkillSource = async (sourceId: string) =>
    runMutation(async () => {
      await disableSkillSource(sourceId);
      await refreshPageCenter('skillSources');
    }, '停用 skill source 失败');

  const handleSyncSkillSource = async (sourceId: string) =>
    runMutation(async () => {
      await syncSkillSource(sourceId);
      await refreshPageCenter('skillSources');
    }, '同步 skill source 失败');

  const handleEnableCompanyAgent = async (workerId: string) =>
    runMutation(async () => {
      await enableCompanyAgent(workerId);
      await refreshPageCenter('companyAgents');
    }, '启用 company agent 失败');

  const handleDisableCompanyAgent = async (workerId: string) =>
    runMutation(async () => {
      await disableCompanyAgent(workerId);
      await refreshPageCenter('companyAgents');
    }, '停用 company agent 失败');

  return {
    refreshAll,
    refreshPageCenter,
    refreshTask,
    selectTask,
    updateApproval,
    handlePromoteSkill,
    handleDisableSkill,
    handleRestoreSkill,
    handleRetireSkill,
    handleInvalidateMemory,
    handleSupersedeMemory,
    handleRestoreMemory,
    handleRetireMemory,
    handleInvalidateRule,
    handleSupersedeRule,
    handleRestoreRule,
    handleRetireRule,
    handleQuickCreate,
    downloadRuntimeExport,
    downloadEvalsExport,
    handleCloseConnectorSession,
    handleRefreshConnectorDiscovery,
    handleEnableConnector,
    handleDisableConnector,
    handleSetConnectorPolicy,
    handleClearConnectorPolicy,
    handleSetCapabilityPolicy,
    handleClearCapabilityPolicy,
    handleConfigureConnector,
    handleInstallSkill,
    handleApproveSkillInstall,
    handleRejectSkillInstall,
    handleEnableSkillSource,
    handleDisableSkillSource,
    handleSyncSkillSource,
    handleEnableCompanyAgent,
    handleDisableCompanyAgent
  };
}
