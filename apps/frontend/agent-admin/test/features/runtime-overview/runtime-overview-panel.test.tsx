import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeOverviewPanel } from '@/features/runtime-overview/runtime-overview-panel';

const renderedSummaryProps: Array<Record<string, unknown>> = [];
const renderedAnalyticsProps: Array<Record<string, unknown>> = [];
const renderedQueueProps: Array<Record<string, unknown>> = [];

vi.mock('../../../src/features/runtime-overview/components/runtime-architecture-panel', () => ({
  RuntimeArchitecturePanel: () => <div>architecture panel</div>
}));

vi.mock('../../../src/features/runtime-overview/components/runtime-summary-section', () => ({
  RuntimeSummarySection: (props: Record<string, unknown>) => {
    renderedSummaryProps.push(props);
    return <div>summary section</div>;
  }
}));

vi.mock('../../../src/features/runtime-overview/components/runtime-analytics-section', () => ({
  RuntimeAnalyticsSection: (props: Record<string, unknown>) => {
    renderedAnalyticsProps.push(props);
    return <div>analytics section</div>;
  }
}));

vi.mock('../../../src/features/runtime-overview/components/runtime-queue-section', () => ({
  RuntimeQueueSection: (props: Record<string, unknown>) => {
    renderedQueueProps.push(props);
    return <div>queue section</div>;
  }
}));

describe('RuntimeOverviewPanel composition', () => {
  it('renders architecture, summary, analytics and queue sections together', () => {
    renderedSummaryProps.length = 0;
    renderedAnalyticsProps.length = 0;
    renderedQueueProps.length = 0;

    const onExecutionModeFilterChange = vi.fn();
    const onInteractionKindFilterChange = vi.fn();
    const onCopyShareLink = vi.fn();
    const onSelectTask = vi.fn();
    const onRetryTask = vi.fn();
    const onRefreshRuntime = vi.fn();
    const onCreateDiagnosisTask = vi.fn();
    const onRevokeApprovalPolicy = vi.fn();
    const onHistoryDaysChange = vi.fn();

    const html = renderToStaticMarkup(
      <RuntimeOverviewPanel
        runtime={{} as any}
        bundle={null}
        historyDays={30}
        onHistoryDaysChange={onHistoryDaysChange}
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        modelFilter=""
        onModelFilterChange={vi.fn()}
        pricingSourceFilter=""
        onPricingSourceFilterChange={vi.fn()}
        executionModeFilter="all"
        onExecutionModeFilterChange={onExecutionModeFilterChange}
        interactionKindFilter="all"
        onInteractionKindFilterChange={onInteractionKindFilterChange}
        onCopyShareLink={onCopyShareLink}
        onExport={vi.fn()}
        onSelectTask={onSelectTask}
        onRetryTask={onRetryTask}
        onRefreshRuntime={onRefreshRuntime}
        onCreateDiagnosisTask={onCreateDiagnosisTask}
        onRevokeApprovalPolicy={onRevokeApprovalPolicy}
      />
    );

    expect(html).toContain('architecture panel');
    expect(html).toContain('summary section');
    expect(html).toContain('analytics section');
    expect(html).toContain('queue section');

    expect(renderedSummaryProps[0]).toEqual(
      expect.objectContaining({
        executionModeFilter: 'all',
        interactionKindFilter: 'all',
        onExecutionModeFilterChange,
        onInteractionKindFilterChange,
        onCopyShareLink,
        onSelectTask,
        onRetryTask,
        onRefreshRuntime,
        onCreateDiagnosisTask,
        onRevokeApprovalPolicy
      })
    );
    expect(renderedAnalyticsProps[0]).toEqual(
      expect.objectContaining({
        historyDays: 30,
        onHistoryDaysChange
      })
    );
    expect(renderedQueueProps[0]).toEqual(
      expect.objectContaining({
        historyDays: 30,
        executionModeFilter: 'all',
        interactionKindFilter: 'all'
      })
    );
  });
});
