import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const runtimeSummaryTestState = vi.hoisted(() => ({
  stateQueue: [] as Array<{ value: unknown; setter?: (...args: unknown[]) => void }>,
  getChannelDeliveries: vi.fn<() => Promise<Array<{ id: string }>>>(async () => []),
  getAgentToolExecutionProjection: vi.fn<() => Promise<{ requests: Array<{ id: string }> }>>(async () => ({
    requests: []
  })),
  isAbortedAdminRequestError: vi.fn<(error: unknown) => boolean>(() => false),
  cleanups: [] as Array<() => void>
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      const next = runtimeSummaryTestState.stateQueue.shift();
      return [next?.value ?? initialValue, next?.setter ?? vi.fn()];
    }) as typeof actual.useState,
    useMemo: ((factory: () => unknown) => factory()) as typeof actual.useMemo,
    useEffect: ((effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === 'function') {
        runtimeSummaryTestState.cleanups.push(cleanup);
      }
    }) as typeof actual.useEffect
  };
});

vi.mock('@/api/admin-api', () => ({
  getChannelDeliveries: () => runtimeSummaryTestState.getChannelDeliveries(),
  getAgentToolExecutionProjection: () => runtimeSummaryTestState.getAgentToolExecutionProjection(),
  isAbortedAdminRequestError: (error: unknown) => runtimeSummaryTestState.isAbortedAdminRequestError(error)
}));

vi.mock('@/pages/runtime-overview/components/runtime-summary-overview', () => ({
  RuntimeSummaryOverview: () => <div>overview-block</div>
}));
vi.mock('@/pages/runtime-overview/components/runtime-workflow-catalog-card', () => ({
  RuntimeWorkflowCatalogCard: () => <div>workflow-catalog-block</div>
}));
vi.mock('@/pages/runtime-overview/components/runtime-summary-budget', () => ({
  RuntimeSummaryBudget: () => <div>budget-block</div>
}));
vi.mock('@/pages/runtime-overview/components/runtime-summary-governance', () => ({
  RuntimeSummaryGovernance: () => <div>governance-block</div>
}));
vi.mock('@/pages/runtime-overview/components/runtime-summary-tools', () => ({
  RuntimeSummaryTools: (props: any) => (
    <div data-agent-tool-request-count={String(props.agentToolExecutions?.requests?.length ?? 0)}>tools-block</div>
  )
}));
vi.mock('@/pages/runtime-overview/components/runtime-summary-agent-errors', () => ({
  RuntimeSummaryAgentErrors: (props: any) => (
    <div
      data-error-codes={props.errorCodeOptions.join(',')}
      data-filtered-count={String(props.filteredAgentErrors.length)}
      data-ministries={props.ministryOptions.join(',')}
    >
      agent-errors-block
    </div>
  )
}));
vi.mock('@/pages/runtime-overview/components/runtime-summary-visuals', () => ({
  RuntimeSummaryVisuals: () => <div>visuals-block</div>
}));
vi.mock('@/pages/runtime-overview/components/runtime-summary-channel-deliveries', () => ({
  RuntimeSummaryChannelDeliveries: ({ channelDeliveries }: { channelDeliveries: Array<{ id: string }> }) => (
    <div data-channel-deliveries={channelDeliveries.map(item => item.id).join(',') || 'empty'}>
      channel-deliveries-block
    </div>
  )
}));

import { RuntimeSummarySection } from '@/pages/runtime-overview/components/runtime-summary-section';

function buildProps() {
  return {
    runtime: {
      taskCount: 8,
      activeTaskCount: 2,
      pendingApprovalCount: 1,
      recentAgentErrors: [
        { id: 'err-1', errorCode: 'provider_timeout', ministry: 'gongbu-code', retryable: true },
        { id: 'err-2', errorCode: 'provider_timeout', ministry: 'xingbu-review', retryable: false },
        { id: 'err-3', errorCode: 'empty_output', ministry: undefined, retryable: true }
      ]
    } as any,
    executionModeFilter: 'all' as const,
    onExecutionModeFilterChange: vi.fn(),
    interactionKindFilter: 'all' as const,
    onInteractionKindFilterChange: vi.fn(),
    onCopyShareLink: vi.fn(),
    onLaunchWorkflowTask: vi.fn(),
    onSelectTask: vi.fn(),
    onRetryTask: vi.fn(),
    onRefreshRuntime: vi.fn(),
    onCreateDiagnosisTask: vi.fn(),
    onRevokeApprovalPolicy: vi.fn()
  };
}

function resetHarness() {
  runtimeSummaryTestState.stateQueue.length = 0;
  runtimeSummaryTestState.cleanups.length = 0;
  runtimeSummaryTestState.getChannelDeliveries.mockReset();
  runtimeSummaryTestState.getChannelDeliveries.mockResolvedValue([]);
  runtimeSummaryTestState.getAgentToolExecutionProjection.mockReset();
  runtimeSummaryTestState.getAgentToolExecutionProjection.mockResolvedValue({ requests: [] });
  runtimeSummaryTestState.isAbortedAdminRequestError.mockReset();
  runtimeSummaryTestState.isAbortedAdminRequestError.mockReturnValue(false);
}

afterEach(() => {
  resetHarness();
  vi.clearAllMocks();
});

describe('RuntimeSummarySection', () => {
  it('renders summary sub-sections, computes options, and loads channel deliveries', async () => {
    const setChannelDeliveries = vi.fn();
    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: '' },
      { value: [], setter: setChannelDeliveries },
      { value: undefined }
    );
    runtimeSummaryTestState.getChannelDeliveries.mockResolvedValue([{ id: 'delivery-1' }]);

    const html = renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);
    await Promise.resolve();
    await Promise.resolve();

    expect(html).toContain('overview-block');
    expect(html).toContain('workflow-catalog-block');
    expect(html).toContain('budget-block');
    expect(html).toContain('governance-block');
    expect(html).toContain('tools-block');
    expect(html).toContain('agent-errors-block');
    expect(html).toContain('visuals-block');
    expect(html).toContain('data-error-codes="provider_timeout,empty_output"');
    expect(html).toContain('data-ministries="gongbu-code,xingbu-review"');
    expect(html).toContain('data-filtered-count="3"');
    expect(html).toContain('data-channel-deliveries="empty"');
    expect(runtimeSummaryTestState.getChannelDeliveries).toHaveBeenCalledTimes(1);
    expect(runtimeSummaryTestState.getAgentToolExecutionProjection).toHaveBeenCalledTimes(1);
    expect(setChannelDeliveries).toHaveBeenCalledWith([{ id: 'delivery-1' }]);
  });

  it('passes loaded agent-tools projection to tools summary', async () => {
    const setAgentToolExecutionProjection = vi.fn();
    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: '' },
      { value: [] },
      { value: undefined, setter: setAgentToolExecutionProjection }
    );
    runtimeSummaryTestState.getAgentToolExecutionProjection.mockResolvedValue({
      requests: [{ id: 'req-projection' }]
    });

    const html = renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);
    await Promise.resolve();
    await Promise.resolve();

    expect(html).toContain('data-agent-tool-request-count="0"');
    expect(runtimeSummaryTestState.getAgentToolExecutionProjection).toHaveBeenCalledTimes(1);
    expect(setAgentToolExecutionProjection).toHaveBeenCalledWith({
      requests: [{ id: 'req-projection' }]
    });
  });

  it('filters recent agent errors by error code, ministry, and retryability', () => {
    runtimeSummaryTestState.stateQueue.push(
      { value: 'provider_timeout' },
      { value: 'xingbu-review' },
      { value: 'fatal' },
      { value: [] },
      { value: undefined }
    );

    const html = renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);

    expect(html).toContain('data-filtered-count="1"');
    expect(html).toContain('data-error-codes="provider_timeout,empty_output"');
    expect(html).toContain('data-ministries="gongbu-code,xingbu-review"');
  });

  it('filters retryable and fatal errors through their dedicated branches', () => {
    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: 'retryable' },
      { value: [] },
      { value: undefined }
    );
    const retryableHtml = renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);

    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: 'fatal' },
      { value: [] },
      { value: undefined }
    );
    const fatalHtml = renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);

    expect(retryableHtml).toContain('data-filtered-count="2"');
    expect(fatalHtml).toContain('data-filtered-count="1"');
  });

  it('falls back to empty channel deliveries for non-aborted request failures', async () => {
    const setChannelDeliveries = vi.fn();
    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: '' },
      { value: [], setter: setChannelDeliveries },
      { value: undefined }
    );
    runtimeSummaryTestState.getChannelDeliveries.mockRejectedValue(new Error('network failed'));
    runtimeSummaryTestState.isAbortedAdminRequestError.mockReturnValue(false);

    renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);
    await Promise.resolve();
    await Promise.resolve();

    expect(setChannelDeliveries).toHaveBeenCalledWith([]);
    expect(runtimeSummaryTestState.isAbortedAdminRequestError).toHaveBeenCalled();
  });

  it('ignores aborted request failures when loading channel deliveries', async () => {
    const setChannelDeliveries = vi.fn();
    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: '' },
      { value: [], setter: setChannelDeliveries },
      { value: undefined }
    );
    runtimeSummaryTestState.getChannelDeliveries.mockRejectedValue(new Error('aborted'));
    runtimeSummaryTestState.isAbortedAdminRequestError.mockReturnValue(true);

    renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);
    await Promise.resolve();
    await Promise.resolve();

    expect(setChannelDeliveries).not.toHaveBeenCalled();
    expect(runtimeSummaryTestState.isAbortedAdminRequestError).toHaveBeenCalled();
  });

  it('does not commit late channel deliveries after cleanup marks the effect as cancelled', async () => {
    let resolveDeliveries: ((value: Array<{ id: string }>) => void) | undefined;
    const pendingDeliveries: Promise<Array<{ id: string }>> = new Promise(resolve => {
      resolveDeliveries = resolve;
    });
    const setChannelDeliveries = vi.fn();
    runtimeSummaryTestState.stateQueue.push(
      { value: '' },
      { value: '' },
      { value: '' },
      { value: [], setter: setChannelDeliveries },
      { value: undefined }
    );
    runtimeSummaryTestState.getChannelDeliveries.mockReturnValue(pendingDeliveries);

    renderToStaticMarkup(<RuntimeSummarySection {...buildProps()} />);
    expect(runtimeSummaryTestState.cleanups).toHaveLength(2);

    runtimeSummaryTestState.cleanups.forEach(cleanup => cleanup());
    resolveDeliveries?.([{ id: 'delivery-late' }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(setChannelDeliveries).not.toHaveBeenCalled();
  });
});
