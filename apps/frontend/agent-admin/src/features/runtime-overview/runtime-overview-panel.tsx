import * as React from 'react';

import { RuntimeAnalyticsSection } from './components/runtime-analytics-section';
import { RuntimeArchitecturePanel } from './components/runtime-architecture-panel';
import { RuntimeQueueSection } from './components/runtime-queue-section';
import { RuntimeSummarySection } from './components/runtime-summary-section';
import { RuntimeWorkspaceSwitcher } from './components/runtime-workspace-switcher';
import type { RuntimeOverviewPanelProps, RuntimeOverviewWorkspaceKey } from './components/runtime-overview-types';

export function RuntimeOverviewPanel(props: RuntimeOverviewPanelProps) {
  const [activeWorkspace, setActiveWorkspace] = React.useState<RuntimeOverviewWorkspaceKey>(
    () => props.defaultWorkspace ?? 'queue'
  );

  const workspaceContent =
    activeWorkspace === 'analytics' ? (
      <RuntimeAnalyticsSection
        runtime={props.runtime}
        historyDays={props.historyDays}
        onHistoryDaysChange={props.onHistoryDaysChange}
      />
    ) : activeWorkspace === 'architecture' ? (
      <RuntimeArchitecturePanel />
    ) : (
      <RuntimeQueueSection {...props} />
    );

  return (
    <div className="grid gap-6">
      <RuntimeSummarySection
        runtime={props.runtime}
        executionModeFilter={props.executionModeFilter}
        onExecutionModeFilterChange={props.onExecutionModeFilterChange}
        interactionKindFilter={props.interactionKindFilter}
        onInteractionKindFilterChange={props.onInteractionKindFilterChange}
        onCopyShareLink={props.onCopyShareLink}
        onSelectTask={props.onSelectTask}
        onRetryTask={props.onRetryTask}
        onLaunchWorkflowTask={props.onLaunchWorkflowTask}
        onRefreshRuntime={props.onRefreshRuntime}
        onCreateDiagnosisTask={props.onCreateDiagnosisTask}
        onRevokeApprovalPolicy={props.onRevokeApprovalPolicy}
      />
      <RuntimeWorkspaceSwitcher activeWorkspace={activeWorkspace} onWorkspaceChange={setActiveWorkspace} />
      {workspaceContent}
    </div>
  );
}
