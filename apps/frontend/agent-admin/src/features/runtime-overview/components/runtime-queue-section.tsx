import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import { RuntimeQueueRunList } from './runtime-queue-run-list';
import { RuntimeQueueSelectedRun } from './runtime-queue-selected-run';
export { buildCriticalPathSummary, buildTraceView, buildTraceWaterfallRows } from './runtime-queue-section-support';

export function RuntimeQueueSection(props: RuntimeOverviewPanelProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
      <RuntimeQueueRunList {...props} />
      <RuntimeQueueSelectedRun
        bundle={props.bundle}
        statusFilter={props.statusFilter}
        modelFilter={props.modelFilter}
        pricingSourceFilter={props.pricingSourceFilter}
        executionModeFilter={props.executionModeFilter}
        interactionKindFilter={props.interactionKindFilter}
        observatoryFocusTarget={props.observatoryFocusTarget}
        onObservatoryFocusTargetChange={props.onObservatoryFocusTargetChange}
        compareTaskId={props.compareTaskId}
        onCompareTaskIdChange={props.onCompareTaskIdChange}
        graphNodeId={props.graphNodeId}
        onGraphNodeIdChange={props.onGraphNodeIdChange}
        replayLaunchReceipt={props.replayLaunchReceipt}
        onRetryTask={props.onRetryTask}
        onLaunchWorkflowTask={props.onLaunchWorkflowTask}
      />
    </div>
  );
}
