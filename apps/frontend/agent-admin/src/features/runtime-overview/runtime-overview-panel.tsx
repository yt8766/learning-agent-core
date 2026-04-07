import { RuntimeAnalyticsSection } from './components/runtime-analytics-section';
import { RuntimeArchitecturePanel } from './components/runtime-architecture-panel';
import { RuntimeQueueSection } from './components/runtime-queue-section';
import { RuntimeSummarySection } from './components/runtime-summary-section';
import type { RuntimeOverviewPanelProps } from './components/runtime-overview-types';

export function RuntimeOverviewPanel(props: RuntimeOverviewPanelProps) {
  return (
    <div className="grid gap-6">
      <RuntimeArchitecturePanel />
      <RuntimeSummarySection
        runtime={props.runtime}
        executionModeFilter={props.executionModeFilter}
        onExecutionModeFilterChange={props.onExecutionModeFilterChange}
        interactionKindFilter={props.interactionKindFilter}
        onInteractionKindFilterChange={props.onInteractionKindFilterChange}
        onCopyShareLink={props.onCopyShareLink}
        onSelectTask={props.onSelectTask}
        onRetryTask={props.onRetryTask}
        onRefreshRuntime={props.onRefreshRuntime}
        onCreateDiagnosisTask={props.onCreateDiagnosisTask}
        onRevokeApprovalPolicy={props.onRevokeApprovalPolicy}
      />
      <RuntimeAnalyticsSection
        runtime={props.runtime}
        historyDays={props.historyDays}
        onHistoryDaysChange={props.onHistoryDaysChange}
      />
      <RuntimeQueueSection {...props} />
    </div>
  );
}
