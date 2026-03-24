import { RuntimeAnalyticsSection } from './components/runtime-analytics-section';
import { RuntimeQueueSection } from './components/runtime-queue-section';
import { RuntimeSummarySection } from './components/runtime-summary-section';
import type { RuntimeOverviewPanelProps } from './components/runtime-overview-types';

export function RuntimeOverviewPanel(props: RuntimeOverviewPanelProps) {
  return (
    <div className="grid gap-6">
      <RuntimeSummarySection runtime={props.runtime} />
      <RuntimeAnalyticsSection
        runtime={props.runtime}
        historyDays={props.historyDays}
        onHistoryDaysChange={props.onHistoryDaysChange}
      />
      <RuntimeQueueSection {...props} />
    </div>
  );
}
