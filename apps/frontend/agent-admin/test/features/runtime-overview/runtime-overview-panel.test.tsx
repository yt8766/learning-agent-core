import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeOverviewPanel } from '@/features/runtime-overview/runtime-overview-panel';

vi.mock('../../../src/features/runtime-overview/components/runtime-architecture-panel', () => ({
  RuntimeArchitecturePanel: () => <div>architecture panel</div>
}));

vi.mock('../../../src/features/runtime-overview/components/runtime-summary-section', () => ({
  RuntimeSummarySection: () => <div>summary section</div>
}));

vi.mock('../../../src/features/runtime-overview/components/runtime-analytics-section', () => ({
  RuntimeAnalyticsSection: () => <div>analytics section</div>
}));

vi.mock('../../../src/features/runtime-overview/components/runtime-queue-section', () => ({
  RuntimeQueueSection: () => <div>queue section</div>
}));

describe('RuntimeOverviewPanel composition', () => {
  it('renders architecture, summary, analytics and queue sections together', () => {
    const html = renderToStaticMarkup(
      <RuntimeOverviewPanel
        runtime={{} as any}
        bundle={null}
        historyDays={30}
        onHistoryDaysChange={vi.fn()}
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
        onRetryTask={vi.fn()}
        onRefreshRuntime={vi.fn()}
        onCreateDiagnosisTask={vi.fn()}
        onRevokeApprovalPolicy={vi.fn()}
      />
    );

    expect(html).toContain('architecture panel');
    expect(html).toContain('summary section');
    expect(html).toContain('analytics section');
    expect(html).toContain('queue section');
  });
});
