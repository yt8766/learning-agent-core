import { useEffect, useState } from 'react';

import { approveWorkspaceSkillDraft, getWorkspaceCenter, rejectWorkspaceSkillDraft } from '@/api/admin-api-workspace';
import { ApprovalsPanel } from '@/features/approvals-center/approvals-panel';
import { ArchiveCenterPanel } from '@/features/archive-center/archive-center-panel';
import { CompanyAgentsPanel } from '@/features/company-agents/company-agents-panel';
import { ConnectorsCenterPanel } from '@/features/connectors-center/connectors-center-panel';
import { EvidenceCenterPanel } from '@/features/evidence-center/evidence-center-panel';
import { EvalsCenterPanel } from '@/features/evals-center/evals-center-panel';
import { LearningCenterPanel } from '@/features/learning-center/learning-center-panel';
import { MemoryCenterPanel } from '@/features/learning-center/memory-center-panel';
import { MemoryGovernancePanel } from '@/features/learning-center/memory-governance-panel';
import { MemoryResolutionQueueCard } from '@/features/learning-center/memory-resolution-queue-card';
import { ProfileCenterPanel } from '@/features/learning-center/profile-center-panel';
import { RuntimeOverviewPanel } from '@/features/runtime-overview/runtime-overview-panel';
import { SkillLabPanel } from '@/features/skill-lab/skill-lab-panel';
import { SkillSourcesCenterPanel } from '@/features/skill-sources-center/skill-sources-center-panel';
import { WorkspaceCenterPanel } from '@/features/workspace-center/workspace-center-panel';
import type {
  WorkspaceCenterRecord,
  WorkspaceSkillDraftDecisionResponse
} from '@/features/workspace-center/workspace-center-types';
import type { AdminDashboardState } from '@/hooks/use-admin-dashboard';
import { DashboardLoadingState } from './dashboard-loading-state';

const EMPTY_WORKSPACE_CENTER: WorkspaceCenterRecord = {
  workspace: {
    id: 'workspace-empty',
    profileId: 'profile-empty',
    name: 'Agent Workspace',
    scope: 'company',
    status: 'active',
    owner: {
      id: 'system',
      label: 'System',
      kind: 'system'
    },
    policyRefs: [],
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    summary: {
      workspaceId: 'workspace-empty',
      scope: 'company',
      activeDraftCount: 0,
      approvedDraftCount: 0,
      reuseRecordCount: 0,
      updatedAt: '1970-01-01T00:00:00.000Z'
    }
  },
  drafts: [],
  reuseRecords: []
};

export function renderDashboardCenter(dashboard: AdminDashboardState) {
  const consoleData = dashboard.consoleData;
  const copyShareUrl = () => void navigator.clipboard.writeText(dashboard.shareUrl);

  if (!consoleData) {
    return <DashboardLoadingState />;
  }

  switch (dashboard.page) {
    case 'runtime':
      return (
        <RuntimeOverviewPanel
          runtime={consoleData.runtime}
          bundle={dashboard.bundle}
          historyDays={dashboard.runtimeHistoryDays}
          statusFilter={dashboard.runtimeStatusFilter}
          onStatusFilterChange={dashboard.setRuntimeStatusFilter}
          modelFilter={dashboard.runtimeModelFilter}
          onModelFilterChange={dashboard.setRuntimeModelFilter}
          pricingSourceFilter={dashboard.runtimePricingSourceFilter}
          onPricingSourceFilterChange={dashboard.setRuntimePricingSourceFilter}
          executionModeFilter={dashboard.runtimeExecutionModeFilter}
          onExecutionModeFilterChange={dashboard.setRuntimeExecutionModeFilter}
          interactionKindFilter={dashboard.runtimeInteractionKindFilter}
          onInteractionKindFilterChange={dashboard.setRuntimeInteractionKindFilter}
          observatoryFocusTarget={dashboard.observatoryFocusTarget}
          onObservatoryFocusTargetChange={dashboard.setObservatoryFocusTarget}
          compareTaskId={dashboard.runtimeCompareTaskId}
          onCompareTaskIdChange={dashboard.setRuntimeCompareTaskId}
          graphNodeId={dashboard.runtimeGraphNodeId}
          onGraphNodeIdChange={dashboard.setRuntimeGraphNodeId}
          onCopyShareLink={copyShareUrl}
          onHistoryDaysChange={days => {
            dashboard.setRuntimeHistoryDays(days);
            void dashboard.refreshPageCenter('runtime', { runtimeDays: days });
          }}
          onExport={dashboard.downloadRuntimeExport}
          onSelectTask={dashboard.selectTask}
          onRetryTask={dashboard.handleRetryTask}
          onLaunchWorkflowTask={dashboard.handleLaunchWorkflowTask}
          onRefreshRuntime={() => dashboard.refreshPageCenter('runtime')}
          onCreateDiagnosisTask={dashboard.handleCreateDiagnosisTask}
          onRevokeApprovalPolicy={dashboard.handleRevokeApprovalPolicy}
        />
      );
    case 'approvals':
      return (
        <ApprovalsPanel
          approvals={dashboard.pendingApprovals}
          loading={dashboard.loading}
          onExport={dashboard.downloadApprovalsExport}
          onCopyShareLink={copyShareUrl}
          executionModeFilter={dashboard.approvalsExecutionModeFilter}
          onExecutionModeFilterChange={dashboard.setApprovalsExecutionModeFilter}
          interactionKindFilter={dashboard.approvalsInteractionKindFilter}
          onInteractionKindFilterChange={dashboard.setApprovalsInteractionKindFilter}
          onDecision={dashboard.updateApproval}
        />
      );
    case 'learning':
      return (
        <div className="grid gap-4">
          <MemoryResolutionQueueCard
            candidates={consoleData.learning.memoryResolutionCandidates}
            loading={dashboard.loading}
            onResolve={dashboard.handleResolveMemoryResolutionCandidate}
          />
          <MemoryGovernancePanel
            onInvalidateMemory={dashboard.handleInvalidateMemory}
            onRestoreMemory={dashboard.handleRestoreMemory}
            onRetireMemory={dashboard.handleRetireMemory}
          />
          <LearningCenterPanel
            learning={consoleData.learning}
            loading={dashboard.loading}
            onInvalidateMemory={dashboard.handleInvalidateMemory}
            onSupersedeMemory={dashboard.handleSupersedeMemory}
            onRestoreMemory={dashboard.handleRestoreMemory}
            onRetireMemory={dashboard.handleRetireMemory}
            onCreateCounselorSelector={dashboard.handleCreateCounselorSelector}
            onEditCounselorSelector={dashboard.handleEditCounselorSelector}
            onEnableCounselorSelector={dashboard.handleEnableCounselorSelector}
            onDisableCounselorSelector={dashboard.handleDisableCounselorSelector}
            onSetLearningConflictStatus={dashboard.handleSetLearningConflictStatus}
          />
        </div>
      );
    case 'workspace':
      return <WorkspaceDashboardCenter dashboard={dashboard} />;
    case 'memory':
      return (
        <MemoryCenterPanel
          onInvalidateMemory={dashboard.handleInvalidateMemory}
          onRestoreMemory={dashboard.handleRestoreMemory}
          onRetireMemory={dashboard.handleRetireMemory}
        />
      );
    case 'profiles':
      return <ProfileCenterPanel />;
    case 'evals':
      return (
        <EvalsCenterPanel
          evals={consoleData.evals}
          historyDays={dashboard.evalsHistoryDays}
          scenarioFilter={dashboard.evalScenarioFilter}
          onScenarioFilterChange={dashboard.setEvalScenarioFilter}
          outcomeFilter={dashboard.evalOutcomeFilter}
          onOutcomeFilterChange={dashboard.setEvalOutcomeFilter}
          onHistoryDaysChange={days => {
            dashboard.setEvalsHistoryDays(days);
            void dashboard.refreshPageCenter('evals', { evalsDays: days });
          }}
          onExport={dashboard.downloadEvalsExport}
        />
      );
    case 'archives':
      return (
        <ArchiveCenterPanel
          runtime={consoleData.runtime}
          evals={consoleData.evals}
          runtimeHistoryDays={dashboard.runtimeHistoryDays}
          evalsHistoryDays={dashboard.evalsHistoryDays}
          runtimeExportFilters={{
            status: dashboard.runtimeStatusFilter || undefined,
            model: dashboard.runtimeModelFilter || undefined,
            pricingSource: dashboard.runtimePricingSourceFilter || undefined,
            executionMode:
              dashboard.runtimeExecutionModeFilter === 'all' ? undefined : dashboard.runtimeExecutionModeFilter,
            interactionKind:
              dashboard.runtimeInteractionKindFilter === 'all' ? undefined : dashboard.runtimeInteractionKindFilter
          }}
          approvalsExportFilters={{
            executionMode:
              dashboard.approvalsExecutionModeFilter === 'all' ? undefined : dashboard.approvalsExecutionModeFilter,
            interactionKind:
              dashboard.approvalsInteractionKindFilter === 'all' ? undefined : dashboard.approvalsInteractionKindFilter
          }}
          onRuntimeHistoryDaysChange={days => {
            dashboard.setRuntimeHistoryDays(days);
            void dashboard.refreshPageCenter('runtime', { runtimeDays: days });
          }}
          onEvalsHistoryDaysChange={days => {
            dashboard.setEvalsHistoryDays(days);
            void dashboard.refreshPageCenter('evals', { evalsDays: days });
          }}
          onExportRuntime={dashboard.downloadRuntimeExport}
          onExportApprovals={dashboard.downloadApprovalsExport}
          onExportEvals={dashboard.downloadEvalsExport}
        />
      );
    case 'skills':
      return (
        <SkillLabPanel
          skills={consoleData.skills}
          rules={consoleData.rules}
          loading={dashboard.loading}
          onPromote={dashboard.handlePromoteSkill}
          onDisable={dashboard.handleDisableSkill}
          onRestoreSkill={dashboard.handleRestoreSkill}
          onRetireSkill={dashboard.handleRetireSkill}
          onInvalidateRule={dashboard.handleInvalidateRule}
          onSupersedeRule={dashboard.handleSupersedeRule}
          onRestoreRule={dashboard.handleRestoreRule}
          onRetireRule={dashboard.handleRetireRule}
        />
      );
    case 'evidence':
      return <EvidenceCenterPanel evidence={consoleData.evidence} />;
    case 'connectors':
      return (
        <ConnectorsCenterPanel
          connectors={consoleData.connectors}
          onSelectTask={dashboard.selectTask}
          onCloseSession={dashboard.handleCloseConnectorSession}
          onRefreshConnectorDiscovery={dashboard.handleRefreshConnectorDiscovery}
          onEnableConnector={dashboard.handleEnableConnector}
          onDisableConnector={dashboard.handleDisableConnector}
          onSetConnectorPolicy={dashboard.handleSetConnectorPolicy}
          onClearConnectorPolicy={dashboard.handleClearConnectorPolicy}
          onSetCapabilityPolicy={dashboard.handleSetCapabilityPolicy}
          onClearCapabilityPolicy={dashboard.handleClearCapabilityPolicy}
          onConfigureConnector={dashboard.handleConfigureConnector}
        />
      );
    case 'skillSources':
      return (
        <SkillSourcesCenterPanel
          skillSources={consoleData.skillSources}
          onSelectTask={dashboard.selectTask}
          onInstallSkill={dashboard.handleInstallSkill}
          onApproveInstall={dashboard.handleApproveSkillInstall}
          onRejectInstall={dashboard.handleRejectSkillInstall}
          onEnableSource={dashboard.handleEnableSkillSource}
          onDisableSource={dashboard.handleDisableSkillSource}
          onSyncSource={dashboard.handleSyncSkillSource}
        />
      );
    case 'companyAgents':
      return (
        <CompanyAgentsPanel
          agents={consoleData.companyAgents}
          onEnableAgent={dashboard.handleEnableCompanyAgent}
          onDisableAgent={dashboard.handleDisableCompanyAgent}
        />
      );
    default:
      return null;
  }
}

function WorkspaceDashboardCenter({ dashboard }: { dashboard: AdminDashboardState }) {
  const consoleData = dashboard.consoleData as
    | ({ workspaceCenter?: WorkspaceCenterRecord } & NonNullable<AdminDashboardState['consoleData']>)
    | null;
  const [workspaceCenter, setWorkspaceCenter] = useState<WorkspaceCenterRecord>(
    () => consoleData?.workspaceCenter ?? EMPTY_WORKSPACE_CENTER
  );

  async function refreshWorkspaceCenter() {
    const nextWorkspaceCenter = await getWorkspaceCenter();
    setWorkspaceCenter(nextWorkspaceCenter);
  }

  useEffect(() => {
    let active = true;

    void getWorkspaceCenter().then(nextWorkspaceCenter => {
      if (active) {
        setWorkspaceCenter(nextWorkspaceCenter);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <WorkspaceCenterPanel
      workspaceCenter={workspaceCenter}
      onApproveDraft={draftId => {
        void approveWorkspaceSkillDraft(draftId).then(async response => {
          await refreshWorkspaceAfterDraftApproval(response, dashboard, refreshWorkspaceCenter);
        });
      }}
      onRejectDraft={draftId => {
        const reason = window.prompt('请输入拒绝原因')?.trim();
        if (!reason) {
          return;
        }
        void rejectWorkspaceSkillDraft(draftId, reason).then(refreshWorkspaceCenter);
      }}
    />
  );
}

export async function refreshWorkspaceAfterDraftApproval(
  response: WorkspaceSkillDraftDecisionResponse,
  dashboard: Pick<AdminDashboardState, 'refreshPageCenter'>,
  refreshWorkspaceCenter: () => Promise<void>
) {
  await refreshWorkspaceCenter();
  if (response.intake?.mode === 'install-candidate') {
    await dashboard.refreshPageCenter('skillSources');
  }
}
