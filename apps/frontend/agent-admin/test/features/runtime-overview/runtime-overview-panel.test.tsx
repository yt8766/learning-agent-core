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
  it('renders the summary section with the queue workspace by default', () => {
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
        observatoryFocusTarget={undefined}
        onObservatoryFocusTargetChange={vi.fn()}
        compareTaskId={undefined}
        onCompareTaskIdChange={vi.fn()}
        graphNodeId={undefined}
        onGraphNodeIdChange={vi.fn()}
        onRetryTask={onRetryTask}
        onLaunchWorkflowTask={vi.fn()}
        onRefreshRuntime={onRefreshRuntime}
        onCreateDiagnosisTask={onCreateDiagnosisTask}
        onRevokeApprovalPolicy={onRevokeApprovalPolicy}
      />
    );

    expect(html).toContain('summary section');
    expect(html).toContain('queue section');
    expect(html).not.toContain('architecture panel');
    expect(html).not.toContain('analytics section');
    expect(html).toContain('运行队列');
    expect(html).toContain('运行分析');
    expect(html).toContain('架构视图');

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
    expect(renderedAnalyticsProps).toEqual([]);
    expect(renderedQueueProps[0]).toEqual(
      expect.objectContaining({
        historyDays: 30,
        executionModeFilter: 'all',
        interactionKindFilter: 'all'
      })
    );
  });

  it('renders the selected workspace panel when a non-default workspace is requested', () => {
    renderedSummaryProps.length = 0;
    renderedAnalyticsProps.length = 0;
    renderedQueueProps.length = 0;

    const onHistoryDaysChange = vi.fn();

    const html = renderToStaticMarkup(
      <RuntimeOverviewPanel
        runtime={{} as any}
        bundle={null}
        historyDays={14}
        onHistoryDaysChange={onHistoryDaysChange}
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        modelFilter=""
        onModelFilterChange={vi.fn()}
        pricingSourceFilter=""
        onPricingSourceFilterChange={vi.fn()}
        executionModeFilter="all"
        onExecutionModeFilterChange={vi.fn()}
        interactionKindFilter="all"
        onInteractionKindFilterChange={vi.fn()}
        onCopyShareLink={vi.fn()}
        onExport={vi.fn()}
        onSelectTask={vi.fn()}
        observatoryFocusTarget={undefined}
        onObservatoryFocusTargetChange={vi.fn()}
        compareTaskId={undefined}
        onCompareTaskIdChange={vi.fn()}
        graphNodeId={undefined}
        onGraphNodeIdChange={vi.fn()}
        onRetryTask={vi.fn()}
        onLaunchWorkflowTask={vi.fn()}
        onRefreshRuntime={vi.fn()}
        onCreateDiagnosisTask={vi.fn()}
        onRevokeApprovalPolicy={vi.fn()}
        defaultWorkspace="analytics"
      />
    );

    expect(html).toContain('summary section');
    expect(html).toContain('analytics section');
    expect(html).not.toContain('queue section');
    expect(renderedQueueProps).toEqual([]);
    expect(renderedAnalyticsProps[0]).toEqual(
      expect.objectContaining({
        historyDays: 14,
        onHistoryDaysChange
      })
    );
  });
});
