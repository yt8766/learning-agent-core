import {
  approveTask,
  createAgentDiagnosisTask,
  createTask,
  disableSkill,
  exportEvalsCenter,
  exportApprovalsCenter,
  exportRuntimeCenter,
  invalidateMemory,
  invalidateRule,
  promoteSkill,
  refreshMetricsSnapshots,
  rejectTask,
  resolveMemoryResolutionCandidate,
  restoreMemory,
  restoreRule,
  restoreSkill,
  retireMemory,
  retireRule,
  retireSkill,
  retryTask,
  revokeApprovalScopePolicy,
  setLearningConflictStatus,
  supersedeMemory,
  supersedeRule
} from '@/api/admin-api';
import { adminQueryKeys } from '@/api/admin-query';
import { downloadText } from './admin-dashboard-constants';
import type { AdminDashboardActionContext } from './admin-dashboard-actions.types';
import { createConnectorSkillCounselorMutations } from './admin-dashboard-mutation-connector-actions';

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

  const connectorSkillCounselorActions = createConnectorSkillCounselorMutations({
    runMutation,
    refreshPageCenter: refreshActions.refreshPageCenter
  });

  return {
    selectTask: async (taskId: string) => {
      context.setActiveTaskId(taskId);
      context.setObservatoryFocusTarget(undefined);
      context.setRuntimeCompareTaskId(undefined);
      context.setRuntimeGraphNodeId(undefined);
      context.setRuntimeReplayReceipt(undefined);
      await refreshActions.refreshTask(taskId);
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
    handleRevokeApprovalPolicy: async (policyId: string) =>
      runMutation(async () => {
        await revokeApprovalScopePolicy(policyId);
        await refreshActions.refreshPageCenter('runtime');
      }, '撤销审批策略失败'),
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
        context.setActiveTaskId(task.id);
        context.setObservatoryFocusTarget(undefined);
        context.setRuntimeCompareTaskId(undefined);
        context.setRuntimeGraphNodeId(undefined);
        context.setRuntimeReplayReceipt(undefined);
        await refreshActions.refreshTask(task.id, false);
        context.setPage('runtime');
      }, '快速创建任务失败'),
    handleLaunchWorkflowTask: async (params: {
      goal: string;
      workflowCommand?: string;
      baselineTaskId?: string;
      replaySourceLabel?: string;
      replayScoped?: boolean;
    }) =>
      runMutation(async () => {
        const task = await createTask({
          goal: params.workflowCommand ? `${params.workflowCommand} ${params.goal}`.trim() : params.goal.trim(),
          lineage: params.baselineTaskId
            ? {
                parentTaskId: params.baselineTaskId,
                baselineTaskId: params.baselineTaskId,
                launchReason: 'replay',
                replaySourceLabel: params.replaySourceLabel,
                replayScoped: params.replayScoped ?? false
              }
            : undefined
        });
        context.setActiveTaskId(task.id);
        context.setObservatoryFocusTarget(undefined);
        context.setRuntimeCompareTaskId(params.baselineTaskId);
        context.setRuntimeGraphNodeId(undefined);
        context.setRuntimeReplayReceipt({
          sourceLabel: params.replaySourceLabel,
          scoped: params.replayScoped ?? false,
          baselineTaskId: params.baselineTaskId
        });
        await refreshActions.refreshTask(task.id, false);
        context.setPage('runtime');
      }, '启动 workflow 任务失败'),
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
        context.setActiveTaskId(task.id);
        context.setObservatoryFocusTarget(undefined);
        context.setRuntimeCompareTaskId(undefined);
        context.setRuntimeGraphNodeId(undefined);
        context.setRuntimeReplayReceipt(undefined);
        await refreshActions.refreshTask(task.id, false);
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
    handleRefreshMetricsSnapshots: async () =>
      runMutation(async () => {
        await refreshMetricsSnapshots(Math.max(context.getRuntimeHistoryDays(), context.getEvalsHistoryDays()));
        await context.queryClient.invalidateQueries({
          queryKey: adminQueryKeys.platformConsoleLogAnalysis(7)
        });
        await refreshActions.refreshAll();
      }, '刷新 metrics snapshot 失败'),
    handleSetLearningConflictStatus: async (
      conflictId: string,
      status: 'open' | 'merged' | 'dismissed' | 'escalated',
      preferredMemoryId?: string
    ) =>
      runMutation(async () => {
        await setLearningConflictStatus(conflictId, status, preferredMemoryId);
        await refreshActions.refreshPageCenter('learning');
      }, '更新 learning conflict 状态失败'),
    handleResolveMemoryResolutionCandidate: async (
      resolutionCandidateId: string,
      resolution: 'accepted' | 'rejected'
    ) =>
      runMutation(async () => {
        await resolveMemoryResolutionCandidate(resolutionCandidateId, resolution);
        await refreshActions.refreshPageCenter('learning');
      }, '更新 memory 决议候选失败'),
    ...connectorSkillCounselorActions
  };
}
